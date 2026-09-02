/** TASKS R9: a chosen place becomes a `geocode` observer labelled "name, admin1, country" with the result's zone (PLAN §7.2, FR-LOC-3). */
import { describe, expect, it } from 'vitest';
import type { Place } from '../model';
import { observerFromPlace, placeLabel, placeRegion } from './place';

const CIPOLLETTI: Place = { name: 'Cipolletti', admin1: 'Rio Negro', country: 'Argentina', lat: -38.93392, lon: -67.99032, elevationM: 267, timeZone: 'America/Argentina/Salta' };
const SINGAPORE: Place = { name: 'Singapore', country: 'Singapore', lat: 1.28967, lon: 103.85007, elevationM: 23, timeZone: 'Asia/Singapore' };

describe('placeLabel / placeRegion', () => {
  it('joins name, admin1 and country', () => {
    expect(placeLabel(CIPOLLETTI)).toBe('Cipolletti, Rio Negro, Argentina');
    expect(placeRegion(CIPOLLETTI)).toBe('Rio Negro, Argentina');
  });

  it('skips the parts the provider did not give', () => {
    expect(placeLabel(SINGAPORE)).toBe('Singapore, Singapore');
    expect(placeRegion(SINGAPORE)).toBe('Singapore');
    expect(placeLabel({ ...SINGAPORE, country: '' })).toBe('Singapore');
    expect(placeRegion({ name: 'X', lat: 0, lon: 0, elevationM: 0, timeZone: 'Etc/UTC' })).toBe('');
  });
});

describe('observerFromPlace', () => {
  it('is a geocode observer at the place, with its label, elevation and zone', () => {
    expect(observerFromPlace(CIPOLLETTI)).toEqual({
      lat: -38.93392,
      lon: -67.99032,
      altM: 267,
      label: 'Cipolletti, Rio Negro, Argentina',
      source: 'geocode',
      timeZone: 'America/Argentina/Salta',
    });
  });
});
