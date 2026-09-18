/**
 * R81 (FR-FIRST-8): the stripe is three lines of text in one `aria-hidden`
 * `pre`, its band coloured by sky, and nothing before the bands arrive. The
 * geometry itself is `lib/tonightStripe.test.ts`'s.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SkyBand } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { TonightStripe } from './TonightStripe';

const H = 3_600_000;
const MIDNIGHT = Date.UTC(2026, 8, 18, 0, 0, 0);
const at = (hours: number) => MIDNIGHT + hours * H;
const band = (fromH: number, toH: number, sky: SkyBand['sky']): SkyBand => ({ from: at(fromH), to: at(toH), sky });
/** Dark from 20:00 to 04:00 UTC, twilight an hour either side: the span is 18:00 to 06:00. */
const NIGHT: readonly SkyBand[] = [band(-12, 19, 'day'), band(19, 20, 'bright-twilight'), band(20, 28, 'dark'), band(28, 29, 'bright-twilight'), band(29, 40, 'day')];
const peakAt = (hours: number): Pass => ({ peak: { t: at(hours), azDeg: 0, elDeg: 40, rangeKm: 800 } }) as Pass;

describe('<TonightStripe> (FR-FIRST-8)', () => {
  it('draws the labels, the band and the ticks as one hidden picture', () => {
    render(<TonightStripe bands={NIGHT} passes={[peakAt(21.1), peakAt(40)]} observer={{ lon: 0, timeZone: 'UTC' }} now={at(12)} />);
    const stripe = screen.getByTestId('tonight-stripe');
    expect(stripe.tagName).toBe('PRE');
    expect(stripe).toHaveAttribute('aria-hidden', 'true');
    expect(stripe.textContent.split('\n')).toEqual(['18   20   22   00   02   04   06', '▓▓▒▒▒████████████████████▒▒▓▓▓', '       ▲                      ']);
    expect([...stripe.querySelectorAll('[data-sky]')].map((run) => run.getAttribute('data-sky'))).toEqual(['day', 'bright-twilight', 'dark', 'bright-twilight', 'day']);
  });

  it('draws nothing until the bands arrive', () => {
    render(<TonightStripe bands={[]} passes={[]} observer={{ lon: 0, timeZone: 'UTC' }} now={at(12)} />);
    expect(screen.queryByTestId('tonight-stripe')).toBeNull();
  });
});
