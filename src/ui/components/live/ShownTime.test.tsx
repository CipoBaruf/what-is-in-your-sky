/**
 * R143 (FR-TONIGHT-7, D-903): the headline and the context line, one case each — the time with seconds and `now`
 * at real time, the offset ahead and behind, `tonight`, the weekday; the up pass, the sky form, the two no-pass
 * sentences — in both languages.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { I18nProvider } from '../../../i18n/useT';
import { tonightBand } from '../../../lib/shownTime';
import type { SkyBand } from '../../../lib/timeStripe';
import { ContextLine, ShownTime, shownTimeText, type ShownTimeProps } from './ShownTime';

const ZONE = 'America/Argentina/Salta';
const H = 3_600_000;
const MIN = 60_000;
/** Friday 2026-09-11, 12:00:07 local. */
const NOW = Date.UTC(2026, 8, 11, 15, 0, 7);
const BANDS: SkyBand[] = [
  { from: NOW, to: NOW + 7 * H, sky: 'day' },
  { from: NOW + 7 * H, to: NOW + 18 * H, sky: 'dark' },
  { from: NOW + 18 * H, to: NOW + 24 * H, sky: 'day' },
];
const NIGHT = tonightBand(BANDS, NOW);
/** On real time at `NOW`, the 1 s clock on the same second; `held` holds `t` off it. */
const LIVE: ShownTimeProps = { t: NOW, realTime: true, now: NOW, clock: NOW, night: NIGHT, timeZone: ZONE };
const held = (t: number): ShownTimeProps => ({ ...LIVE, t, realTime: false });

const es = (children: React.ReactElement) => <I18nProvider locale="es">{children}</I18nProvider>;

