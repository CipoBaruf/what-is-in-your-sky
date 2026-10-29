/** US-5 AC2: the pass list order. `chronological` is the default; `best` ranks by brightness × elevation (`lib/passSort.ts`). Persisted in `wiys:prefs:v1`. */
export type PassSort = 'chronological' | 'best';
/**
 * US-6 AC3/AC5 (R13): which sky chart view is shown — the 2D polar chart, the
 * ASCII dome (R15) or the sky window (R47, FR-WIN-5). Persisted in
 * `wiys:prefs:v1`. R66 (D-352) narrowed the preference to the dome and the
 * polar chart, R121 (D-789) opened the window again on wide, and R136
 * (FR-FLOW-14, V26-11, D-876) removed the narrowing: the window is a saved view
 * on compact as on wide, and with nothing saved a phone opens on the window and
 * a desk on the dome (`ui/screens/chartViewDefault.ts`). `localPrefs.ts`
 * round-trips all three values and narrows nothing.
 */
export type ChartView = 'dome' | 'polar' | 'window';
/**
 * FR-LEG-7 / D-387 (R71): whether the compact live page's legend panel is
 * open. The legend is behind the `[ list (n) ]` control there, so this is the
 * one thing about it the app remembers between visits; the wide page has no
 * such state, since the legend is always in the rail (FR-LEG-6). Closed until
 * the control is used: the box's floor (FR-COMP-5) is measured with the list
 * closed, so that is what a first visit gets. Persisted in `wiys:prefs:v1`.
 */
export const DEFAULT_LIVE_LEGEND_OPEN = false;
/**
 * FR-FAINT-3 / D-623 (R98): whether the pass list shows the passes fainter
 * than `FAINT_MAG` (FR-FAINT-1). Off until the count line's `[ show n faint ]`
 * is used — the default list is the one a reader could find with their eyes
 * (US-34) — and off again for a stored value that is not a boolean, which is
 * no choice at all. Persisted in `wiys:prefs:v1`; read by R97's control.
 */
export const DEFAULT_SHOW_FAINT = false;
/**
 * FR-SKY-3 / D-791 (R123): whether the live page, the pass detail and their
 * screens draw the stars layer — the stars, the figures and the planets under
 * the arcs — behind the one `[ stars ]` toggle. On until the toggle is used,
 * and on again for a stored value that is not a boolean. Persisted in
 * `wiys:prefs:v1`.
 */
export const DEFAULT_STARS_LAYER = true;
/**
 * FR-FLOW-6 / D-848 (R132): whether the reader has made a first drag, pinch or
 * tap on any sky view. The hand hint under the drawing (`SkyHint`) shows until
 * then and is gone for good after; false until the first gesture, and false
 * again for a stored value that is not a boolean. Persisted in `wiys:prefs:v1`.
 */
export const DEFAULT_SKY_HINT_SEEN = false;
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
