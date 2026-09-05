/**
 * R32 (FR-LIVE-3): the five fields of the status strip, worded from the
 * values the page hands in — the instant in the observer's zone with its
 * abbreviation, the sky state in words, the cloud cover or "unknown", the
 * count, and the Moon's phase and illumination — in both languages, with the
 * pending reading while the astronomy has not arrived.
 */
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import type { CloudVerdict } from '../../../model';
import { StatusStrip } from './StatusStrip';

const T = 1_789_120_104_063; // inside the R1 golden pass, 10 s after its start (2026-09-11 09:48:24 UTC)
const unknown: CloudVerdict = { state: 'unknown', effectivePct: null, at: T };
const clear: CloudVerdict = { state: 'clear', effectivePct: 12.4, at: T };

const field = (id: string): HTMLElement => screen.getByTestId(`live-${id}`);

describe('<StatusStrip>', () => {
  it('shows the five fields: the instant in the zone with its abbreviation, the sky, the clouds, the count and the Moon', async () => {
    const { container } = render(<StatusStrip t={T} timeZone="America/Argentina/Salta" sky="dark" cloud={clear} count={3} moon={MOON_FIXTURE} />);
    const strip = screen.getByTestId('status-strip');
    expect(strip.tagName).toBe('DL');
    expect(strip).toHaveAttribute('aria-label', 'Sky status');
    expect(within(strip).getAllByRole('term').map((term) => term.textContent)).toEqual(['Time', 'Sky', 'Clouds', 'Visible', 'Moon']);
    expect(field('time')).toHaveTextContent('2026-09-11 06:48:24 GMT-3');
    expect(field('time').querySelector('time')).toHaveAttribute('datetime', '2026-09-11T09:48:24.063Z');
    expect(field('sky')).toHaveTextContent('dark');
    expect(field('cloud')).toHaveTextContent('Clear, 12 % cloud');
    expect(field('cloud').querySelector('[data-state]')).toHaveAttribute('data-state', 'clear');
    expect(field('count')).toHaveTextContent('3 satellites');
    expect(field('count').querySelector('[data-count]')).toHaveAttribute('data-count', '3');
    expect(field('moon')).toHaveTextContent('waning gibbous, 72 % lit');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says UTC without a zone, "unknown" without a forecast, one satellite in the singular, and the other two sky states', () => {
    const { rerender } = render(<StatusStrip t={T} timeZone={null} sky="bright-twilight" cloud={unknown} count={1} moon={MOON_FIXTURE} />);
    expect(field('time')).toHaveTextContent('2026-09-11 09:48:24 UTC');
    expect(field('sky')).toHaveTextContent('bright twilight');
    expect(field('cloud')).toHaveTextContent('Weather unknown');
    expect(field('count')).toHaveTextContent('1 satellite');
    rerender(<StatusStrip t={T} timeZone={null} sky="day" cloud={unknown} count={0} moon={MOON_FIXTURE} />);
    expect(field('sky')).toHaveTextContent('day');
    expect(field('count')).toHaveTextContent('0 satellites');
  });

  it('marks the sky and the Moon as pending until the astronomy chunk has evaluated them', () => {
    render(<StatusStrip t={T} timeZone={null} sky={null} cloud={unknown} count={0} moon={null} />);
    expect(field('sky')).toHaveTextContent('…');
    expect(field('sky').querySelector('[data-sky]')).toHaveAttribute('data-sky', 'pending');
    expect(field('moon')).toHaveTextContent('…');
  });

  it('adds the speed as a sixth field while playing, and not otherwise (R33, FR-LIVE-3)', () => {
    const { rerender } = render(<StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} speed={600} />);
    expect(within(screen.getByTestId('status-strip')).getAllByRole('term').map((term) => term.textContent)).toEqual(['Time', 'Sky', 'Clouds', 'Visible', 'Moon', 'Speed']);
    expect(field('speed')).toHaveTextContent('600×');
    expect(field('speed').querySelector('[data-speed]')).toHaveAttribute('data-speed', '600');
    rerender(<StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} speed={null} />);
    expect(screen.queryByTestId('live-speed')).toBeNull();
  });

  /** R44 (FR-WIN-3, US-21 AC6, F-41): the seventh field, shown only while the dome is following the phone. */
  it('names the true-north correction while following, in both languages, and drops the field otherwise', () => {
    const { rerender } = render(<StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} declinationDeg={1.1187} />);
    expect(within(screen.getByTestId('status-strip')).getAllByRole('term').map((term) => term.textContent)).toEqual(['Time', 'Sky', 'Clouds', 'Visible', 'Moon', 'Heading']);
    expect(field('heading')).toHaveTextContent('true north, declination +1.1°');
    expect(field('heading').querySelector('[data-declination]')).toHaveAttribute('data-declination', '1.1');

    // West of true north is a signed value, with the typographic minus `formatSignedDegrees` writes.
    rerender(<StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} declinationDeg={-12.4943} />);
    expect(field('heading')).toHaveTextContent('true north, declination −12.5°');

    // Zero is still a correction worth naming: it says the compass and the sky agree here.
    rerender(<StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} declinationDeg={0} />);
    expect(field('heading')).toHaveTextContent('true north, declination +0.0°');

    // Not following: no heading is being corrected, so there is nothing to say.
    rerender(<StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} declinationDeg={null} />);
    expect(screen.queryByTestId('live-heading')).toBeNull();

    render(
      <I18nProvider locale="es">
        <StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={MOON_FIXTURE} declinationDeg={1.1187} />
      </I18nProvider>,
    );
    // Spanish takes the comma as the decimal mark (FR-I18N-4, `formatSignedDegrees`).
    expect(screen.getAllByTestId('live-heading')[0]).toHaveTextContent('Rumbo norte verdadero, declinación +1,1°');
  });

  it('speaks Spanish (FR-I18N-2), with the zone abbreviation Intl gives that language', () => {
    render(
      <I18nProvider locale="es">
        <StatusStrip t={T} timeZone="America/Argentina/Salta" sky="dark" cloud={clear} count={2} moon={MOON_FIXTURE} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('status-strip')).toHaveAttribute('aria-label', 'Estado del cielo');
    expect(field('time')).toHaveTextContent('2026-09-11 06:48:24 GMT-3');
    expect(field('sky')).toHaveTextContent('oscuro');
    expect(field('cloud')).toHaveTextContent('Despejado, 12 % de nubes');
    expect(field('count')).toHaveTextContent('2 satélites');
    expect(field('moon')).toHaveTextContent('gibosa menguante, 72 % iluminada');
  });
});
