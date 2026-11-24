/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, US-20 AC1/AC5, D-184): the two shapes of the header, and what each one does
 * and does not carry — no language or theme switch anywhere (V26-10).
 *
 * R215 (FR-LAND-4, FR-LAND-6, FR-CTRL-5, US-62 AC2; D-1238): the links are `live satellites settings` at both widths,
 * as tabs — the current page a span over a 2 px accent rule 6 px under its words; `← back` is bare words; the wide
 * row carries the place line in its three readings — `Salta · example  change`, the place's name with `change`, and
 * `Set your place` — and `change` opens the place dialog. On compact the tab row is the mark and the three links.
 *
 * v2.14.1 (FR-CLEAN-14 as amended; D-1134): `satellites` opens the pass up now, else the span's next, else `#pass`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

let media: MatchMediaStub | undefined;

afterEach(() => {
  media?.restore();
  media = undefined;
  window.history.replaceState(null, '', window.location.pathname);
});

const SUB_PAGES = ['settings'] as const satisfies readonly HeaderPage[];
const TABS = ['live', 'pass', 'settings'] as const satisfies readonly HeaderPage[];
const HREF: Record<(typeof TABS)[number], string> = { live: '#live', pass: '#pass', settings: '#settings' };
const PLACE = '−38.93, −67.99';

const renderIn = (locale: Locale, props: HeaderProps) => render(<I18nProvider locale={locale}>{<Header {...props} />}</I18nProvider>);

/** Neither switch is on any header: they are the settings page's alone (FR-COMP-2, V26-10). */
const expectNoSwitches = (locale: Locale): void => {
  const t = CATALOGS[locale];
  expect(screen.queryByRole('group', { name: t.app.language })).toBeNull();
  expect(screen.queryByRole('group', { name: t.app.theme })).toBeNull();
};

/** FR-LAND-6, FR-CTRL-5: the three tabs in order, the current one a span (no `href`, `aria-current`), the others links. */
function expectTabs(locale: Locale, page: HeaderPage): void {
  const t = CATALOGS[locale];
  const nav = screen.getByRole('navigation', { name: t.header.nav });
  const links = within(nav).getAllByTestId(/-link$/);
  expect(links.map((link) => link.textContent)).toEqual(TABS.map((tab) => t.header.pages[tab]));
  for (const [i, tab] of TABS.entries()) {
    const link = links[i] as HTMLElement;
    expect(link).toHaveAttribute('data-testid', `${tab}-link`);
    expect(link.className, tab).toMatch(/tab/);
    if (tab === page) {
      expect(link.tagName).toBe('SPAN');
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link.className).toMatch(/current/);
      expect(link).not.toHaveAttribute('href');
    } else {
      expect(link.tagName).toBe('A');
      expect(link).not.toHaveAttribute('aria-current');
      expect(link).toHaveAttribute('href', HREF[tab]);
    }
  }
  expect(screen.queryByTestId('stars-link')).toBeNull();
}

