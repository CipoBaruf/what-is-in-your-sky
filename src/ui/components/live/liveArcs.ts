import { arcState } from '../../../lib/arcReveal';
import type { EpochMs, Pass } from '../../../model';
import type { ChartPass } from '../guide/skychart/SkyChart.types';

/**
 * R48 (FR-TRAJ-1, FR-TRAJ-3, D-189): the live page's passes with the state
 * their arc is drawn in at the shown instant — `arcState(pass, t)` per pass,
 * carried on the props so the chart, whichever view is mounted, and the
 * legend read one value (D-186).
 *
 * The instant moves on every frame at 3600×, and most frames change no
 * state. When none has changed the previous array is returned as it is, so
 * the chart's memoised geometry and the legend's rows are recomputed only
 * when an arc appears, grows into `live`, fades or goes — which is what the
 * eye sees change.
 */
export function withArcStates(passes: readonly Pass[], t: EpochMs, previous: readonly ChartPass[] | null): readonly ChartPass[] {
  if (previous !== null && previous.length === passes.length && previous.every((prev, i) => sameAs(prev, passes[i], t))) return previous;
  return passes.map((pass) => ({ ...pass, arc: arcState(pass, t) }));
}

const sameAs = (prev: ChartPass, pass: Pass | undefined, t: EpochMs): boolean => pass !== undefined && prev.id === pass.id && prev.track === pass.track && prev.arc === arcState(pass, t);
