/**
 * R38 spike page (FR-WIN-7, PLAN §8.10): the sky window with every knob on
 * the URL, driven by the phone's sensors or by three sliders. Dev only —
 * `vite build` bundles the root `index.html` only.
 *
 *   /spike/window/?projection=stereographic&fov=60&smoothing=0.6&correction=on&heading=auto&pass=high
 *   /spike/window/?alpha=0&beta=120&gamma=0          manual orientation (desktop, captures)
 *
 * The controls write the same parameters back to the URL, so a view found by
 * hand is a link. The readout under the window is the answer to OQ-17: the
 * raw event fields as the platform sends them, the event name, the screen
 * angle, and the update rate by the D-62 method (draws per second).
 * `[ copy facts ]` renders it all as text for `docs/window/FINDINGS.md`.
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Pass } from '../../src/model';
import { othersFor, passFor } from '../dome-composition/fixtures';
import { readWindowParams, windowQuery, type WindowParams } from './params';
import { alphaFor, lookDirection, rotationMatrix, smoothRotation, type Mat3, type View } from './projection';
import { listen, RateMeter, requestOrientation, type PermissionState, type RawReading, type SensorStats } from './sensors';
import { SkyWindow } from './SkyWindow';
import './window.css';

const NOW_FRACTION = 0.6;
const FACT_SAMPLES = 3;

interface Facts {
  userAgent: string;
  permission: PermissionState;
  eventNames: string[];
  first: RawReading | null;
  samples: RawReading[];
  stats: SensorStats | null;
}

declare global {
  interface Window {
    __window: {
      stats: () => SensorStats;
      facts: () => Facts;
      /** The capture script's hand on the sensor: a synthetic reading, as if the platform sent it. */
      feed: (reading: Partial<RawReading>) => void;
    };
  }
}

