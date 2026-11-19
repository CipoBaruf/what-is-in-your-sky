/**
 * R193 (FR-MEAS-2's state rows, FR-MEAS-5, D-1147): `place_set`, `no_passes` and `failure` from the one subscription,
 * each at its moment and not before; and, through the real `startApp`, the load's context and an adopted link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalPrefs } from '../data/localPrefs';
import type { Count, MeasureEnv } from '../data/measure';
import { WIDE_QUERY } from '../lib/layout';
import { passLinkHash } from '../lib/shareLinks';
import type { Observer, Pass, WeatherSnapshot } from '../model';
import { isMeasureEvent } from '../model/measure';
import { ALWAYS_VISIBLE } from './effects';
import { startApp } from './index';
import { startMeasureEffects } from './measureEffects';
import { createAppStore, type AppStore } from './store';
import type { WorkerLike } from './workerClient';

const NOW = Date.UTC(2026, 10, 18, 21, 0, 0);
const typed: Observer = { lat: -38.95, lon: -68.06, altM: 270, label: 'Neuquén, Neuquén, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const coords: Observer = { lat: 48.86, lon: 2.35, altM: 35, label: '48.86, 2.35', source: 'coords', timeZone: null };
const device: Observer = { lat: 40.4168, lon: -3.7038, altM: 650, label: '40.42, −3.70', source: 'device', timeZone: null, accuracyM: 20 };
const window72 = { startMs: NOW, endMs: NOW + 72 * 3_600_000 };
const failure = { kind: 'server', detail: '503' } as const;

const memoryPrefs = (stored: object | null = null) => {
  const map = new Map<string, string>();
  if (stored) map.set('wiys:prefs:v1', JSON.stringify(stored));
  return { map, prefs: createLocalPrefs({ getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) }) };
};

type Sent = [string, string?];
const recorder = (): { count: Count; sent: Sent[] } => {
  const sent: Sent[] = [];
  const count = ((name: string, detail?: string) => void sent.push(detail === undefined ? [name] : [name, detail])) as Count;
  return { count, sent };
};

describe('FR-MEAS-2: the state rows from measureEffects (D-1147)', () => {
  let store: AppStore;
  let sent: Sent[];
  let stop: () => void;

  const wire = (stored: object | null = null): void => {
    const { prefs } = memoryPrefs(stored);
    store = createAppStore({ now: () => NOW, prefs });
    store.getState().restoreSavedObserver();
    const rec = recorder();
    sent = rec.sent;
    stop = startMeasureEffects(store, rec.count);
  };

  afterEach(() => {
    stop();
  });

  it('place_set: a typed place is search, a coordinate pair coords, a device fix device', () => {
    wire();
    expect(sent).toEqual([]);
    store.getState().setObserver(typed);
    store.getState().setObserver(coords);
    store.getState().setObserver(device);
    expect(sent).toEqual([
      ['place_set', 'search'],
      ['place_set', 'coords'],
      ['place_set', 'device'],
    ]);
  });

  it.each(['pass', 'none', 'no_city', 'failed', 'slow'] as const)('FR-OPEN-10: example_shown:%s once when the outcome latches, never again in that load', (outcome) => {
    wire();
    expect(sent).toEqual([]);
    // R200's slice field, set here as its latch does; `pending` is no latch.
    store.setState({ exampleOutcome: 'pending' } as never);
    expect(sent).toEqual([]);
    store.setState({ exampleOutcome: outcome } as never);
    store.setState({ nowMs: NOW + 1 });
    store.setState({ exampleOutcome: outcome === 'pass' ? 'slow' : 'pass' } as never);
    expect(sent).toEqual([['example_shown', outcome]]);
  });

  it('FR-OPEN-10: a latch already held when the effect starts is sent, once', () => {
    const { prefs } = memoryPrefs(null);
    store = createAppStore({ now: () => NOW, prefs });
    store.setState({ exampleOutcome: 'no_city' } as never);
    const rec = recorder();
    sent = rec.sent;
    stop = startMeasureEffects(store, rec.count);
    store.setState({ nowMs: NOW + 1 });
    expect(sent).toEqual([['example_shown', 'no_city']]);
  });

  it('place_set: a favourite picked is favourite, not its source', () => {
    wire({ favourites: [] });
    store.getState().addFavourite(typed);
    const cellKey = store.getState().favourites[0]?.cellKey ?? '';
    store.getState().selectFavourite(cellKey);
    expect(sent).toEqual([['place_set', 'favourite']]);
  });

  it('place_set: not for the restored place, a zone filled in, a device fix named, or a place cleared', () => {
    wire({ observer: coords });
    expect(store.getState().observer).toEqual(coords);
    store.getState().fillTimeZone('Europe/Paris');
    store.getState().clearSavedObserver();
    store.getState().setObserver(device);
    store.getState().setObserver({ ...device, label: 'Madrid' });
    expect(sent).toEqual([['place_set', 'device']]);
  });

  it('place_set: a visit kept is link', () => {
    wire({ observer: typed });
    store.getState().visit(coords);
    expect(sent).toEqual([]);
    store.getState().keepVisit();
    expect(sent).toEqual([['place_set', 'link']]);
  });

  it('no_passes: when the job is done with an empty list, and not while it computes or when it found one', () => {
    wire();
    const { startJob, addPasses, finishJob } = store.getState();
    startJob('a', coords, window72);
    expect(sent).toEqual([]);
    addPasses('a', [{ noradId: 25544 } as Pass]);
    finishJob('a', { cancelled: false, elapsedMs: 5, hasDarkness: true });
    expect(sent).toEqual([]);
    startJob('b', typed, window72);
    finishJob('b', { cancelled: false, elapsedMs: 5, hasDarkness: true });
    expect(sent).toEqual([['no_passes']]);
  });

  it('failure: elements, forecast and passes, each when its slice stores a Failure', () => {
    wire();
    const state = store.getState();
    state.setElements({ status: 'loading' });
    state.startWeather(coords);
    state.startJob('a', coords, window72);
    expect(sent).toEqual([]);
    state.setElements({ status: 'error', failure });
    state.setWeatherError(coords, failure);
    state.failJob('a', failure);
    expect(sent).toEqual([
      ['failure', 'elements'],
      ['failure', 'forecast'],
      ['failure', 'passes'],
    ]);
  });
});

describe('FR-MEAS-1, FR-MEAS-5: what startApp counts (D-1146)', () => {
  let stop: () => void = () => undefined;
  afterEach(() => {
    stop();
    vi.unstubAllGlobals();
  });

  const boot = (stored: object | null, hash: string, over: Partial<MeasureEnv> = {}) => {
    const beacon = vi.fn((_url: string, _body: string) => true);
    const { prefs, map } = memoryPrefs(stored);
    const store = createAppStore({ now: () => NOW, prefs });
    const never = <T>(): Promise<T> => new Promise<T>(() => undefined);
    stop = startApp({
      store,
      prefs,
      cache: { loadForObserver: () => Promise.resolve(null), save: () => Promise.resolve(null) },
      createWorker: (): WorkerLike => ({ postMessage: () => undefined, addEventListener: () => undefined, terminate: () => undefined }),
      loadElements: never,
      loadWeather: never as () => Promise<WeatherSnapshot>,
      now: () => NOW,
      visibility: ALWAYS_VISIBLE,
      hash,
      measureEnv: { beacon, online: () => true, origin: 'http://localhost:4173', webdriver: true, forced: true, ...over },
    });
    const bodies = () => beacon.mock.calls.map((call) => JSON.parse(String(call[1])) as Record<string, unknown>);
    return { store, map, bodies };
  };

  it('a first visit by an adopted link posts place_set link, with first and the load context', () => {
    const link = passLinkHash({ observer: { lat: 48.86, lon: 2.35, altM: 35 }, noradId: 25544, startT: NOW + 3_600_000 });
    const { bodies, store } = boot(null, link);
    expect(store.getState().observer).toMatchObject({ lat: 48.86 });
    const [event] = bodies();
    expect(bodies()).toHaveLength(1);
    expect(isMeasureEvent(event)).toBe(true);
    expect(event).toMatchObject({ name: 'place_set', detail: 'link', visit: 'first', layout: 'compact', lang: 'en' });
    // FR-MEAS-5: nothing of the place rides on the event.
    expect(JSON.stringify(event)).not.toMatch(/48\.86|2\.35|Paris/);
  });

  it('a return visit is return, wide and in its language, fixed at load; the restored place is not a place set', () => {
    let wide = true;
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === WIDE_QUERY && wide }));
    const { bodies, store, map } = boot({ observer: typed, locale: 'es' }, '');
    wide = false; // the window narrows after load
    const before = map.get('wiys:prefs:v1');
    expect(bodies()).toEqual([]);
    store.getState().setObserver(coords);
    expect(bodies()).toEqual([expect.objectContaining({ name: 'place_set', detail: 'coords', visit: 'return', layout: 'wide', lang: 'es' })]);
    // The context is fixed at load: a language switched later does not change it, and nothing of the count is stored.
    store.getState().setLocale('en');
    store.getState().setObserver(device);
    expect(bodies()[1]).toMatchObject({ visit: 'return', layout: 'wide', lang: 'es', id: bodies()[0]?.['id'] });
    expect(map.get('wiys:prefs:v1')).not.toBe(before); // the place and locale were written, as ever
    expect([...map.keys()]).toEqual(['wiys:prefs:v1']);
    expect(map.get('wiys:prefs:v1')).not.toMatch(/[0-9a-f]{16}/);
  });

  it('off the public address and unforced, nothing is sent', () => {
    const { bodies, store } = boot(null, '', { forced: false, webdriver: false });
    store.getState().setObserver(typed);
    expect(bodies()).toEqual([]);
  });
});
