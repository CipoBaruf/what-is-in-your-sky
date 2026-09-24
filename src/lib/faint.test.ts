/**
 * FR-FAINT-4: the classification over a fixture run, at the two thresholds
 * (just over and just under each) and with the three exemptions. The run is
 * the stored Neuquén run the e2e specs load, so the numbers here are the ones
 * the list is drawn from.
 */
import { describe, expect, it } from 'vitest';
import run from '../../tests/fixtures/stored-run-neuquen.json';
import type { Pass } from '../model';
import { FAINT_MAG, FAINT_MAG_MOON, faintLimit, isFaint, splitFaint, type FaintExemptions } from './faint';

const ISS = 25544;
const passes = run.passes as unknown as Pass[];
const none: FaintExemptions = { isIss: (id) => id === ISS, nextEventId: null, openId: null };
const byId = (id: string): Pass => {
  const pass = passes.find((p) => p.id === id);
  if (!pass) throw new Error(`no pass ${id} in the fixture`);
  return pass;
};
const glare = (pass: Pass): Pass => ({ ...pass, moonGlare: { glare: true, separationDeg: 12 } });
const at = (pass: Pass, peakMagnitude: number): Pass => ({ ...pass, peakMagnitude });
const EPS = 0.001;

describe('isFaint (FR-FAINT-1)', () => {
  it('sets the thresholds at +3.5, and +2.5 under moon glare', () => {
    expect(FAINT_MAG).toBe(3.5);
    expect(FAINT_MAG_MOON).toBe(2.5);
    const rocket = byId('26474-1789203849375');
    expect(faintLimit(rocket)).toBe(FAINT_MAG);
    expect(faintLimit(glare(rocket))).toBe(FAINT_MAG_MOON);
  });

  it('pins the fixture run: the five passes fainter than +3.5 and nothing else', () => {
    const { bright, faint } = splitFaint(passes, none);
    expect(faint.map((p) => [p.name, Math.round(p.peakMagnitude * 100) / 100])).toEqual([
      ['SL-16 R/B (Cosmos 2369)', 3.55],
      ['Titan 4B R/B', 4.46],
      ['SL-16 R/B (Cosmos 2369)', 3.62],
      ['Titan 4B R/B', 3.95],
      ['SL-16 R/B (Cosmos 2369)', 4.01],
    ]);
    expect(bright).toHaveLength(passes.length - 5);
    // Each side keeps the run's order.
    expect([...bright, ...faint].sort((a, b) => passes.indexOf(a) - passes.indexOf(b))).toEqual(passes);
  });

  it('is faint just over +3.5 and not at or just under it', () => {
    const rocket = byId('26474-1789203849375');
    expect(isFaint(at(rocket, FAINT_MAG + EPS), none)).toBe(true);
    expect(isFaint(at(rocket, FAINT_MAG), none)).toBe(false);
    expect(isFaint(at(rocket, FAINT_MAG - EPS), none)).toBe(false);
    // The fixture's own pass at +3.07 is kept without glare and left out with it.
    const hazy = byId('38341-1789115465719');
    expect(isFaint(hazy, none)).toBe(false);
    expect(isFaint(glare(hazy), none)).toBe(true);
  });

  it('is faint just over +2.5 under moon glare and not at or just under it', () => {
    const rocket = glare(byId('26474-1789203849375'));
    expect(isFaint(at(rocket, FAINT_MAG_MOON + EPS), none)).toBe(true);
    expect(isFaint(at(rocket, FAINT_MAG_MOON), none)).toBe(false);
    expect(isFaint(at(rocket, FAINT_MAG_MOON - EPS), none)).toBe(false);
  });

  it('never leaves out a pass of the ISS', () => {
    const iss = glare(at(byId('25544-1789120094063'), 5));
    expect(isFaint(iss, none)).toBe(false);
    expect(isFaint(iss, { ...none, isIss: () => false })).toBe(true);
  });

  it('never leaves out the pass the next-event block names', () => {
    const rocket = byId('26474-1789203849375');
    expect(isFaint(rocket, none)).toBe(true);
    expect(isFaint(rocket, { ...none, nextEventId: rocket.id })).toBe(false);
  });

  it('never leaves out the open pass', () => {
    const rocket = byId('26474-1789203849375');
    expect(isFaint(rocket, { ...none, openId: rocket.id })).toBe(false);
    expect(splitFaint(passes, { ...none, openId: rocket.id }).faint).toHaveLength(4);
  });
});
