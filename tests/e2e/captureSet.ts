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
 *
 * R53 (SPEC §9 Phase 2b): v1.1 added three places a reader can be that the v1
 * set had no picture of — the settings page (FR-COMP-2), the sky window
 * (FR-WIN-1) and the legend in its FR-LEG-3 states — so the set gains a screen
 * each and keeps its name: the files are still `v1-*`, because the set is the
 * app's screens and not a phase's. The 1024 px profile R50 added for the home
 * and the guide (D-192) is the fourth thing SPEC §9 asks for and is already
 * here.
 *
 * R64 (SPEC §9 Phase 2d, FR-FSC-7): v1.3 replaces the live page's `following`
 * state with a screen of its own — a layer over the whole viewport (FR-FSC-1),
 * so what a reader is looking at is not the live page at all. It is captured
 * where it is used and nowhere else: at 844 × 390, a phone held sideways, in
 * the three states the drawing can be in, and at 390 × 844, upright, where it
 * is FR-FSC-4's note. That makes it the one screen in this set with no 1280 px
 * picture — the window is offered only where FR-WIN-4's presence test passes,
 * so there is no such screen to shoot — and `captures.test.ts` carries the
 * exception by name. The v1.2 `live-following` captures go with the state they
 * showed.
 *
 * R66 (SPEC v1.3.1, FR-FSC-7 as amended; V13-6, V13-9): the screen is the
 * **sky screen** and the view control is the way in, on the pass detail as well
 * as the live page — so `follow-screen-*` is renamed and `window`, which was
 * the pass detail's window laid out in the sheet at 390 and 1280, is that same
 * screen opened from a pass, at 844. Its `ground` and `buried` states leave the
 * set with it: they are the same two states as `sky-screen-ground` and
 * `sky-screen-buried`, which are shot from the live page, and a second picture
 * of each from a pass shows nothing the first does not.
 *
 * R60 (SPEC §9 Phase 2c): v1.2 added two states the window can be in (FR-FOL-5,
 * R56) and one the live page can be in (FR-FOL-1, R59), so `window-ground` and
 * `window-buried` join `window` and `live-following` joins `live` — a state
 * is a screen here when a reader can be looking at nothing else, the same
 * reasoning `window` and `legend` already carry. And R61's rail (F-59) widens
 * `live` itself: 1920, 2560 and 3840 join 1280 as the sizes a wide live page is
 * shot at, since the rail only appears from `LIVE_TWO_COLUMN_MIN_PX` up.
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
 *
 * R50 (FR-DESK-5 as amended, D-192): 1024 × 768 is the laptop between the wide
 * breakpoint and `WIDE_SPLIT_MIN_PX`, where an open guide has the right column
 * to itself and the list is one `[ list ]` control away (FR-DESK-3, F-6). The
 * home and the guide are the two screens that look different there, and 768 is
 * the height F-9 was about.
 */
export const VIEWPORTS = {
  390: { width: 390, height: 844 },
  844: { width: 844, height: 390 },
  1024: { width: 1024, height: 768 },
  1280: { width: 1280, height: 800 },
  1920: { width: 1920, height: 1080 },
  2560: { width: 2560, height: 1440 },
  3840: { width: 3840, height: 2160 },
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
  { name: 'home', widths: [390, 1024, 1280], what: 'Home with passes: the Now panel, the ISS hero, the Moon, the readiness line and the three nights. 1024 is the mid-width laptop.' },
  { name: 'settings', widths: [390, 1280], what: 'The settings page (FR-COMP-2): language, theme, location, saved places, the install offer, the clear action, in that order. Reached by the header link on compact and by the hash on wide, where nothing links to it.' },
  { name: 'guide', widths: [390, 1024, 1280], what: 'A pass open on the dome view, mid-pass, with the Sun and the Moon on the chart. At 1024 it has the right column to itself (F-6).' },
  { name: 'polar', widths: [390, 1280], what: 'The same pass on the polar view: the live marker and the flown arc as elements.' },
  {
    name: 'window',
    widths: [844],
    what: 'The sky screen opened from a pass detail (FR-FSC-1, FR-FSC-6, R66), aimed at that pass\'s peak by a stubbed orientation reading: the whole arc (FR-DOME-5) filling the viewport, the `×`, the facing readout and the legend. A phone held sideways, which since v1.3.1 is the only place the window is drawn.',
  },
  { name: 'legend', widths: [390, 1280], what: 'The legend in its states (FR-LEG-3): the live page with the hidden objects shown, so the rows carry `up`, `soon`, `gone` and the FR-LIVE-6 reasons, and one row activated so its arc is highlighted and the others dim (FR-LEG-4). Under the drawing at 390, beside it at 1280 (FR-LEG-2).' },
  { name: 'favourites', widths: [390, 1280], what: 'The saved places, with the one in use marked.' },
  { name: 'shortcuts', widths: [390, 1280], what: 'The keyboard shortcuts overlay over an inert page.' },
  { name: 'live', widths: [390, 844, 1280, 1920, 2560, 3840], what: 'The live sky page: the dome, the status strip, the time stripe and the controls. 844 is the landscape phone; 1920, 2560 and 3840 are R61\'s wide rail (F-59).' },
  {
    name: 'sky-screen-sky',
    widths: [844],
    what: 'The sky screen (FR-FSC-1, R64, R66) on a phone held sideways, aimed at a pass: the drawing filling the viewport, the `×` in the top-right corner, the facing readout in the top-left and the legend along the bottom — and nothing of the live page under it.',
  },
  { name: 'sky-screen-ground', widths: [844], what: 'The same screen swept 10° below the horizon (FR-FOL-5): the hatch fills the ground and the sky above it keeps drawing, under the same three overlays.' },
  { name: 'sky-screen-buried', widths: [844], what: 'The same screen swept 60° below the horizon (FR-FOL-5): no sky is left in the field, and the box is the hatched panel with its note — the `×` is still the way out.' },
  { name: 'sky-screen-portrait', widths: [390], what: 'The sky screen with the phone held upright (FR-FSC-4, US-21 AC12): the note asking for the phone to be turned, and the `×`, and nothing else — no drawing, no readout, no legend.' },
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
