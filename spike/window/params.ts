/**
 * R38 (FR-WIN-7, PLAN §8.10): every knob of the sky-window spike as one URL
 * parameter, so a setting the owner likes on the phone is a string the
 * findings file can quote and the capture script can replay. Pure.
 *
 * `read` never throws: an unknown or malformed value falls back to the
 * default, so a hand-edited URL degrades to the nearest sensible view.
 */

export type Projection = 'gnomonic' | 'stereographic';
export type PassName = 'golden' | 'high';
/**
 * Where the heading comes from on iOS (OQ-17): the WebKit compass field on every reading, `alpha`
 * as if it were absolute, or `fused` — the event's own continuous alpha, offset by the compass as
 * calibrated while the phone is held upright, so the picture follows the gyro through the zenith
 * where the compass field (the direction of the phone's *top* along the ground) has no answer.
 * `auto` is `fused` once a calibration exists, `webkit` before that.
 */
export type HeadingSource = 'auto' | 'webkit' | 'alpha' | 'fused';
/** The screen-angle correction (FR-WIN-3): applied, not applied, or applied with the opposite sign — the phone says which is right. */
export type Correction = 'on' | 'off' | 'neg';
/** The stripe's stepping candidates (FR-TRAJ-5, OQ-18). */
export type Stepping = 'buttons' | 'tap' | 'drag';

export interface WindowParams {
  projection: Projection;
  /** Field of view across the shorter side, degrees (FR-WIN-1: default 60). */
  fov: number;
  /** Exponential smoothing weight of the previous frame, 0 (none) to 0.95. */
  smoothing: number;
  correction: Correction;
  heading: HeadingSource;
  pass: PassName;
  /** Dim companion passes drawn beside the fixture pass, 0–3. */
  others: number;
  /** Manual orientation instead of the sensor: alpha, beta, gamma in degrees. `null` means the sensor drives. */
  manual: { alpha: number; beta: number; gamma: number } | null;
  /** The view's largest width in CSS px; it takes the screen's width up to this, and its height is the shorter of that and the screen's room. */
  width: number;
}

export const WINDOW_DEFAULTS: WindowParams = {
  projection: 'stereographic',
  fov: 60,
  smoothing: 0.6,
  correction: 'on',
  heading: 'auto',
  pass: 'high',
  others: 2,
  manual: null,
  width: 1400,
};

export interface StripeParams {
  step: Stepping;
  width: number;
}

export const STRIPE_DEFAULTS: StripeParams = { step: 'buttons', width: 390 };

const num = (q: URLSearchParams, key: string, fallback: number, min: number, max: number): number => {
  const raw = q.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

const pick = <T extends string>(q: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T => {
  const raw = q.get(key);
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
};

export function readWindowParams(search: string): WindowParams {
  const q = new URLSearchParams(search);
  const manual = q.has('alpha') || q.has('beta') || q.has('gamma') ? { alpha: num(q, 'alpha', 0, 0, 360), beta: num(q, 'beta', 90, -180, 180), gamma: num(q, 'gamma', 0, -90, 90) } : null;
  return {
    projection: pick(q, 'projection', ['gnomonic', 'stereographic'], WINDOW_DEFAULTS.projection),
    fov: num(q, 'fov', WINDOW_DEFAULTS.fov, 20, 140),
    smoothing: num(q, 'smoothing', WINDOW_DEFAULTS.smoothing, 0, 0.95),
    correction: pick(q, 'correction', ['on', 'off', 'neg'], WINDOW_DEFAULTS.correction),
    heading: pick(q, 'heading', ['auto', 'webkit', 'alpha', 'fused'], WINDOW_DEFAULTS.heading),
    pass: pick(q, 'pass', ['golden', 'high'], WINDOW_DEFAULTS.pass),
    others: num(q, 'others', WINDOW_DEFAULTS.others, 0, 3),
    manual,
    width: num(q, 'width', WINDOW_DEFAULTS.width, 200, 1400),
  };
}

export function windowQuery(p: WindowParams): string {
  const q = new URLSearchParams();
  q.set('projection', p.projection);
  q.set('fov', String(p.fov));
  q.set('smoothing', String(p.smoothing));
  q.set('correction', p.correction);
  q.set('heading', p.heading);
  q.set('pass', p.pass);
  q.set('others', String(p.others));
  if (p.manual) {
    q.set('alpha', String(p.manual.alpha));
    q.set('beta', String(p.manual.beta));
    q.set('gamma', String(p.manual.gamma));
  }
  if (p.width !== WINDOW_DEFAULTS.width) q.set('width', String(p.width));
  return q.toString();
}

export function readStripeParams(search: string): StripeParams {
  const q = new URLSearchParams(search);
  return { step: pick(q, 'step', ['buttons', 'tap', 'drag'], STRIPE_DEFAULTS.step), width: num(q, 'width', STRIPE_DEFAULTS.width, 200, 1400) };
}

export function stripeQuery(p: StripeParams): string {
  const q = new URLSearchParams();
  q.set('step', p.step);
  if (p.width !== STRIPE_DEFAULTS.width) q.set('width', String(p.width));
  return q.toString();
}
