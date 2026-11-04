import { describe, expect, it } from 'vitest';
import type { LayoutMode } from '../../lib/layout';
import type { ChartView } from '../../model';
import { nextView, viewFor, type SkyPage } from './chartViewDefault';

type Saved = ChartView | undefined;

/**
 * FR-WIDE-2 (D-1095): every page × width × saved value. On wide the row is Globe, Window, Dome on all three pages (R186,
 * FR-WIDE-6); on compact the live page and the pass detail offer the window, the dome and the polar chart, the
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
    wide: [[undefined, 'globe'], ['globe', 'globe'], ['polar', 'globe'], ['window', 'window'], ['dome', 'dome']],
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

describe('nextView', () => {
  it('FR-WIDE-2: v cycles Globe, Window, Dome on wide from the view shown', () => {
    for (const page of ['live', 'pass', 'stars'] as const) {
      expect(nextView(page, 'wide', undefined)).toBe('window');
      expect(nextView(page, 'wide', 'window')).toBe('dome');
      expect(nextView(page, 'wide', 'dome')).toBe('globe');
      expect(nextView(page, 'wide', 'polar')).toBe('window');
    }
  });

  it('FR-DESK-4: on compact v toggles the dome and the polar chart, as on 2.13', () => {
    expect(nextView('live', 'compact', undefined)).toBe('dome');
    expect(nextView('live', 'compact', 'dome')).toBe('polar');
  });
});
