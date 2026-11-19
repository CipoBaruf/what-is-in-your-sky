/**
 * TASKS R200 (FR-OPEN-2, D-1175): the example is a third observer slot under the visit and the saved place, dropped
 * by any place set and never written through to `wiys:prefs:v1`; its outcome latches once (D-1177).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../model';
import { createAppStore } from '../store';
import { activeObserver } from './location';

const NOW = 1_789_120_000_000;
const example: Observer = { lat: -34.6, lon: -58.45, altM: 0, label: 'Buenos Aires', source: 'example', timeZone: 'America/Argentina/Buenos_Aires' };
const neuquen: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const paris: Observer = { lat: 48.86, lon: 2.35, altM: 0, label: '48.86, 2.35', source: 'coords', timeZone: null };

const storeWith = (saved: Observer | null = null) => {
  const write = vi.fn();
  const store = createAppStore({ now: () => NOW, prefs: { read: () => (saved ? { observer: saved } : {}), write } });
  return { store, write };
};

describe('the example observer (FR-OPEN-2, D-1175)', () => {
  it('FR-OPEN-2: activeObserver is visiting, then observer, then example', () => {
    expect(activeObserver({ visiting: null, observer: null, example })).toBe(example);
    expect(activeObserver({ visiting: null, observer: neuquen, example })).toBe(neuquen);
    expect(activeObserver({ visiting: paris, observer: neuquen, example })).toBe(paris);
    expect(activeObserver({ visiting: paris, observer: null, example })).toBe(paris);
    expect(activeObserver({ visiting: null, observer: null, example: null })).toBeNull();
  });

  it('FR-OPEN-2: setExample looks from the city, its start the search window’s, and nothing is written', () => {
    const { store, write } = storeWith();
    store.getState().setExample(example, NOW + 5);
    expect(store.getState()).toMatchObject({ example, exampleStartedMs: NOW + 5, nowMs: NOW + 5, observer: null, visiting: null });
    expect(activeObserver(store.getState())).toBe(example);
    expect(write).not.toHaveBeenCalled();
  });

  it('FR-OPEN-2: setObserver drops the example, and only the set place is written through', () => {
    const { store, write } = storeWith();
    store.getState().setExample(example, NOW);
    store.getState().setObserver(neuquen);
    expect(store.getState().example).toBeNull();
    expect(activeObserver(store.getState())).toBe(neuquen);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith({ observer: neuquen });
    // Clearing the place does not bring the example back: it is dropped for this load.
    store.getState().setObserver(null);
    expect(activeObserver(store.getState())).toBeNull();
    expect(JSON.stringify(write.mock.calls)).not.toContain('example');
  });

  it('FR-OPEN-2: a place already set or visited keeps setExample from taking over', () => {
    const saved = storeWith(neuquen);
    saved.store.getState().restoreSavedObserver();
    saved.store.getState().setExample(example, NOW);
    expect(saved.store.getState().example).toBeNull();

    const visited = storeWith();
    visited.store.getState().visit(paris);
    visited.store.getState().setExample(example, NOW);
    expect(visited.store.getState().example).toBeNull();
    expect(visited.write).not.toHaveBeenCalled();
  });

  it('FR-OPEN-6: the outcome latches once and a later answer does not move it', () => {
    const { store } = storeWith();
    expect(store.getState().exampleOutcome).toBe('pending');
    store.getState().latchExampleOutcome('slow');
    store.getState().latchExampleOutcome('pass');
    expect(store.getState().exampleOutcome).toBe('slow');
    // A place set afterwards drops the example but keeps what the first run came to.
    store.getState().setExample(example, NOW);
    store.getState().setObserver(neuquen);
    expect(store.getState().exampleOutcome).toBe('slow');
  });
});
