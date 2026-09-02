import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../../tests/support/fixtures';
import { goldenPassFixture } from '../../tests/support/catalogFixtures';
import type { Pass } from '../model';
import { COMPASS_NAMES, brightnessPhrase, compassName, elevationWord, endReasonPhrase, guideSentence, startReasonPhrase } from './phrases';

interface GuideGolden {
  asComputed: string;
  endHorizon: string;
  endShadow: string;
  endTwilight: string;
}
const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as GuideGolden;
const pass = goldenPassFixture();

describe('elevationWord (FR-GUIDE-1)', () => {
  it('names the four bands with each boundary in the higher band (D-32)', () => {
    expect(elevationWord(10)).toBe('low');
    expect(elevationWord(24.9)).toBe('low');
    expect(elevationWord(25)).toBe('mid-sky');
    expect(elevationWord(49.9)).toBe('mid-sky');
    expect(elevationWord(50)).toBe('high');
    expect(elevationWord(74.9)).toBe('high');
    expect(elevationWord(75)).toBe('almost overhead');
    expect(elevationWord(90)).toBe('almost overhead');
  });
});

describe('brightnessPhrase (FR-GUIDE-3)', () => {
  it('uses the five bands with each boundary in the brighter band', () => {
    expect(brightnessPhrase(-4)).toBe('brighter than Venus');
    expect(brightnessPhrase(-4.5)).toBe('brighter than Venus');
    expect(brightnessPhrase(-3.9)).toBe('brighter than any star');
    expect(brightnessPhrase(-1.4)).toBe('brighter than any star');
    expect(brightnessPhrase(-1.3)).toBe('like a bright star');
    expect(brightnessPhrase(1)).toBe('like a bright star');
    expect(brightnessPhrase(1.1)).toBe('like an average star');
    expect(brightnessPhrase(3)).toBe('like an average star');
    expect(brightnessPhrase(3.1)).toBe('faint, needs dark sky');
  });
});

describe('compassName', () => {
  it('spells out every 16-point abbreviation', () => {
    expect(Object.keys(COMPASS_NAMES)).toHaveLength(16);
    expect(compassName(247)).toBe('west-southwest');
    expect(compassName(0)).toBe('north');
    expect(compassName(53.3)).toBe('northeast');
  });
});

describe('reason phrases (US-6 AC4)', () => {
  it('distinguishes the three end conditions', () => {
    expect(endReasonPhrase('shadow')).toBe("disappears into Earth's shadow");
    expect(endReasonPhrase('horizon')).toBe('drops below the horizon');
    expect(endReasonPhrase('twilight')).toBe('fades into the brightening sky');
    expect(startReasonPhrase('horizon')).toBe('appears');
    expect(startReasonPhrase('shadow')).toBe("emerges from Earth's shadow");
  });
});

describe('guideSentence (US-6 AC1) on the first R1 golden pass in UTC', () => {
  it('matches the golden string for the pass as computed (horizon end, twilight = true)', () => {
    expect(pass.endReason).toBe('horizon');
    expect(pass.twilight).toBe(true);
    expect(guideSentence(pass, null)).toBe(golden.asComputed);
  });

  it('matches one golden string per end reason without the twilight clause', () => {
    const dark = (endReason: Pass['endReason']): Pass => ({ ...pass, endReason, twilight: false });
    expect(guideSentence(dark('horizon'), null)).toBe(golden.endHorizon);
    expect(guideSentence(dark('shadow'), null)).toBe(golden.endShadow);
    expect(guideSentence(dark('twilight'), null)).toBe(golden.endTwilight);
  });

  it('follows the US-6 example shape for a bright high pass ending in shadow', () => {
    const example: Pass = {
      ...pass,
      start: { t: Date.parse('2026-09-11T21:14:32Z'), azDeg: 247, elDeg: 10, rangeKm: 1500 },
      peak: { t: Date.parse('2026-09-11T21:17:50Z'), azDeg: 180, elDeg: 62, rangeKm: 500 },
      end: { t: Date.parse('2026-09-11T21:20:05Z'), azDeg: 67, elDeg: 30, rangeKm: 900 },
      endReason: 'shadow',
      peakMagnitude: -1.8,
      twilight: false,
    };
    expect(guideSentence(example, null)).toBe(
      "Appears low in the west-southwest at 21:14:32 UTC, climbs to 62° (high in the sky) in the south at 21:17:50 UTC, disappears into Earth's shadow in the east-northeast at 21:20:05 UTC. Brighter than any star (magnitude −1.8).",
    );
  });

  it('formats the times in the observer zone when one is known', () => {
    expect(guideSentence(pass, 'America/Argentina/Buenos_Aires')).toContain('at 06:48:14 GMT-3,');
  });
});
