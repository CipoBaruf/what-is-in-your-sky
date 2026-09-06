import { arcState, type ArcState } from '../../../lib/arcReveal';
import type { EpochMs, Pass } from '../../../model';
import type { ChartPass } from '../guide/skychart/SkyChart.types';

/**
 * R48 (FR-TRAJ-1, FR-TRAJ-3, D-189): the live page's passes with the state
 * their arc is drawn in at the shown instant — `arcState(pass, t)` per pass,
 * carried on the props so the chart, whichever view is mounted, and the
 * legend read one value (D-186).
 *
 * The instant moves on every frame at 3600×, and most frames change no
 * state. `arcKey` is the states as one string, cheap to compute per frame;
 * the page memoises `withArcStates` on the passes and that key, so the
 * array — and with it the chart's memoised geometry and the legend's rows —
 * is remade only when an arc appears, grows into `live`, fades or goes,
 * which is what the eye sees change. (A key rather than a comparison with
 * the previous array: React forbids a ref written during render.)
 */
export const ARC_KEY_SEPARATOR = ' ';

export function arcKey(passes: readonly Pass[], t: EpochMs): string {
  return passes.map((pass) => arcState(pass, t)).join(ARC_KEY_SEPARATOR);
}

/** The passes with the states `key` names, in order; a key from another list is a programming error. */
export function withArcStates(passes: readonly Pass[], key: string): readonly ChartPass[] {
  const states = key === '' ? [] : (key.split(ARC_KEY_SEPARATOR) as ArcState[]);
  if (states.length !== passes.length) throw new Error(`withArcStates: ${String(states.length)} states for ${String(passes.length)} passes`);
  return passes.map((pass, i) => ({ ...pass, arc: states[i] ?? 'hidden' }));
}
