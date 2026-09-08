/** US-5 AC2: the pass list order. `chronological` is the default; `best` ranks by brightness × elevation (`lib/passSort.ts`). Persisted in `wiys:prefs:v1`. */
export type PassSort = 'chronological' | 'best';
/** US-6 AC3/AC5 (R13): which sky chart view is shown, the 2D polar chart (default for now, D-68), the ASCII dome (R15) or, on a phone, the sky window (R47, FR-WIN-5). Persisted in `wiys:prefs:v1`. */
export type ChartView = 'dome' | 'polar' | 'window';
/**
 * R66 (FR-WIN-5 as amended v1.3.1, V13-8, D-352): the views a *preference* can
 * hold. The window is a mode, not a view a page can be left in — it is entered
 * by the tap that chooses it and left by the sky screen's `×` — so nothing
 * writes it and a value stored by an older build reads as the dome.
 */
export type SavedChartView = Exclude<ChartView, 'window'>;
export const SAVED_CHART_VIEWS: readonly SavedChartView[] = ['dome', 'polar'];
/** A stored `chartView`, narrowed: anything that is not a saved view (a `window` from a build before v1.3.1) is the dome. */
export function savedChartView(view: ChartView | undefined, fallback: SavedChartView): SavedChartView {
  return view === undefined || view === 'window' ? fallback : view;
}
/** FR-GUIDE-4 (R13): the polar chart's convention, `looking-up` (east on the left, the default) or `map` (east on the right). Persisted in `wiys:prefs:v1`. */
export type ChartOrientation = 'looking-up' | 'map';
/** FR-I18N-1 (R17): the language the app renders in, chosen from the browser on the first visit and overridden by the header switch. Persisted in `wiys:prefs:v1`. */
export type Locale = 'en' | 'es';
/** FR-THEME-1 / US-19 (R20): the palette, the default dark one or the red-on-black night one. Persisted in `wiys:prefs:v1` and applied as `data-theme` before the first render (D-70). */
export type Theme = 'dark' | 'night';
/**
 * The themes `tokens.css` defines, in the order the header switch offers
 * them. A value, not a type, because the switch has to enumerate them and the
 * store has to default to one, and both sit on opposite sides of PLAN §3's
 * layering — `src/model` is the layer both may import.
 */
export const THEMES = ['dark', 'night'] as const;
/** Dark until the switch is used: the night palette is a choice, never a guess from the device (FR-THEME-1). */
export const DEFAULT_THEME: Theme = 'dark';
