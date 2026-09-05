/**
 * R36 (SPEC §9 Phase 2, D-179): what the v1 capture set contains — which
 * screens, at which widths, under which theme and which language.
 *
 * One list, read from both ends: `v1-captures.spec.ts` produces the files from
 * it, and `tests/docs/captures.test.ts` checks `docs/screenshots/` against it.
 * A screen added to the set therefore fails the suite until it is captured, and
 * a capture nobody named fails it too — which is the only way "no screen is
 * missing a language or a theme" can be a claim rather than a hope.
 *
 * The per-task captures (`r16-…` to `r35-…`) stay where they are: they are the
 * evidence each PR was reviewed against, shot at whatever width and variant
 * that task changed. This set is the other thing — the whole app, one naming
 * scheme, every combination, re-shot in one run off one build.
 */

export const THEMES = ['dark', 'night'] as const;
export const LOCALES = ['en', 'es'] as const;
export type CaptureTheme = (typeof THEMES)[number];
export type CaptureLocale = (typeof LOCALES)[number];

/**
 * The viewports, by the number the file name carries. 390 × 844 is the phone
 * (the MVP reference profile), 1280 × 800 the wide layout (FR-DESK-1, ≥ 100
 * cells), and 844 × 390 the same phone turned sideways — the live page only,
 * which is the one screen with a landscape layout of its own (FR-LIVE-7).
 */
export const VIEWPORTS = {
  390: { width: 390, height: 844 },
  844: { width: 844, height: 390 },
  1280: { width: 1280, height: 800 },
} as const;
export type CaptureWidth = keyof typeof VIEWPORTS;

export interface CaptureScreen {
  /** The `<screen>` part of the file name. */
  readonly name: string;
  readonly widths: readonly CaptureWidth[];
  /** What a reviewer should be looking at. Repeated in the PR body. */
  readonly what: string;
}

/**
 * Every screen the app has. "Screen" is a place a reader can be, not a state a
 * screen can be in: the install hint, the update banner, the offline message
 * and the not-ready readiness line are transient states of the home screen, and
 * their captures are R27's and R28's.
 */
export const SCREENS: readonly CaptureScreen[] = [
  { name: 'location', widths: [390, 1280], what: 'Home before a location is known: the place field, the coordinates, the device button, the footer.' },
  { name: 'home', widths: [390, 1280], what: 'Home with passes: the Now panel, the ISS hero, the Moon, the readiness line and the three nights.' },
  { name: 'guide', widths: [390, 1280], what: 'A pass open on the dome view, mid-pass, with the Sun and the Moon on the chart.' },
  { name: 'polar', widths: [390, 1280], what: 'The same pass on the polar view: the live marker and the flown arc as elements.' },
  { name: 'favourites', widths: [390, 1280], what: 'The saved places, with the one in use marked.' },
  { name: 'shortcuts', widths: [390, 1280], what: 'The keyboard shortcuts overlay over an inert page.' },
  { name: 'live', widths: [390, 844, 1280], what: 'The live sky page: the dome, the status strip, the time stripe and the controls. 844 is the landscape phone.' },
];

export const CAPTURE_DIR = 'docs/screenshots';
/** `v1-<screen>-<width>-<theme>-<locale>.png`, the visual-review naming with the task prefix spent on the phase. */
export const captureName = (screen: string, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale): string => `v1-${screen}-${String(width)}-${theme}-${locale}.png`;

export interface Capture {
  readonly screen: CaptureScreen;
  readonly width: CaptureWidth;
  readonly theme: CaptureTheme;
  readonly locale: CaptureLocale;
  readonly file: string;
}

/** The whole matrix, in a stable order. */
export function captureSet(): Capture[] {
  return SCREENS.flatMap((screen) =>
    screen.widths.flatMap((width) => THEMES.flatMap((theme) => LOCALES.map((locale) => ({ screen, width, theme, locale, file: captureName(screen.name, width, theme, locale) })))),
  );
}
