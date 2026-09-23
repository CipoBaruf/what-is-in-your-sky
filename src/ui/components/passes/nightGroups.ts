import { nightOf, type NightKey } from '../../../lib/nights';
import type { Pass } from '../../../model';

/**
 * US-16 AC5 as amended v2.1 (FR-NIGHT-1, D-534, F-90): the list cut into
 * nights, a night being local noon to the next local noon in the observer's
 * zone — or the device's until one is known (`lib/nights`). A pass belongs to
 * the night holding its *start*, so one that straddles a noon is listed once,
 * and a pass before dawn sits under the evening before it rather than beside
 * that evening's passes of the same date.
 *
 * Until v2.1 a night was 24 h from the instant of the computation (the
 * worker's nights, D-95), which filed a 01:00 run's 05:00 and 21:00 passes
 * together. The worker still searches in its own 24 h slices; only the
 * grouping the reader sees is cut here.
 *
 * Only nights holding a pass are returned, in order (FR-NIGHT-2: a night with
 * no pass left is not drawn). `index` is the group's place in that order, for
 * the disclosure ids; `key` is its identity across ticks, which the reader's
 * open-and-closed choices hang on, since the first night leaves the list when
 * its last pass does.
 */
export interface NightGroup {
  /** 0, 1, 2 … — the group's place in the list. */
  index: number;
  /** The local date of the noon the night began at (`lib/nights`). */
  key: NightKey;
  passes: Pass[];
}

export function groupByNight(passes: readonly Pass[], zone: string | null): NightGroup[] {
  const byKey = new Map<NightKey, Pass[]>();
  for (const pass of passes) {
    const key = nightOf(pass.start.t, zone);
    const group = byKey.get(key);
    if (group) group.push(pass);
    else byKey.set(key, [pass]);
  }
  return [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, group], index) => ({ index, key, passes: group }));
}
