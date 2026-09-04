/**
 * `physics/now.ts` (TASKS R7): the four item states (visible / in shadow /
 * below the horizon / daylight), `SkyState`, and `visibleUntil`, asserted
 * against `reference-values.json` and the R1 golden pass (sdd-implement rule).
 */
import { describe, expect, it } from 'vitest';
import { loadFixturePair } from '../../tests/support/fixtures';
import { fixtureObserver, runOurPipeline, SPIKE_THRESHOLDS } from '../../tests/support/heavensAbove';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import { loadOmmFixture } from '../../tests/setup/msw';
import { CATALOG } from '../data/catalog';
import { moonAt } from './moon';
import type { NowItem, Observer } from '../model';
import { DEFAULT_THRESHOLDS } from './constants';
import { isHidden, LOOKAHEAD_STEP_MS, MAX_LOOKAHEAD_MS, nowItem, nowState, skyState, visibleUntil, type NowObject } from './now';
import { ommToSatrec } from './sgp4';
import { sunAltitudeDeg } from './sun';

const ref = loadReferenceValues();
const observer = referenceObserver(ref);
const ISS = 25544;
const issStdMag = CATALOG.find((e) => e.noradId === ISS)?.stdMag ?? -2.5;

function issObject(ommFixture = '2026-09-02'): NowObject {
  const omm = loadOmmFixture('stations', ommFixture).find((r) => r.NORAD_CAT_ID === ISS);
  if (!omm) throw new Error('no ISS in the OMM fixture');
  return { satrec: ommToSatrec(omm), noradId: ISS, name: omm.OBJECT_NAME, stdMag: issStdMag };
}

describe('skyState', () => {
  it('splits at the two sun-altitude thresholds, upper bounds inclusive', () => {
    expect(skyState(0, DEFAULT_THRESHOLDS)).toBe('day');
    expect(skyState(-5.99, DEFAULT_THRESHOLDS)).toBe('day');
    expect(skyState(-6, DEFAULT_THRESHOLDS)).toBe('bright-twilight');
    expect(skyState(-11.99, DEFAULT_THRESHOLDS)).toBe('bright-twilight');
    expect(skyState(-12, DEFAULT_THRESHOLDS)).toBe('dark');
    expect(skyState(-57.67, DEFAULT_THRESHOLDS)).toBe('dark');
  });
});

describe('nowState at the R1 reference instant (below the horizon, in shadow, dark sky)', () => {
  const state = nowState([issObject()], observer, ref.t, DEFAULT_THRESHOLDS);
  const [iss] = state.items;

  it('reproduces the reference look angles, sun altitude and umbra flag', () => {
    expect(state.t).toBe(ref.t);
    expect(state.sunAltDeg).toBeCloseTo(ref.sunAltitudeDeg, 6);
    expect(state.sky).toBe('dark');
    expect(iss).toBeDefined();
    expect(iss?.azDeg).toBeCloseTo(ref.lookAngles.azDeg, 6);
    expect(iss?.elDeg).toBeCloseTo(ref.lookAngles.elDeg, 6);
    expect(iss?.rangeKm).toBeCloseTo(ref.lookAngles.rangeKm, 6);
    expect(iss?.lit).toBe(!ref.inUmbra);
  });

  it('is a "below horizon" item: not above the minimum elevation, not visible, no magnitude, no visibleUntil', () => {
    expect(iss).toMatchObject({ noradId: ISS, name: 'ISS (ZARYA)', aboveMinElevation: false, visible: false, magnitude: null });
    expect(iss?.visibleUntil).toBeUndefined();
    expect(iss?.endReason).toBeUndefined();
  });
});

describe('nowState inside the R1 golden pass (visible)', () => {
  const golden = ref.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  // 10 s after the pass start, on the pass's own 1 s grid, so the look-ahead lands exactly on its end sample.
  const t = golden.start.t + 10_000;
  const state = nowState([issObject()], observer, t, DEFAULT_THRESHOLDS);
  const [iss] = state.items;

  it('is bright twilight (sun in (−12°, −6°] as the golden pass records)', () => {
    expect(state.sunAltDeg).toBeGreaterThan(DEFAULT_THRESHOLDS.twilightLabelSunAltDeg);
    expect(state.sunAltDeg).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.sunAltMaxDeg);
    expect(state.sky).toBe('bright-twilight');
  });

  it('lists the ISS as visible, lit, above 10°, with a magnitude', () => {
    expect(iss).toMatchObject({ visible: true, lit: true, aboveMinElevation: true });
    expect(iss?.elDeg).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.minElevationDeg);
    expect(iss?.azDeg).toBeGreaterThan(golden.start.azDeg);
    expect(iss?.azDeg).toBeLessThan(golden.end.azDeg);
    expect(iss?.magnitude).not.toBeNull();
  });

  it('visibleUntil is the golden pass end, and the end reason is the pass end reason', () => {
    expect(iss?.visibleUntil).toBe(golden.end.t);
    expect(iss?.endReason).toBe(golden.endReason);
    expect((golden.end.t - t) / 1000).toBeGreaterThan(0);
  });

  it('visibleUntil refines the last coarse step to the 1 s grid', () => {
    const end = visibleUntil(issObject(), observer, t, DEFAULT_THRESHOLDS);
    expect(end?.visibleUntil).toBe(golden.end.t);
    expect((golden.end.t - t) % LOOKAHEAD_STEP_MS).not.toBe(0); // the answer is not on the coarse grid
  });
});

