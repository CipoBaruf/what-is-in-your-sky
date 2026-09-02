/**
 * Heavens-Above comparison (TASKS R1 steps 9–12, PLAN §10). Shared by
 * `scripts/validate-iss.ts` and `src/physics/passes.golden.test.ts`.
 * Pure: takes fixtures and our passes, returns a report. No I/O.
 */
import type { Observer, OmmRecord, Pass, PassBoundaryReason, TimeWindow, VisibilityThresholds } from '../../src/model';
import { azimuthDeltaDeg, findPasses, isoUtc, ommToSatrec, parseOmmEpoch } from '../../src/physics';

export interface HaEvent {
  t: string; // full ISO 8601 UTC, e.g. "2026-09-11T09:48:14Z"
  altDeg: number;
  azDeg: number;
  compass: string;
}
export type HaEventKey = 'rises' | 'reaches10' | 'max' | 'drops10' | 'sets' | 'entersShadow' | 'exitsShadow';
export interface HaPass {
  date: string; // YYYY-MM-DD, as printed by Heavens-Above (UTC)
  magnitude: number;
  /**
   * Only the rows the detail page shows. `max` is absent when the pass has no
   * "Maximum altitude" row, which Heavens-Above omits when the highest point
   * coincides with the start or the end (a shadow boundary above 10°).
   */
  events: Partial<Record<HaEventKey, HaEvent>>;
  /** Optional override of which event rows the summary table's Start / Highest / End columns show. */
  summary?: { start?: HaEventKey; highest?: HaEventKey; end?: HaEventKey };
}
export interface HaFixture {
  capturedAt: string; // ISO 8601 UTC, to the minute
  /** Observer name as entered on Heavens-Above, e.g. "Paris (spike)". R1's fixture predates the field. */
  location?: string;
  observer: { lat: number; lon: number; altM: number };
  timeZone: 'UTC';
  haEpoch: string;
  /** Name of the OMM capture to pair with (`tests/fixtures/omm/<name>-stations.json`); defaults to the fixture date. */
  ommFixture?: string;
  /** Heavens-Above's own search period (its page header). The comparison window is clipped to it. */
  searchPeriod?: { start: string; end: string };
  filtersText: string;
  passes: HaPass[];
}

/** Extras we list that Heavens-Above omits, each with its explanation (README step 13). */
export interface ExplainedExtra {
  peak: string; // ISO 8601 UTC, minute precision is enough
  reason: string;
}

