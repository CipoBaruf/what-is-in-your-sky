/**
 * Golden pass test (PLAN §9.1, §10.2; TASKS R1, H): the whole pipeline
 * reproduces the hand-transcribed Heavens-Above ISS passes for every committed
 * observer fixture (Neuquén 39° S, Paris 49° N, Singapore 1° N), offline, from
 * the committed fixture pairs. Fails loudly when no fixture is committed.
 */
import { describe, expect, it } from 'vitest';
import { ANGLE_TOLERANCE_DEG, TIME_TOLERANCE_S, compare, formatReport, runOurPipeline } from '../../tests/support/heavensAbove';
import { haFixtureNames, loadFixturePair } from '../../tests/support/fixtures';

const names = haFixtureNames();

describe('Heavens-Above golden passes (ISS)', () => {
  it('has at least one committed fixture', () => {
    expect(names, 'No tests/fixtures/heavens-above/<date>-<place>-iss.json; see the README there').not.toEqual([]);
  });

  it('covers a southern mid-latitude, a northern mid-latitude and a near-equator observer (TASKS H)', () => {
    const lats = names.map((n) => loadFixturePair(n).ha.observer.lat);
    expect(lats.some((lat) => lat <= -30)).toBe(true);
    expect(lats.some((lat) => lat >= 45 && lat <= 52)).toBe(true);
    expect(lats.some((lat) => Math.abs(lat) <= 5)).toBe(true);
  });

  for (const name of names) {
    describe(`fixture ${name}`, () => {
      const pair = loadFixturePair(name);
      const ours = runOurPipeline(pair.ha, pair.omm);
      const report = compare(pair.ha, ours, pair.explainedExtras);
      const table = formatReport(report, pair.explainedExtras);

      it('pairs its OMM capture with elements of essentially the same epoch as Heavens-Above (< 1 day)', () => {
        const iss = pair.omm.find((r) => r.NORAD_CAT_ID === 25544);
        expect(iss).toBeDefined();
        const gapH = Math.abs(Date.parse(`${iss?.EPOCH ?? ''}Z`) - Date.parse(pair.ha.haEpoch)) / 3_600_000;
        expect(gapH).toBeLessThan(24);
      });

      it('finds every Heavens-Above pass', () => {
        expect(report.unpairedHa, table).toEqual([]);
      });

      it(`matches every paired pass within ${TIME_TOLERANCE_S} s / ${ANGLE_TOLERANCE_DEG}° at start, peak and end`, () => {
        expect(report.pairs.length).toBeGreaterThan(0);
        for (const p of report.pairs) {
          for (const point of [p.start, p.peak, p.end]) {
            expect(Math.abs(point.dtS), table).toBeLessThanOrEqual(TIME_TOLERANCE_S);
            expect(point.dAzDeg, table).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
            expect(Math.abs(point.dElDeg), table).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
          }
        }
      });

      it('agrees with the implied start and end reasons for every pass', () => {
        for (const p of report.pairs) {
          expect(p.ours.startReason, table).toBe(p.startReasonExpected);
          expect(p.ours.endReason, table).toBe(p.endReasonExpected);
        }
      });

      it('explains every extra pass', () => {
        expect(report.unexplainedExtras.map((p) => new Date(p.peak.t).toISOString()), table).toEqual([]);
      });

      it('is OVERALL: PASS', () => {
        expect(report.overall, table).toBe(true);
      });
    });
  }
});
