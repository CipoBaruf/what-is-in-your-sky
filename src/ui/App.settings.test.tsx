/**
 * R52 (FR-COMP-2, US-20 AC1/AC4/AC5, D-184): the `#settings` route where it
 * meets the app — the hash round-trip, the three ways out, and the two widths.
 *
 * The page's own contents are `Settings.test.tsx`; what is here is the routing.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../tests/support/matchMedia';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { en } from '../i18n/en';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';
import { forgetInstallOffer } from './components/common/installOffer';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();

let media: MatchMediaStub;

const withSky = (): void => {
  act(() => {
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true } });
  });
};

/** Navigates the way the browser does, so both hash subscribers hear it. */
const goTo = (hash: string): void => {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

/**
 * F-68: the hero card's choice (`nextFeaturedPass`) reads the wall clock, and
 * the golden passes are dated; from the calendar day their window ends the
 * card never renders and every assertion on `iss-hero` is red, on any branch.
 * So the clock is pinned at `NOW`, the same fix F-67 gave the night labels.
 */
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  media = stubMatchMedia(COMPACT_PX);
});

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
  window.history.replaceState(null, '', window.location.pathname);
  window.localStorage.clear();
  forgetInstallOffer();
});

describe('<App> and the #settings route (FR-COMP-2)', () => {
  it('opens the settings page from the compact header, and the hash follows (US-20 AC1)', () => {
    withSky();
    render(<App />);
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '#settings');
    goTo('#settings');
    expect(screen.getByTestId('settings-back')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: en.location.heading })).toBeInTheDocument();
    // Nothing of the home screen is left underneath it.
    expect(screen.queryByTestId('location-summary')).toBeNull();
    expect(screen.queryByRole('region', { name: en.passes.heading })).toBeNull();
  });

  it('renders the settings page on a reload straight onto #settings: the hash is the only route state (D-13)', () => {
    window.location.hash = 'settings';
    withSky();
    render(<App />);
    expect(screen.getByTestId('settings-back')).toBeInTheDocument();
  });

  it('returns to the home screen through the back control, and clears the hash in place (US-20 AC4)', async () => {
    withSky();
    render(<App />);
    goTo('#settings');
    await act(async () => {
      screen.getByTestId('settings-back').click();
      await Promise.resolve();
    });
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-back')).toBeNull();
  });

  it('returns to the home screen on Esc, with the observer and the list intact (US-20 AC4)', () => {
    withSky();
    render(<App />);
    goTo('#settings');
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByTestId('settings-back')).toBeNull();
    expect(appStore.getState().observer).toBe(observer);
    expect(screen.getByTestId('next-tag')).toBeInTheDocument();
  });

  it('leaves an Esc pressed inside one of the page’s own fields to that field (D-73)', () => {
    withSky();
    render(<App />);
    goTo('#settings');
    const place = screen.getByLabelText(en.location.placeLabel);
    act(() => {
      fireEvent.keyDown(place, { key: 'Escape' });
    });
    expect(screen.getByTestId('settings-back')).toBeInTheDocument();
  });

  it('shows no link to #settings on wide, but still renders the page when navigated to (US-20 AC5, FR-COMP-2)', () => {
    media.restore();
    media = stubMatchMedia(WIDE_PX);
    withSky();
    const { container } = render(<App />);
    expect(screen.queryByTestId('settings-link')).toBeNull();
    // R76 (FR-FIRST-4, FR-SET-3): the wide home's location is the Where reading's line, and its
    // `[ change ]` opens the whole form in place; nothing on the page links to #settings.
    expect(container.querySelector('a[href="#settings"]')).toBeNull();
    act(() => {
      screen.getByTestId('location-summary-change').click();
    });
    expect(screen.getByRole('region', { name: en.location.heading })).toBeInTheDocument();
    expect(container.querySelector('a[href="#settings"]')).toBeNull();
    goTo('#settings');
    expect(screen.getByTestId('settings-back')).toBeInTheDocument();
  });
});