describe('the Moon in the Now state (R19 review, D-109)', () => {
  it('is the Moon at the instant asked for, for the observer asked about (FR-MOON-3)', () => {
    const state = nowState([issObject()], observer, ref.t, DEFAULT_THRESHOLDS);
    expect(state.moon.t).toBe(ref.t);
    expect(state.moon).toEqual(moonAt(ref.t, observer));
  });

  it('follows the observer: the same instant puts the Moon at a different altitude elsewhere', () => {
    const antipode: Observer = { ...observer, lat: -observer.lat, lon: observer.lon + 180 };
    const here = nowState([issObject()], observer, ref.t, DEFAULT_THRESHOLDS).moon;
    const there = nowState([issObject()], antipode, ref.t, DEFAULT_THRESHOLDS).moon;
    expect(there.elDeg).not.toBeCloseTo(here.elDeg, 1);
    // Same instant, so the phase is a fact about the Sun and the Moon alone, not about the place.
    expect(there.illuminatedFraction).toBeCloseTo(here.illuminatedFraction, 12);
    expect(there.phase).toBe(here.phase);
  });
});

describe('nowState in daylight', () => {
  it('reports sky "day" and nothing visible at local noon, whatever is up', () => {
    const noon = Date.UTC(2026, 8, 11, 16, 0, 0); // ≈ 13:00 at UTC−3
    const state = nowState([issObject()], observer, noon, DEFAULT_THRESHOLDS);
    expect(state.sunAltDeg).toBeGreaterThan(0);
    expect(state.sky).toBe('day');
    expect(state.items.every((i) => !i.visible)).toBe(true);
  });
});

describe('nowState with an object above 10° but in Earth’s shadow', () => {
  it('flags it aboveMinElevation, unlit, not visible, magnitude null (just after a shadow-bounded Paris pass)', () => {
    const pair = loadFixturePair('2026-09-02-paris-iss');
    const paris: Observer = fixtureObserver(pair.ha);
    const shadowPass = runOurPipeline(pair.ha, pair.omm).find((p) => p.endReason === 'shadow');
    if (!shadowPass) throw new Error('the Paris fixture has no shadow-bounded pass');
    const object = issObject(pair.ommFixture);
    const t = shadowPass.end.t + 2_000;
    const state = nowState([object], paris, t, SPIKE_THRESHOLDS);
    expect(state.sky).not.toBe('day');
    expect(state.items[0]).toMatchObject({ aboveMinElevation: true, lit: false, visible: false, magnitude: null });
    expect(state.items[0]?.elDeg).toBeGreaterThanOrEqual(SPIKE_THRESHOLDS.minElevationDeg);

    // And just before the end: visible, ending in shadow at the pass end.
    const before = nowItem(object, paris, shadowPass.end.t - 5_000, SPIKE_THRESHOLDS);
    expect(before).toMatchObject({ visible: true, endReason: 'shadow', visibleUntil: shadowPass.end.t });
  });
});

describe('isHidden (FR-LIVE-6)', () => {
  const item = (over: Partial<NowItem> = {}): NowItem => ({
    noradId: 1,
    name: 'Test',
    azDeg: 180,
    elDeg: 40,
    rangeKm: 600,
    magnitude: 1,
    lit: true,
    aboveMinElevation: true,
    visible: true,
    ...over,
  });

  it('excludes an object below the horizon, however it fails', () => {
    expect(isHidden(item({ elDeg: -0.1, visible: false, aboveMinElevation: false }), DEFAULT_THRESHOLDS)).toBe(false);
    expect(isHidden(item({ elDeg: 0, visible: false, aboveMinElevation: false }), DEFAULT_THRESHOLDS)).toBe(false);
  });

  it('includes an object up but under the minimum elevation', () => {
    expect(isHidden(item({ elDeg: 4, aboveMinElevation: false, visible: false }), DEFAULT_THRESHOLDS)).toBe(true);
  });

  it('includes an object in Earth’s shadow and one in daylight', () => {
    expect(isHidden(item({ lit: false, visible: false, magnitude: null }), DEFAULT_THRESHOLDS)).toBe(true);
    expect(isHidden(item({ visible: false }), DEFAULT_THRESHOLDS)).toBe(true); // daylight: nothing else failed
  });

  it('includes a lit object in a dark sky that is too faint to look for, at the magnitude limit exactly', () => {
    const limit = DEFAULT_THRESHOLDS.magLimit;
    expect(isHidden(item({ magnitude: limit }), DEFAULT_THRESHOLDS)).toBe(false);
    expect(isHidden(item({ magnitude: limit + 0.1 }), DEFAULT_THRESHOLDS)).toBe(true);
  });

  it('excludes the objects the app does tell you to look for', () => {
    expect(isHidden(item(), DEFAULT_THRESHOLDS)).toBe(false);
  });
});