export const SPIKE_THRESHOLDS: VisibilityThresholds = {
  minElevationDeg: 10,
  sunAltMaxDeg: -6,
  twilightLabelSunAltDeg: -12,
  magLimit: Number.POSITIVE_INFINITY, // brightness is compared separately (step 8)
};
export const ISS_NORAD_ID = 25544;
/** Seed value pending R3's provenance work (step 12). */
export const ISS_STD_MAG_SEED = -1.8;
export const PAIRING_WINDOW_MS = 15 * 60_000;
export const TIME_TOLERANCE_S = 60;
export const ANGLE_TOLERANCE_DEG = 5;
export const WINDOW_DAYS = 10;

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Bad ISO time in fixture: ${iso}`);
  return t;
};

/** Step 9: which Heavens-Above rows begin, top and end the visible pass, and the implied boundary reasons. */
export function haComparisonPoints(pass: HaPass): {
  start: HaEvent;
  peak: HaEvent;
  end: HaEvent;
  startKey: HaEventKey;
  peakKey: HaEventKey;
  endKey: HaEventKey;
  endReason: PassBoundaryReason;
  startReason: PassBoundaryReason;
} {
  const e = pass.events;
  const timeOf = (k: HaEventKey): number => {
    const event = e[k];
    if (!event) throw new Error(`Pass ${pass.date}: event ${k} missing`);
    return ms(event.t);
  };
  const pick = (keys: HaEventKey[], latest: boolean): HaEventKey => {
    const present = keys.filter((k) => e[k] !== undefined);
    if (present.length === 0) throw new Error(`Pass ${pass.date}: none of ${keys.join('/')} present`);
    return present.reduce((a, b) => {
      const ta = timeOf(a);
      const tb = timeOf(b);
      return (latest ? tb > ta : tb < ta) ? b : a;
    });
  };
  const startKey = pass.summary?.start ?? pick(['reaches10', 'exitsShadow', 'rises'], true);
  const endKey = pass.summary?.end ?? pick(['drops10', 'entersShadow', 'sets'], false);
  const start = e[startKey];
  const end = e[endKey];
  if (!start || !end) throw new Error(`Pass ${pass.date}: summary event missing`);
  // Without a "Maximum altitude" row the summary's Highest column repeats the higher of start / end (end on a tie).
  const peakKey = pass.summary?.highest ?? (e.max ? 'max' : end.altDeg >= start.altDeg ? endKey : startKey);
  const peak = e[peakKey];
  if (!peak) throw new Error(`Pass ${pass.date}: highest event ${peakKey} missing`);
  return {
    start,
    peak,
    end,
    startKey,
    peakKey,
    endKey,
    startReason: startKey === 'exitsShadow' ? 'shadow' : 'horizon',
    endReason: endKey === 'entersShadow' ? 'shadow' : 'horizon',
  };
}

/** Heavens-Above's visible duration for a pass, seconds, from its own start and end rows. */
export function haVisibleDurationS(pass: HaPass): number {
  const p = haComparisonPoints(pass);
  return (ms(p.end.t) - ms(p.start.t)) / 1000;
}

export interface PointDelta {
  dtS: number;
  dAzDeg: number;
  dElDeg: number;
}
export interface PairReport {
  ha: HaPass;
  ours: Pass;
  start: PointDelta;
  peak: PointDelta;
  end: PointDelta;
  startReasonExpected: PassBoundaryReason;
  endReasonExpected: PassBoundaryReason;
  endReasonMatches: boolean;
  haMagnitude: number;
  ourMagnitude: number;
  pass: boolean;
}
export interface ComparisonReport {
  window: TimeWindow;
  pairs: PairReport[];
  /** Fixture passes whose peak lies outside the comparison window; not compared. */
  haOutsideWindow: HaPass[];
  unpairedHa: HaPass[];
  unpairedOurs: Pass[];
  unexplainedExtras: Pass[];
  overall: boolean;
}

function delta(ours: { t: number; azDeg: number; elDeg: number }, ha: HaEvent): PointDelta {
  return {
    dtS: (ours.t - ms(ha.t)) / 1000,
    dAzDeg: azimuthDeltaDeg(ours.azDeg, ha.azDeg),
    dElDeg: ours.elDeg - ha.altDeg,
  };
}

const within = (d: PointDelta): boolean =>
  Math.abs(d.dtS) <= TIME_TOLERANCE_S && d.dAzDeg <= ANGLE_TOLERANCE_DEG && Math.abs(d.dElDeg) <= ANGLE_TOLERANCE_DEG;

/**
 * Step 3: the comparison window is [capturedAt, capturedAt + 10 days],
 * clipped to Heavens-Above's own search period when the fixture records it
 * (a pass only one side searched for cannot be compared).
 */
export function comparisonWindow(fixture: HaFixture): TimeWindow {
  const startMs = ms(fixture.capturedAt);
  const window = { startMs, endMs: startMs + WINDOW_DAYS * 86_400_000 };
  if (fixture.searchPeriod) {
    window.startMs = Math.max(window.startMs, ms(fixture.searchPeriod.start));
    window.endMs = Math.min(window.endMs, ms(fixture.searchPeriod.end));
  }
  return window;
}

export function fixtureObserver(fixture: HaFixture): Observer {
  return { ...fixture.observer, label: fixture.location ?? 'Neuquen (spike)', source: 'coords', timeZone: 'UTC' };
}

/** Step 8: run our pipeline on the committed fixtures only. */
export function runOurPipeline(fixture: HaFixture, omm: OmmRecord[], stdMag: number = ISS_STD_MAG_SEED): Pass[] {
  const iss = omm.find((r) => r.NORAD_CAT_ID === ISS_NORAD_ID);
  if (!iss) throw new Error(`NORAD ${ISS_NORAD_ID} not in the OMM fixture`);
  return findPasses(ommToSatrec(iss), fixtureObserver(fixture), comparisonWindow(fixture), SPIKE_THRESHOLDS, {
    noradId: ISS_NORAD_ID,
    name: iss.OBJECT_NAME,
    stdMag,
    elementsEpochMs: parseOmmEpoch(iss.EPOCH),
  });
}

/** Steps 10–13: pair by peak time within ±15 min, compare, and classify extras. */
export function compare(fixture: HaFixture, ours: Pass[], explainedExtras: ExplainedExtra[] = []): ComparisonReport {
  const window = comparisonWindow(fixture);
  const remaining = new Set(ours);
  const pairs: PairReport[] = [];
  const haOutsideWindow: HaPass[] = [];
  const unpairedHa: HaPass[] = [];
  for (const ha of fixture.passes) {
    const points = haComparisonPoints(ha);
    const tPeak = ms(points.peak.t);
    if (tPeak < window.startMs || tPeak > window.endMs) {
      haOutsideWindow.push(ha);
      continue;
    }
    let best: Pass | null = null;
    for (const p of remaining) {
      const d = Math.abs(p.peak.t - tPeak);
      if (d <= PAIRING_WINDOW_MS && (!best || d < Math.abs(best.peak.t - tPeak))) best = p;
    }
    if (!best) {
      unpairedHa.push(ha);
      continue;
    }
    remaining.delete(best);
    const start = delta(best.start, points.start);
    const peak = delta(best.peak, points.peak);
    const end = delta(best.end, points.end);
    const endReasonMatches = best.endReason === points.endReason;
    pairs.push({
      ha,
      ours: best,
      start,
      peak,
      end,
      startReasonExpected: points.startReason,
      endReasonExpected: points.endReason,
      endReasonMatches,
      haMagnitude: ha.magnitude,
      ourMagnitude: best.peakMagnitude,
      pass: within(start) && within(peak) && within(end) && endReasonMatches,
    });
  }
  const unpairedOurs = [...remaining];
  const explained = (p: Pass): boolean =>
    explainedExtras.some((x) => Math.abs(ms(x.peak) - p.peak.t) <= PAIRING_WINDOW_MS);
  const unexplainedExtras = unpairedOurs.filter((p) => !explained(p));
  return {
    window,
    pairs,
    haOutsideWindow,
    unpairedHa,
    unpairedOurs,
    unexplainedExtras,
    overall: pairs.every((p) => p.pass) && unpairedHa.length === 0 && unexplainedExtras.length === 0,
  };
}

/** Step 11: one table row per pair plus PASS/FAIL, then the overall verdict. */
export function formatReport(report: ComparisonReport, explainedExtras: ExplainedExtra[] = []): string {
  const lines: string[] = [];
  const f = (n: number, w: number, d = 1): string => n.toFixed(d).padStart(w);
  lines.push(`Window: ${isoUtc(report.window.startMs)} .. ${isoUtc(report.window.endMs)}`);
  lines.push('');
  lines.push('HA peak (UTC)        | start Δt  Δaz  Δel | peak  Δt  Δaz  Δel | end   Δt  Δaz  Δel | reasons ours/HA (start, end)   | mag ours/HA | result');
  lines.push('---------------------|--------------------|--------------------|--------------------|--------------------------------|-------------|-------');
  for (const p of report.pairs) {
    const cell = (d: PointDelta): string => `${f(d.dtS, 6, 0)}s ${f(d.dAzDeg, 4)} ${f(d.dElDeg, 5)}`;
    const points = haComparisonPoints(p.ha);
    const reasons = `${p.ours.startReason}/${p.startReasonExpected}, ${p.ours.endReason}/${p.endReasonExpected}`;
    lines.push(
      `${points.peak.t.slice(0, 19).padEnd(21)}| ${cell(p.start)} | ${cell(p.peak)} | ${cell(p.end)} | ${reasons.padEnd(30)} | ${f(p.ourMagnitude, 5)}/${f(p.haMagnitude, 4)} | ${p.pass ? 'PASS' : 'FAIL'}`,
    );
  }
  lines.push('');
  if (report.haOutsideWindow.length) {
    lines.push(`Heavens-Above passes outside the comparison window (not compared): ${report.haOutsideWindow.length}`);
  }
  if (report.unpairedHa.length) {
    lines.push('Unpaired Heavens-Above passes (we did not find these):');
    for (const ha of report.unpairedHa) {
      const pt = haComparisonPoints(ha);
      lines.push(`  ${pt.peak.t} max ${pt.peak.altDeg}° az ${pt.peak.azDeg}° mag ${ha.magnitude} (HA visible for ${haVisibleDurationS(ha)} s, ${pt.startKey}→${pt.endKey})`);
    }
  } else {
    lines.push('No unpaired Heavens-Above passes.');
  }
  if (report.unpairedOurs.length) {
    lines.push('Extra passes we list that Heavens-Above omits:');
    for (const p of report.unpairedOurs) {
      const why = explainedExtras.find((x) => Math.abs(ms(x.peak) - p.peak.t) <= PAIRING_WINDOW_MS)?.reason;
      lines.push(
        `  ${isoUtc(p.peak.t)} max ${p.peak.elDeg.toFixed(1)}° az ${p.peak.azDeg.toFixed(0)}° mag ${p.peakMagnitude.toFixed(1)} sunAlt ${p.sunAltAtPeakDeg.toFixed(1)}° twilight=${p.twilight} ${p.startReason}→${p.endReason} ${p.durationS.toFixed(0)} s  ${why ? `explained: ${why}` : 'UNEXPLAINED'}`,
      );
    }
  } else {
    lines.push('No extra passes.');
  }
  lines.push('');
  lines.push(`OVERALL: ${report.overall ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}
