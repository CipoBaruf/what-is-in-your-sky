import type { LayoutMode } from '../../lib/layout';
import { DEFAULT_CHART_VIEW, type ChartView } from '../../model';

/** The three sky pages that open on a view: the live page, the pass detail and the stars page. */
export type SkyPage = 'live' | 'pass' | 'stars';

/**
 * R182 (FR-WIDE-2, FR-KEEP-1; D-1095, amends D-876): the view a sky page opens on at a width. One saved value serves
 * every page; with nothing saved a phone opens on the window and a desk on the globe (FR-KEEP-3). A value the page or
 * width does not offer maps to the one that stands for it: the globe and the polar chart are each other's across the
 * breakpoint, and the stars page, which has no dome, reads the dome as its whole sky. The prefs reader leaves
 * `chartView` undefined while nothing is saved, so this is the one place the default is decided.
 */
export function viewFor(page: SkyPage, mode: LayoutMode, saved: ChartView | undefined): ChartView {
  if (saved === undefined) return DEFAULT_CHART_VIEW[mode];
  if (mode === 'wide') {
    // On wide the row is Globe, Window, Dome; the polar chart is not offered, and the stars page has no dome.
    if (saved === 'polar' || (page === 'stars' && saved === 'dome')) return 'globe';
    return saved;
  }
  // On compact the rows are 2.13's: the window, the dome and the polar chart; the stars page's window and whole sky.
  if (saved === 'globe' || (page === 'stars' && saved === 'dome')) return 'polar';
  return saved;
}

/**
 * R136 (FR-FLOW-14; D-876), kept as a thin caller of `viewFor` until R186 mounts the globe on the live page and the
 * pass detail: those pages cannot draw the globe yet, so where `viewFor` answers it they keep 2.13's answer — the
 * dome with nothing saved, and the saved view otherwise.
 */
export function defaultChartView(mode: LayoutMode, saved: ChartView | undefined): ChartView {
  const view = viewFor('live', mode, saved);
  return view === 'globe' ? (saved === undefined || saved === 'globe' ? 'dome' : saved) : view;
}
