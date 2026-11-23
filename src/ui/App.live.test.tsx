/**
 * R32 (FR-LIVE-1), R212 (FR-LAND-1, D-1230): the live route in the app, which
 * is the first page. The route with no hash, or with one that names none, is
 * `#live` at both widths with no history entry; under it the whole screen is
 * the live page, and the satellites page's header links to it.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { MOON_FIXTURE } from '../../tests/support/moonFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX } from '../../tests/support/matchMedia';
import { liveLinkHash } from '../lib/shareLinks';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';
import { resetNavigation } from './navigation';

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
    resetNavigation();
    window.localStorage.clear();
  });

  for (const [width, px] of [['compact', COMPACT_PX], ['wide', WIDE_PX]] as const) {
    it.each(['', '#', '#nope', '#what', '#live?lat=999', '#pass?lat=999'])(`FR-LAND-1: %j opens #live on ${width}, with no history entry`, async (hash) => {
      const media = stubMatchMedia(px);
      try {
        withSky();
        window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
        const entries = window.history.length;
        render(<App />);
        expect(window.location.hash).toBe('#live');
        expect(await screen.findByTestId('live-page')).toBeInTheDocument();
        expect(window.history.length).toBe(entries);
        // D-1230: the first page has nowhere to go back to.
        expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
      } finally {
        media.restore();
      }
    });
  }

  it('FR-LAND-1: a hash typed over a page that names no route becomes #live in that entry', async () => {
    withSky();
    window.history.replaceState(null, '', '#settings');
    render(<App />);
    go('#nope');
    expect(window.location.hash).toBe('#live');
    expect(await screen.findByTestId('live-page')).toBeInTheDocument();
  });

  it('links to the live page from the satellites page’s header (FR-LIVE-1, FR-LAND-6)', () => {
    withSky();
    window.history.replaceState(null, '', '#pass');
    render(<App />);
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
    // R52 (FR-COMP-1): the header's control is `live` on compact, which is what jsdom is without a `matchMedia` stub; `App.wide.test.tsx` has the wide one.
    expect(screen.getByTestId('live-link')).toHaveTextContent('live');
  });

  it('mounts the live page, and nothing of the satellites page, under #live; its Back returns to what opened it', async () => {
    withSky();
    window.history.replaceState(null, '', '#pass');
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    act(() => {
      screen.getByTestId('live-link').click();
    });
    const page = await screen.findByTestId('live-page');
    expect(page).toHaveAttribute('data-state', 'live');
    // R92 (FR-A11Y-1, F-71): nothing of another page, and the live page's own landmarks — its top row the
    // banner, the rest the main, no footer on compact (D-1023: the footer's row is the sheet's last, a `div`).
    // R129 (D-845): the header is the live page's own, told its page, inside the page's banner.
    // R148 (FR-FULL-2, D-920): on compact the banner is the head over the sky, and the `h1` the page's name with the place.
    expect(screen.queryByTestId('header')).toBeNull();
    expect(screen.getByRole('banner')).toContainElement(screen.getByTestId('live-head'));
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId('live-dome'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('live · −38.93, −67.99');
    expect(screen.queryByRole('contentinfo')).toBeNull();
    // R144 (FR-TONIGHT-6): on compact the conditions are the context line under the shown time.
    expect(await screen.findByTestId('live-context')).toBeInTheDocument();
    // FR-LAND-6: the phone's way to the list is the sheet's head.
    expect(screen.getByTestId('sheet-satellites')).toHaveAttribute('href', '#pass');
    act(() => {
      // R85 (FR-COMP-7): the compact return control is `[ ← ]`, named "Back"; opened from a page, it goes back to it.
      screen.getByRole('button', { name: 'Back' }).click();
    });
    await vi.waitFor(() => {
      expect(screen.getByRole('region', { name: 'Upcoming passes' })).toBeInTheDocument();
    });
    expect(window.location.hash).toBe('#pass');
    expect(screen.queryByTestId('live-page')).toBeNull();
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
    expect(await screen.findByTestId('sheet-place')).toHaveTextContent('51.48, −0.01');
    // R83 (FR-VISIT-1, D-538): over a saved place the link's is a visit — shown, and the saved one kept.
    const shared = appStore.getState().visiting;
    expect(shared).toMatchObject({ lat: 51.48, lon: -0.01, altM: 0, source: 'coords', label: '51.48, −0.01' });
    expect(appStore.getState().observer).toBe(own);
    // The same place again is not a new observer: a fresh one would restart the whole compute chain for the sky already shown.
    go('#live');
    go('#live?lat=51.48&lon=-0.01&alt=0');
    expect(appStore.getState().visiting).toBe(shared);
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
    expect(await screen.findByTestId('sheet-place')).toHaveTextContent('Neuquén, Argentina');
    expect(appStore.getState().observer).toBe(fix);
    expect(appStore.getState().passes).toBe(passesBefore);
  });

  it('is the inert live page under #live with no observer', async () => {
    render(<App />);
    go('#live');
    expect(await screen.findByTestId('live-inert')).toBeInTheDocument();
    // R129 (D-845): the header is the live page's own, told its page, inside the page's banner.
    expect(screen.getByTestId('header')).toHaveAttribute('data-page', 'live');
    expect(screen.getByRole('banner')).toContainElement(screen.getByTestId('live-top-row'));
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId('live-inert'));
  });

  // R87 (FR-VISIT-4, F-93): a `#live?…` link that does not parse is no longer the inert live page but the
  // reader's first page (R212, FR-LAND-1), with one line saying so and the link out of the URL.
  it('opens #live with "That link could not be read." for a #live?… link that does not parse', async () => {
    render(<App />);
    go('#live?lat=-99&lon=0');
    expect(await screen.findByTestId('link-note')).toHaveTextContent('That link could not be read.');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(window.location.hash).toBe('#live');
  });
});
