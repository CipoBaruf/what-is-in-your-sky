/**
 * R30 (FR-MOON-4, FR-MOON-5, US-18 AC3): the tradition line — labelled as
 * tradition in both languages, carrying the sign, the folk name inside its
 * window and one reviewed one-liner, and stating no observing fact. The
 * wording of the file itself is gated in `data/moon/lore.test.ts`; what is
 * checked here is what reaches the page and how it is announced.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale, MoonState } from '../../../model';
import { MoonLore } from './MoonLore';

/** The R19 fixture Moon: 72 % lit waning gibbous at ecliptic longitude 43.8°, which is Taurus. */
const waningGibbous = MOON_FIXTURE;
/** Full, on 2026-01-01 at 02:00 UTC — the last hours of December where the observer stands three hours west. */
const full: MoonState = { ...MOON_FIXTURE, t: Date.UTC(2026, 0, 1, 2, 0), phaseAngleDeg: 180, phase: 'full', illuminatedFraction: 0.999 };

const show = (moon: MoonState, timeZone: string | null = null, locale: Locale = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <MoonLore moon={moon} timeZone={timeZone} />
    </I18nProvider>,
  );

describe('<MoonLore> (FR-MOON-4)', () => {
  it('is a region named as tradition, with the sign and the sign’s line', async () => {
    const { container } = show(waningGibbous);
    const section = screen.getByRole('region', { name: 'Moon tonight lore' });
    expect(section).toHaveTextContent('The Moon is in Taurus.');
    expect(section).toHaveTextContent('The bull carries Aldebaran, the star Arabic astronomers called the follower for trailing the Pleiades across the sky.');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds the month’s folk name and the file’s hemisphere note within a day of full (D-123: and the phase’s line there)', () => {
    const section = show(full).getByRole('region', { name: 'Moon tonight lore' });
    expect(section).toHaveTextContent('full Moon is known as the Wolf Moon');
    expect(section).toHaveTextContent('The full Moon rises as the Sun sets');
    expect(section).toHaveTextContent('These names follow the seasons of the northern hemisphere');
  });

  it('takes the month from the observer’s zone, not from UTC', () => {
    const section = show(full, 'America/Argentina/Salta').getByRole('region', { name: 'Moon tonight lore' });
    expect(section).toHaveTextContent('the Cold Moon');
    expect(section).not.toHaveTextContent('Wolf Moon');
  });

  it('leaves the folk name and its note out on every other night', () => {
    const section = show(waningGibbous).getByRole('region', { name: 'Moon tonight lore' });
    expect(section).not.toHaveTextContent('Wolf Moon');
    expect(section).not.toHaveTextContent('northern hemisphere');
  });

  it('states no observing fact: no phase name, no illumination, no direction (FR-MOON-5)', () => {
    const section = show(waningGibbous).getByRole('region', { name: 'Moon tonight lore' });
    expect(section).not.toHaveTextContent('waning gibbous');
    expect(section).not.toHaveTextContent('72 %');
    expect(section).not.toHaveTextContent('29°');
  });

  it('is Spanish under a Spanish provider, tradition label included (FR-I18N-2)', () => {
    const section = show(waningGibbous, null, 'es').getByRole('region', { name: 'La Luna esta noche tradición' });
    expect(section).toHaveTextContent('La Luna está en Tauro.');
    expect(section).toHaveTextContent('El toro lleva a Aldebarán');
    expect(section).not.toHaveTextContent('The Moon is in');
  });
});
