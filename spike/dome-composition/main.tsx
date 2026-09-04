/**
 * R16 spike page (FR-DOME-8, PLAN §8.7): the layered dome with every knob on
 * the URL. Dev only — `vite build` bundles the root `index.html` only, so
 * `dist/` never contains this page.
 *
 *   /spike/dome-composition/?pass=high&tilt=50&base=0&tol=128
 *
 * The controls write the same parameters back to the URL, so a composition
 * found by hand is a link. `?candidate=<name>` loads one of `candidates.ts`.
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { en } from '../../src/i18n/en';
import { drag as dragCamera, initialFor, readoutParams, tilt as tiltCamera, turn, type CameraState } from '../../src/ui/components/guide/skychart/dome/camera';
import { installPerf } from '../perf';
import { CANDIDATES, candidate } from './candidates';
import { passFor } from './fixtures';
import { DEFAULT_ADVANCE, LayeredDome } from './LayeredDome';
import { paletteFor } from './palette';
import { DEFAULTS, read, toQuery, type Params } from './params';
import './dome-composition.css';

const TIME_ZONE = 'America/Argentina/Salta';
const clock = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });

/** The advance of one glyph as a fraction of the font size, measured in the font the layer uses. */
function measureAdvance(text: string, family: string): number {
  const probe = document.createElement('span');
  probe.textContent = text.repeat(20);
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:100px';
  probe.style.fontFamily = family;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width > 0 ? width / 20 / 100 : DEFAULT_ADVANCE;
}

function initialParams(): Params {
  const q = new URLSearchParams(window.location.search);
  const named = q.get('candidate');
  const base = named ? candidate(named)?.params : undefined;
  const fromUrl = read(window.location.search);
  if (!base) return fromUrl;
  // A named candidate is the starting point; any other parameter on the URL overrides it.
  const overrides = read(`?${new URLSearchParams([...q.entries()].filter(([k]) => k !== 'candidate')).toString()}`);
  const patched: Record<string, unknown> = { ...base };
  for (const key of Object.keys(DEFAULTS) as (keyof Params)[]) {
    if (overrides[key] !== DEFAULTS[key]) patched[key] = overrides[key];
  }
  return patched as unknown as Params;
}

type Knob = { key: keyof Params; kind: 'number'; step?: number } | { key: keyof Params; kind: 'bool' } | { key: keyof Params; kind: 'enum'; options: readonly string[] };

const KNOBS: readonly Knob[] = [
  { key: 'pass', kind: 'enum', options: ['golden', 'high'] },
  { key: 'theme', kind: 'enum', options: ['dark', 'night'] },
  { key: 'colorSet', kind: 'enum', options: ['cool', 'warm', 'mono'] },
  { key: 'meridians', kind: 'enum', options: ['none', 'cardinal', 'eight', 'sixteen'] },
  { key: 'encoding', kind: 'enum', options: ['spans', 'atlas'] },
  { key: 'tilt', kind: 'number', step: 5 },
  { key: 'width', kind: 'number', step: 10 },
  { key: 'cols', kind: 'number', step: 10 },
  { key: 'basePalette', kind: 'enum', options: ['default', 'blocks', 'dots', 'ascii', 'lines', 'stars', 'math'] },
  { key: 'baseRatio', kind: 'number', step: 0.05 },
  { key: 'groundRadius', kind: 'number', step: 0.05 },
  { key: 'ambient', kind: 'number', step: 0.05 },
  { key: 'key', kind: 'number', step: 0.05 },
  { key: 'sunAlt', kind: 'number', step: 1 },
  { key: 'sunAz', kind: 'number', step: 5 },
  { key: 'horizonWeight', kind: 'number', step: 0.05 },
  { key: 'ringWeight', kind: 'number', step: 0.05 },
  { key: 'meridianWeight', kind: 'number', step: 0.05 },
  { key: 'passWeight', kind: 'number', step: 0.05 },
  { key: 'dimWeight', kind: 'number', step: 0.05 },
  { key: 'passDensity', kind: 'number', step: 1 },
  { key: 'tol', kind: 'number', step: 16 },
  { key: 'downscale', kind: 'number', step: 1 },
  { key: 'pulseHz', kind: 'number', step: 5 },
  { key: 'now', kind: 'number', step: 0.05 },
  { key: 'others', kind: 'number', step: 1 },
  { key: 'moonAlt', kind: 'number', step: 5 },
  { key: 'moonAz', kind: 'number', step: 5 },
  { key: 'moonPhase', kind: 'number', step: 0.05 },
  { key: 'base', kind: 'bool' },
  { key: 'bowl', kind: 'bool' },
  { key: 'ground', kind: 'bool' },
  { key: 'colors', kind: 'bool' },
  { key: 'ticks', kind: 'bool' },
  { key: 'ringLabels', kind: 'bool' },
  { key: 'timeLabels', kind: 'bool' },
  { key: 'moon', kind: 'bool' },
  { key: 'pulse', kind: 'bool' },
  { key: 'dropBaseOnDrag', kind: 'bool' },
];

interface DomeViewProps {
  params: Params;
  advances: { braille: number; mono: number };
}

