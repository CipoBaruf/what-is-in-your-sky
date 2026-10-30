/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, US-20 AC1/AC5, D-184): the two shapes
 * of the header, and what each one does and does not carry.
 *
 * R129 (FR-FLOW-3, FR-COMP-7 as amended v2.6, D-845; F7, D3, D4): the header is
 * told its page. The five pages in both languages at both widths: the home's
 * row, a sub-page's `[ ← ]`, name and context on compact, and on wide one row
 * with the page links, the current one marked, and `[ settings ]` last — and no
 * language or theme switch anywhere.
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
import { open, resetNavigation, subscribe } from '../../navigation';
import { Header, type HeaderProps } from './Header';

let media: MatchMediaStub;

afterEach(() => {
  media.restore();
  window.history.replaceState(null, '', window.location.pathname);
});

const SUB_PAGES = ['live', 'stars', 'pass', 'settings'] as const satisfies readonly HeaderPage[];
const PLACE = '−38.93, −67.99';

const renderIn = (locale: Locale, props: HeaderProps = {}) => render(<I18nProvider locale={locale}>{<Header {...props} />}</I18nProvider>);

/** Neither switch is on any header: they are the settings page's alone (FR-COMP-2, V26-10). */
const expectNoSwitches = (locale: Locale): void => {
  const t = CATALOGS[locale];
  expect(screen.queryByRole('group', { name: t.app.language })).toBeNull();
  expect(screen.queryByRole('group', { name: t.app.theme })).toBeNull();
};

describe.each(LOCALES)('<Header> compact in %s (FR-COMP-1, FR-FLOW-3)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it('home: one row of the short title, [ live ] and [ settings ], with no tagline and no switch (US-20 AC1)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    const { container } = renderIn(locale);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('heading', { level: 1, name: t.app.shortTitle })).toBeInTheDocument();
    expect(banner).not.toHaveTextContent(t.app.tagline);
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
    expect(screen.getByTestId('live-link')).toHaveTextContent(t.live.openShort);
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '#settings');
    expect(screen.getByTestId('settings-link')).toHaveTextContent(t.settings.open);
    expect(screen.queryByTestId('stars-link')).toBeNull();
    // One name for the header's navigation on both widths.
    expect(screen.getByRole('navigation', { name: t.header.nav })).toContainElement(screen.getByTestId('live-link'));
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
    const context = screen.getByTestId(page === 'pass' ? 'pass-date' : `${page}-place`);
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

  it('draws the live page’s name and no context when there is none (the inert page, R149)', () => {
    media = stubMatchMedia(COMPACT_PX);
    renderIn(locale, { page: 'live', onBack: vi.fn() });
    expect(screen.getByTestId('header-page')).toHaveTextContent(t.header.pages.live);
    expect(screen.queryByTestId('live-place')).toBeNull();
  });

  it('is a div when the page holds it inside a landmark of its own, so there is one banner', () => {
    media = stubMatchMedia(COMPACT_PX);
    renderIn(locale, { page: 'pass', landmark: false, context: '2026-10-27', onBack: vi.fn() });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByTestId('header').tagName).toBe('DIV');
  });
});

describe.each(LOCALES)('<Header> wide in %s (FR-FLOW-3, FR-DESK-2 as amended v2.6)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it('home: the full title as the h1, the page links with home current, [ settings ] last, the tagline under the row', async () => {
    media = stubMatchMedia(WIDE_PX);
    const { container } = renderIn(locale);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('heading', { level: 1, name: t.app.title })).toBeInTheDocument();
    expect(banner).toHaveTextContent(t.app.tagline);
    const nav = screen.getByRole('navigation', { name: t.header.nav });
    expect(within(nav).getAllByTestId(/-link$/).map((link) => link.textContent)).toEqual([t.header.pages.home, t.header.pages.live, t.header.pages.stars]);
    expect(screen.getByTestId('home-link')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('home-link')).not.toHaveAttribute('href');
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
    expect(screen.getByTestId('stars-link')).toHaveAttribute('href', '#stars');
    expect(screen.queryByRole('button', { name: t.header.backName })).toBeNull();
    // `[ settings ]` is the row's last item, after the navigation.
    const settings = screen.getByTestId('settings-link');
    expect(settings).toHaveAttribute('href', '#settings');
    expect(settings.parentElement?.lastElementChild).toBe(settings);
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(SUB_PAGES)('%s: [ ← ] first, the title, the links, the context and [ settings ] on one row, no tagline', async (page) => {
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
    expect(within(row).getByTestId(page === 'pass' ? 'pass-date' : `${page}-place`)).toHaveTextContent(PLACE);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    // The current page is marked where it is one of the links; the others are links in the accent.
    for (const target of ['home', 'live', 'stars'] as const) {
      const link = screen.getByTestId(`${target}-link`);
      if (target === page) {
        expect(link).toHaveAttribute('aria-current', 'page');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).toHaveAttribute('href');
      }
    }
    expect(screen.getByTestId('settings-link').hasAttribute('aria-current')).toBe(page === 'settings');
    // The live and stars pages carry their own h1, and the wide pass is the home's panel; settings has the title as its h1.
    expect(screen.queryAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(page === 'settings' ? [t.app.title] : []);
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<Header> wide links', () => {
  it('home leaves every entry this session pushed, in one step', () => {
    media = stubMatchMedia(WIDE_PX);
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
    window.history.pushState({ wiys: 1 }, '', '#stars');
    window.history.pushState({ wiys: 2 }, '', '#live');
    render(<Header page="live" onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('home-link'));
    expect(go).toHaveBeenCalledWith(-2);
    go.mockRestore();
  });

  it('swaps shape when the width crosses the breakpoint', () => {
    media = stubMatchMedia(WIDE_PX);
    render(<Header />);
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.header.pages.live);
    act(() => {
      media.setWidth(COMPACT_PX);
    });
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.openShort);
    expect(screen.getByTestId('settings-link')).toBeInTheDocument();
  });
});

/**
 * R129 (D-857): the wide `home` link leaves every route the session pushed in one step, and lands on home even when
 * the page the app loaded on was a route; a modified click is the browser's (a new tab), as on `live` and `stars`.
 */
describe('<Header> wide: the home link', () => {
  it('lands on home from the live page opened from a bookmarked #stars', async () => {
    media = stubMatchMedia(WIDE_PX);
    resetNavigation();
    const off = subscribe(() => undefined);
    window.history.replaceState(null, '', '#stars');
    open('#live');
    renderIn('en', { page: 'live', onBack: vi.fn() });
    fireEvent.click(screen.getByTestId('home-link'));
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('');
    });
    off();
  });

  it('leaves a modified or middle click to the browser', () => {
    media = stubMatchMedia(WIDE_PX);
    window.history.replaceState(null, '', '#stars');
    renderIn('en', { page: 'stars', onBack: vi.fn() });
    const link = screen.getByTestId('home-link');
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      // `fireEvent` returns false when a handler called `preventDefault`.
      expect(fireEvent.click(link, init), JSON.stringify(init)).toBe(true);
    }
    expect(window.location.hash).toBe('#stars');
    expect(fireEvent.click(link)).toBe(false);
    expect(window.location.hash).toBe('');
  });
});
