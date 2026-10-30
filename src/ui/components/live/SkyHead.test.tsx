// @vitest-environment jsdom
/**
 * R147 (FR-FULL-2; D-920): the head over the sky, on its own — `[ ← ]` (the header's back control: its glyph, its
 * name, its `live-back` test id, the page's Back) then the shown time and its chip, in both states of `t` and both
 * languages; one row whose paragraph is cut with an ellipsis, as wide as its content.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { tonightBand } from '../../../lib/shownTime';
import type { SkyBand } from '../../../lib/timeStripe';
import type { Locale } from '../../../model';
import type { ShownTimeProps } from './ShownTime';
import { SkyHead } from './SkyHead';

afterEach(cleanup);

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
const LIVE: ShownTimeProps = { t: NOW, realTime: true, now: NOW, clock: NOW, night: tonightBand(BANDS, NOW), timeZone: ZONE };
/** 21:47 tonight, 9 h 47 min ahead of the real clock. */
const HELD: ShownTimeProps = { ...LIVE, t: NOW + 9 * H + 47 * MIN - 7_000, realTime: false };

const mount = (locale: Locale, shown: ShownTimeProps, onBack = vi.fn()) => {
  const utils = render(
    <I18nProvider locale={locale}>
      <SkyHead {...shown} onBack={onBack} />
    </I18nProvider>,
  );
  return { ...utils, onBack, head: screen.getByTestId('live-head') };
};

describe('<SkyHead> (FR-FULL-2)', () => {
  it.each([
    ['en', en],
    ['es', es],
  ] as const)('is `[ ← ]` then the shown time at real time in %s', async (locale, m) => {
    const { container, head } = mount(locale, LIVE);
    const [back, time] = [...head.children];
    expect(back).toBe(screen.getByTestId('live-back'));
    expect(back).toHaveTextContent(new RegExp(`^${m.header.back}$`));
    expect(within(head).getByRole('button', { name: m.header.backName })).toBe(back);
    expect(back?.classList.contains('target')).toBe(true);
    expect(time).toContainElement(screen.getByTestId('shown-time'));
    expect(screen.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(m.live.chip({ kind: 'now' }));
    expect(screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent).toBe('12:00:07');
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each([
    ['en', 'tonight · in 9 h 47 min'],
    ['es', 'esta noche · en 9 h 47 min'],
  ] as const)('shows a held time without its seconds and the offset chip in %s', (locale, chip) => {
    mount(locale, HELD);
    expect(screen.getByTestId('shown-time').querySelector('time')?.firstChild?.textContent).toBe('21:47');
    expect(screen.getByTestId('shown-chip')).toHaveTextContent(new RegExp(`^${chip}$`));
  });

  it('calls the page’s Back from `[ ← ]`', () => {
    const { onBack } = mount('en', LIVE);
    fireEvent.click(screen.getByTestId('live-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('is one row as wide as its content, cut with an ellipsis on the paragraph’s end (the chip)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/live/SkyHead.module.css'), 'utf8');
    expect(css).toMatch(/inline-size: max-content;/);
    expect(css).toMatch(/max-inline-size: calc\(100% - 2 \* var\(--space-3\)\);/);
    expect(css).toMatch(/background: var\(--screen-overlay\);/);
    expect(css).toMatch(/\.time > p \{\s*overflow: hidden;\s*text-overflow: ellipsis;/);
    // The paragraph is one line already (`ShownTime.module.css`), so the ellipsis is what gives and not a wrap.
    const shown = readFileSync(resolve(process.cwd(), 'src/ui/components/live/ShownTime.module.css'), 'utf8');
    expect(/\.headline \{[^}]*white-space: nowrap;[^}]*font-size: var\(--text-heading\)|\.headline \{[^}]*font-size: var\(--text-heading\);[^}]*white-space: nowrap;/.test(shown)).toBe(true);
    expect(shown).toMatch(/\.chip \{\s*font-size: var\(--small\);/);
  });
});
