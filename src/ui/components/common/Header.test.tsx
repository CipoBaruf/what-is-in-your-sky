/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, US-20 AC1/AC5, D-184): the two shapes
 * of the header, and what each one does and does not carry.
 *
 * R129 (FR-FLOW-3, FR-COMP-7 as amended v2.6, D-845; F7, D3, D4): the header is
 * told its page, in both languages at both widths — and no language or theme switch anywhere.
 *
 * R212 (FR-LAND-1, FR-LAND-6, D-1230, D-1231): no home. The links are `live satellites stars`; live, the first page,
 * has no Back; on compact live and the satellites' list are tab rows, and stars and settings the sub row.
 *
 * R166, v2.14.1 (FR-CLEAN-14; D-1134): the current link dimmed; `satellites` opens the pass up now, else the span's
 * next, else the bare `#pass`.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import type { HeaderPage } from '../../../i18n/messages';
import { CATALOGS, I18nProvider } from '../../../i18n/useT';
import { LOCALES } from '../../../i18n/locale';
import type { Locale } from '../../../model';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { LIVE_WINDOW_MS } from '../../../lib/livePasses';
import type { Pass } from '../../../model';
import { appStore } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { Header, type HeaderProps } from './Header';

let media: MatchMediaStub;

afterEach(() => {
  media.restore();
  window.history.replaceState(null, '', window.location.pathname);
});

const PAGES = ['live', 'pass', 'stars', 'settings'] as const satisfies readonly HeaderPage[];
const SUB_PAGES = ['stars', 'settings'] as const satisfies readonly HeaderPage[];
const TABS = [['live', 'pass-link', '#pass'], ['pass', 'live-link', '#live']] as const;
const NAV = ['live', 'pass', 'stars'] as const;
const PLACE = '−38.93, −67.99';

const renderIn = (locale: Locale, props: HeaderProps) => render(<I18nProvider locale={locale}>{<Header {...props} />}</I18nProvider>);

/** Neither switch is on any header: they are the settings page's alone (FR-COMP-2, V26-10). */
const expectNoSwitches = (locale: Locale): void => {
  const t = CATALOGS[locale];
  expect(screen.queryByRole('group', { name: t.app.language })).toBeNull();
  expect(screen.queryByRole('group', { name: t.app.theme })).toBeNull();
};

