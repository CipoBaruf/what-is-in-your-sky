import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MOON_FIXTURE, NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import type { Pass, WeatherSnapshot } from '../../../model';
import { PassCard } from './PassCard';

const samplePass: Pass = {
  id: '25544-1789120094063',
  noradId: 25544,
  name: 'ISS (Zarya)',
  start: { t: 1789120094063, azDeg: 46.44, elDeg: 10.0, rangeKm: 1513 },
  peak: { t: 1789120118376, azDeg: 53.33, elDeg: 10.16, rangeKm: 1505 },
  end: { t: 1789120142063, azDeg: 60.03, elDeg: 10.01, rangeKm: 1516 },
  startReason: 'horizon',
  endReason: 'horizon',
  durationS: 48,
  peakMagnitude: 0.48,
  sunAltAtPeakDeg: -10.6,
  twilight: true,
  track: [],
  elementsEpochMs: 1788291742677,
  ...NO_MOON_AT_PEAK, // the Moon reaches the card in R30 (FR-MOON-2)
};

const HOUR = 3_600_000;
const peakHour = Math.floor(samplePass.peak.t / HOUR) * HOUR;
const forecast: WeatherSnapshot = {
  provider: 'open-meteo',
  lat: -38.9,
  lon: -68,
  cellKey: '-38.9,-68.0',
  fetchedAt: samplePass.start.t - 2 * HOUR,
  timeZone: 'America/Argentina/Salta',
  hourly: [
    { t: peakHour, totalPct: 20, lowPct: 10, midPct: 10, highPct: 40 },
    { t: peakHour + HOUR, totalPct: 20, lowPct: 10, midPct: 10, highPct: 40 },
  ],
};

describe('<PassCard> (FR-FIRST-10)', () => {
  it('is two lines: the start time and the name, then the duration, the peak and the magnitude (US-5 AC1)', () => {
    render(<PassCard pass={{ ...samplePass, durationS: 372, peakMagnitude: -3.44, peak: { ...samplePass.peak, elDeg: 67.6, azDeg: 2 } }} timeZone={null} />);
    const card = screen.getByRole('article', { name: 'ISS (Zarya)' });
    expect(within(card).getByTestId('card-first-line')).toHaveTextContent(/^09:48 UTC\s*ISS \(Zarya\)$/);
    expect(within(card).getByTestId('card-detail')).toHaveTextContent('6 min · peak 68° N · mag −3.4');
  });

  it('reads the start in the observer zone when one is known', () => {
    render(<PassCard pass={samplePass} timeZone="America/Argentina/Buenos_Aires" />);
    expect(screen.getByTestId('card-first-line')).toHaveTextContent(/^06:48\s*ISS/);
  });

  it('on the phone’s third step, the brightness phrase in place of the magnitude (FR-GUIDE-3)', () => {
    render(<PassCard pass={samplePass} timeZone={null} detail="phrase" />);
    expect(screen.getByTestId('card-detail')).toHaveTextContent('1 min · peak 10° NE · like a bright star');
  });

  it('is Spanish under a Spanish provider', () => {
    render(
      <I18nProvider locale="es">
        <PassCard pass={samplePass} timeZone={null} tag="Próxima ISS" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('card-detail')).toHaveTextContent('1 min · máx. 10° NE · mag +0,5');
    expect(screen.getByTestId('next-tag')).toHaveTextContent('Próxima ISS');
  });

  it('carries a tag on its first line only when given one (§8 rank 1 as amended)', () => {
    const { rerender } = render(<PassCard pass={samplePass} timeZone={null} />);
    expect(screen.queryByTestId('next-tag')).toBeNull();
    rerender(<PassCard pass={samplePass} timeZone={null} tag="Next ISS" />);
    expect(within(screen.getByTestId('card-first-line')).getByTestId('next-tag')).toHaveTextContent('Next ISS');
  });

  it('carries the "sky still bright" label only when the pass is a twilight one (FR-VIS-7)', () => {
    const { rerender } = render(<PassCard pass={samplePass} timeZone={null} />);
    expect(screen.getByRole('article')).toHaveTextContent('sky still bright');
    rerender(<PassCard pass={{ ...samplePass, twilight: false }} timeZone={null} />);
    expect(screen.getByRole('article')).not.toHaveTextContent('sky still bright');
  });

  it('carries the "[moon glare]" label only when the pass has the verdict (FR-MOON-2)', () => {
    const { rerender } = render(<PassCard pass={{ ...samplePass, moonAtPeak: MOON_FIXTURE, moonGlare: { glare: true, separationDeg: 8.2 } }} timeZone={null} />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('moon glare')).toHaveAccessibleDescription(/at least 50 % lit and closer than 30°/);
    rerender(<PassCard pass={samplePass} timeZone={null} />);
    expect(card).not.toHaveTextContent('moon glare');
  });

  /**
   * R49 (F-14), US-18 AC1: the phase and the illumination are on the card for
   * any Moon that is up at the peak — the glare label is the extra, not the
   * condition. `samplePass` carries a Moon below the horizon, which is the one
   * case with nothing to say.
   */
  it('names the Moon at the peak whenever it is up, glare or not', () => {
    const upNoGlare = { ...samplePass, moonAtPeak: MOON_FIXTURE, moonGlare: { glare: false, separationDeg: 120 } };
    const { rerender } = render(<PassCard pass={upNoGlare} timeZone={null} />);
    const card = screen.getByRole('article');
    expect(within(card).getByTestId('moon-at-peak')).toHaveTextContent('Moon at the peak: waning gibbous, 72 % lit');
    expect(card).not.toHaveTextContent('moon glare');

    rerender(<PassCard pass={{ ...upNoGlare, moonGlare: { glare: true, separationDeg: 8.2 } }} timeZone={null} />);
    expect(within(card).getByTestId('moon-at-peak')).toBeInTheDocument();
    expect(within(card).getByText('moon glare')).toBeInTheDocument();

    rerender(<PassCard pass={samplePass} timeZone={null} />);
    expect(within(card).queryByTestId('moon-at-peak')).toBeNull();
  });

  it('wears the cloud word at the peak when given a forecast, "weather unknown" for null, and none when omitted (FR-WX-3, US-7 AC2)', () => {
    const { rerender } = render(<PassCard pass={samplePass} timeZone="America/Argentina/Salta" weather={forecast} />);
    const card = screen.getByRole('article');
    // 0.6·10 + 0.3·10 + 0.1·40 = 13 %: clear, the figure in the tooltip.
    expect(within(card).getByText('Clear')).toHaveAttribute('data-state', 'clear');
    expect(within(card).getByRole('tooltip')).toHaveTextContent('13 % effective cloud at the pass peak.');
    expect(within(card).getByRole('tooltip')).toHaveTextContent('fetched 2026-09-11 04:48:14 GMT-3');
    rerender(<PassCard pass={samplePass} timeZone={null} weather={null} />);
    expect(within(card).getByText('Weather unknown')).toHaveAttribute('data-state', 'unknown');
    rerender(<PassCard pass={samplePass} timeZone={null} />);
    expect(within(card).queryByText('Weather unknown')).toBeNull();
  });

  it('is one control, named after the pass, only when it can open; the open card is marked', async () => {
    const onOpen = vi.fn();
    const { rerender, container } = render(<PassCard pass={samplePass} timeZone={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<PassCard pass={samplePass} timeZone={null} onOpen={onOpen} selected />);
    await userEvent.click(screen.getByRole('button', { name: 'Open guide → ISS (Zarya)' }));
    expect(onOpen).toHaveBeenCalledWith(samplePass.id);
    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });
});
