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
   * R52 (FR-COMP-1): jsdom without a `matchMedia` stub is the compact layout. R212 (FR-LAND-6, D-1231): the compact
   * frame is the satellites page's — the tab's one-row header, the list's regions and the full footer.
   */
  it('FR-LAND-6: the compact satellites page has the tab header, asks for a place, then lists tonight, with no axe violations', async () => {
    act(() => {
      appStore.setState({ exampleOutcome: 'no_city' });
    });
    window.history.replaceState(null, '', '#pass');
    const { container } = render(<App />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent(en.app.shortTitle);
    expect(banner).not.toHaveTextContent(en.app.tagline);
    expect(screen.getByRole('heading', { level: 1, name: en.header.pages.pass })).toBeInTheDocument();
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '#settings');
    expect(screen.getByTestId('pass-set-place')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    act(() => {
      appStore.setState({ observer });
    });
    expect(screen.queryByTestId('pass-set-place')).toBeNull();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Orbital elements by CelesTrak.');
    const list = screen.getByRole('region', { name: 'Upcoming passes' });
    expect(within(list).getByRole('heading', { level: 2, name: 'Upcoming passes' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByTestId('conditions')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('with passes: the tagged card, the sort toggle and the list, no axe violations; header and footer inert with the sheet open', async () => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass, other], hasDarkness: true } });
    });
    window.history.replaceState(null, '', '#pass');
    const { container } = render(<App />);
    // R81 (§8 rank 1 as amended): the next ISS pass stays in the list, tagged.
    expect(screen.getByTestId('next-tag').closest('article')).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.getByRole('group', { name: 'Sort passes' })).toBeInTheDocument();
    expect(within(within(screen.getByRole('region', { name: 'Upcoming passes' })).getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
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

  it('FR-UPD-2: the update bar is the shell’s on every route, under the header, and out of reach only under a layer', async () => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true }, updateReady: true, applyUpdate: () => undefined });
    });
    render(<App />);
    for (const hash of ['#live', '#settings', '#stars', '#pass']) {
      act(() => {
        window.location.hash = hash;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      const bar = await screen.findByTestId('update-banner');
      expect(bar.closest('main'), hash).toBeNull();
      expect(bar, hash).not.toHaveAttribute('inert');
      // The compact live page's header is in its own grid, which follows the bar.
      if (hash === '#settings' || hash === '#pass') expect(bar.parentElement?.previousElementSibling, hash).toBe(screen.getByTestId('header'));
    }
    act(() => {
      window.location.hash = `#pass=${pass.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('update-banner')).toHaveAttribute('inert');
  });

  it('FR-OFF-6: the install offer stands on the phone’s satellites page, inside the main a pass makes inert', () => {
    act(() => {
      appStore.setState({ observer });
    });
    window.history.replaceState(null, '', '#pass');
    render(<App />);
    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
    });
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId('install-hint'));
  });
});
