import type { EpochMs } from '../model';

/**
 * FR-OFF-6 as amended (SPEC v1.1.2, V11-15) / D-272: how long an unanswered
 * install offer stays away, and when it stops coming back at all.
 *
 * D-153 read v1's "shown once" as strictly as it could be — one latch, written
 * by every answer including the softest one — which reads a reader who is not
 * ready today as a reader who will never be ready. The part of that reading
 * worth keeping is about the *browser*, not the reader: `beforeinstallprompt`
 * cannot be replayed inside a page, so a hint that survived someone tapping
 * Install and then closing the browser's own dialog would come back offering a
 * button that no longer works. So installing — by our action or any other
 * route — still ends the offer, and only "Not now" is a snooze.
 */

/**
 * The snooze after each decline, in days (FR-VIS-6: a threshold with its
 * rationale beside it). A week is long enough that the offer is not the same
 * week's question twice and short enough to reach a reader who has since made
 * the app a habit; a month is the back-off for one who has now said no twice.
 * The decline past the last entry — the third, by default — ends the offer
 * instead of setting an expiry, so it can be refused three times and no more.
 */
export const INSTALL_SNOOZE_DAYS: readonly number[] = [7, 30];

const DAY_MS = 86_400_000;

/** What the device remembers about the offer. Every field is absent until the reader has answered once. */
export interface InstallAnswer {
  /** The offer is over: the app was installed, our action was pressed, or the last decline was spent. */
  dismissed?: boolean | undefined;
  /** How many times "Not now" has been pressed. */
  declines?: number | undefined;
  /** When the current snooze runs out. */
  snoozedUntil?: EpochMs | undefined;
}

export type InstallOfferVisibility =
  /** Nothing stands in the way; whether there is an offer to show is the browser's business. */
  | 'shown'
  /** Declined, and the snooze has not run out yet. */
  | 'snoozed'
  /** Answered for good — installed, or declined once past the last snooze. */
  | 'answered';

/** The snooze the `n`th decline (1-based) earns, in ms; `null` when that decline is the last one. */
export function snoozeAfter(declines: number): number | null {
  const days = INSTALL_SNOOZE_DAYS[declines - 1];
  return days === undefined ? null : days * DAY_MS;
}

/** The answer a "Not now" at `now` writes, given what is already remembered (D-272). */
export function decline(answer: InstallAnswer, now: EpochMs): InstallAnswer {
  const declines = (answer.declines ?? 0) + 1;
  const snooze = snoozeAfter(declines);
  return snooze === null ? { dismissed: true, declines } : { declines, snoozedUntil: now + snooze };
}

/**
 * Whether the offer may be put in front of the reader at `now`. The latch wins
 * over everything, an unexpired snooze hides it, and anything else — no answer
 * at all, or a snooze that has run out — shows it.
 */
export function installOfferVisibility(answer: InstallAnswer, now: EpochMs): InstallOfferVisibility {
  if (answer.dismissed === true) return 'answered';
  if (answer.snoozedUntil !== undefined && now < answer.snoozedUntil) return 'snoozed';
  return 'shown';
}
