import type { LayoutMode } from '../../lib/layout';
import type { ChartView } from '../../model';

/**
 * R136 (FR-FLOW-14; V26-11, D-876): the view a sky page opens on. The saved
 * view wins wherever it is read; with nothing saved, a phone opens on the
 * window — the first-person view the stars, the landmark and the tap were
 * built for — and a desk on the dome, which keeps its place there (V25-1).
 * The prefs reader leaves `chartView` undefined when nothing was saved, so
 * this one rule is the only place the default is decided.
 */
export function defaultChartView(mode: LayoutMode, saved: ChartView | undefined): ChartView {
  return saved ?? (mode === 'compact' ? 'window' : 'dome');
}
