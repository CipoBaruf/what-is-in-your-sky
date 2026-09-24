import type { NoradId, Pass } from '../model';

/**
 * R97 (FR-FAINT-1, D-623): which passes the list leaves out by default. Pure:
 * a function of the stored run and of the three exemptions the caller names,
 * so the list, the count line, the nights' counts and tonight's stripe, which
 * all read `useShownPasses`, cannot disagree about a pass.
 *
 * The two thresholds are FR-VIS-6 thresholds, documented here with their
 * rationale. They sit in this module rather than in `physics/constants.ts`
 * because nothing in `src/physics` reads them — the worker still finds every
 * pass down to `MAG_LIMIT` — and because that module is outside the `ui`
 * lane, the precedent `ENDED_LINGER_S` set in `lib/nights.ts` (R88).
 */

/**
 * A pass whose peak magnitude is greater than this is faint: about what a
 * suburban sky shows to an unpractised eye, a magnitude brighter than the
 * `MAG_LIMIT` (+4.5) the worker searches down to, which a dark-adapted
 * observer under a good sky can still pick out.
 */
export const FAINT_MAG = 3.5;

/**
 * The same limit for a pass tagged `[moon glare]` (FR-MOON-2): a bright Moon
 * within 30° of the peak washes out about a magnitude around it, so a pass
 * the plain rule keeps can still be one the reader will not find.
 */
export const FAINT_MAG_MOON = 2.5;

/** The passes never left out, whatever their figures (FR-FAINT-1). */
export interface FaintExemptions {
  /** A pass of the ISS: the object people go out for (the featured object, spec §8 rank 1). */
  isIss: (noradId: NoradId) => boolean;
  /** The pass the next-event block names, so the block never counts down to a pass the list hides. */
  nextEventId: string | null;
  /** The open pass: the one on the screen, or the one a link opened (FR-FAINT-3). */
  openId: string | null;
}

/** The faintest peak magnitude a pass may have and still be shown by default. */
export function faintLimit(pass: Pass): number {
  return pass.moonGlare.glare ? FAINT_MAG_MOON : FAINT_MAG;
}

/** Whether a pass is faint (FR-FAINT-1): fainter than its limit, and none of the three exemptions. */
export function isFaint(pass: Pass, exempt: FaintExemptions): boolean {
  if (pass.peakMagnitude <= faintLimit(pass)) return false;
  return !(exempt.isIss(pass.noradId) || pass.id === exempt.nextEventId || pass.id === exempt.openId);
}

/** The run split in two, each side in the run's own order. */
export function splitFaint(passes: readonly Pass[], exempt: FaintExemptions): { bright: Pass[]; faint: Pass[] } {
  const bright: Pass[] = [];
  const faint: Pass[] = [];
  for (const pass of passes) (isFaint(pass, exempt) ? faint : bright).push(pass);
  return { bright, faint };
}
