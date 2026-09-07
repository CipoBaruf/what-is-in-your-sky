/**
 * FR-OFF-6 as amended (SPEC v1.1.2, V11-15) / D-272: the rule at its
 * boundaries. Nothing stored shows the offer; each decline hides it for its
 * own number of days, to the millisecond; the decline past the last snooze
 * ends it; and an install ends it whatever the count says.
 */
import { describe, expect, it } from 'vitest';
import { INSTALL_SNOOZE_DAYS, decline, installOfferVisibility, snoozeAfter, type InstallAnswer } from './installSnooze';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 6, 21, 0);

describe('the install offer snooze (FR-OFF-6 as amended, D-272)', () => {
  it('shows the offer on a device that has answered nothing', () => {
    expect(installOfferVisibility({}, NOW)).toBe('shown');
  });

  it('hides it for exactly the first snooze, and shows it again on the millisecond it ends', () => {
    const answer = decline({}, NOW);
    expect(answer).toEqual({ declines: 1, snoozedUntil: NOW + 7 * DAY });
    expect(installOfferVisibility(answer, NOW)).toBe('snoozed');
    expect(installOfferVisibility(answer, NOW + 7 * DAY - 1)).toBe('snoozed');
    expect(installOfferVisibility(answer, NOW + 7 * DAY)).toBe('shown');
  });

  it('backs off to the second snooze on the second decline', () => {
    const second = decline(decline({}, NOW), NOW + 7 * DAY);
    expect(second).toEqual({ declines: 2, snoozedUntil: NOW + 37 * DAY });
    expect(installOfferVisibility(second, NOW + 37 * DAY - 1)).toBe('snoozed');
    expect(installOfferVisibility(second, NOW + 37 * DAY)).toBe('shown');
  });

  it('ends the offer on the decline past the last snooze, with no expiry left to run out', () => {
    const third = decline(decline(decline({}, NOW), NOW + 7 * DAY), NOW + 37 * DAY);
    expect(third).toEqual({ dismissed: true, declines: 3 });
    expect(third.snoozedUntil).toBeUndefined();
    expect(installOfferVisibility(third, NOW + 37 * DAY)).toBe('answered');
    expect(installOfferVisibility(third, NOW + 3650 * DAY)).toBe('answered');
  });

  it('lets the latch win over an unexpired snooze: an install answers it whatever the count says', () => {
    const installedMidSnooze: InstallAnswer = { ...decline({}, NOW), dismissed: true };
    expect(installOfferVisibility(installedMidSnooze, NOW)).toBe('answered');
  });

  /** The count is what picks the snooze, so it decides where the last one is (FR-VIS-6: the threshold, not a literal). */
  it('has one snooze per entry and none past the last', () => {
    for (const [index, days] of INSTALL_SNOOZE_DAYS.entries()) expect(snoozeAfter(index + 1)).toBe(days * DAY);
    expect(snoozeAfter(INSTALL_SNOOZE_DAYS.length + 1)).toBeNull();
    expect(INSTALL_SNOOZE_DAYS).toEqual([7, 30]);
  });
});
