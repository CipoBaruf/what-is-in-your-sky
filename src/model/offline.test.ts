/**
 * R41 (F-13): the `Favourite` doc block names the field that carries the cell.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Favourite doc block', () => {
  it('names cellKey as the cell, not the stale id', () => {
    const source = readFileSync('src/model/offline.ts', 'utf8');
    const doc = source.slice(0, source.indexOf('export interface Favourite {'));
    const favouriteDoc = doc.slice(doc.lastIndexOf('/**'));
    expect(favouriteDoc).toContain('`cellKey` is the observer');
    expect(favouriteDoc).not.toMatch(/`id` is the observer/);
  });
});
