/**
 * Golden pass test (PLAN §9.1, §10.2): the whole pipeline reproduces the
 * hand-transcribed Heavens-Above ISS passes for Neuquén, offline, from the
 * committed fixture pair. Fails loudly when the fixture is missing.
 */
import { describe, expect, it } from 'vitest';
import { ANGLE_TOLERANCE_DEG, TIME_TOLERANCE_S, compare, formatReport, runOurPipeline } from '../../tests/support/heavensAbove';
import { haFixtureDates, loadFixturePair } from '../../tests/support/fixtures';

const dates = haFixtureDates();

describe('Heavens-Above golden passes (ISS, Neuquén)', () => {
  it('has at least one committed fixture', () => {
    expect(dates, 'No tests/fixtures/heavens-above/<date>-neuquen-iss.json; see the README there').not.toEqual([]);
  });

  for (const date of dates) {
    describe(`fixture ${date}`, () => {
      const pair = loadFixturePair(date);
      const ours = runOurPipeline(pair.ha, pair.omm);
      const report = compare(pair.ha, ours, pair.explainedExtras);
      const table = formatReport(report, pair.explainedExtras);

      it('finds every Heavens-Above pass', () => {
        expect(report.unpairedHa, table).toEqual([]);
      });

      it(`matches every paired pass within ${TIME_TOLERANCE_S} s / ${ANGLE_TOLERANCE_DEG}° at start, peak and end`, () => {
        for (const p of report.pairs) {
          for (const point of [p.start, p.peak, p.end]) {
            expect(Math.abs(point.dtS), table).toBeLessThanOrEqual(TIME_TOLERANCE_S);
            expect(point.dAzDeg, table).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
            expect(Math.abs(point.dElDeg), table).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
          }
        }
      });

      it('agrees with the implied end reason for every pass', () => {
        for (const p of report.pairs) expect(p.ours.endReason, table).toBe(p.endReasonExpected);
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