function App() {
  const [params, setParams] = useState<WindowParams>(() => readWindowParams(window.location.search));
  const [permission, setPermission] = useState<PermissionState>('pending');
  const [listening, setListening] = useState(false);
  const [raw, setRaw] = useState<RawReading | null>(null);
  const [matrix, setMatrix] = useState<Mat3>(() => rotationMatrix(0, 90, 0));
  const [stats, setStats] = useState<SensorStats | null>(null);
  const [factsText, setFactsText] = useState('');
  const [size, setSize] = useState(() => Math.min(params.width, window.innerWidth));

  const smoothed = useRef<Mat3 | null>(null);
  const latest = useRef<RawReading | null>(null);
  const meter = useRef(new RateMeter());
  const facts = useRef<Facts>({ userAgent: navigator.userAgent, permission: 'pending', eventNames: [], first: null, samples: [], stats: null });
  const frame = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // The URL is the state: every change is a link.
  const update = useCallback((patch: Partial<WindowParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      window.history.replaceState(null, '', `?${windowQuery(next)}`);
      return next;
    });
  }, []);

  useEffect(() => {
    const onResize = (): void => {
      setSize(Math.min(paramsRef.current.width, window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /** One frame: the newest reading (or the sliders) through smoothing to the drawing. Runs once per reading, never faster than the display. */
  const draw = useCallback(() => {
    frame.current = null;
    const p = paramsRef.current;
    let target: Mat3 | null = null;
    if (p.manual) target = rotationMatrix(p.manual.alpha, p.manual.beta, p.manual.gamma);
    else {
      const r = latest.current;
      if (r) {
        const alpha = alphaFor(r, p.heading);
        if (alpha !== null && r.beta !== null && r.gamma !== null) target = rotationMatrix(alpha, r.beta, r.gamma);
      }
    }
    if (!target) return;
    const next = smoothRotation(smoothed.current, target, p.manual ? 0 : p.smoothing);
    smoothed.current = next;
    setMatrix(next);
    meter.current.draw();
    // The phone's sensor came at 10 readings a second on iOS Chrome (R38's first run): the window
    // keeps drawing at the display rate, easing toward the latest reading, until it has arrived.
    if (!p.manual && listeningRef.current && p.smoothing > 0 && !converged(next, target)) frame.current ??= requestAnimationFrame(draw);
  }, []);

  const schedule = useCallback(() => {
    frame.current ??= requestAnimationFrame(draw);
  }, [draw]);

  const onReading = useCallback(
    (reading: RawReading) => {
      latest.current = reading;
      meter.current.event();
      const f = facts.current;
      if (!f.eventNames.includes(reading.event)) f.eventNames.push(reading.event);
      f.first ??= reading;
      if (f.samples.length < FACT_SAMPLES && (f.samples.length === 0 || reading.at - (f.samples[f.samples.length - 1]?.at ?? 0) > 1500)) f.samples.push(reading);
      setRaw(reading);
      schedule();
    },
    [schedule],
  );

  // Manual sliders redraw at once.
  useEffect(() => {
    if (params.manual) schedule();
  }, [params.manual, schedule]);

  // The stats line, once a second, and the hooks the capture script uses.
  useEffect(() => {
    const timer = setInterval(() => {
      const s = meter.current.stats();
      facts.current.stats = s;
      setStats(s);
    }, 1000);
    window.__window = {
      stats: () => meter.current.stats(),
      facts: () => facts.current,
      feed: (reading) => {
        onReading({ at: Date.now(), event: 'deviceorientation', alpha: 0, beta: 90, gamma: 0, absolute: true, webkitCompassHeading: null, webkitCompassAccuracy: null, screenAngle: 0, screenType: null, ...reading });
      },
    };
    return () => {
      clearInterval(timer);
    };
  }, [onReading]);

  const start = async (): Promise<void> => {
    const state = await requestOrientation();
    setPermission(state);
    facts.current.permission = state;
    if (state === 'granted' || state === 'not-needed') {
      meter.current.reset();
      listen(onReading);
      listeningRef.current = true;
      setListening(true);
      update({ manual: null });
    }
  };

  const copyFacts = (): void => {
    const f = facts.current;
    const line = (r: RawReading): string => `  ${r.event}: alpha ${fmt(r.alpha)} beta ${fmt(r.beta)} gamma ${fmt(r.gamma)} absolute ${String(r.absolute)} webkitCompassHeading ${fmt(r.webkitCompassHeading)} accuracy ${fmt(r.webkitCompassAccuracy)} screen ${String(r.screenAngle)}° ${r.screenType ?? '-'}`;
    const text = [
      `user agent: ${f.userAgent}`,
      `permission: ${f.permission}`,
      `event names seen: ${f.eventNames.join(', ') || 'none'}`,
      `first event:`,
      f.first ? line(f.first) : '  none',
      `samples:`,
      ...(f.samples.length > 0 ? f.samples.map(line) : ['  none']),
      `rate: ${f.stats ? `${String(f.stats.eventsPerSecond)} events/s, ${String(f.stats.drawsPerSecond)} draws/s, longest gap ${String(f.stats.longestGapMs)} ms` : 'not measured'}`,
      `settings: ${windowQuery(params)}`,
    ].join('\n');
    setFactsText(text);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const passes: Pass[] = useMemo(() => [passFor(params.pass), ...othersFor(params.others)], [params.pass, params.others]);
  const view: View = { projection: params.projection, fovDeg: params.fov, width: size, height: size, screenAngleDeg: params.correction === 'off' ? 0 : (params.correction === 'neg' ? -1 : 1) * (raw?.screenAngle ?? 0) };
  const look = lookDirection(matrix);
  const manual = params.manual ?? { alpha: 0, beta: 90, gamma: 0 };

  return (
    <main>
      <SkyWindow m={matrix} view={view} passes={passes} nowFraction={NOW_FRACTION} />
      <p className="look">
        looking {look.azDeg.toFixed(0)}° / {look.altDeg.toFixed(0)}° · {params.projection} {String(params.fov)}° · smoothing {String(params.smoothing)}
        {stats ? ` · ${String(stats.eventsPerSecond)} ev/s ${String(stats.drawsPerSecond)} draws/s gap ${String(stats.longestGapMs)} ms` : ''}
      </p>
      <section className="controls">
        <div className="row">
          {!listening ? (
            <button type="button" onClick={() => void start()}>
              start sensors
            </button>
          ) : (
            <span className="ok">sensors on ({permission})</span>
          )}
          <button type="button" onClick={() => update({ manual: params.manual ? null : { ...manual } })}>
            {params.manual ? 'sensor' : 'manual'}
          </button>
          <button type="button" onClick={copyFacts}>
            copy facts
          </button>
        </div>
        <div className="row">
          <label>
            projection
            <select value={params.projection} onChange={(e) => update({ projection: e.target.value as WindowParams['projection'] })}>
              <option value="stereographic">stereographic</option>
              <option value="gnomonic">gnomonic</option>
            </select>
          </label>
          <label>
            fov {String(params.fov)}°
            <input type="range" min={30} max={120} step={5} value={params.fov} onChange={(e) => update({ fov: Number(e.target.value) })} />
          </label>
          <label>
            smoothing {String(params.smoothing)}
            <input type="range" min={0} max={0.95} step={0.05} value={params.smoothing} onChange={(e) => update({ smoothing: Number(e.target.value) })} />
          </label>
        </div>
        <div className="row">
          <label>
            screen correction
            <select value={params.correction} onChange={(e) => update({ correction: e.target.value as WindowParams['correction'] })}>
              <option value="on">on</option>
              <option value="off">off</option>
              <option value="neg">opposite sign</option>
            </select>
          </label>
          <label>
            heading from
            <select value={params.heading} onChange={(e) => update({ heading: e.target.value as WindowParams['heading'] })}>
              <option value="auto">auto</option>
              <option value="webkit">webkitCompassHeading</option>
              <option value="alpha">alpha</option>
            </select>
          </label>
          <label>
            pass
            <select value={params.pass} onChange={(e) => update({ pass: e.target.value as WindowParams['pass'] })}>
              <option value="high">high (synthetic)</option>
              <option value="golden">golden (grazing)</option>
            </select>
          </label>
          <label>
            others {String(params.others)}
            <input type="range" min={0} max={3} step={1} value={params.others} onChange={(e) => update({ others: Number(e.target.value) })} />
          </label>
        </div>
        {params.manual ? (
          <div className="row">
            {(['alpha', 'beta', 'gamma'] as const).map((axis) => (
              <label key={axis}>
                {axis} {String(manual[axis])}°
                <input
                  type="range"
                  min={axis === 'alpha' ? 0 : axis === 'beta' ? -180 : -90}
                  max={axis === 'alpha' ? 360 : axis === 'beta' ? 180 : 90}
                  step={1}
                  value={manual[axis]}
                  onChange={(e) => update({ manual: { ...manual, [axis]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
        ) : null}
      </section>
      <section className="readout">
        <h2>raw event</h2>
        {raw ? (
          <dl>
            <dt>event</dt>
            <dd>{raw.event}</dd>
            <dt>alpha / beta / gamma</dt>
            <dd>
              {fmt(raw.alpha)} / {fmt(raw.beta)} / {fmt(raw.gamma)}
            </dd>
            <dt>absolute</dt>
            <dd>{raw.absolute === undefined ? 'undefined' : String(raw.absolute)}</dd>
            <dt>webkitCompassHeading</dt>
            <dd>
              {fmt(raw.webkitCompassHeading)} (±{fmt(raw.webkitCompassAccuracy)})
            </dd>
            <dt>screen</dt>
            <dd>
              {String(raw.screenAngle)}° {raw.screenType ?? '-'}
            </dd>
            <dt>alpha used</dt>
            <dd>{fmt(alphaFor(raw, params.heading))}</dd>
          </dl>
        ) : (
          <p>{params.manual ? 'manual orientation' : 'no event yet — tap start sensors'}</p>
        )}
        {factsText ? <textarea readOnly value={factsText} rows={12} /> : null}
      </section>
      <p className="links">
        <a href={`stripe.html`}>the stripe page</a>
      </p>
    </main>
  );
}

const fmt = (n: number | null): string => (n === null ? 'null' : n.toFixed(1));

/** Within a tenth of a degree on every axis: nothing left to ease. */
const converged = (a: Mat3, b: Mat3): boolean => {
  for (const r of [0, 1, 2] as const) for (const c of [0, 1, 2] as const) if (Math.abs(a[r][c] - b[r][c]) > 0.0017) return false;
  return true;
};

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
