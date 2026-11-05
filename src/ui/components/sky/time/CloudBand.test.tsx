/**
 * R187 (FR-WIDE-8, US-55 AC3): the cloud band on the overview and the stripe — one path per shaded band for a fixed
 * forecast, the hour with no forecast left blank like clear, and the runs sentence as the slider's description in
 * both languages.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/useT';
import { CLOUD_BAND_PX } from '../../../../lib/cloudBand';
import type { Span } from '../../../../lib/timeStripe';
import type { HourlyCloud, Locale } from '../../../../model';
import { StripeOverview } from './StripeOverview';
import { TimeStripe } from './TimeStripe';

const H = 3_600_000;
const T0 = Date.parse('2026-01-15T22:00Z');
const span: Span = { start: T0, end: T0 + 8 * H };
const at = (h: number, totalPct: number): HourlyCloud => ({ t: T0 + h * H, totalPct });
// Clear 22–23, mostly cloudy 23–02, clear 02–04, no forecast 04–05, overcast 05–06.
const forecast: HourlyCloud[] = [at(0, 5), at(1, 60), at(2, 70), at(3, 75), at(4, 10), at(5, 0), at(7, 95)];

afterEach(cleanup);

function overview(locale: Locale, clouds: readonly HourlyCloud[] | null = forecast) {
  return render(
    <I18nProvider locale={locale}>
      <StripeOverview span={span} passes={[]} bands={[]} t={T0} timeZone="UTC" onScrub={vi.fn()} {...(clouds !== null ? { clouds } : {})} />
    </I18nProvider>,
  );
}

describe('the cloud band (FR-WIDE-8)', () => {
  it('FR-WIDE-8: one path per shaded band along the foot, clear and the gap left blank', () => {
    const { container } = overview('en');
    const paths = [...container.querySelectorAll('[data-row="clouds"] path')];
    expect(paths.map((path) => path.getAttribute('data-cloud'))).toEqual(['mostly', 'overcast']);
    // 600 px for 8 h is 75 px an hour; the overview is 24 px tall, the band its last CLOUD_BAND_PX.
    const top = (24 - CLOUD_BAND_PX).toFixed(1);
    expect(paths[0]?.getAttribute('d')).toBe(`M75.0 ${top}H300.0V24.0H75.0Z`);
    expect(paths[1]?.getAttribute('d')).toBe(`M525.0 ${top}H600.0V24.0H525.0Z`);
  });

  it('FR-WIDE-8: the runs sentence is the slider\'s description, in English and in Spanish', () => {
    overview('en');
    expect(screen.getByRole('slider', { name: 'Night overview' })).toHaveAccessibleDescription(
      'Clouds: clear until 23:00, mostly cloudy 23:00–02:00, clear 02:00–04:00, no forecast 04:00–05:00, then overcast',
    );
    cleanup();
    overview('es');
    expect(screen.getByRole('slider', { name: 'Vista de la noche' })).toHaveAccessibleDescription(
      'Nubes: despejado hasta las 23:00, mayormente nublado 23:00–02:00, despejado 02:00–04:00, sin pronóstico 04:00–05:00, luego cubierto',
    );
  });

  it('FR-WIDE-8: the stripe carries the same band over the hours it draws and the same sentence', () => {
    const { container } = render(
      <I18nProvider locale="en">
        <TimeStripe span={span} passes={[]} bands={[]} t={T0 + 30 * 60_000} timeZone="UTC" onScrub={vi.fn()} clouds={forecast} />
      </I18nProvider>,
    );
    expect(container.querySelector('[data-row="clouds"] path[data-cloud="mostly"]')).not.toBeNull();
    expect(screen.getByRole('slider', { name: /Time stripe/ })).toHaveAccessibleDescription(/^Clouds: clear until 23:00/);
  });

  it('draws no band and no description without a forecast', () => {
    const { container } = overview('en', null);
    expect(container.querySelector('[data-row="clouds"]')).toBeNull();
    expect(screen.getByRole('slider')).not.toHaveAttribute('aria-describedby');
  });
});
