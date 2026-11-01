import type { EpochMs, Observer, Theme } from '../../model';

/**
 * FR-THEME-1 / D-70 (R20): the palette is an attribute on the root element,
 * and `tokens.css` is what reads it — no component knows a theme exists
 * (D-84). This is the only place that writes it.
 *
 * "Applied before first paint" is met the way the language is: `main.tsx`
 * calls this with the store's theme *before* `createRoot().render()`, so the
 * first frame the browser composites already carries the attribute. An inline
 * bootstrap script is not an option under `script-src 'self'` (PLAN §11), and
 * would buy nothing — the app is client-rendered, so there is no
 * server-painted frame to correct.
 *
 * The dark theme is written out rather than left off: `[data-theme="dark"]`
 * is not a selector `tokens.css` needs, but a value on the element is what
 * lets `sky-theme.spec.ts` assert what is showing, and what stops a stale
 * `night` attribute from surviving a switch back.
 *
 * R156 (FR-PHONE-15, FR-THEME-1 as amended v2.10; D-972, D-979): the saved
 * preference has a third value, `auto`, which is not a palette: it resolves to
 * `night` while the Sun is below `THEME_AUTO_SUN_DEG` at the reader's saved
 * place and to `dark` otherwise (`resolveTheme`), before first paint and again
 * on the shell's ten-second tick (`useThemeTick.ts`), so an evening open turns red
 * at civil dusk without a reload. The instant is the real one, never the live
 * page's shown time: the theme is about the reader's eyes, not the scrubbed
 * sky. The place is the saved observer, not a visited one, for the same reason.
 */

/**
 * R156 (FR-PHONE-15): the Sun's altitude below which Auto turns the theme to night — the end of civil twilight,
 * where FR-STAR-13 draws every rung and the eye starts to adapt. Geometric, like every twilight threshold in the
 * app (D-2): at −6° refraction is a fraction of a degree and moves the switch by about a minute.
 */
export const THEME_AUTO_SUN_DEG = -6;

/** What `data-theme` can hold: the two palettes `tokens.css` defines. */
export type ResolvedTheme = Exclude<Theme, 'auto'>;

const DEG = Math.PI / 180;

/**
 * The Sun's geometric altitude at `lat`, `lon` and `t`, in degrees, from the low-precision solar coordinates of the
 * Astronomical Almanac (good to about 0.01° in declination for decades either side of J2000). D-979: not
 * `physics/sun.ts`, because `astronomy-engine` is the lazy `skyBodies` chunk's (22 KB, D-80), not `main`'s, and the
 * first paint cannot wait for a chunk; this is a few hundred bytes, and `theme.test.ts` holds it to 0.1° of
 * `astronomy-engine` across the year and the latitudes — under half a minute of clock at the threshold.
 */
export function sunAltitudeDeg(lat: number, lon: number, t: EpochMs): number {
  const d = t / 86_400_000 - 10_957.5; // days from J2000.0 (2000-01-01 12:00 UTC)
  const g = (357.529 + 0.98560028 * d) * DEG;
  const longitude = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const obliquity = (23.439 - 0.00000036 * d) * DEG;
  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const hourAngle = (280.46061837 + 360.98564736629 * d + lon) * DEG - ra;
  return Math.asin(Math.sin(lat * DEG) * Math.sin(dec) + Math.cos(lat * DEG) * Math.cos(dec) * Math.cos(hourAngle)) / DEG;
}

/** The palette a preference shows: itself, or for `auto` night below `THEME_AUTO_SUN_DEG` and dark otherwise — and dark with no Sun to read (no observer). */
export function resolveTheme(pref: Theme, sunAltDeg: number | null): ResolvedTheme {
  if (pref !== 'auto') return pref;
  return sunAltDeg !== null && sunAltDeg < THEME_AUTO_SUN_DEG ? 'night' : 'dark';
}

/** The palette for `pref` at the saved `observer` and the real instant `t`; the Sun is worked out only for `auto`. */
export function themeAt(pref: Theme, observer: Observer | null, t: EpochMs): ResolvedTheme {
  return resolveTheme(pref, pref === 'auto' && observer !== null ? sunAltitudeDeg(observer.lat, observer.lon, t) : null);
}

/** Writes `data-theme`, and only when it changes, so the tick costs no style recalculation while the palette stands. */
export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.dataset['theme'] !== theme) root.dataset['theme'] = theme;
}
