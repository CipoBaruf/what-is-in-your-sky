/** TASKS R9: a chosen place becomes a `geocode` observer labelled "name, admin1, country" with the result's zone (PLAN §7.2, FR-LOC-3). */
import { describe, expect, it } from 'vitest';
import type { Place } from '../model';
import { observerFromPlace, placeLabel, placeRegion } from './place';

const ROSARIO: Place = { name: 'Rosario', admin1: 'Santa Fe', country: 'Argentina', lat: -32.94682, lon: -60.63932, elevationM: 38, timeZone: 'America/Argentina/Cordoba' };
const SINGAPORE: Place = { name: 'Singapore', country: 'Singapore', lat: 1.28967, lon: 103.85007, elevationM: 23, timeZone: 'Asia/Singapore' };

describe('placeLabel / placeRegion', () => {
  it('joins name, admin1 and country', () => {
    expect(placeLabel(ROSARIO)).toBe('Rosario, Santa Fe, Argentina');
    expect(placeRegion(ROSARIO)).toBe('Santa Fe, Argentina');
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
    expect(observerFromPlace(ROSARIO)).toEqual({
      lat: -32.94682,
      lon: -60.63932,
      altM: 38,
      label: 'Rosario, Santa Fe, Argentina',
      source: 'geocode',
      timeZone: 'America/Argentina/Cordoba',
    });
  });
});
