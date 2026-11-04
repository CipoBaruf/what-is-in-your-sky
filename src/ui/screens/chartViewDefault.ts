import type { LayoutMode } from '../../lib/layout';
import { DEFAULT_CHART_VIEW, type ChartView } from '../../model';

/** The three sky pages that open on a view: the live page, the pass detail and the stars page. */
export type SkyPage = 'live' | 'pass' | 'stars';

/**
 * R182 (FR-WIDE-2, FR-KEEP-1; D-1095, amends D-876): the view a sky page opens on at a width. One saved value serves
 * every page; with nothing saved a phone opens on the window and a desk on the globe (FR-KEEP-3). A value the page or
 * width does not offer maps to the one that stands for it: the globe and the polar chart are each other's across the
 * breakpoint, and the compact stars page, which has no dome, reads the dome as its whole sky. R186 (FR-WIDE-6): the
 * wide row is `Globe Window Dome` on all three pages, so the wide stars page keeps a saved dome (D-1109 retired).
 * The prefs reader leaves `chartView` undefined while nothing is saved, so this is the one place the default is decided.
 */
export function viewFor(page: SkyPage, mode: LayoutMode, saved: ChartView | undefined): ChartView {
  if (saved === undefined) return DEFAULT_CHART_VIEW[mode];
  // On wide the row is Globe, Window, Dome on every page; the polar chart is not offered.
  if (mode === 'wide') return saved === 'polar' ? 'globe' : saved;
  // On compact the rows are 2.13's: the window, the dome and the polar chart; the stars page's window and whole sky.
  if (saved === 'globe' || (page === 'stars' && saved === 'dome')) return 'polar';
  return saved;
}

/** R186 (FR-WIDE-2, FR-DESK-4): the wide row's order, which `v` cycles. */
export const WIDE_VIEWS: readonly ChartView[] = ['globe', 'window', 'dome'];

/**
 * R186 (FR-WIDE-2, FR-DESK-4): what `v` saves — on wide the next of the row's three after the view shown; on compact
 * 2.13's toggle between the dome and the polar chart.
 */
export function nextView(page: SkyPage, mode: LayoutMode, saved: ChartView | undefined): ChartView {
  const shown = viewFor(page, mode, saved);
  if (mode === 'compact') return shown === 'dome' ? 'polar' : 'dome';
  return WIDE_VIEWS[(WIDE_VIEWS.indexOf(shown) + 1) % WIDE_VIEWS.length] ?? 'globe';
}