/**
 * The drawing and its camera. The parent gives it a key built from the
 * fixture, the facing and the tilt, so a knob change resets the camera the
 * React way instead of through an effect.
 */
function DomeView({ params, advances }: DomeViewProps) {
  const [camera, setCamera] = useState<CameraState>(() => ({ ...initialFor(passFor(params.pass), params.facing ?? undefined), tiltDeg: params.tilt }));
  const [dragging, setDragging] = useState(false);
  const [pulse, setPulse] = useState(0);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const palette = paletteFor(params.colorSet, params.theme);

  // FR-DOME-8d: the pulse ticks at its own rate, not at the frame rate.
  useEffect(() => {
    if (!params.pulse) return;
    let frame = 0;
    let last = 0;
    const period = 1000 / Math.max(1, params.pulseHz);
    const tick = (t: number) => {
      if (t - last >= period) {
        last = t;
        setPulse((t % 2000) / 2000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [params.pulse, params.pulseHz]);

  useEffect(() => {
    window.__domeCamera = { rotX: camera.tiltDeg, rotY: camera.facingAzDeg };
  }, [camera]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const active = dragRef.current;
    if (!active || active.id !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.x = event.clientX;
    active.y = event.clientY;
    setCamera((state) => dragCamera(state, dx, dy));
  };
  const endDrag = (): void => {
    dragRef.current = null;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, (state: CameraState) => CameraState> = {
      ArrowLeft: (s) => turn(s, -15),
      ArrowRight: (s) => turn(s, 15),
      ArrowUp: (s) => tiltCamera(s, 5),
      ArrowDown: (s) => tiltCamera(s, -5),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setCamera(move);
  };

  return (
    <div id="stage" style={{ width: `${String(params.width)}px` }}>
      <div className="stage-inner" role="group" aria-label="Sky dome" tabIndex={0} data-dragging={dragging} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown}>
        {/* D-61: the sentinel keeps glyphcss from injecting its stylesheet; the rules are in dome-composition.css. */}
        <span id="glyph-styles" hidden />
        <LayeredDome params={params} palette={palette} camera={camera} dragging={dragging} pulse={pulse} advances={advances} clock={clock} />
      </div>
      <p className="readout" data-testid="dome-readout">
        {en.chart.readout(readoutParams(camera))} · {params.cols} cols · {params.colors ? params.colorSet : 'mono'} · {params.base ? `base ${String(Math.round(params.cols * params.baseRatio))}` : 'no base'}
      </p>
    </div>
  );
}

function App() {
  const [params, setParams] = useState<Params>(initialParams);
  const [advances, setAdvances] = useState<{ braille: number; mono: number } | null>(null);
  const palette = paletteFor(params.colorSet, params.theme);

  useEffect(() => {
    window.history.replaceState(null, '', `?${toQuery(params)}`);
  }, [params]);

  useEffect(() => {
    document.documentElement.dataset['theme'] = params.theme;
    document.documentElement.style.setProperty('--bg', palette.bg);
    document.documentElement.style.setProperty('--fg', palette.fg);
  }, [params.theme, palette]);

  // Both fonts are measured once, so the two layers land on the same grid.
  useEffect(() => {
    const fonts = document.fonts;
    const load = fonts ? fonts.load('12px "WIYS Braille"').catch(() => undefined) : Promise.resolve();
    void load.then(() => {
      const mono = getComputedStyle(document.body).fontFamily;
      setAdvances({ braille: measureAdvance('⣿', `"WIYS Braille", ${mono}`), mono: measureAdvance('M', mono) });
    });
  }, []);

  const set = useCallback(<K extends keyof Params>(key: K, value: Params[K]) => setParams((p) => ({ ...p, [key]: value })), []);
  const controls = useMemo(
    () =>
      KNOBS.map((knob) => {
        const value = params[knob.key];
        if (knob.kind === 'bool')
          return (
            <label key={knob.key}>
              <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(knob.key, e.target.checked as Params[typeof knob.key])} /> {knob.key}
            </label>
          );
        if (knob.kind === 'enum')
          return (
            <label key={knob.key}>
              {knob.key}
              <select value={String(value)} onChange={(e) => set(knob.key, e.target.value as Params[typeof knob.key])}>
                {knob.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        return (
          <label key={knob.key}>
            {knob.key}
            <input type="number" step={knob.step ?? 1} value={Number(value)} onChange={(e) => set(knob.key, Number(e.target.value) as Params[typeof knob.key])} />
          </label>
        );
      }),
    [params, set],
  );

  return (
    <div className="page">
      <div className="controls">
        <label>
          candidate
          <select value="" onChange={(e) => setParams(candidate(e.target.value)?.params ?? DEFAULTS)}>
            <option value="">…</option>
            {CANDIDATES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {controls}
      </div>
      {advances && <DomeView key={`${params.pass}-${String(params.facing)}-${String(params.tilt)}`} params={params} advances={advances} />}
    </div>
  );
}

declare global {
  interface Window {
    __domeCamera?: { rotX: number; rotY: number };
  }
}

installPerf(
  () => window.__domeCamera ?? null,
  () => (document.querySelector('.lines-scene pre')?.textContent ?? '').trim().length > 0,
);

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
