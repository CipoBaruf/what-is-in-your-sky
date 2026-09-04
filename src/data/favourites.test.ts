/**
 * TASKS R26 (FR-OFF-7, US-17, D-85, D-138): the saved list is held newest use
 * first, a place is its 0.01° cell, and a ninth entry evicts the least
 * recently used one.
 */
import { describe, expect, it } from 'vitest';
import { addFavourite, favouriteCellKey, mostRecentlyUsed, removeFavourite, touchFavourite } from './favourites';
import { MAX_FAVOURITES, type Favourite, type Observer } from '../model';

const NOW = 1_789_120_000_000;
const MINUTE = 60_000;

/** Eight distinct cells: one degree apart, so nothing rounds into a neighbour. */
const place = (n: number, label = `place ${n}`): Observer => ({ lat: -38.93 + n, lon: -67.99, altM: 0, label, source: 'geocode', timeZone: 'America/Argentina/Salta' });

/** Saves places 0..n − 1, each a minute after the last, so the LRU order is the order they were saved in. */
const saved = (count: number): Favourite[] => {
  let list: Favourite[] = [];
  for (let n = 0; n < count; n++) list = addFavourite(list, place(n), NOW + n * MINUTE);
  return list;
};

describe('favouriteCellKey', () => {
  it('is the observer rounded to 0.01°, so a place a few hundred metres away is the same favourite', () => {
    expect(favouriteCellKey(place(0))).toBe('-38.93,-67.99');
    expect(favouriteCellKey({ ...place(0), lat: -38.9299, lon: -67.9902 })).toBe('-38.93,-67.99');
    expect(favouriteCellKey(place(1))).toBe('-37.93,-67.99');
  });
});

describe('addFavourite', () => {
  it('saves the whole observer, zone included, with the clock on both stamps', () => {
    const [first] = addFavourite([], place(0), NOW);
    expect(first).toEqual({ cellKey: '-38.93,-67.99', observer: place(0), addedAt: NOW, lastUsedAt: NOW });
  });

  it('holds the list newest use first', () => {
    expect(saved(3).map((favourite) => favourite.observer.label)).toEqual(['place 2', 'place 1', 'place 0']);
  });

  it('refreshes the place already saved for that cell instead of spending a second slot, keeping addedAt', () => {
    const list = addFavourite(saved(3), { ...place(0), label: 'home' }, NOW + 10 * MINUTE);
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ cellKey: '-38.93,-67.99', addedAt: NOW, lastUsedAt: NOW + 10 * MINUTE });
    expect(list[0]?.observer.label).toBe('home'); // the new label wins: it is what the user just typed
  });

  it('evicts the least recently used at nine, and only at nine (D-85)', () => {
    const eight = saved(MAX_FAVOURITES);
    expect(eight).toHaveLength(MAX_FAVOURITES);
    expect(eight.map((favourite) => favourite.observer.label)).toContain('place 0');

    const ninth = addFavourite(eight, place(8), NOW + 8 * MINUTE);
    expect(ninth).toHaveLength(MAX_FAVOURITES);
    expect(ninth.map((favourite) => favourite.observer.label)).not.toContain('place 0'); // the oldest use, dropped
    expect(ninth[0]?.observer.label).toBe('place 8');
    expect(ninth.at(-1)?.observer.label).toBe('place 1');
  });

  it('evicts by use, not by age: a place saved first but used last stays', () => {
    const eight = touchFavourite(saved(MAX_FAVOURITES), favouriteCellKey(place(0)), NOW + 100 * MINUTE);
    const ninth = addFavourite(eight, place(8), NOW + 101 * MINUTE);
    expect(ninth.map((favourite) => favourite.observer.label)).toContain('place 0');
    expect(ninth.map((favourite) => favourite.observer.label)).not.toContain('place 1');
  });

  it('keeps the newest of a set saved in the same millisecond, a frozen clock included', () => {
    let list: Favourite[] = [];
    for (let n = 0; n < MAX_FAVOURITES + 1; n++) list = addFavourite(list, place(n), NOW);
    expect(list).toHaveLength(MAX_FAVOURITES);
    expect(list[0]?.observer.label).toBe('place 8');
    expect(list.map((favourite) => favourite.observer.label)).not.toContain('place 0');
  });
});

describe('touchFavourite', () => {
  it('moves the selected place to the front and stamps the use', () => {
    const list = touchFavourite(saved(3), favouriteCellKey(place(0)), NOW + 5 * MINUTE);
    expect(list.map((favourite) => favourite.observer.label)).toEqual(['place 0', 'place 2', 'place 1']);
    expect(list[0]).toMatchObject({ addedAt: NOW, lastUsedAt: NOW + 5 * MINUTE });
  });

  it('leaves an unknown cell alone', () => {
    const list = saved(3);
    expect(touchFavourite(list, 'nowhere', NOW + MINUTE)).toEqual(list);
  });
});

describe('removeFavourite', () => {
  it('drops one place and nothing else', () => {
    const list = removeFavourite(saved(3), favouriteCellKey(place(1)));
    expect(list.map((favourite) => favourite.observer.label)).toEqual(['place 2', 'place 0']);
    expect(removeFavourite(list, 'nowhere')).toEqual(list);
  });
});

describe('mostRecentlyUsed', () => {
  it('sorts and caps whatever it is handed, so a list read back from storage is eight at most', () => {
    const twelve = Array.from({ length: 12 }, (_, n) => ({ cellKey: `cell ${n}`, observer: place(n), addedAt: NOW, lastUsedAt: NOW + n * MINUTE }));
    const capped = mostRecentlyUsed(twelve);
    expect(capped).toHaveLength(MAX_FAVOURITES);
    expect(capped[0]?.lastUsedAt).toBe(NOW + 11 * MINUTE);
    expect(capped.at(-1)?.lastUsedAt).toBe(NOW + 4 * MINUTE);
  });
});
