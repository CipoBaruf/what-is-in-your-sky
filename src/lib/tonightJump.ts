import type { EpochMs } from '../model';
// D-896 keeps the lead in `physics/constants.ts` beside FR-TRAJ-2's thresholds (`eslint.config.js` allows this one import, D-907).
import { TONIGHT_LEAD_MIN } from '../physics/constants';
import { nightAt, passUp, type PassTimes } from './playback';
import type { SkyBand, Span } from './timeStripe';

/**
 * R141 (FR-TONIGHT-1, FR-TONIGHT-4, D-897): where the compact live page's
 * jump, `tonight` and `next` land. Pure over the stored run, no React and no
 * clock (D-15). `passes` are the visible passes — the list's own, the ones the
 * page draws — so a target is never a pass the page then hides; the caller
 * filters, these functions never widen. A landing is `start − TONIGHT_LEAD_MIN`
 * of a pass, never before `now`: real time is the earliest the page shows.
 */
const LEAD_MS = TONIGHT_LEAD_MIN * 60_000;

function lead(start: EpochMs, now: EpochMs): EpochMs {
  return Math.max(now, start - LEAD_MS);
}

/** The earliest `start` among `passes` that `keep` accepts, or `null`. */
function firstStart(passes: readonly PassTimes[], keep: (start: EpochMs) => boolean): EpochMs | null {
  let best: EpochMs | null = null;
  for (const pass of passes) {
    const start = pass.start.t;
    if (keep(start) && (best === null || start < best)) best = start;
  }
  return best;
}

/**
 * FR-TONIGHT-1: the instant the page jumps to on opening, or `null` to stay on
 * real time — a visible pass is up at `now` (`start ≤ now ≤ end`), or none
 * rises inside the span.
 */
export function openingJump(passes: readonly PassTimes[], now: EpochMs, span: Span): EpochMs | null {
  if (passes.some((pass) => passUp(pass, now))) return null;
  const start = firstStart(passes, (s) => s > now && s <= span.end);
  return start === null ? null : lead(start, now);
}

export interface TonightTarget {
  t: EpochMs;
  /** True when the target is a pass (play it); false when tonight has none and the target is the night's start, paused. */
  play: boolean;
}

/**
 * FR-TONIGHT-4's `tonight`. Tonight is the night at or after `now` — the run
 * of non-`day` bands that holds `now` or comes next, from the same bands the
 * stripe draws (D-170). From outside tonight, the target is the first visible
 * pass rising in it; from inside, the first rising at or after `t`, and when
 * none is left after `t`, tonight's first, as from outside. With no visible
 * pass tonight it is the night's start (or `now`, when the night has begun),
 * paused. `null` while the bands hold no night (not loaded yet). The bands
 * run an hour past the span (D-170), so a pass rising after the span's end
 * is not tonight's and the night's start is held at the span's end at most.
 */
export function tonightTarget(bands: readonly SkyBand[], passes: readonly PassTimes[], now: EpochMs, t: EpochMs, span: Span): TonightTarget | null {
  const night = nightAt(bands, now);
  if (!night) return null;
  const inNight = (s: EpochMs): boolean => s >= Math.max(night.from, now) && s < night.to && s <= span.end;
  if (t >= night.from && t < night.to) {
    const after = firstStart(passes, (s) => inNight(s) && s >= t);
    if (after !== null) return { t: lead(after, now), play: true };
  }
  const first = firstStart(passes, inNight);
  if (first !== null) return { t: lead(first, now), play: true };
  return { t: Math.min(span.end, Math.max(now, night.from)), play: false };
}

/**
 * FR-TONIGHT-4's `next`: `start − TONIGHT_LEAD_MIN` of the first visible pass
 * rising after `t + TONIGHT_LEAD_MIN` — so from a landing the next tap moves
 * on — or `null` past the last pass, the control's disabled state.
 */
export function nextTarget(passes: readonly PassTimes[], t: EpochMs): EpochMs | null {
  const start = firstStart(passes, (s) => s > t + LEAD_MS);
  return start === null ? null : start - LEAD_MS;
}
