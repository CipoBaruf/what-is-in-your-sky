/**
 * FR-MEAS-2 (D-1147): the four pages a load can open after it starts are counted from `App`'s route hooks — a pass
 * detail, the live page, the settings page (R222: the stars page is gone) — each when its route is on screen and not before.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../tests/support/matchMedia';
import { passIdHash } from '../lib/shareLinks';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { count } from '../state/measure';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';

vi.mock('../state/measure', () => ({ count: vi.fn() }));

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
let media: MatchMediaStub;

const go = (hash: string): void => {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};
const opened = () => vi.mocked(count).mock.calls.map((call) => call.join(':')).filter((pair) => pair.endsWith('_open'));

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.mocked(count).mockClear();
  act(() => {
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true } });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
  window.history.replaceState(null, '', window.location.pathname);
  window.localStorage.clear();
});

describe.each([
  ['compact', COMPACT_PX],
  ['wide', WIDE_PX],
] as const)('<App> counts the pages it opens on %s (FR-MEAS-2)', (_layout, px) => {
  beforeEach(() => {
    media = stubMatchMedia(px);
  });

  it.each([
    ['pass_open', passIdHash(pass.id), '#settings'],
    ['live_open', '#live', '#settings'],
    ['settings_open', '#settings', '#live'],
  ])('%s when %s is on screen, and not before it', async (name, hash, before) => {
    window.history.replaceState(null, '', before);
    render(<App />);
    expect(opened()).not.toContain(name);
    vi.mocked(count).mockClear();
    go(hash);
    await act(async () => {
      await Promise.resolve();
    });
    expect(opened()).toEqual([name]);
  });

  it('FR-LAND-1: the route with no hash is a live opening', () => {
    render(<App />);
    expect(opened()).toEqual(['live_open']);
  });

  it('a pass page with no pass to show (`#pass`, an empty span) is no pass detail', () => {
    act(() => {
      appStore.setState({ passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [], hasDarkness: true } });
    });
    window.history.replaceState(null, '', '#pass');
    render(<App />);
    expect(opened()).toEqual([]);
  });
});
