import type { SkyBand, Span } from '../../../lib/timeStripe';
import { tonightSpan, tonightsDark } from '../../../lib/tonightStripe';
import type { EpochMs, Observer, Pass } from '../../../model';
import type { NightKey } from '../../../lib/nights';
import { defaultOpenNight, tonightKey } from '../../components/passes/PassList';
import { groupByNight, type NightGroup } from '../../components/passes/nightGroups';

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513): what the phone's **when** and
 * **what** steps count, from one rule so the two can never disagree — the when
 * step's `5 tonight, 7 in 72 h` is the what step's "Five things cross tonight"
 * and its cards.
 *
 * Tonight is the night the list opens on (`defaultOpenNight`, US-16 AC5 as
 * amended v2.1: a night is local noon to local noon in `zone`), less the
 * passes already over: a first visit is about what is still to come. The
 * later nights are every pass after it, and the total is the two together.
 */
export interface TonightSplit {
  tonight: Pass[];
  /** The nights after tonight that hold a pass, each chronological. */
  laterNights: NightGroup[];
  later: Pass[];
  /** FR-NIGHT-1's tonight, which the later nights are named against (`nightLabel`). */
  tonightKey: NightKey;
}

const byStart = (a: Pass, b: Pass): number => a.start.t - b.start.t;

export function splitTonight(passes: readonly Pass[], zone: string | null, now: EpochMs): TonightSplit {
  const groups = groupByNight(passes, zone);
  const open = defaultOpenNight(groups, now, zone) ?? '';
  const tonight = (groups.find((group) => group.key === open)?.passes ?? []).filter((pass) => pass.end.t > now).sort(byStart);
  const laterNights = groups.filter((group) => group.key > open && group.passes.length > 0).map((group) => ({ ...group, passes: [...group.passes].sort(byStart) }));
  return { tonight, laterNights, later: laterNights.flatMap((group) => group.passes), tonightKey: tonightKey(groups, now, zone) };
}

/**
 * The stretch of tonight the Moon's sentence and the cloud word are about: the
 * rest of the dark band (from now if it is already open), or the stripe's
 * twelve hours where there is no dark band (OQ-33).
 */
export function nightWindow(bands: readonly SkyBand[], observer: Pick<Observer, 'lon' | 'timeZone'>, now: EpochMs): Span {
  const dark = tonightsDark(bands, now);
  if (dark) return { start: Math.max(dark.from, now), end: dark.to };
  return tonightSpan(bands, observer, now);
}
