import type { EpochMs, NoradId, NowItem, NowState, Observer, PassBoundaryReason, SkyState, VisibilityThresholds } from '../model';
import { DENSE_STEP_MS } from './constants';
import type { SatRec } from './sgp4';
import { sunAltitudeDeg } from './sun';
import { failingReason, sampleAt, visibilityAt } from './visibility';

/**
 * The "Now" state (US-4, FR-VIS-5, PLAN D-14): every object evaluated at one
 * instant with the same functions the pass search uses, plus the sun altitude
 * that explains an empty panel (daylight / nothing up / all in shadow).
 * Pure: time enters only through `t` (D-15).
 */
export interface NowObject {
  satrec: SatRec;
  noradId: NoradId;
  name: string;
  stdMag: number;
}

/** Coarse step of the look-ahead that finds `visibleUntil`; the last coarse step is refined at DENSE_STEP_MS. */
export const LOOKAHEAD_STEP_MS = 10_000;

/** No LEO pass lasts this long above 10°; a visible item still visible at the cap gets no `visibleUntil`. */
export const MAX_LOOKAHEAD_MS = 30 * 60_000;

/** PLAN §5 `SkyState`: sun > sunAltMax → day; (twilightLabel, sunAltMax] → bright-twilight; ≤ twilightLabel → dark. */
export function skyState(sunAltDeg: number, thresholds: Pick<VisibilityThresholds, 'sunAltMaxDeg' | 'twilightLabelSunAltDeg'>): SkyState {
  if (sunAltDeg > thresholds.sunAltMaxDeg) return 'day';
  if (sunAltDeg > thresholds.twilightLabelSunAltDeg) return 'bright-twilight';
  return 'dark';
}

/**
 * When a currently visible object stops being visible, and why: the last
 * visible instant on the 1 s grid `t + k·DENSE_STEP_MS` (the same grid
 * `findPasses` uses, so inside a pass the answer is the pass's own `end`).
 * Coarse 10 s steps first, then 1 s inside the last coarse step. Null when
 * still visible at MAX_LOOKAHEAD_MS (or when propagation fails first).
 */
export function visibleUntil(
  object: NowObject,
  observer: Observer,
  t: EpochMs,
  thresholds: VisibilityThresholds,
): { visibleUntil: EpochMs; endReason: PassBoundaryReason } | null {
  const visibleAt = (at: EpochMs): boolean | null => {
    const s = sampleAt(object.satrec, observer, at, object.stdMag);
    return s ? visibilityAt(s, thresholds).visible : null;
  };
  let lastVisible = t;
  let firstInvisible: EpochMs | null = null;
  for (let at = t + LOOKAHEAD_STEP_MS; at <= t + MAX_LOOKAHEAD_MS; at += LOOKAHEAD_STEP_MS) {
    const v = visibleAt(at);
    if (v === null) return null;
    if (!v) {
      firstInvisible = at;
      break;
    }
    lastVisible = at;
  }
  if (firstInvisible === null) return null;
  for (let at = lastVisible + DENSE_STEP_MS; at < firstInvisible; at += DENSE_STEP_MS) {
    const v = visibleAt(at);
    if (v === null) return null;
    if (!v) {
      firstInvisible = at;
      break;
    }
    lastVisible = at;
  }
  const outside = sampleAt(object.satrec, observer, firstInvisible, object.stdMag);
  const endReason = outside ? (failingReason(outside, thresholds) ?? 'horizon') : 'horizon';
  return { visibleUntil: lastVisible, endReason };
}

/** One object at `t`; null when SGP4 fails (the caller skips it). */
export function nowItem(object: NowObject, observer: Observer, t: EpochMs, thresholds: VisibilityThresholds): NowItem | null {
  const s = sampleAt(object.satrec, observer, t, object.stdMag);
  if (!s) return null;
  const v = visibilityAt(s, thresholds);
  const item: NowItem = {
    noradId: object.noradId,
    name: object.name,
    azDeg: s.azDeg,
    elDeg: s.elDeg,
    rangeKm: s.rangeKm,
    magnitude: s.elDeg < 0 || !s.lit ? null : s.magnitude, // below the horizon or in shadow: nothing to see
    lit: s.lit,
    aboveMinElevation: v.aboveMinElevation,
    visible: v.visible,
  };
  if (!v.visible) return item;
  const end = visibleUntil(object, observer, t, thresholds);
  return end ? { ...item, visibleUntil: end.visibleUntil, endReason: end.endReason } : item;
}

/**
 * FR-LIVE-6's dimmed set: above the true horizon at `t`, but not something the
 * app would tell you to look for. That is the complement of what the live page
 * draws from `Pass.track`, which is why the magnitude limit is applied here and
 * not by `visibilityAt` — a lit object in a dark sky at 40° that is fainter
 * than `magLimit` produces no pass, so nothing else would draw it. The reason
 * itself is read off the item: `aboveMinElevation` false is too low, `lit`
 * false is Earth's shadow, `NowState.sky` other than `dark` is daylight, and a
 * `magnitude` past the limit is too faint.
 */
export function isHidden(item: NowItem, thresholds: VisibilityThresholds): boolean {
  if (item.elDeg <= 0) return false;
  if (!item.visible) return true;
  return item.magnitude === null || item.magnitude > thresholds.magLimit;
}

export interface NowOptions {
  /** FR-LIVE-6 (D-76): also return `hidden`. Off by default, so an MVP response is unchanged. */
  includeHidden?: boolean;
}

/** Every object at `t`, in the order given; objects whose propagation fails are left out. */
export function nowState(
  objects: readonly NowObject[],
  observer: Observer,
  t: EpochMs,
  thresholds: VisibilityThresholds,
  options: NowOptions = {},
): NowState {
  const sunAltDeg = sunAltitudeDeg(observer, t);
  const items: NowItem[] = [];
  for (const object of objects) {
    const item = nowItem(object, observer, t, thresholds);
    if (item) items.push(item);
  }
  const state: NowState = { t, sunAltDeg, sky: skyState(sunAltDeg, thresholds), items };
  if (!options.includeHidden) return state;
  return { ...state, hidden: items.filter((item) => isHidden(item, thresholds)) };
}
