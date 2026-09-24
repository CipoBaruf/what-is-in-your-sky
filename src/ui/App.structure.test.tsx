/**
 * R92 (FR-A11Y-1..5, FR-ROUTE-1..3; US-30; D-529..D-533): every route in one shell — its landmarks, its heading
 * outline, its title, the focus after each change, the announcer and the skip link — as `App` renders them.
 * The browser's own run of the same, at two widths and with a full list, is `tests/e2e/structure.spec.ts`.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../tests/support/matchMedia';
import { outline, skippedLevels } from '../../tests/support/outline';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App, AppRoot } from './App';
import { resetNavigation } from './navigation';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };
const tomorrow = { ...pass, id: 'tomorrow', noradId: 3, name: 'Tomorrow object', start: { ...pass.start, t: pass.start.t + 86_400_000 } };
const APP = en.app.title;

let media: MatchMediaStub | null = null;

const withPasses = (passes = [pass, other, tomorrow]): void => {
  act(() => {
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes, hasDarkness: true } });
  });
};

// jsdom fires a typed hash's `hashchange` a task later; the tests say it now, as the existing route tests do.
const go = (hash: string): void => {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

const landmarks = () => ({
  main: document.querySelectorAll('main').length,
  h1: document.querySelectorAll('h1').length,
  banner: document.querySelectorAll('header').length,
  navigation: document.querySelectorAll('nav').length,
  contentinfo: document.querySelectorAll('footer').length,
});

const HOME_TAIL: [number, string][] = [
  [2, en.home.panes.where],
  [2, en.home.panes.when],
  [2, en.home.panes.what],
  [2, en.passes.heading],
];

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  resetNavigation();
});

afterEach(() => {
  vi.restoreAllMocks();
  media?.restore();
  media = null;
  appStore.setState(initial, true);
  localStorage.clear();
  window.history.replaceState(null, '', window.location.pathname);
});

describe('the outline of each screen (FR-A11Y-2, US-30 AC2)', () => {
  it('home, wide: the title, the three panes and the list, a night under the list and its passes under the night', () => {
    media = stubMatchMedia(WIDE_PX);
    withPasses();
    render(<App />);
    // Tomorrow's night is folded: its heading and its card are out of the tree with it.
    expect(outline()).toEqual([[1, APP], ...HOME_TAIL, [3, 'Tonight'], [4, pass.name], [4, other.name]]);
  });

  it('home, compact: the same outline under the short title', () => {
    withPasses();
    render(<App />);
    expect(outline()).toEqual([[1, en.app.shortTitle], ...HOME_TAIL, [3, 'Tonight'], [4, pass.name], [4, other.name]]);
  });

  it('home with one night: no night heading, so the cards are one rank under the list', () => {
    withPasses([pass, other]);
    render(<App />);
    expect(outline()).toEqual([[1, en.app.shortTitle], ...HOME_TAIL, [3, pass.name], [3, other.name]]);
  });

  it('the guide: the pass name is its h2, and the page under it keeps one h1', async () => {
    media = stubMatchMedia(WIDE_PX);
    withPasses();
    render(<App />);
    go(`#pass=${pass.id}`);
    const panel = await screen.findByTestId('guide-panel');
    expect(outline(panel)).toEqual([[2, pass.name]]);
    expect(skippedLevels(outline())).toEqual([]);
  });

  it('settings: its three blocks under the header', async () => {
    withPasses();
    render(<App />);
    go('#settings');
    // R93 (D-545): the page is a chunk of its own; its Back control is the sign it has landed.
    await screen.findByTestId('settings-back');
    expect(outline()).toEqual([
      [1, en.app.shortTitle],
      [2, en.location.heading],
      [2, en.favourites.heading],
      [2, en.settings.browser],
    ]);
  });

  it('live: the page is named by its h1, and nothing under it skips a rank', async () => {
    withPasses();
    render(<App />);
    go('#live');
    await screen.findByTestId('live-page');
    const headings = outline();
    expect(headings[0]).toEqual([1, en.live.open]);
    expect(headings.filter(([level]) => level === 1)).toHaveLength(1);
    expect(skippedLevels(headings)).toEqual([]);
  });
});

describe('the landmarks of each route (FR-A11Y-1, US-30 AC1)', () => {
  it('home and settings have one of each, live its banner and main, at both widths', async () => {
    for (const width of [390, WIDE_PX]) {
      media = stubMatchMedia(width);
      withPasses();
      const { unmount } = render(<App />);
      expect(landmarks()).toEqual({ main: 1, h1: 1, banner: 1, navigation: 1, contentinfo: 1 });
      go('#settings');
      await screen.findByTestId('settings-back');
      expect(landmarks()).toEqual({ main: 1, h1: 1, banner: 1, navigation: 1, contentinfo: 1 });
      go('#live');
      await screen.findByTestId('live-page');
      expect(landmarks()).toMatchObject({ main: 1, h1: 1, banner: 1, contentinfo: 0 });
      unmount();
      media.restore();
      media = null;
      act(() => {
        window.history.replaceState(null, '', window.location.pathname);
      });
    }
  });
});

describe('the title (FR-A11Y-3, US-30 AC3)', () => {
  it('names the route, in the active language, and follows both', async () => {
    media = stubMatchMedia(WIDE_PX);
    withPasses();
    render(<AppRoot />);
    expect(document.title).toBe(APP);
    go('#settings');
    expect(document.title).toBe(`${en.settings.heading} · ${APP}`);
    act(() => {
      appStore.setState({ locale: 'es' });
    });
    expect(document.title).toBe(`${es.settings.heading} · ${es.app.title}`);
    go(`#pass=${pass.id}`);
    await screen.findByTestId('guide-panel');
    expect(document.title).toMatch(new RegExp(`^${pass.name.replace(/[()]/g, '\\$&')} \\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d( UTC)? · ${es.app.title}$`));
    go('#live');
    await screen.findByTestId('live-page');
    expect(document.title).toBe(`${es.live.open} · ${es.app.title}`);
    act(() => {
      appStore.setState({ locale: 'en' });
    });
    expect(document.title).toBe(`${en.live.open} · ${APP}`);
    go('');
    expect(document.title).toBe(APP);
  });
});

describe('the skip link (FR-A11Y-5, US-30 AC5)', () => {
  it('is the first focusable element of home and settings, targets main, and is not on the live page', async () => {
    withPasses();
    render(<App />);
    const first = (): Element | null => document.querySelector('a[href], button, input, [tabindex]:not([tabindex="-1"])');
    expect(first()).toHaveTextContent(en.a11y.skip);
    fireEvent.click(screen.getByTestId('skip-link'));
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(window.location.hash).toBe('');
    go('#settings');
    expect(first()).toHaveTextContent(en.a11y.skip);
    go('#live');
    await screen.findByTestId('live-page');
    expect(screen.queryByTestId('skip-link')).toBeNull();
  });
});

describe('focus and the announcer follow the route (FR-A11Y-4, US-30 AC4)', () => {
  it('enters on the Back control and leaves to the control that opened the page, naming each route once', async () => {
    withPasses();
    render(<App />);
    const announcer = screen.getByTestId('route-announcer');
    expect(announcer).toHaveTextContent('');

    const settingsLink = screen.getByTestId('settings-link');
    settingsLink.focus();
    fireEvent.click(settingsLink);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('settings-back'));
    });
    expect(announcer).toHaveTextContent(`${en.settings.heading} · ${APP}`);
    fireEvent.click(screen.getByTestId('settings-back'));
    // The page was opened by the app, so leaving it is `history.back()`, which lands a task later.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('settings-link'));
    });
    expect(announcer).toHaveTextContent(APP);

    const liveLink = screen.getByTestId('live-link');
    liveLink.focus();
    fireEvent.click(liveLink);
    await screen.findByTestId('live-page');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('live-back'));
    });
    expect(announcer).toHaveTextContent(`${en.live.open} · ${APP}`);
    fireEvent.click(screen.getByTestId('live-back'));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('live-link'));
    });
  });

  it('leaves a route that was the load entry to the h1, in place', async () => {
    window.history.replaceState(null, '', '#settings');
    withPasses();
    render(<App />);
    const entries = window.history.length;
    fireEvent.click(await screen.findByTestId('settings-back'));
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(entries);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('writes the announcer once per route change, and not for a language switch', async () => {
    withPasses();
    render(<AppRoot />);
    const writes = vi.fn();
    const observerOf = new MutationObserver(writes);
    observerOf.observe(screen.getByTestId('route-announcer'), { childList: true, characterData: true, subtree: true });
    go('#settings');
    act(() => {
      appStore.setState({ locale: 'es' });
    });
    // The observer reports a task later.
    await new Promise((resolve) => setTimeout(resolve, 0));
    observerOf.disconnect();
    expect(writes.mock.calls.flatMap(([records]: MutationRecord[][]) => records ?? [])).toHaveLength(1);
  });
});

describe('history (FR-ROUTE-1..3, F-91)', () => {
  it('opening and closing a pass, the live page and settings through the UI grows the history by no entry', async () => {
    media = stubMatchMedia(WIDE_PX);
    withPasses();
    render(<App />);
    const open = async (control: HTMLElement, back: () => HTMLElement): Promise<void> => {
      fireEvent.click(control);
      fireEvent.click(await waitFor(back));
      await waitFor(() => {
        expect(window.location.hash).toBe('');
      });
    };
    const guideClose = (): HTMLElement => within(screen.getByTestId('guide-panel')).getByRole('button', { name: en.guide.close });
    const cards = (): HTMLElement[] => screen.getAllByRole('button', { name: /Open guide/ });
    await open(cards()[0] as HTMLElement, guideClose);
    const after = window.history.length;
    await open(cards()[1] as HTMLElement, guideClose);
    await open(cards()[0] as HTMLElement, guideClose);
    await open(screen.getByTestId('live-link'), () => screen.getByTestId('live-back'));
    go('#settings');
    // A typed hash is the browser's entry, not the app's (it takes the forward entry the Backs left): closing
    // it replaces it in place.
    fireEvent.click(await screen.findByTestId('settings-back'));
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(after);
  });

  it('shows FR-SHARE-3 message for a #pass=<id> the run no longer has', () => {
    window.history.replaceState(null, '', `#pass=25544-${String(NOW - 86_400_000)}`);
    withPasses();
    render(<App />);
    expect(screen.getByTestId('share-fallback')).toHaveTextContent(/ISS \(Zarya\)/);
  });

  it('closes the sky screen when the route changes under it (FR-ROUTE-2)', async () => {
    withPasses();
    render(<App />);
    go('#live');
    await screen.findByTestId('live-page');
    act(() => {
      appStore.getState().openSkyScreen();
    });
    expect(appStore.getState().skyScreen).toBe(true);
    go('');
    expect(appStore.getState().skyScreen).toBe(false);
  });
});
