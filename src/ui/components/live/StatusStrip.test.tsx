/**
 * R32 (FR-LIVE-3), re-cut by R77 (FR-WATCH-3, FR-LIVE-3 as amended v2.0): the
 * conditions line, worded from the values the page hands in, in both
 * languages, with the pending reading while the astronomy has not arrived.
 * Wide: the sky, the clouds with their percentage, the count and the Moon, in
 * the rail. Compact: the clock, the sky word, the cloud word and `n up` on one
 * line of at most 36 cells, the labels and the zone spoken.
 */
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

/** The wide shell: a `matchMedia` that says the viewport is past the breakpoint. jsdom has none, which is compact. */
const stubWide = (): void => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
};

describe('<StatusStrip>', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('on wide is one line in the rail: the sky, the clouds with their percentage, the count and the Moon — and no clock, which is the indicator’s', async () => {
    stubWide();
    const { container } = render(<StatusStrip t={T} timeZone="America/Argentina/Salta" sky="dark" cloud={clear} count={3} moon={MOON_FIXTURE} />);
    const strip = screen.getByTestId('status-strip');
    expect(strip.tagName).toBe('DL');
    expect(strip).toHaveAccessibleName('Sky conditions');
    expect(strip).toHaveAttribute('data-compact', 'false');
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

  it('on compact is the clock, the sky word, the cloud word and `n up`, the labels and the zone spoken, the Moon left to the list panel', async () => {
    const { container, rerender } = render(<StatusStrip t={T} timeZone="America/Argentina/Salta" sky="dark" cloud={clear} count={3} moon={MOON_FIXTURE} />);
    const strip = screen.getByTestId('status-strip');
    expect(strip).toHaveAttribute('data-compact', 'true');
    expect(fieldIds()).toEqual(['live-time', 'live-sky', 'live-cloud', 'live-count']);
    // The line as the eye reads it: the text outside the spoken labels and the spoken zone.
    const shown = (dd: Element): string => {
      const copy = dd.cloneNode(true) as Element;
      for (const spoken of copy.querySelectorAll('.sr-only')) spoken.remove();
      return copy.textContent ?? '';
    };
    const visible = [...strip.querySelectorAll('dd')].map(shown).join(' ');
    expect(visible).toBe('06:48:24 dark clear 3 up');
    // What a screen reader hears carries the labels and the zone.
    expect(field('time')).toHaveTextContent(/^Time 06:48:24 GMT-3$/);
    expect(field('time').querySelector('time')).toHaveAttribute('dateTime', new Date(T).toISOString());
    expect(within(field('time')).getByText('Time')).toHaveClass('sr-only');
    expect(field('count')).toHaveTextContent(/^Satellites 3 up$/);
    expect(screen.queryByTestId('live-moon')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
    // No forecast, no zone: `unknown`, and UTC.
    rerender(<StatusStrip t={T} timeZone={null} sky="bright-twilight" cloud={unknown} count={0} moon={MOON_FIXTURE} />);
    expect(field('cloud')).toHaveTextContent(/^Clouds unknown$/);
    expect(field('cloud').querySelector('[data-state]')).toHaveAttribute('data-state', 'unknown');
    expect(field('time')).toHaveTextContent(/^Time 09:48:24 UTC$/);
    expect(field('sky')).toHaveTextContent(/^Sky twilight$/);
  });

  it('draws `s/d` in Spanish without a forecast and says "sin datos" (FR-COMP-7)', async () => {
    const { container } = render(
      <I18nProvider locale="es">
        <StatusStrip t={T} timeZone={null} sky="dark" cloud={unknown} count={0} moon={null} />
      </I18nProvider>,
    );
    const value = field('cloud').querySelector('[data-state]') as HTMLElement;
    const drawn = within(value).getByText('s/d');
    expect(drawn).toHaveAttribute('aria-hidden', 'true');
    expect(within(value).getByText(es.live.cloudSpoken.unknown)).toHaveClass('sr-only');
    expect(es.live.cloudSpoken.unknown).toBe('sin datos');
    expect(field('cloud')).toHaveTextContent(/^Nubes s\/dsin datos$/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says UTC without a zone and "unknown" without a forecast on wide, and the other two sky states', () => {
    stubWide();
    const { rerender } = render(<StatusStrip t={T} timeZone={null} sky="bright-twilight" cloud={unknown} count={1} moon={MOON_FIXTURE} />);
    expect(field('cloud')).toHaveTextContent(/^Clouds Weather unknown$/);
    expect(field('sky')).toHaveTextContent(/^Sky bright twilight$/);
    expect(field('count')).toHaveTextContent(/^Up 1$/);
    rerender(<StatusStrip t={T} timeZone={null} sky="day" cloud={unknown} count={0} moon={MOON_FIXTURE} />);
    expect(field('sky')).toHaveTextContent(/^Sky day$/);
  });

  it('marks the sky and the Moon as pending until the astronomy chunk has evaluated them', () => {
    stubWide();
    const { unmount } = render(<StatusStrip t={T} timeZone={null} sky={null} cloud={unknown} count={0} moon={null} />);
    expect(field('sky')).toHaveTextContent(/^Sky …$/);
    expect(field('moon')).toHaveTextContent(/^Moon …$/);
    unmount();
    vi.unstubAllGlobals();
    render(<StatusStrip t={T} timeZone={null} sky={null} cloud={unknown} count={0} moon={null} />);
    expect(field('sky')).toHaveTextContent(/^Sky …$/);
  });

  it('speaks Spanish (FR-I18N-2), with the zone abbreviation Intl gives that language', () => {
    stubWide();
    const { unmount } = render(
      <I18nProvider locale="es">
        <StatusStrip t={T} timeZone="America/Argentina/Salta" sky="dark" cloud={clear} count={3} moon={MOON_FIXTURE} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('status-strip')).toHaveAccessibleName('Condiciones del cielo');
    expect(field('sky')).toHaveTextContent(/^Cielo oscuro$/);
    expect(field('cloud')).toHaveTextContent(/^Nubes Despejado, 12 % de nubes$/);
    expect(field('count')).toHaveTextContent(/^Arriba 3$/);
    expect(field('moon')).toHaveTextContent(`Luna ${es.live.moon(moonFacts(MOON_FIXTURE))}`);
    unmount();
    vi.unstubAllGlobals();
    render(
      <I18nProvider locale="es">
        <StatusStrip t={T} timeZone="America/Argentina/Salta" sky="bright-twilight" cloud={clear} count={3} moon={MOON_FIXTURE} />
      </I18nProvider>,
    );
    expect(field('time')).toHaveTextContent(/^Hora 06:48:24 GMT-3$/);
    expect(field('sky')).toHaveTextContent(/^Cielo crepúsculo$/);
    expect(field('cloud')).toHaveTextContent(/^Nubes limpio$/);
    expect(field('count')).toHaveTextContent(/^Satélites 3 arriba$/);
  });

  /** FR-WATCH-3, FR-COMP-4: the compact line at its longest in both languages — `tests/styles/controlRows.test.ts` counts it on the page. */
  it('keeps the compact line within 36 cells with its longest words, in both languages', () => {
    for (const m of [en.live, es.live]) {
      const longest = (words: Record<string, string>): string => Object.values(words).reduce((a, b) => ([...b].length > [...a].length ? b : a));
      const line = ['21:14:32', longest(m.skyShort), longest(m.cloudWord), m.upCount(12)].join(' ');
      expect([...line].length, line).toBeLessThanOrEqual(36);
    }
  });
});
