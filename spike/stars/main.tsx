/**
 * R111 (FR-STAR-12, D-740): the stars spike. One window-shaped field over the
 * whole viewport, the camera from the hand (drag, arrows) or the sensor, the
 * rate meter in the corner, and every knob a link (params.ts). The catalogue
 * is the one `catalog.ts` wrote into `.sdd-cache/spike-stars/`.
 *
 *   npm run spike:stars   →  https://<LAN address>:5173/spike/stars/
 */
import '../../src/ui/styles/tokens.css';
import './stars.css';
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { compassPoint } from '../../src/lib/compass';
import { DRAG_PX_PER_DEG, PITCH_STEP_DEG, YAW_STEP_DEG } from '../../src/ui/components/guide/skychart/dome/camera';
import {
  alphaFor,
  lookDirection,
  rotationMatrix,
  smoothRotation,
  uprightRotation,
  windowReadingFrom,
  WINDOW_SMOOTHING,
  type Mat3,
  type View,
} from '../../src/ui/components/guide/skychart/window/projection';
import { listen, RateMeter, requestOrientation, type PermissionState, type SensorStats } from '../window/sensors';
import type { Catalog } from './catalogData';
import { ReactField, RefField, type RefFieldHandle } from './Field';
import { labelsFor, ladderFor } from './frame';
import { defaultFacing, LAYERS, readStarsParams, starsQuery, type Layer, type StarsParams } from './params';
import { planetsAt, starsAt } from './sky';

const TILT_MIN = -10;
const TILT_MAX = 90;
const clampTilt = (t: number): number => Math.max(TILT_MIN, Math.min(TILT_MAX, t));

export interface SweepResult {
  seconds: number;
  draws: number;
  drawsPerSecond: number;
  longestGapMs: number;
}

declare global {
  interface Window {
    __stars?: { ready: boolean; nodes: number; sweep: (seconds: number) => Promise<SweepResult>; ink: typeof inkOffset };
  }
}

/**
 * The ink centre of a glyph against the em box's centre, from the canvas's text metrics in the page's own
 * monospace face (`--font-mono`): what `dominant-baseline: central` and `text-anchor: middle` leave over.
 */