describe.each(LOCALES)('<Header> compact in %s (FR-COMP-1, FR-FLOW-3)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it.each(TABS)('%s: one row of the short title, the other tab and settings, with no Back, no tagline and no switch (US-20 AC1)', async (page, testId, href) => {
    media = stubMatchMedia(COMPACT_PX);
    const { container } = renderIn(locale, { page });
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent(t.app.shortTitle);
    // The pages carry their own h1 (FR-A11Y-1).
    expect(within(banner).queryByRole('heading')).toBeNull();
    expect(banner).not.toHaveTextContent(t.app.tagline);
    const tab = screen.getByTestId(testId);
    expect(tab).toHaveAttribute('href', href);
    expect(tab).toHaveTextContent(page === 'live' ? t.header.pages.pass : t.live.openShort);
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '#settings');
    expect(screen.getByTestId('settings-link')).toHaveTextContent(t.settings.open);
    expect(screen.queryByTestId('stars-link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    // One name for the header's navigation on both widths.
    expect(screen.getByRole('navigation', { name: t.header.nav })).toContainElement(tab);
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(SUB_PAGES)('%s: [ ← ] named Back, the page name in the accent, then the context', async (page) => {
    media = stubMatchMedia(COMPACT_PX);
    const onBack = vi.fn();
    const { container } = renderIn(locale, { page, context: PLACE, onBack });
    const header = screen.getByTestId('header');
    expect(header).toHaveAttribute('data-page', page);
    const back = screen.getByRole('button', { name: t.header.backName });
    expect(back).toHaveTextContent(t.header.back);
    expect(back).toHaveAttribute('data-testid', `${page}-back`);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    const name = screen.getByTestId('header-page');
    expect(name).toHaveTextContent(t.header.pages[page]);
    const context = screen.getByTestId(`${page}-place`);
    expect(context).toHaveTextContent(PLACE);
    // In that order, and nothing else on the row: no title, no links, no switch.
    expect([...header.children]).toEqual([back, name, context]);
    expect(header).not.toHaveTextContent(t.app.shortTitle);
    expect(screen.queryByRole('link')).toBeNull();
    expectNoSwitches(locale);
    // Settings has no h1 of its own: its name is the page's. The others' are the pages' own (FR-A11Y-1).
    expect(screen.queryAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(page === 'settings' ? [t.header.pages.settings] : []);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('live takes no Back, and draws its context under the row only where there is one (the inert page, R149)', () => {
    media = stubMatchMedia(COMPACT_PX);
    const { unmount } = renderIn(locale, { page: 'live', onBack: vi.fn() });
    expect(screen.queryByRole('button', { name: t.header.backName })).toBeNull();
    expect(screen.queryByTestId('live-place')).toBeNull();
    unmount();
    renderIn(locale, { page: 'live', context: PLACE, onBack: vi.fn() });
    expect(screen.getByTestId('header').lastElementChild).toBe(screen.getByTestId('live-place'));
  });

  it('is a div when the page holds it inside a landmark of its own, so there is one banner', () => {
    media = stubMatchMedia(COMPACT_PX);
    renderIn(locale, { page: 'live', landmark: false, context: PLACE, onBack: vi.fn() });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByTestId('header').tagName).toBe('DIV');
  });
});

/**
 * R166 (FR-CLEAN-14, D-1007): the wide page links are `BracketLink`s, `[ home ] [ live ] [ stars ]` — the brackets are
 * the primitive's stylesheet, so its class is what is asserted — the current page the primitive's dim `aria-current`
 * span (no `href`), the other two links in the accent; no accent rule under the current one.
 */
function expectBracketedLinks(page: HeaderPage): void {
  for (const target of NAV) {
    const link = screen.getByTestId(`${target}-link`);
    expect(link.className, target).toMatch(/bracketLink/);
    expect(link.className, target).not.toMatch(/navCurrent|navLink/);
    if (target === page) {
      expect(link.tagName).toBe('SPAN');
      expect(link.className).toMatch(/current/);
      expect(link).not.toHaveAttribute('href');
    } else {
      expect(link.tagName).toBe('A');
      expect(link.className).not.toMatch(/current/);
    }
  }
}

describe.each(LOCALES)('<Header> wide in %s (FR-FLOW-3, FR-DESK-2 as amended v2.6)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it('live: the title, the page links with live current, settings last, and no Back (FR-LAND-1)', async () => {
    media = stubMatchMedia(WIDE_PX);
    const { container } = renderIn(locale, { page: 'live', onBack: vi.fn() });
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent(t.app.title);
    expect(banner).not.toHaveTextContent(t.app.tagline);
    const nav = screen.getByRole('navigation', { name: t.header.nav });
    expect(within(nav).getAllByTestId(/-link$/).map((link) => link.textContent)).toEqual(NAV.map((page) => t.header.pages[page]));
    expect(t.header.pages.pass).toBe(locale === 'es' ? 'satélites' : 'satellites');
    expect(screen.getByTestId('live-link')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('live-link')).not.toHaveAttribute('href');
    // No pass in the store: the pass page with no id (D-1134).
    expect(screen.getByTestId('pass-link')).toHaveAttribute('href', '#pass');
    expect(screen.getByTestId('stars-link')).toHaveAttribute('href', '#stars');
    expect(screen.queryByTestId('home-link')).toBeNull();
    expectBracketedLinks('live');
    expect(screen.queryByRole('button', { name: t.header.backName })).toBeNull();
    // `settings` is the row's last item, after the navigation.
    const settings = screen.getByTestId('settings-link');
    expect(settings).toHaveAttribute('href', '#settings');
    expect(settings.parentElement?.lastElementChild).toBe(settings);
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(PAGES.filter((page) => page !== 'live'))('%s: [ ← ] first, the title, the links, the context and [ settings ] on one row, no tagline', async (page) => {
    media = stubMatchMedia(WIDE_PX);
    const onBack = vi.fn();
    const { container } = renderIn(locale, { page, context: PLACE, onBack });
    const banner = screen.getByRole('banner');
    expect(banner).not.toHaveTextContent(t.app.tagline);
    const back = screen.getByRole('button', { name: t.header.backName });
    const row = back.parentElement as HTMLElement;
    expect(row.firstElementChild).toBe(back);
    expect(row.lastElementChild).toBe(screen.getByTestId('settings-link'));
    expect(row).toHaveTextContent(t.app.title);
    expect(within(row).getByTestId(`${page}-place`)).toHaveTextContent(PLACE);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    // The current page is marked where it is one of the links; the others are links in the accent.
    for (const target of NAV) {
      const link = screen.getByTestId(`${target}-link`);
      if (target === page) {
        expect(link).toHaveAttribute('aria-current', 'page');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).toHaveAttribute('href');
      }
    }
    expect(screen.getByTestId('settings-link').hasAttribute('aria-current')).toBe(page === 'settings');
    expectBracketedLinks(page);
    // The live, stars and pass pages carry their own h1 (the pass's name, D-1134); settings has the title as its h1.
    expect(screen.queryAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(page === 'settings' ? [t.app.title] : []);
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<Header> wide links', () => {
  it.each([
    ['a pass up', ['up', 'next'], '#pass=up'],
    ['one ahead', ['gone', 'next', 'later'], '#pass=next'],
    ['none in the span', ['gone', 'tomorrow'], '#pass'],
  ] as const)('[ satellites ] with %s opens the pass it names (D-1134)', (_case, ids, href) => {
    media = stubMatchMedia(WIDE_PX);
    const T0 = Date.UTC(2026, 10, 5, 0, 0);
    const MIN = 60_000;
    const starts: Record<string, number> = { gone: T0 - 60 * MIN, up: T0 - 2 * MIN, next: T0 + 30 * MIN, later: T0 + 90 * MIN, tomorrow: T0 + LIVE_WINDOW_MS + MIN };
    const passes = ids.map((id) => ({ id, noradId: 25544, peakMagnitude: -2, start: { t: starts[id] }, peak: { t: (starts[id] ?? 0) + 2 * MIN }, end: { t: (starts[id] ?? 0) + 5 * MIN }, ...NO_MOON_AT_PEAK }) as unknown as Pass);
    const initial = appStore.getInitialState();
    appStore.setState({ nowMs: T0, elements: { status: 'ready', records: [], unavailable: [], rejected: [], fetchedAt: T0, stale: false, persistent: true }, passes: { ...IDLE_PASSES, status: 'done', passes, hasDarkness: true } });
    try {
      render(<Header page="live" onBack={vi.fn()} />);
      expect(screen.getByTestId('pass-link')).toHaveAttribute('href', href);
    } finally {
      appStore.setState(initial, true);
    }
  });

  it('swaps shape when the width crosses the breakpoint', () => {
    media = stubMatchMedia(WIDE_PX);
    render(<Header page="pass" />);
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.header.pages.live);
    expect(screen.getByTestId('stars-link')).toBeInTheDocument();
    act(() => {
      media.setWidth(COMPACT_PX);
    });
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.openShort);
    expect(screen.queryByTestId('stars-link')).toBeNull();
    expect(screen.getByTestId('settings-link')).toBeInTheDocument();
  });
});