describe('<ShownTime>', () => {
  it('shows the time with its seconds and `now` in the accent at real time, the zone spoken', () => {
    render(<ShownTime {...LIVE} />);
    const headline = screen.getByTestId('shown-time');
    expect(headline).toHaveTextContent(/^Shown time: 12:00:07 GMT-3 now$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
    expect(headline.querySelector('time')?.firstChild?.textContent).toBe('12:00:07');
  });

  it('reads the seconds from the 1 s clock on real time, not from t’s 10 s tick', () => {
    const { rerender } = render(<ShownTime {...LIVE} clock={NOW + 3_000} />);
    expect(screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent).toBe('12:00:10');
    rerender(<ShownTime {...LIVE} clock={NOW + 4_000} />);
    expect(screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent).toBe('12:00:11');
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^now$/);
  });

  it('is `now` by the realTime flag: a held instant on the clock reads the offset, under a minute as <1 min', () => {
    const { rerender } = render(<ShownTime {...held(NOW)} />);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
    expect(screen.getByTestId('shown-time')).toHaveTextContent(/12:00 GMT-3 in <1 min$/);
    rerender(<ShownTime {...held(NOW - 20_000)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^<1 min ago$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'behind');
    rerender(es(<ShownTime {...held(NOW - 20_000)} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^hace <1 min$/);
  });

  it('drops the seconds off real time and says how far ahead or behind', () => {
    const { rerender } = render(<ShownTime {...held(NOW + 6 * H + 12 * MIN)} />);
    expect(screen.getByTestId('shown-time')).toHaveTextContent(/18:12 GMT-3 in 6 h 12 min$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
    rerender(<ShownTime {...held(NOW - 12 * MIN)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^12 min ago$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'behind');
  });

  it('puts tonight in front inside the night band, and the weekday outside it once past today', () => {
    const { rerender } = render(<ShownTime {...held(NOW + 9 * H)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^tonight · in 9 h 00 min$/);
    rerender(<ShownTime {...held(NOW + 19 * H)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^Sat · in 19 h 00 min$/);
  });

  it('speaks Spanish', () => {
    const { rerender } = render(es(<ShownTime {...LIVE} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^ahora$/);
    rerender(es(<ShownTime {...held(NOW + 9 * H)} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^esta noche · en 9 h 00 min$/);
    rerender(es(<ShownTime {...held(NOW + 19 * H)} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^sáb · en 19 h 00 min$/);
    rerender(es(<ShownTime {...held(NOW - 12 * MIN)} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^hace 12 min$/);
  });

  it('gives the headline as one string for the track’s value text', () => {
    expect(shownTimeText(en, 'en', held(NOW + 9 * H))).toBe('21:00 GMT-3 tonight · in 9 h 00 min');
    expect(shownTimeText(en, 'en', { ...LIVE, timeZone: null })).toBe('15:00:07 UTC now');
  });
});

describe('<ContextLine>', () => {
  it('names an up pass and what it does next, the name the part that gives way', () => {
    render(<ContextLine parts={{ kind: 'up', name: 'Tiangong', event: 'peak', point: 'SE', inMs: 40_000 }} timeZone={ZONE} />);
    const line = screen.getByTestId('context-line');
    expect(line).toHaveTextContent(/^Tiangong · peaks SE 0:40$/);
    expect(line).toHaveAttribute('data-kind', 'up');
    expect(line.firstElementChild).toHaveTextContent(/^Tiangong$/);
    // The separator is the catalog's own string, in the tail with what the pass does.
    expect(line.lastElementChild?.textContent).toBe(`${en.live.context.separator}peaks SE 0:40`);
  });

  it('words the end by its reason, in Spanish too', () => {
    const { rerender } = render(<ContextLine parts={{ kind: 'up', name: 'ISS', event: 'shadow', point: 'NE', inMs: 72_000 }} timeZone={ZONE} />);
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^ISS · into shadow NE 1:12$/);
    rerender(es(<ContextLine parts={{ kind: 'up', name: 'ISS', event: 'horizon', point: 'NE', inMs: 72_000 }} timeZone={ZONE} />));
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^ISS · se pone NE 1:12$/);
  });

  it('is the sky, the cloud and the next rise', () => {
    const { rerender } = render(<ContextLine parts={{ kind: 'sky', sky: 'dark', cloud: 'clear', nextAt: NOW + 9 * H + 47 * MIN }} timeZone={ZONE} />);
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^Dark · Clear · next 21:47$/);
    rerender(<ContextLine parts={{ kind: 'sky', sky: null, cloud: 'partly', nextAt: NOW + 9 * H + 47 * MIN }} timeZone={ZONE} />);
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^… · Partly · next 21:47$/);
    rerender(es(<ContextLine parts={{ kind: 'sky', sky: 'dark', cloud: 'clear', nextAt: NOW + 9 * H + 47 * MIN }} timeZone={ZONE} />));
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^Oscuro · Limpio · próximo 21:47$/);
  });

  it('draws S/d and says sin datos', () => {
    render(es(<ContextLine parts={{ kind: 'sky', sky: 'bright-twilight', cloud: 'unknown', nextAt: NOW + 9 * H + 47 * MIN }} timeZone={ZONE} />));
    const line = screen.getByTestId('context-line');
    expect(line.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^Crepúsculo · S\/d · próximo 21:47$/);
    expect(line).toHaveTextContent(/Crepúsculo · sin datos · próximo 21:47$/);
  });

  it('says the two no-pass sentences in both languages', () => {
    const { rerender } = render(<ContextLine parts={{ kind: 'none', reason: 'span' }} timeZone={ZONE} />);
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^No visible pass in 24 h$/);
    rerender(<ContextLine parts={{ kind: 'none', reason: 'tonight' }} timeZone={ZONE} />);
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^No visible pass tonight$/);
    rerender(es(<ContextLine parts={{ kind: 'none', reason: 'span' }} timeZone={ZONE} />));
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^Ningún pase visible en 24 h$/);
    rerender(es(<ContextLine parts={{ kind: 'none', reason: 'tonight' }} timeZone={ZONE} />));
    expect(screen.getByTestId('context-line')).toHaveTextContent(/^Ningún pase visible esta noche$/);
  });
});