describe('nowState with includeHidden (D-76)', () => {
  const golden = ref.firstGoldenPass;
  const t = (golden?.start.t ?? ref.t) + 10_000;

  it('omits the key entirely without the option, so an MVP response is unchanged', () => {
    const state = nowState([issObject()], observer, t, DEFAULT_THRESHOLDS);
    expect(state).not.toHaveProperty('hidden');
    expect(nowState([issObject()], observer, t, DEFAULT_THRESHOLDS, {})).toEqual(state);
    expect(nowState([issObject()], observer, t, DEFAULT_THRESHOLDS, { includeHidden: false })).toEqual(state);
  });

  it('returns the hidden subset of the same items, leaving `items` alone', () => {
    const plain = nowState([issObject()], observer, t, DEFAULT_THRESHOLDS);
    const withHidden = nowState([issObject()], observer, t, DEFAULT_THRESHOLDS, { includeHidden: true });
    expect(withHidden.items).toEqual(plain.items);
    expect(withHidden.hidden).toEqual(plain.items.filter((i) => isHidden(i, DEFAULT_THRESHOLDS)));
  });

  it('names the shadowed object above 10° after a shadow-bounded Paris pass', () => {
    const pair = loadFixturePair('2026-09-02-paris-iss');
    const paris: Observer = fixtureObserver(pair.ha);
    const shadowPass = runOurPipeline(pair.ha, pair.omm).find((p) => p.endReason === 'shadow');
    if (!shadowPass) throw new Error('the Paris fixture has no shadow-bounded pass');
    const state = nowState([issObject(pair.ommFixture)], paris, shadowPass.end.t + 2_000, SPIKE_THRESHOLDS, { includeHidden: true });
    expect(state.hidden?.map((i) => i.noradId)).toEqual([ISS]);
    expect(state.hidden?.[0]).toMatchObject({ lit: false, visible: false, aboveMinElevation: true });
  });

  it('is empty when the only object is below the horizon', () => {
    const state = nowState([issObject()], observer, ref.t, DEFAULT_THRESHOLDS, { includeHidden: true });
    expect(state.items[0]?.elDeg).toBeLessThan(0);
    expect(state.hidden).toEqual([]);
  });
});

describe('nowState edge cases', () => {
  it('leaves out an object whose propagation fails', () => {
    // The ISS with a drag term 600× the real one has decayed ten days after its epoch (SGP4 error 6), as in sgp4.test.ts.
    const omm = loadOmmFixture('stations').find((r) => r.NORAD_CAT_ID === ISS);
    if (!omm) throw new Error('no ISS in the OMM fixture');
    const decayed: NowObject = { ...issObject(), noradId: 1, satrec: ommToSatrec({ ...omm, BSTAR: 0.05 }) };
    const state = nowState([decayed, issObject()], observer, ref.iss.epochMs + 10 * 86_400_000, DEFAULT_THRESHOLDS);
    expect(state.items.map((i) => i.noradId)).toEqual([ISS]);
  });

  it('caps the look-ahead: a permanently "visible" predicate yields no visibleUntil', () => {
    // A minimum elevation of −90° and a sun-altitude ceiling of +90° make every lit instant visible;
    // the ISS is lit at the golden pass and for far longer than the cap, so the look-ahead runs out.
    const always = { ...DEFAULT_THRESHOLDS, minElevationDeg: -90, sunAltMaxDeg: 90 };
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    const item = nowItem(issObject(), observer, golden.start.t, always);
    expect(item?.visible).toBe(true);
    expect(item?.visibleUntil).toBeUndefined();
    expect(MAX_LOOKAHEAD_MS).toBeGreaterThan(15 * 60_000);
  });

  it('agrees with sunAltitudeDeg for the state’s sun altitude', () => {
    const state = nowState([], observer, ref.t, DEFAULT_THRESHOLDS);
    expect(state.items).toEqual([]);
    expect(state.sunAltDeg).toBe(sunAltitudeDeg(observer, ref.t));
  });
});
