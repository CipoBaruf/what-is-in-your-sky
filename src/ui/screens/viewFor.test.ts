import { describe, expect, it } from 'vitest';
import type { LayoutMode } from '../../lib/layout';
import type { ChartView } from '../../model';
import { defaultChartView, viewFor, type SkyPage } from './chartViewDefault';

type Saved = ChartView | undefined;

/**
 * FR-WIDE-2 (D-1095): every page × width × saved value. On wide the row is Globe, Window, Dome (the stars page has no
 * dome, FR-KEEP-1); on compact the live page and the pass detail offer the window, the dome and the polar chart, the
 * stars page the window and the whole sky (the polar chart).
 */
const EXPECTED: Record<SkyPage, Record<LayoutMode, [Saved, ChartView][]>> = {
  live: {
    compact: [[undefined, 'window'], ['globe', 'polar'], ['polar', 'polar'], ['window', 'window'], ['dome', 'dome']],
    wide: [[undefined, 'globe'], ['globe', 'globe'], ['polar', 'globe'], ['window', 'window'], ['dome', 'dome']],
  },
  pass: {
    compact: [[undefined, 'window'], ['globe', 'polar'], ['polar', 'polar'], ['window', 'window'], ['dome', 'dome']],
    wide: [[undefined, 'globe'], ['globe', 'globe'], ['polar', 'globe'], ['window', 'window'], ['dome', 'dome']],
  },
  stars: {
    compact: [[undefined, 'window'], ['globe', 'polar'], ['polar', 'polar'], ['window', 'window'], ['dome', 'polar']],
    wide: [[undefined, 'globe'], ['globe', 'globe'], ['polar', 'globe'], ['window', 'window'], ['dome', 'globe']],
  },
};

describe('viewFor', () => {
  for (const page of ['live', 'pass', 'stars'] as const) {
    for (const mode of ['compact', 'wide'] as const) {
      it(`FR-WIDE-2: maps every saved value on the ${page} page at ${mode}`, () => {
        for (const [saved, view] of EXPECTED[page][mode]) expect([saved, viewFor(page, mode, saved)]).toEqual([saved, view]);
      });
    }
  }

  it('FR-WIDE-2: never opens the polar chart on wide or the globe on compact', () => {
    for (const page of ['live', 'pass', 'stars'] as const) {
      for (const saved of [undefined, 'globe', 'polar', 'window', 'dome'] as const) {
        expect(viewFor(page, 'wide', saved)).not.toBe('polar');
        expect(viewFor(page, 'compact', saved)).not.toBe('globe');
      }
    }
  });
});

/** R136 (D-876) as kept by R182 until R186: the live page and the pass detail draw no globe yet, so 2.13's answer holds. */
describe('defaultChartView', () => {
  it('opens a phone on the window and a desk on the dome when nothing is saved', () => {
    expect(defaultChartView('compact', undefined)).toBe('window');
    expect(defaultChartView('wide', undefined)).toBe('dome');
  });

  it("opens on the saved view, whichever of 2.13's three it is, in both modes", () => {
    for (const saved of ['dome', 'polar', 'window'] as const) {
      expect(defaultChartView('compact', saved)).toBe(saved);
      expect(defaultChartView('wide', saved)).toBe(saved);
    }
  });

  it('reads a saved globe as the polar chart on compact and the dome on wide', () => {
    expect(defaultChartView('compact', 'globe')).toBe('polar');
    expect(defaultChartView('wide', 'globe')).toBe('dome');
  });
});
