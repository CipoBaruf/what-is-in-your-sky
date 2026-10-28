import { describe, expect, it } from 'vitest';
import type { ChartView } from '../../model';
import { defaultChartView } from './chartViewDefault';

/** R136 (FR-FLOW-14, V26-11, D-876): the view a sky page opens on, for each pref case and both modes. */
describe('defaultChartView', () => {
  it('opens a phone on the window and a desk on the dome when nothing is saved', () => {
    expect(defaultChartView('compact', undefined)).toBe('window');
    expect(defaultChartView('wide', undefined)).toBe('dome');
  });

  it('opens on the saved view, whichever it is, in both modes', () => {
    const views: ChartView[] = ['dome', 'polar', 'window'];
    for (const saved of views) {
      expect(defaultChartView('compact', saved)).toBe(saved);
      expect(defaultChartView('wide', saved)).toBe(saved);
    }
  });
});