describe('FR-CTRL-5: the tab form and the back form', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/components/primitives/BracketLink.module.css'), 'utf8');
  const rule = (selector: string): string => new RegExp(`(?:^|\\n)${selector.replace(/[.\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

  it('a tab is its words in --fg-dim, --fg on hover; the current one --fg over a 2 px accent rule 6 px under', () => {
    expect(rule('.tab')).toMatch(/color:\s*var\(--fg-dim\);[^}]*text-decoration:\s*none;/);
    expect(rule('.tab:hover')).toMatch(/color:\s*var\(--fg\);/);
    const current = rule('.tab.current');
    expect(current).toMatch(/color:\s*var\(--fg\);/);
    expect(current).toMatch(/text-decoration-color:\s*var\(--accent\);/);
    // 2 px: two hairlines; 6 px: `--space-1`, a quarter row of 24 px.
    expect(current).toMatch(/text-decoration-thickness:\s*calc\(2 \* var\(--hairline\)\);/);
    expect(current).toMatch(/text-underline-offset:\s*var\(--space-1\);/);
  });

  it.each(LOCALES)('← back, in %s, is bare dim words named Back, with no box', (locale) => {
    media = stubMatchMedia(WIDE_PX);
    const t = CATALOGS[locale];
    const onBack = vi.fn();
    renderIn(locale, { page: 'pass', place: null, onBack });
    const back = screen.getByRole('button', { name: t.header.backName });
    expect(back).toHaveTextContent(locale === 'es' ? '← volver' : '← back');
    expect(back.className).toMatch(/bare/);
    expect(back.className).toMatch(/dim/);
    expect(back.querySelector('span')).toBeNull();
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe.each(LOCALES)('<Header> compact in %s (FR-COMP-1, FR-LAND-6)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it.each(['live', 'pass'] as const)('%s: one row of the mark and the three tabs, with no Back, no title, no place line and no switch', async (page) => {
    media = stubMatchMedia(COMPACT_PX);
    const { container } = renderIn(locale, { page, place: { label: 'Salta', example: true }, onBack: vi.fn() });
    const banner = screen.getByRole('banner');
    expect(screen.getByTestId('mark')).toBeInTheDocument();
    expect(banner).not.toHaveTextContent(t.app.shortTitle);
    expect(banner).not.toHaveTextContent(t.app.tagline);
    expect(within(banner).queryByRole('heading')).toBeNull();
    expectTabs(locale, page);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('place-line')).toBeNull();
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(SUB_PAGES)('%s: ← back named Back, the page name in the accent, then the context', async (page) => {
    media = stubMatchMedia(COMPACT_PX);
    const onBack = vi.fn();
    const { container } = renderIn(locale, { page, context: PLACE, onBack });
    const header = screen.getByTestId('header');
    expect(header).toHaveAttribute('data-page', page);
    const back = screen.getByRole('button', { name: t.header.backName });
    expect(back).toHaveTextContent(t.header.backWords);
    expect(back).toHaveAttribute('data-testid', `${page}-back`);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    const name = screen.getByTestId('header-page');
    expect(name).toHaveTextContent(t.header.pages[page]);
    const context = screen.getByTestId(`${page}-place`);
    expect(context).toHaveTextContent(PLACE);
    // In that order, and nothing else on the row: no title, no links, no switch.
    expect([...header.children]).toEqual([back, name, context]);
    expect(screen.queryByRole('link')).toBeNull();
    expectNoSwitches(locale);
    // Settings has no h1 of its own: its name is the page's. The others' are the pages' own (FR-A11Y-1).
    expect(screen.queryAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(page === 'settings' ? [t.header.pages.settings] : []);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a div when the page holds it inside a landmark of its own, so there is one banner', () => {
    media = stubMatchMedia(COMPACT_PX);
    renderIn(locale, { page: 'live', landmark: false, context: PLACE, onBack: vi.fn() });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByTestId('header').tagName).toBe('DIV');
  });
});

describe.each(LOCALES)('<Header> wide in %s (FR-LAND-4, FR-LAND-6)', (locale: Locale) => {
  const t = CATALOGS[locale];

  it('live: the title, the place line, the three tabs with live current, and no Back (FR-LAND-1)', async () => {
    media = stubMatchMedia(WIDE_PX);
    const { container } = renderIn(locale, { page: 'live', place: { label: 'Salta', example: true }, onBack: vi.fn() });
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent(t.app.title);
    expect(banner).not.toHaveTextContent(t.app.tagline);
    expectTabs(locale, 'live');
    expect(t.header.pages.pass).toBe(locale === 'es' ? 'satélites' : 'satellites');
    expect(t.header.pages.settings).toBe(locale === 'es' ? 'ajustes' : 'settings');
    expect(screen.queryByRole('button', { name: t.header.backName })).toBeNull();
    // The row: the title's end, the place line, the tabs' end — the line between the two.
    const line = screen.getByTestId('place-line');
    const row = line.parentElement as HTMLElement;
    expect([...row.children].indexOf(line)).toBe(1);
    expect(row.lastElementChild).toContainElement(screen.getByTestId('settings-link'));
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('the place line’s three readings: the example, a place, and none (US-62 AC2, FR-LAND-5)', () => {
    media = stubMatchMedia(WIDE_PX);
    const change = vi.fn();
    const { unmount } = renderIn(locale, { page: 'live', place: { label: 'Salta', example: true }, onChangePlace: change });
    const example = screen.getByTestId('place-line');
    expect(example).toHaveAttribute('data-place', 'example');
    expect(example).toHaveTextContent(`Salta · ${t.header.place.example}${t.header.place.change}`);
    fireEvent.click(within(example).getByRole('button', { name: t.header.place.change }));
    expect(change).toHaveBeenCalledOnce();
    unmount();

    const set = renderIn(locale, { page: 'pass', place: { label: 'Cipolletti, Rio Negro, Argentina', example: false }, onChangePlace: change, onBack: vi.fn() });
    const placed = screen.getByTestId('place-line');
    expect(placed).toHaveAttribute('data-place', 'set');
    expect(screen.getByTestId('place-name')).toHaveTextContent('Cipolletti, Rio Negro, Argentina');
    expect(placed).not.toHaveTextContent(t.header.place.example);
    fireEvent.click(within(placed).getByRole('button', { name: t.header.place.change }));
    expect(change).toHaveBeenCalledTimes(2);
    set.unmount();

    renderIn(locale, { page: 'settings', place: null, onChangePlace: change, onBack: vi.fn() });
    const none = screen.getByTestId('place-line');
    expect(none).toHaveAttribute('data-place', 'none');
    expect(none).toHaveTextContent(locale === 'es' ? 'Elegí tu lugar' : 'Set your place');
    fireEvent.click(within(none).getByRole('button', { name: t.header.place.set }));
    expect(change).toHaveBeenCalledTimes(3);
  });

  it.each(['pass', 'settings'] as const)('%s: ← back first, the title, the place line, the tabs; no tagline', async (page) => {
    media = stubMatchMedia(WIDE_PX);
    const onBack = vi.fn();
    const { container } = renderIn(locale, { page, place: { label: PLACE, example: false }, onBack });
    const banner = screen.getByRole('banner');
    expect(banner).not.toHaveTextContent(t.app.tagline);
    const back = screen.getByRole('button', { name: t.header.backName });
    const start = back.parentElement as HTMLElement;
    expect(start.firstElementChild).toBe(back);
    expect(start).toHaveTextContent(t.app.title);
    expect(screen.getByTestId('place-name')).toHaveTextContent(PLACE);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
    expectTabs(locale, page);
    // The live and pass pages carry their own h1 (the pass's name, D-1134); settings has the title as its h1.
    expect(screen.queryAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(page === 'settings' ? [t.app.title] : []);
    expectNoSwitches(locale);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<Header> links', () => {
  it.each([
    ['a pass up', ['up', 'next'], '#pass=up'],
    ['one ahead', ['gone', 'next', 'later'], '#pass=next'],
    ['none in the span', ['gone', 'tomorrow'], '#pass'],
  ] as const)('satellites with %s opens the pass it names (D-1134)', (_case, ids, href) => {
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

  it('swaps shape when the width crosses the breakpoint, the same three tabs on both', () => {
    media = stubMatchMedia(WIDE_PX);
    render(<Header page="pass" />);
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.header.pages.live);
    expect(screen.getByTestId('place-line')).toBeInTheDocument();
    act(() => {
      media?.setWidth(COMPACT_PX);
    });
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.header.pages.live);
    expect(screen.getByTestId('settings-link')).toBeInTheDocument();
    expect(screen.queryByTestId('place-line')).toBeNull();
  });

  it('reads the place the pages open for when the page gives none: the example, then none (FR-LAND-5)', () => {
    media = stubMatchMedia(WIDE_PX);
    const initial = appStore.getInitialState();
    appStore.setState({ example: { lat: -24.79, lon: -65.41, altM: 0, label: 'Salta', source: 'example', timeZone: null }, exampleOutcome: 'pending' });
    try {
      const { unmount } = render(<Header page="live" />);
      expect(screen.getByTestId('place-line')).toHaveTextContent(`Salta · ${en.header.place.example}`);
      unmount();
      appStore.setState({ exampleOutcome: 'no_city' });
      render(<Header page="live" />);
      expect(screen.getByTestId('place-line')).toHaveAttribute('data-place', 'none');
    } finally {
      appStore.setState(initial, true);
    }
  });
});
