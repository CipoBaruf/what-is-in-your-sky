/**
 * R32 (FR-LIVE-1): the `#live` route in the app. Under it the whole screen is
 * the live page and nothing of the home page is mounted; the header and the
 * Now panel carry the control that opens it; leaving it puts the home page
 * back with the same store.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { MOON_FIXTURE } from '../../tests/support/moonFixtures';
import { liveLinkHash } from '../lib/shareLinks';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();

const go = (hash: string): void => {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

const withSky = (): void => {
  act(() => {
    appStore.getState().setChartView('polar');
    appStore.setState({
      observer,
      nowMs: NOW,
      elements: ready,
      passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true },
      now: { observer, state: { t: NOW, sunAltDeg: -30, sky: 'dark', items: [], moon: MOON_FIXTURE }, error: null },
    });
  });
};

describe('<App> and the live route', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
    window.localStorage.clear();
  });

  it('links to the live page from the header and from the Now panel', () => {
    withSky();
    render(<App />);
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
    // R52 (FR-COMP-1): the header's control is `[ live ]` on compact, which is what jsdom is without a `matchMedia` stub; `App.wide.test.tsx` has the wide name.
    expect(screen.getByTestId('live-link')).toHaveTextContent('live');
    expect(screen.getByTestId('now-live-link')).toHaveAttribute('href', '#live');
    expect(screen.getByTestId('now-live-link')).toHaveTextContent('Watch the sky live');
  });

  it('mounts the live page, and nothing of the home page, under #live; leaving restores the home page', async () => {
    withSky();
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    go('#live');
    const page = await screen.findByTestId('live-page');
    expect(page).toHaveAttribute('data-state', 'live');
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(await screen.findByTestId('status-strip')).toBeInTheDocument();
    act(() => {
      screen.getByRole('button', { name: '← Back' }).click();
    });
    expect(window.location.hash).toBe('');
    expect(screen.queryByTestId('live-page')).toBeNull();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Upcoming passes' })).toBeInTheDocument();
  });

  /**
   * R39 (F-34): `startApp` sets a link's observer before the first render
   * (D-135), which is the arrival. A navigation inside the document — a shared
   * link opened from a page of the app, the back button — only changed the
   * hash, so the live page drew this device's own sky at the link's instant and
   * offered to share that back as if it were the sender's.
   */
  it("applies a shared #live?… link's observer on a same-document navigation too (F-34)", async () => {
    withSky();
    render(<App />);
    const own = appStore.getState().observer;
    go('#live?lat=51.48&lon=-0.01&alt=0');
    expect(await screen.findByTestId('live-place')).toHaveTextContent('51.48, −0.01');
    const shared = appStore.getState().observer;
    expect(shared).toMatchObject({ lat: 51.48, lon: -0.01, altM: 0, source: 'coords', label: '51.48, −0.01' });
    expect(shared).not.toBe(own);
    // The same place again is not a new observer: a fresh one would restart the whole compute chain for the sky already shown.
    go('#live');
    go('#live?lat=51.48&lon=-0.01&alt=0');
    expect(appStore.getState().observer).toBe(shared);
  });

  /**
   * R58 review (F-56, FR-LIVE-11, D-280, D-295): the guard `startApp` applies
   * on arrival has to hold a render later too. A phone's own fix keeps every
   * digit the device reported (`observerFromPosition`), and the link FR-LIVE-9
   * writes for it carries five decimals, so the two are the same place without
   * being equal number for number — which is all the old exact-equality test
   * looked at. It replaced the reader's geocoded observer with a bare
   * `source: 'coords'` one, and with it went the label, the zone and the
   * stored run: F-56, one render after `startApp` had just refused it.
   */
  it("leaves the observer alone for a #live link at its own place, however many digits the fix had (F-56)", async () => {
    const fix: Observer = { lat: -38.933921274, lon: -67.990318617, altM: 270.4, label: 'Neuquén, Argentina', source: 'geocode', timeZone: 'America/Argentina/Buenos_Aires' };
    withSky();
    act(() => {
      appStore.setState({ observer: fix, now: { observer: fix, state: { t: NOW, sunAltDeg: -30, sky: 'dark', items: [], moon: MOON_FIXTURE }, error: null } });
    });
    render(<App />);
    const passesBefore = appStore.getState().passes;
    go(liveLinkHash({ observer: fix, t: null })); // '#live?lat=-38.93392&lon=-67.99032&alt=270'
    expect(await screen.findByTestId('live-place')).toHaveTextContent('Neuquén, Argentina');
    expect(appStore.getState().observer).toBe(fix);
    expect(appStore.getState().passes).toBe(passesBefore);
  });

  it('is the inert live page under #live with no observer, and a #live?… link that does not parse', async () => {
    render(<App />);
    go('#live');
    expect(await screen.findByTestId('live-inert')).toBeInTheDocument();
    go('#live?lat=-99&lon=0');
    expect(await screen.findByTestId('live-inert')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).toBeNull();
  });
});
