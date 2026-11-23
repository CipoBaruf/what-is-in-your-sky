/**
 * R143 (FR-TONIGHT-7, D-903): the headline and the context line, one case each — the time with seconds at real
 * time; the up pass, the sky form, the two no-pass sentences. R213 (FR-STRIP-6, FR-DARK-3): the time line's end,
 * `● live` or the offset, and the daytime line. Both languages.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { I18nProvider } from '../../../i18n/useT';
import { ContextLine, DaytimeLine, ShownTime, shownTimeText, type ShownTimeProps } from './ShownTime';

const ZONE = 'America/Argentina/Salta';
const H = 3_600_000;
const MIN = 60_000;
/** Friday 2026-09-11, 12:00:07 local. */
const NOW = Date.UTC(2026, 8, 11, 15, 0, 7);
/** On real time at `NOW`, the 1 s clock on the same second; `held` holds `t` off it. */
const LIVE: ShownTimeProps = { t: NOW, realTime: true, now: NOW, clock: NOW, timeZone: ZONE };
const held = (t: number): ShownTimeProps => ({ ...LIVE, t, realTime: false });

const es = (children: React.ReactElement) => <I18nProvider locale="es">{children}</I18nProvider>;

describe('<ShownTime>', () => {
  it('ends with `● live` on real time, after the time with its seconds, the zone spoken (FR-STRIP-6)', () => {
    render(<ShownTime {...LIVE} />);
    const headline = screen.getByTestId('shown-time');
    expect(headline).toHaveTextContent(/^Shown time: 12:00:07 GMT-3 ● live$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
    expect(headline.querySelector('time')?.firstChild?.textContent).toBe('12:00:07');
  });

  it('reads the seconds from the 1 s clock on real time, not from t’s 10 s tick', () => {
    const { rerender } = render(<ShownTime {...LIVE} clock={NOW + 3_000} />);
    expect(screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent).toBe('12:00:10');
    rerender(<ShownTime {...LIVE} clock={NOW + 4_000} />);
    expect(screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent).toBe('12:00:11');
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^● live$/);
  });

  it('is live by the realTime flag alone: a held instant on the clock reads the offset', () => {
    const { rerender } = render(<ShownTime {...held(NOW)} />);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
    expect(screen.getByTestId('shown-time')).toHaveTextContent(/12:00 GMT-3 \+0 min$/);
    rerender(<ShownTime {...held(NOW - MIN)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^−1 min$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'behind');
  });

  it('drops the seconds off real time and ends with the offset, ahead or behind (FR-STRIP-6)', () => {
    const { rerender } = render(<ShownTime {...held(NOW + 6 * H + 12 * MIN)} />);
    expect(screen.getByTestId('shown-time')).toHaveTextContent(/18:12 GMT-3 \+6 h 12 min$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
    rerender(<ShownTime {...held(NOW - 12 * MIN)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^−12 min$/);
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'behind');
  });

  it('says the offset alone, with no word for the night or the day (FR-STRIP-6)', () => {
    const { rerender } = render(<ShownTime {...held(NOW + 2 * H + 10 * MIN)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^\+2 h 10 min$/);
    rerender(<ShownTime {...held(NOW - 35 * MIN)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^−35 min$/);
    rerender(<ShownTime {...held(NOW + 19 * H)} />);
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^\+19 h 00 min$/);
  });

  it('speaks Spanish', () => {
    const { rerender } = render(es(<ShownTime {...LIVE} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^● en vivo$/);
    rerender(es(<ShownTime {...held(NOW - 12 * MIN)} />));
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(/^−12 min$/);
  });

  it('gives the headline as one string for the track’s value text', () => {
    expect(shownTimeText(en, 'en', held(NOW + 9 * H))).toBe('21:00 GMT-3 +9 h 00 min');
    expect(shownTimeText(en, 'en', { ...LIVE, timeZone: null })).toBe('15:00:07 UTC live');
  });
});

describe('<DaytimeLine>', () => {
  it('says that satellites show after dusk, in both languages (FR-DARK-3)', () => {
    const { rerender } = render(<DaytimeLine />);
    expect(screen.getByTestId('daytime-line')).toHaveTextContent(/^Daytime · satellites show after dusk$/);
    rerender(es(<DaytimeLine />));
    expect(screen.getByTestId('daytime-line')).toHaveTextContent(/^De día · los satélites se ven al anochecer$/);
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