const inkCache = new Map<string, { x: number; y: number }>();
export function inkOffset(char: string, px: number): { x: number; y: number } {
  const key = `${char}@${String(px)}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return { x: 0, y: 0 };
  ctx.font = `${String(px)}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const m = ctx.measureText(char);
  const off = { x: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y: (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 };
  inkCache.set(key, off);
  return off;
}

const link = (p: StarsParams, change: Partial<StarsParams>): string => `?${starsQuery({ ...p, ...change })}`;

function useViewSize(fovDeg: number): View {
  const read = (): View => ({ fovDeg, width: window.innerWidth, height: window.innerHeight, screenAngleDeg: screen.orientation.angle });
  const [view, setView] = useState(read);
  useEffect(() => {
    const update = (): void => {
      setView(read());
    };
    window.addEventListener('resize', update);
    screen.orientation.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      screen.orientation.removeEventListener('change', update);
    };
    // `read` closes over fovDeg only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fovDeg]);
  return view;
}

function App({ catalog, params }: { catalog: Catalog; params: StarsParams }): ReactElement {
  const view = useViewSize(params.fov);
  const [now, setNow] = useState(() => (params.at === null ? Date.now() : Date.parse(params.at)));
  useEffect(() => {
    if (params.at !== null) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [params.at]);
  // One rotation per shown instant (FR-STAR-2): the positions change once a second, never per frame.
  const stars = useMemo(() => starsAt(catalog.stars, params.lat, params.lon, new Date(now)), [catalog, params.lat, params.lon, now]);
  const planets = useMemo(() => planetsAt(params.lat, params.lon, new Date(now)), [params.lat, params.lon, now]);
  const labels = useMemo(() => labelsFor(catalog), [catalog]);
  const ladder = useMemo(() => ladderFor(catalog, params.big, params.small, params.dot, params.inkfix ? inkOffset : null), [catalog, params.big, params.small, params.dot, params.inkfix]);
  const options = useMemo(() => ({ mag: params.mag, small: params.small, collide: params.collide, layers: params.layers }), [params]);

  // The camera: one rotation whatever drives it (FR-STAR-4, FR-STAR-11).
  const [opening] = useState(() => uprightRotation(params.facing ?? defaultFacing(params.lat), params.tilt));
  const hand = useRef({ az: params.facing ?? defaultFacing(params.lat), alt: params.tilt });
  const rotationRef = useRef<Mat3>(opening);
  const [rotation, setRotation] = useState<Mat3>(opening);
  const field = useRef<RefFieldHandle>(null);
  const pending = useRef(false);
  const meter = useMemo(() => new RateMeter(), []);
  const counter = useRef({ draws: 0, last: 0, gap: 0 });

  const onDrawn = useCallback(() => {
    const t = performance.now();
    meter.draw(t);
    const c = counter.current;
    if (c.last > 0) c.gap = Math.max(c.gap, t - c.last);
    c.last = t;
    c.draws += 1;
  }, [meter]);

  // One update per animation frame, whichever path draws it.
  const push = useCallback(
    (next: Mat3) => {
      rotationRef.current = next;
      if (pending.current) return;
      pending.current = true;
      requestAnimationFrame(() => {
        pending.current = false;
        if (params.render === 'ref') field.current?.draw(rotationRef.current);
        else setRotation(rotationRef.current);
      });
    },
    [params.render],
  );

  // The ref path redraws when the instant or the size changes; React does it by props.
  useEffect(() => {
    if (params.render === 'ref') field.current?.draw(rotationRef.current);
  }, [params.render, stars, planets, view]);

  const turn = useCallback(
    (dAz: number, dAlt: number) => {
      const h = hand.current;
      h.az = (((h.az + dAz) % 360) + 360) % 360;
      h.alt = clampTilt(h.alt + dAlt);
      push(uprightRotation(h.az, h.alt));
    },
    [push],
  );

  // The hand: a drag at the dome's rate, the arrows at its steps.
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (params.source !== 'hand') return;
    const key = (e: KeyboardEvent): void => {
      const steps: Record<string, [number, number]> = { ArrowLeft: [-YAW_STEP_DEG, 0], ArrowRight: [YAW_STEP_DEG, 0], ArrowUp: [0, PITCH_STEP_DEG], ArrowDown: [0, -PITCH_STEP_DEG] };
      const step = steps[e.key];
      if (!step) return;
      e.preventDefault();
      turn(step[0], step[1]);
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
    };
  }, [params.source, turn]);

  // The sensor: R38's path, smoothed, the screen angle from the reading.
  const [permission, setPermission] = useState<PermissionState | 'idle'>('idle');
  const smoothed = useRef<Mat3 | null>(null);
  const [screenAngle, setScreenAngle] = useState(0);
  const startSensor = useCallback(async () => {
    setPermission('pending');
    const state = await requestOrientation();
    setPermission(state);
    if (state !== 'granted' && state !== 'not-needed') return;
    listen((raw) => {
      meter.event(raw.at);
      const reading = windowReadingFrom(raw as unknown as DeviceOrientationEvent);
      const alpha = alphaFor(reading, null, 0);
      if (alpha === null || raw.beta === null || raw.gamma === null) return;
      smoothed.current = smoothRotation(smoothed.current, rotationMatrix(alpha, raw.beta, raw.gamma), WINDOW_SMOOTHING);
      setScreenAngle(raw.screenAngle);
      push(smoothed.current);
    });
  }, [meter, push]);

  // The proxy measurement (D-62's method): turn the camera every frame for `seconds` and count what was drawn.
  useEffect(() => {
    window.__stars = {
      ready: true,
      ink: inkOffset,
      nodes: catalog.stars.length + planets.length + labels.length + catalog.figures.reduce((n, f) => n + f.segments.length, 0),
      sweep: (seconds: number) =>
        new Promise<SweepResult>((done) => {
          counter.current = { draws: 0, last: 0, gap: 0 };
          const end = performance.now() + seconds * 1000;
          const step = (): void => {
            if (performance.now() >= end) {
              const c = counter.current;
              done({ seconds, draws: c.draws, drawsPerSecond: c.draws / seconds, longestGapMs: Math.round(c.gap) });
              return;
            }
            turn(0.6, 0);
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
    };
  }, [catalog, planets.length, labels.length, turn]);

  const [stats, setStats] = useState<SensorStats | null>(null);
  const [look, setLook] = useState(() => lookDirection(opening));
  useEffect(() => {
    const id = setInterval(() => {
      setStats(meter.stats());
      setLook(lookDirection(rotationRef.current));
    }, 250);
    return () => {
      clearInterval(id);
    };
  }, [meter]);

  const shownView = useMemo(() => ({ ...view, screenAngleDeg: params.source === 'sensor' ? screenAngle : view.screenAngleDeg }), [view, params.source, screenAngle]);
  const fieldProps = { catalog, stars, planets, labels, ladder, view: shownView, mark: params.mark, options, onDrawn };
  const toggle = (layer: Layer): readonly Layer[] => (params.layers.includes(layer) ? params.layers.filter((l) => l !== layer) : LAYERS.filter((l) => l === layer || params.layers.includes(l)));

  return (
    <main
      className="page"
      onPointerDown={(e) => {
        if (params.source !== 'hand' || (e.target as Element).closest('.panel')) return;
        drag.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        turn(-(e.clientX - d.x) / DRAG_PX_PER_DEG, (e.clientY - d.y) / DRAG_PX_PER_DEG);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      {params.render === 'ref' ? <RefField ref={field} {...fieldProps} /> : <ReactField {...fieldProps} rotation={rotation} />}
      <div className="readout">
        <div>
          Facing {compassPoint(look.azDeg)} · {Math.round(look.altDeg)}° up · {params.site ?? `${params.lat.toFixed(2)}, ${params.lon.toFixed(2)}`}
        </div>
        <div>
          {stats ? `${String(stats.drawsPerSecond)} draws/s · ${String(stats.eventsPerSecond)} events/s · gap ${String(stats.longestGapMs)} ms` : '…'} · {params.render}/{params.mark} ·{' '}
          {String(window.__stars?.nodes ?? 0)} nodes
        </div>
      </div>
      <nav className="panel">
        <a href={link(params, { render: params.render === 'react' ? 'ref' : 'react' })}>[ render: {params.render} ]</a>
        <a href={link(params, { mark: params.mark === 'glyph' ? 'disc' : 'glyph' })}>[ mark: {params.mark} ]</a>
        <a href={link(params, { source: params.source === 'hand' ? 'sensor' : 'hand' })}>[ camera: {params.source} ]</a>
        {LAYERS.map((layer) => (
          <a key={layer} href={link(params, { layers: toggle(layer) })}>
            [{params.layers.includes(layer) ? 'x' : ' '}] {layer}
          </a>
        ))}
        <button
          type="button"
          onClick={() => {
            navigator.geolocation.getCurrentPosition((pos) => {
              location.search = link(params, { site: null, lat: Number(pos.coords.latitude.toFixed(3)), lon: Number(pos.coords.longitude.toFixed(3)) });
            });
          }}
        >
          [ here ]
        </button>
        {params.source === 'sensor' && permission !== 'granted' && permission !== 'not-needed' ? (
          <button type="button" onClick={() => void startSensor()}>
            [ start sensor ]{permission === 'idle' ? '' : ` (${permission})`}
          </button>
        ) : null}
      </nav>
    </main>
  );
}

async function start(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;
  const params = readStarsParams(location.search);
  const response = await fetch('/.sdd-cache/spike-stars/catalog.objects.json');
  if (!response.ok) {
    root.textContent = 'No catalogue: run `npx tsx spike/stars/catalog.ts` first (npm run spike:stars does).';
    return;
  }
  const catalog = (await response.json()) as Catalog;
  createRoot(root).render(
    <StrictMode>
      <App catalog={catalog} params={params} />
    </StrictMode>,
  );
}

void start();
