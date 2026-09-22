/**
 * TASKS R12 (FR-X-1, FR-X-2, FR-X-5, FR-X-6): the frame is header (title,
 * tagline), the three titled regions, and the footer; `jest-axe` finds no
 * violation on the empty Home screen nor on a Home screen with passes (hero
 * card, sort toggle, list); header and footer are inert with the sheet open.
 */
import { act, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { passLinkHash } from '../lib/shareLinks';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { en } from '../i18n/en';
import { App } from './App';
import { forgetInstallOffer } from './components/common/installOffer';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };

describe('<App> frame (R12)', () => {
  /**
   * F-68: the hero card's choice (`nextFeaturedPass`) reads the wall clock, and
   * the golden passes are dated; from the calendar day their window ends the
   * card never renders and every assertion on `iss-hero` is red, on any branch.
   * So the clock is pinned at `NOW`, the same fix F-67 gave the night labels.
   */
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
    // R49 (F-31): the held `beforeinstallprompt` lives outside the store.
    forgetInstallOffer();
  });

  /*
   * R52 (FR-COMP-1, FR-COMP-3): jsdom without a `matchMedia` stub is the
   * compact layout, and this is the compact frame — the one-row header with
   * the short title. R76 (FR-FIRST-1): with no observer the main is the cold
   * open, whose own inventory is `screens/Home.test.tsx`'s; once there is one,
   * the three readings with the titled regions they hold. The wide frame, with
   * the full title and the tagline, is `App.wide.test.tsx`.
   */
  it('has the compact header, the cold open, the titled regions once there is a place, and the footer, with no axe violations while empty', async () => {
    const first = render(<App />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('heading', { level: 1, name: en.app.shortTitle })).toBeInTheDocument();
    expect(banner).not.toHaveTextContent(en.app.tagline);
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.openShort);
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '#settings');
    // FR-FIRST-1: the place is asked for on the home screen itself, and nothing else is there yet.
    expect(within(screen.getByRole('main')).getByTestId('cold-open')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: en.home.coldHeading })).toBeInTheDocument();
    expect(screen.queryByTestId('location-summary')).toBeNull();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Orbital elements by CelesTrak.');
    expect(await axe(first.container)).toHaveNoViolations();

    // R82 (FR-FIRST-4 as amended v2.0.2): on a phone's first visit the place moves the page on to the when step…
    act(() => {
      appStore.setState({ observer });
    });
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('step-when')).toBeInTheDocument();
    expect(await axe(first.container)).toHaveNoViolations();

    // …and the next visit, with the place saved, opens on the three readings stacked.
    first.unmount();
    const { container } = render(<App />);
    expect(screen.queryByTestId('step-when')).toBeNull();
    expect(screen.getByTestId('location-summary')).toHaveTextContent(observer.label);
    // R81 (FR-FIRST-5 as amended): the list keeps its named region; the Now panel is the When reading's table now.
    const list = screen.getByRole('region', { name: 'Upcoming passes' });
    expect(within(list).getByRole('heading', { level: 2, name: 'Upcoming passes' })).toBeInTheDocument();
    expect(within(screen.getByTestId('reading-when')).getByTestId('conditions')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('with passes: the tagged card, the sort toggle and the list, no axe violations; header and footer inert with the sheet open', async () => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass, other], hasDarkness: true } });
    });
    const { container } = render(<App />);
    // R81 (§8 rank 1 as amended): the next ISS pass stays in the list, tagged.
    expect(screen.getByTestId('next-tag').closest('article')).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.getByRole('group', { name: 'Sort passes' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();

    act(() => {
      window.location.hash = `#pass=${pass.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeInTheDocument();
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role, { hidden: true })).toHaveAttribute('inert');
  });

  /**
   * R83 (FR-SHARE-3 as amended, F-93's first clause, D-539): a pass link for
   * another place pasted into a running tab was dropped — F-17's consumption
   * saw an observer that was not the link's and cleared the hash. It now goes
   * through `followHash` like a boot: the place is visited, the saved one kept,
   * and the pass is selected with the link still in the address bar.
   */
  it('a pass link pasted into a running tab visits its place and selects the pass, not dropped (F-93)', () => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass, other], hasDarkness: true } });
    });
    render(<App />);
    const hash = passLinkHash({ observer: { lat: 51.48, lon: -0.01, altM: 0 }, noradId: pass.noradId, startT: pass.start.t });
    act(() => {
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(appStore.getState().visiting).toMatchObject({ lat: 51.48, lon: -0.01, source: 'coords' });
    expect(appStore.getState().observer).toBe(observer);
    expect(window.location.hash).toBe(hash);
    expect(screen.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeInTheDocument();
  });

  /**
   * R28 (FR-OFF-1, FR-OFF-6, D-154): "nothing swaps under an open pass or the
   * live page" is a fact about where the two offers are rendered, not a rule
   * either of them enforces. Both sit inside `main`, which the compact sheet
   * makes inert and which the live route replaces outright, so this is the
   * test that keeps that placement — moving either one outside the shell would
   * break it here and nowhere else.
   */
  it('the update offer and the install hint sit inside the shell, so a pass makes them inert and the live page has neither', () => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true }, updateReady: true, applyUpdate: () => undefined });
    });
    render(<App />);
    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
    });
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByTestId('update-banner'));
    expect(main).toContainElement(screen.getByTestId('install-hint'));

    act(() => {
      window.location.hash = `#pass=${pass.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');

    act(() => {
      window.location.hash = '#live';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.queryByTestId('update-banner')).toBeNull();
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });
});
