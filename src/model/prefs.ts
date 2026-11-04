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
 * round-trips every value and narrows nothing. R182 (FR-WIDE-2, D-1095) adds
 * `globe`, the desk's whole sky; `viewFor` maps a saved value a page or width
 * does not offer to the one that stands for it.
 */
export type ChartView = 'dome' | 'polar' | 'window' | 'globe';
/** Every `ChartView`, for the stored prefs' schema (`localPrefs.ts`), which may not import a type's members. */
export const CHART_VIEWS = ['dome', 'polar', 'window', 'globe'] as const satisfies readonly ChartView[];

/*
 * R182 (FR-KEEP-3, D-1096): the first visit's defaults, one constant per row of the table, read where nothing is
 * saved. The ranges and the speeds restate the chart's and `lib/playback.ts`'s values here because `src/data` may
 * import neither (PLAN §3); `prefs.test.ts` holds them equal.
 */
/** FR-KEEP-3 `view`: the window on a phone, the globe on a desk (FR-WIDE-2). */
export const DEFAULT_CHART_VIEW = { compact: 'window', wide: 'globe' } as const satisfies Record<'compact' | 'wide', ChartView>;
/** FR-KEEP-1 `starLayers`: the stars page's three switches. */
export interface StarLayers {
  stars: boolean;
  figures: boolean;
  planets: boolean;
}
/** FR-KEEP-3 `stars, figures, planets`: all on, at both widths. */
export const DEFAULT_STAR_LAYERS: Readonly<StarLayers> = { stars: true, figures: true, planets: true };
/** FR-KEEP-3 `names` (R160, D-990): until `[x] names` is tapped, on in the window, off in the polar chart on a phone, on on a desk. */
export const DEFAULT_NAMES = { compact: { window: true, polar: false }, wide: true } as const;
/** FR-KEEP-3 `faint stars`: off on the globe and the window. */
export const DEFAULT_FAINT_STARS = false;
/** FR-GLOBE-5: the globe turns with the reader (`with you`) or with the stars. */
export type GlobeTurn = 'you' | 'stars';
/** FR-KEEP-3 `globe's turn`: with you. */
export const DEFAULT_GLOBE_TURN: GlobeTurn = 'you';
/** FR-KEEP-3 `zoom`: the globe at 1×. */
export const DEFAULT_GLOBE_ZOOM = 1;
/** FR-GLOBE-6's bounds (`GLOBE_ZOOM_MIN`, `GLOBE_ZOOM_MAX`); a stored zoom is clamped to them on read. */
export const GLOBE_ZOOM_RANGE = [0.5, 4] as const;
/** FR-KEEP-3 `zoom`: the window at `WINDOW_FOV`, degrees. */
export const DEFAULT_WINDOW_FOV_DEG = 60;
/** FR-SKY-14's range (`WINDOW_FOV_MIN_DEG`, `WINDOW_FOV_MAX_DEG`); a stored field is clamped to it on read. */
export const WINDOW_FOV_RANGE_DEG = [20, 90] as const;
/** `lib/playback.ts`'s `SPEEDS`: the rates the playback row offers. */
export const PLAY_SPEEDS = [1, 60, 600, 3600] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];
/** FR-KEEP-3 `speed` (FR-KEEP-2): every page opens at real time, watching, whatever rate is saved. */
export const OPENING_SPEED: PlaySpeed = 1;
/** D-1110: the rate `play` starts at with nothing saved — 2.13's `DEFAULT_SPEED`; `playSpeed` replaces it once chosen. */
export const DEFAULT_PLAY_SPEED: PlaySpeed = 60;
/** FR-KEEP-4: the privacy note shows until either `[ × ]` closes it. */
export const DEFAULT_PRIVACY_NOTE_CLOSED = false;
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
 * v2.12 (FR-SET-5, D-1019): whether the sky views draw the Sun's glow on the horizon (FR-DOME-6) — the window, the
 * dome and the polar chart. Off until the settings page turns it on; persisted in `wiys:prefs:v1`.
 */
export const DEFAULT_SUN_GLOW = false;
/**
 * FR-FLOW-6 / D-848 (R132): whether the reader has made a first drag, pinch or
 * tap on any sky view. The hand hint under the drawing (`SkyHint`) shows until
 * then and is gone for good after; false until the first gesture, and false
 * again for a stored value that is not a boolean. Persisted in `wiys:prefs:v1`.
 */
export const DEFAULT_SKY_HINT_SEEN = false;
/**
 * FR-PHONE-2 / D-962 (R159): whether the reader has once granted the motion request a browser asks for (iOS). The
 * live page, the stars page and the pass detail then open following-armed: the first touch on the sky asks inside
 * the gesture. Written `true` on a grant from the follow toggle or the control, cleared on a refusal; a refusal never
 * writes it. False until the first grant, and false again for a stored value that is not a boolean. Persisted in
 * `wiys:prefs:v1`.
 */
export const DEFAULT_FOLLOW_GRANTED = false;
/** FR-GUIDE-4 (R13): the polar chart's convention, `looking-up` (east on the left, the default) or `map` (east on the right). Persisted in `wiys:prefs:v1`. */
export type ChartOrientation = 'looking-up' | 'map';
/** FR-I18N-1 (R17): the language the app renders in, chosen from the browser on the first visit and overridden by the header switch. Persisted in `wiys:prefs:v1`. */
export type Locale = 'en' | 'es';
/**
 * FR-THEME-1 / US-19 (R20): the palette, the default dark one or the red-on-black night one. Persisted in
 * `wiys:prefs:v1` and applied as `data-theme` before the first render (D-70). R156 (FR-PHONE-15, D-972) added a
 * third value, `auto`, the theme by the Sun at the saved place; v2.12 (FR-PHONE-15 withdrawn, D-1020) took it out
 * again on the owner's call, and a stored `auto` reads as no choice, so dark (`localPrefs.ts`'s enum).
 */
export type Theme = 'dark' | 'night';
/**
 * The themes the settings page's Theme row offers, in its order (`[x] Dark [ ] Night`). A value, not a
 * type, because the switch has to enumerate them, the stored prefs are checked against them and the store has to
 * default to one, and those sit on opposite sides of PLAN §3's layering — `src/model` is the layer all may import.
 */
export const THEMES = ['dark', 'night'] as const satisfies readonly Theme[];
/** Dark until the switch is used: the night palette is a choice, never a guess from the device (FR-THEME-1). */
export const DEFAULT_THEME: Theme = 'dark';
