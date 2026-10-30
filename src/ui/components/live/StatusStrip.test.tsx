/**
 * R32 (FR-LIVE-3), re-cut by R77 (FR-WATCH-3, FR-LIVE-3 as amended v2.0): the
 * conditions line, worded from the values the page hands in, in both
 * languages, with the pending reading while the astronomy has not arrived:
 * the sky, the clouds with their percentage, the count and the Moon, in the
 * rail. R145 (FR-TONIGHT-6): wide's alone, so there is no compact case — the
 * compact page's context line is `ShownTime.test.tsx`'s.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import type { CloudVerdict } from '../../../model';
import { StatusStrip } from './StatusStrip';

const T = 1_789_120_104_063; // inside the R1 golden pass, 10 s after its start (2026-09-11 09:48:24 UTC)
const unknown: CloudVerdict = { state: 'unknown', effectivePct: null, at: T };
const clear: CloudVerdict = { state: 'clear', effectivePct: 12.4, at: T };

const field = (id: string): HTMLElement => screen.getByTestId(`live-${id}`);
const fieldIds = (): (string | null)[] => [...screen.getByTestId('status-strip').children].map((el) => el.getAttribute('data-testid'));

describe('<StatusStrip>', () => {
  it('is one line in the rail: the sky, the clouds with their percentage, the count and the Moon — and no clock, which is the indicator’s', async () => {
    const { container } = render(<StatusStrip sky="dark" cloud={clear} count={3} moon={MOON_FIXTURE} />);
    const strip = screen.getByTestId('status-strip');
    expect(strip.tagName).toBe('DL');
    expect(strip).toHaveAccessibleName('Sky conditions');
    expect(fieldIds()).toEqual(['live-sky', 'live-cloud', 'live-count', 'live-moon']);
    expect(field('sky')).toHaveTextContent(/^Sky dark$/);
    expect(field('cloud')).toHaveTextContent(/^Clouds Clear, 12 % cloud$/);
    expect(field('cloud').querySelector('[data-state]')).toHaveAttribute('data-state', 'clear');
    expect(field('count')).toHaveTextContent(/^Up 3$/);
    expect(field('count').querySelector('[data-count]')).toHaveAttribute('data-count', '3');
    // FR-MOON-3 as amended: the wide page keeps the phase and the illumination.
    expect(field('moon')).toHaveTextContent(`Moon ${en.live.moon(moonFacts(MOON_FIXTURE))}`);
    expect(screen.queryByTestId('live-time')).toBeNull();
    // FR-WATCH-3: the speed is the playback row's pressed control, never a field here.
    expect(screen.queryByTestId('live-speed')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says "unknown" without a forecast, and the other two sky states', () => {
    const { rerender } = render(<StatusStrip sky="bright-twilight" cloud={unknown} count={1} moon={MOON_FIXTURE} />);
    expect(field('cloud')).toHaveTextContent(/^Clouds Weather unknown$/);
    expect(field('sky')).toHaveTextContent(/^Sky bright twilight$/);
    expect(field('count')).toHaveTextContent(/^Up 1$/);
    rerender(<StatusStrip sky="day" cloud={unknown} count={0} moon={MOON_FIXTURE} />);
    expect(field('sky')).toHaveTextContent(/^Sky day$/);
  });

  it('marks the sky and the Moon as pending until the astronomy chunk has evaluated them', () => {
    render(<StatusStrip sky={null} cloud={unknown} count={0} moon={null} />);
    expect(field('sky')).toHaveTextContent(/^Sky …$/);
    expect(field('moon')).toHaveTextContent(/^Moon …$/);
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <StatusStrip sky="dark" cloud={clear} count={3} moon={MOON_FIXTURE} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('status-strip')).toHaveAccessibleName('Condiciones del cielo');
    expect(field('sky')).toHaveTextContent(/^Cielo oscuro$/);
    expect(field('cloud')).toHaveTextContent(/^Nubes Despejado, 12 % de nubes$/);
    expect(field('count')).toHaveTextContent(/^Arriba 3$/);
    expect(field('moon')).toHaveTextContent(`Luna ${es.live.moon(moonFacts(MOON_FIXTURE))}`);
  });
});
