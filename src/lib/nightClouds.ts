import type { CloudState, CloudVerdict, EpochMs, HourlyCloud, TonightCloud, WeatherSnapshot } from '../model';
import { cloudState, cloudVerdict, effectiveCloudPct } from './cloudVerdict';
import type { Span } from './timeStripe';

/**
 * D-1028: tonight's cloud across its stretch of night (`nightWindow`), hour by hour, rather than one sample at the
 * middle — a night that is overcast until 01:00 and clear after 03:00 is neither "clear" nor "cloudy".
 *
 * The rule:
 * 1. Each forecast hour inside the window gets its state (`cloudVerdict`'s formula). Hours the forecast does not
 *    cover are left out; with fewer than two hours inside (a short window, a forecast that ends first) the night is
 *    the single verdict at the window's middle, as before.
 * 2. Runs of one state are smoothed: a run of one hour is not a change. It joins its neighbours when they agree,
 *    else the longer neighbour, else (a tie) the cloudier one — a one-hour step from cloudy through partly to clear
 *    is not promised as clear. Repeated until no one-hour run is left, or one run is.
 * 3. One run is `steady`; two runs are one `change`, at the first hour of the second; more are `variable`.
 *
 * Each part carries a verdict for the tooltip: its state and the mean effective cover of its hours in that state,
 * so the figure is always inside the state's band. Pure: the window and the snapshot are parameters (D-15).
 */
export type NightClouds =
  | { kind: 'steady'; verdict: CloudVerdict }
  | { kind: 'change'; at: EpochMs; before: CloudVerdict; after: CloudVerdict }
  | { kind: 'variable'; verdict: CloudVerdict };

const SEVERITY: Record<CloudState, number> = { clear: 0, partly: 1, obscured: 2, unknown: -1 };

interface Run {
  state: CloudState;
  hours: HourlyCloud[];
}

function runsOf(hours: readonly HourlyCloud[]): Run[] {
  const runs: Run[] = [];
  for (const hour of hours) {
    const state = cloudState(effectiveCloudPct(hour));
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.hours.push(hour);
    else runs.push({ state, hours: [hour] });
  }
  return runs;
}

/** Step 2: fold every one-hour run into a neighbour until none is left. */
function smooth(input: Run[]): Run[] {
  const runs = input.map((run) => ({ state: run.state, hours: [...run.hours] }));
  for (;;) {
    if (runs.length <= 1) return runs;
    const i = runs.findIndex((run) => run.hours.length === 1);
    if (i < 0) return runs;
    const run = runs[i] as Run;
    const before = runs[i - 1];
    const after = runs[i + 1];
    let into: 'before' | 'after';
    if (!before) into = 'after';
    else if (!after) into = 'before';
    else if (before.state === after.state) {
      before.hours.push(...run.hours, ...after.hours);
      runs.splice(i, 2);
      continue;
    } else if (before.hours.length !== after.hours.length) into = before.hours.length > after.hours.length ? 'before' : 'after';
    else into = SEVERITY[before.state] >= SEVERITY[after.state] ? 'before' : 'after';
    if (into === 'before' && before) before.hours.push(...run.hours);
    else if (after) after.hours.unshift(...run.hours);
    runs.splice(i, 1);
  }
}

function partVerdict(run: Run): CloudVerdict {
  const own = run.hours.map((hour) => effectiveCloudPct(hour)).filter((pct) => cloudState(pct) === run.state);
  const first = run.hours[0] as HourlyCloud;
  return { state: run.state, effectivePct: own.reduce((sum, pct) => sum + pct, 0) / own.length, at: first.t };
}

export function nightClouds(snapshot: WeatherSnapshot | null, window: Span | null, now: EpochMs): NightClouds {
  const middle = window ? (window.start + window.end) / 2 : now;
  const hours = snapshot && window ? snapshot.hourly.filter((hour) => hour.t >= window.start && hour.t <= window.end) : [];
  if (hours.length < 2) return { kind: 'steady', verdict: cloudVerdict(snapshot, middle) };
  const runs = smooth(runsOf(hours));
  const [first, second] = runs;
  if (runs.length === 1 && first) return { kind: 'steady', verdict: { ...partVerdict(first), at: middle } };
  if (runs.length === 2 && first && second) return { kind: 'change', at: second.hours[0]?.t ?? middle, before: partVerdict(first), after: partVerdict(second) };
  const all = hours.map((hour) => effectiveCloudPct(hour));
  const mean = all.reduce((sum, pct) => sum + pct, 0) / all.length;
  return { kind: 'variable', verdict: { state: cloudState(mean), effectivePct: mean, at: middle } };
}

/** The lines' form: the change's instant as the clock the caller formats. */
export function tonightCloud(clouds: NightClouds, clock: (t: EpochMs) => string): TonightCloud {
  if (clouds.kind === 'steady') return { kind: 'steady', state: clouds.verdict.state };
  if (clouds.kind === 'variable') return { kind: 'variable' };
  return { kind: 'change', before: clouds.before.state, after: clouds.after.state, at: clock(clouds.at) };
}

/** A change's better part, the one the door's line names with its stretch of the dark (D-1028): the later when it is less cloudy. */
export function laterIsBetter(change: { before: CloudState; after: CloudState }): boolean {
  return SEVERITY[change.after] < SEVERITY[change.before];
}
