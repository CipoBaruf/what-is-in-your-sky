/**
 * R38 spike, second page (FR-TRAJ-5, OQ-18): the time stripe at 390 px with
 * the three stepping candidates behind one parameter —
 *
 *   /spike/window/stripe.html?step=buttons   ±1 min, ±10 min and previous/next rise
 *   /spike/window/stripe.html?step=tap       a tap on a segment jumps to that pass's rise
 *   /spike/window/stripe.html?step=drag      a slow drag is geared down to seconds per pixel
 *
 * — and the measurement US-22 AC6 asks for: the readout counts taps since
 * `[ reset ]` and shows how far the shown instant is from the nearest rise,
 * so "within 1 min of a rise in ≤ 3 taps" is read off the page. The stripe's
 * geometry is the product's own `lib/timeStripe.ts`; only the drawing and
 * the gestures are the spike's.
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { clampToSpan, cursorAt, hourTicks, MINUTE_MS, passSegments, timeAt, xAt, HOUR_MS, type Span } from '../../src/lib/timeStripe';
import type { Pass, PassPoint } from '../../src/model';
import { OTHER_PASSES } from '../dome-composition/fixtures';
import { PASSES } from '../passes';
import { readStripeParams, stripeQuery, type StripeParams } from './params';
import './window.css';

const TIME_ZONE = 'America/Argentina/Salta';
const HEIGHT = 48;
const SERIES = ['#7cc4ff', '#ffb86b', '#b8f07c', '#f28cd1', '#9fa8ff', '#ffe27c'];
/** The product's drag rate on a phone at this width (OQ-18: "4 min per pixel"), from a 24 h span. */
const SPAN_MS = 24 * HOUR_MS;
/** A drag slower than this, in px per ms, is geared down. */
const SLOW_PX_PER_MS = 0.25;
const SLOW_GEAR = 1 / 16;

const shift = (pass: Pass, byMs: number, suffix: string): Pass => {
  const move = (p: PassPoint): PassPoint => ({ ...p, t: p.t + byMs });
  return { ...pass, id: `${pass.id}-${suffix}`, start: move(pass.start), peak: move(pass.peak), end: move(pass.end), track: pass.track.map(move) };
};

const fixture = (name: string): Pass => {
  const pass = PASSES[name];
  if (!pass) throw new Error(`spike fixture ${name} missing`);
  return pass;
};
const golden: Pass = fixture('golden');
const high: Pass = fixture('high');

/** Seven rises over the night: the two fixtures, the three companions, and two more of the high pass later on. */
const NIGHT: readonly Pass[] = [golden, high, ...OTHER_PASSES, shift(high, 5 * HOUR_MS + 17 * MINUTE_MS, 'late'), shift(high, 9 * HOUR_MS + 41 * MINUTE_MS, 'later')];
const SPAN: Span = { start: golden.start.t - 6 * HOUR_MS, end: golden.start.t - 6 * HOUR_MS + SPAN_MS };

const clock = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TIME_ZONE });
const mmss = (ms: number): string => {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`;
};

declare global {
  interface Window {
    __stripe: { t: () => number; taps: () => number; nearestRiseMs: () => number };
  }
}

function App() {
  const [params, setParams] = useState<StripeParams>(() => readStripeParams(window.location.search));
  const [t, setT] = useState<number>(SPAN.start + 4 * HOUR_MS);
  const [taps, setTaps] = useState(0);
  const [gear, setGear] = useState(1);
  const drag = useRef<{ x: number; at: number } | null>(null);
  const width = Math.min(params.width, window.innerWidth);

  const update = useCallback((patch: Partial<StripeParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      window.history.replaceState(null, '', `?${stripeQuery(next)}`);
      return next;
    });
  }, []);

  const segments = useMemo(() => passSegments(NIGHT, SPAN, width), [width]);
  const ticks = useMemo(() => hourTicks(SPAN, width, TIME_ZONE), [width]);
  const cursor = cursorAt(t, SPAN, width);
  const rises = useMemo(() => NIGHT.map((pass) => pass.start.t).sort((a, b) => a - b), []);
  const nearest = rises.reduce((best, rise) => (Math.abs(rise - t) < Math.abs(best - t) ? rise : best), rises[0] ?? t);
  const deltaMs = t - nearest;
  const met = Math.abs(deltaMs) <= MINUTE_MS && taps <= 3;

  // The capture script's window on the state.
  useEffect(() => {
    window.__stripe = { t: () => t, taps: () => taps, nearestRiseMs: () => deltaMs };
  }, [t, taps, deltaMs]);

  const go = (next: number): void => {
    setT(clampToSpan(next, SPAN));
  };
  const tap = (next: number): void => {
    setTaps((n) => n + 1);
    go(next);
  };
  const xOf = (e: PointerEvent<SVGSVGElement>): number => e.clientX - e.currentTarget.getBoundingClientRect().left;

  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    const x = xOf(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (params.step === 'tap') {
      // A tap on a segment is the rise; a tap on the band is that instant, as today.
      const hit = segments.find((s) => x >= s.x - 6 && x <= s.x + s.width + 6);
      tap(hit ? hit.start : timeAt(x, SPAN, width));
      return;
    }
    if (params.step === 'drag') {
      drag.current = { x, at: performance.now() };
      setGear(1);
      tap(timeAt(x, SPAN, width));
      return;
    }
    tap(timeAt(x, SPAN, width));
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (params.step !== 'drag' || !drag.current) return;
    const x = xOf(e);
    const now = performance.now();
    const dx = x - drag.current.x;
    const dt = Math.max(1, now - drag.current.at);
    const speed = Math.abs(dx) / dt;
    const g = speed < SLOW_PX_PER_MS ? SLOW_GEAR : 1;
    setGear(g);
    drag.current = { x, at: now };
    if (dx !== 0) setT((prev) => clampToSpan(prev + dx * (SPAN_MS / width) * g, SPAN));
  };

  const onPointerUp = (): void => {
    drag.current = null;
    setGear(1);
  };

  const prevRise = rises.filter((r) => r < t - 1000).pop();
  const nextRise = rises.find((r) => r > t + 1000);

  return (
    <main>
      <svg className="stripe" width={width} height={HEIGHT} viewBox={`0 0 ${String(width)} ${String(HEIGHT)}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <rect className="band" width={width} height={HEIGHT} />
        <rect className="night" x={xAt(golden.start.t - 2 * HOUR_MS, SPAN, width)} width={xAt(golden.start.t + 10 * HOUR_MS, SPAN, width) - xAt(golden.start.t - 2 * HOUR_MS, SPAN, width)} height={HEIGHT} />
        {ticks.map((tick) => (
          <g key={tick.x}>
            <line className="hour" x1={tick.x} x2={tick.x} y1={HEIGHT - 8} y2={HEIGHT} />
            {tick.labelled ? (
              <text className="hour-label" x={tick.x} y={HEIGHT - 12}>
                {String(tick.hour).padStart(2, '0')}
              </text>
            ) : null}
          </g>
        ))}
        {segments.map((s) => (
          <line key={s.passId} className="segment" x1={s.x} x2={s.x + Math.max(s.width, 2)} y1={8 + s.lane * 9} y2={8 + s.lane * 9} stroke={SERIES[(s.series - 1) % SERIES.length] ?? '#fff'} />
        ))}
        <line className="cursor" x1={cursor.x} x2={cursor.x} y1={0} y2={HEIGHT} />
      </svg>
      <section className="readout">
        <p className="big">{clock(t)}</p>
        <p className={met ? 'ac6' : 'miss'}>
          {Math.abs(deltaMs) <= MINUTE_MS ? 'within 1 min of a rise' : `${mmss(deltaMs)} ${deltaMs < 0 ? 'before' : 'after'} the nearest rise`} · {String(taps)} tap{taps === 1 ? '' : 's'}
          {met ? ' · AC6 met' : ''}
          {params.step === 'drag' ? ` · gear ${gear === 1 ? '4 min/px' : '15 s/px'}` : ''}
        </p>
        <div className="row">
          <label>
            stepping
            <select value={params.step} onChange={(e) => update({ step: e.target.value as StripeParams['step'] })}>
              <option value="buttons">buttons</option>
              <option value="tap">tap a segment</option>
              <option value="drag">slow drag</option>
            </select>
          </label>
          <button type="button" onClick={() => setTaps(0)}>
            reset taps
          </button>
        </div>
        {params.step === 'buttons' ? (
          <div className="row">
            <button type="button" className="step" disabled={prevRise === undefined} onClick={() => prevRise !== undefined && tap(prevRise)}>
              |◀ rise
            </button>
            <button type="button" className="step" onClick={() => tap(t - 10 * MINUTE_MS)}>
              −10m
            </button>
            <button type="button" className="step" onClick={() => tap(t - MINUTE_MS)}>
              −1m
            </button>
            <button type="button" className="step" onClick={() => tap(t + MINUTE_MS)}>
              +1m
            </button>
            <button type="button" className="step" onClick={() => tap(t + 10 * MINUTE_MS)}>
              +10m
            </button>
            <button type="button" className="step" disabled={nextRise === undefined} onClick={() => nextRise !== undefined && tap(nextRise)}>
              rise ▶|
            </button>
          </div>
        ) : null}
        <p className="look">
          {params.step === 'buttons' ? 'tap the stripe for a rough instant, then the buttons' : params.step === 'tap' ? 'tap a coloured segment: the instant becomes its rise' : 'drag: fast moves 4 min per pixel, slow moves 15 s per pixel'}
        </p>
      </section>
      <p className="links">
        <a href="./">the window page</a>
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
