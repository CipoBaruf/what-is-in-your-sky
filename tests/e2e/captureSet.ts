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
 * R71 (SPEC v1.4, FR-LEG-6, FR-LEG-9; V14-4, V14-5): the two live screens keep
 * their sizes and change what they show. `LIVE_TWO_COLUMN_MIN_PX` is withdrawn,
 * so `live` at 1280 is the rail layout rather than the centred column R61 shot
 * there — R71's own `r71-live-964x700`, `1024x768` and `1280x800` are the
 * pictures the requirement names for that change — and `legend` at 390 is the
 * `[ list (n) ]` panel, open, since on the compact live page the legend is not
 * on the page until the reader taps for it. Neither screen leaves the set.
 *
 * R73 (SPEC v1.4.1, FR-FSC-7 as amended; V14-9, V14-10): the portrait pair is
 * not a picture of a note any more — at 390 × 844 the screen draws, and the
 * shot is the picture with FR-FSC-11's line over it — and one shot is added
 * for the turn, `sky-screen-turned`, where a rotation-locked phone held
 * sideways has the layer turned under it (FR-FSC-10). That one is the first
 * screen in the set with fewer variants than the matrix: what it shows is a
 * geometry, and a geometry is the same picture in either theme and either
 * language, so it is shot at one of each.
 *
 * R72 (SPEC §9 Phase 2f): the release re-shoot, and the two widths v1.4 found
 * the set had never covered — both of them the live page's, both of them named
 * by a requirement of this phase. 1024 × 768 is the desktop width FR-SHP-5
 * calls out: the set has shot the home and the guide there since R50 and the
 * live page never, so the wide layout between the breakpoint and 1280 had no
 * picture of the page the phase spent most of its work on. 1200 × 450 is the
 * shape F-65 was: a wide window dragged short, where until R69 the page took a
 * landscape phone's grid tracks and kept the desktop's areas and the drawing
 * collapsed to zero height. That finding was invisible to the suite for four
 * phases because every test of the landscape layout ran at a compact width, and
 * a set with no short-and-wide picture in it is the same blind spot in the
 * other record. It is the one viewport here that is not a device: heights
 * elsewhere are the shape the width comes in, and 450 is the height the
 * finding was measured at (FR-SHP-4's matrix).
 *
 * What is *not* topped up, and why: FR-LEG-9's 390 × 667 short phone. The set's
 * files are named by width, so a second height at 390 would either collide with
 * the phone already there or be labelled with a number that is not its width —
 * and F-62's 667 half is open for the owner (§4.20), so the picture would be of
 * a layout the spec has not settled. R71's `r71-*` captures hold that evidence
 * until it is.
 *
 * R80 (SPEC §9 Phase 2g; FR-WATCH-9 f, FR-GUT-8, FR-FIRST-7, FR-SET-4): v2.0
 * splits one screen and renames nothing else. The live page is two states now
 * (FR-WATCH-1), told apart by whether the shown instant is real time, and each
 * renders its own inventory — watching has no stripe, no step row and no
 * playback row at all, and on a short wide window scrubbing is a bar over the
 * bottom of the box. Two states a reader can be in with nothing else on the
 * screen is two screens by the rule this file already uses for `window` and
 * `legend`, so `live` becomes `live-watching` and `live-scrubbing` at the eight
 * widths `live` had (1200 × 450 among them since R72, which is where the two
 * states differ most and where FR-WATCH-7 says the box must not move).
 *
 * The rest of the phase changed screens without changing the set: the cold open
 * and the populated home are board 1B's three readings (`location` and `home`,
 * FR-FIRST-7), the settings page is inverted (`settings`, FR-SET-4) and every
 * `sky-screen-*` shot has the 28 px compass gutter where the legend strip was
 * (FR-GUT-8). Those four requirements each say "re-shot on `main` by the
 * release task" and name no new screen, so the re-shoot is the whole of it —
 * the `what` lines below are what moved, and the files keep their names.
 *
 * R60 (SPEC §9 Phase 2c): v1.2 added two states the window can be in (FR-FOL-5,
 * R56) and one the live page can be in (FR-FOL-1, R59), so `window-ground` and
 * `window-buried` join `window` and `live-following` joins `live` — a state
 * is a screen here when a reader can be looking at nothing else, the same
 * reasoning `window` and `legend` already carry. And R61's rail (F-59) widens
 * `live` itself: 1920, 2560 and 3840 join 1280 as the sizes a wide live page is
 * shot at, since the rail only appears from `LIVE_TWO_COLUMN_MIN_PX` up.
 *
 * R94 (SPEC §4.39, FR-CAP-1..5, FR-TAB-3; F-80, D-547, D-626): what a capture
 * shows, and three more widths. A capture is the screen in the state a reader
 * opens it in; where one has to differ to stay reviewable — the home's
 * full-page file closes every night, or the phone picture is 20 000 px tall —
 * its `what` says so and the screen carries `view: true`, which adds a twin of
 * the true state cropped to the viewport, named `-view` after the width
 * (`v1-home-1280-view-dark-es.png`). The home is the one such screen: its
 * `-view` twin has tonight open and, from 1024 up, the Where pane's dome drawn,
 * which F-80 found the full-page files never showed. The twin follows the home
 * at every width it has, because the rule is about the screen and not about a
 * width — D-626 counted it at three widths; at six it is 24 files.
 *
 * The widths: 360 × 800 for every compact screen that has a 390 px picture
 * (FR-CAP-2, the width `narrow.spec.ts` asserts and nothing pictured), 768 ×
 * 1024 for the home, the guide, the live page's two states and the settings
 * page (FR-TAB-3's compact portrait, wider than `COMPACT_MAX_CELLS` and capped
 * by R99), and the home at 1920 × 1080 (FR-CAP-3, FR-HOME-4's evidence). "The
 * live page" at 768 is both of its states, since R80 made them two screens and
 * the pair is how the state split is read. The set is 254 files.
 *
 * R118 (SPEC §9 Phase 2l; PLAN D-758, D-786): v2.4 adds two places a reader can
 * be — the `#stars` page (FR-STAR-3) and the sky screen in its stars inventory
 * (FR-STAR-5) — and changes no other screen, so the set gains two screens and
 * nothing else moves. `stars` is the page at 390, 1280 and 1920, as D-758 names
 * it, and at 360 beside the 390, which FR-CAP-2 asks of every compact screen;
 * `stars-screen` is the layer at 844 × 390, the one size a sky screen is shot
 * at sideways, and `captures.test.ts` carries it in the sky screen's exception
 * by name. Both are on the set's clock and the set's place (FR-SHOW-9). The set
 * is 274 files.
 *
 * R128 (SPEC §9 Phase 2m, FR-SKY-9; PLAN D-799, D-829): v2.5 draws one sky in
 * every view and adds the files FR-SKY-9 names. `live-window` and `guide-window`
 * are the live page and the pass detail with the view control on `Window`, at
 * 1280 and 1920 (the box beside the rail, the box in the sheet) and at 390 with
 * 360 beside it (FR-CAP-2), where the headless reader is the compact one without
 * a sensor and the window is drawn in the box by hand (FR-SKY-2).
 * `live-window-follow` is the live page's window after `f` and `stars-zoom` the
 * stars page at `WINDOW_FOV_MIN_DEG`, each at the one width FR-SKY-9 names, 1280;
 * `captures.test.ts` carries the pair as the desk's exception by name.
 * `stars-passes` is the stars page with `[ passes ]` on, and
 * `stars-passes-screen` the screen it opens at 844; the live page's own screen
 * with the stars and a pass together is `sky-screen-sky`, re-shot, so FR-SKY-9's
 * "from both pages" is that file and the new one. Every chart file of the set
 * moved with the stars under the arcs, which is FR-SKY-9's first named move.
 * The set is 330 files.
 *
 * R135 (SPEC §9 Phase 2n, FR-FLOW-12; PLAN D-853, D-873): v2.6 changes where
 * things stand on every page and adds the files FR-FLOW-12 names. The home's
 * doors in four states at 360, 390, 1280 and 1920: `a later pass` is the home's
 * own `-view` twin at `CLOCK`, which already has those widths, and the other
 * three are `home-up-now`, `home-no-pass` and `home-daylight`, cropped to the
 * viewport as the twin is. The folded Where is the top of the home's compact
 * files and the opened one `where-opened`, a phone's screen
 * (`captures.test.ts` carries it by name). The live page, the stars page and
 * the pass detail at 844 × 390 are `live-watching` (already there), `stars`
 * and `guide` with the width added. The phone's live files show the window
 * because a phone opens on it (FR-FLOW-14), so that is a route change and not
 * a screen — and it makes `live-window` at 360 and 390 the same picture as
 * `live-watching` there, so those eight files are retired and `live-window` is
 * a desk's screen at 1280 and 1920. The set is 386 files.
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
 *
 * R72 (FR-SHP-4, FR-SHP-5, F-65): 1200 × 450 is a wide window dragged short —
 * the mode is the desktop's and the shape is a landscape phone's, which is the
 * pair of facts F-65 was about. The only entry here whose height is not the one
 * the width usually comes with, and deliberately so.
 *
 * R94 (FR-CAP-2, FR-TAB-3): 360 × 800 is the narrow phone `narrow.spec.ts`
 * asserts and the owner measured the narrow-phone overflow on; 768 × 1024 is the tablet held
 * upright, compact portrait wider than the column's cap (R99, D-625).
 */
export const VIEWPORTS = {
  360: { width: 360, height: 800 },
  390: { width: 390, height: 844 },
  768: { width: 768, height: 1024 },
  844: { width: 844, height: 390 },
  1024: { width: 1024, height: 768 },
  1200: { width: 1200, height: 450 },
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
  /**
   * R73 (SPEC v1.4.1, FR-FSC-7 as amended; V14-10): fewer than all of them,
   * for a screen whose subject is a geometry and not a piece of copy or a
   * colour. `sky-screen-turned` is the one: what it shows is the layer turned
   * a quarter under a rotation lock (FR-FSC-10), which is the same picture in
   * either theme and either language, so it is shot once. Absent means the
   * whole matrix, which is what every other screen is.
   */
  readonly themes?: readonly CaptureTheme[];
  readonly locales?: readonly CaptureLocale[];
  /**
   * R94 (FR-CAP-1, D-547): the screen's capture differs from the state a reader
   * opens it in, `what` says how, and the set carries a second file of the true
   * state cropped to the viewport, named `-view` after the width. One flag for
   * the whole screen: every width and every variant gets its twin.
   */
  readonly view?: true;
}

/**
 * Every screen the app has. "Screen" is a place a reader can be, not a state a
 * screen can be in: the install hint, the update banner, the offline message
 * and the not-ready readiness line are transient states of the home screen, and
 * their captures are R27's and R28's.
 */
export const SCREENS: readonly CaptureScreen[] = [
  {
    name: 'location',
    widths: [360, 390, 1280],
    what: 'The cold open (FR-FIRST-1, FR-FIRST-2 as amended v2.0.2): home before a place is known, carrying no hero mark and no tagline. At 390 it is the where step of the phone\'s first visit — the step line, the place field, the coordinates and the device button; at 1280 it is the three panes with Where active and When and What dimmed, so the layout is on the screen before a place is.',
  },
  {
    name: 'home',
    widths: [360, 390, 768, 1024, 1280, 1920],
    view: true,
    what: "Home with passes, as board 1B draws it (FR-FIRST-8..11) and v2.6 orders it (FR-FLOW-1, FR-FLOW-2): the Where reading — on compact folded to the place, `[ change ]` and one status line ending in `[ details ]` — then the three doors at the instant's first state, a later pass (the Satellites door's next pass and its countdown, the Stars door's dark window and cloud word and the brightest star or planet up, the Both door's next rise), then tonight's stripe with a tick per pass, the conditions table, the next-event block counting down on a clock and the one-line cards with their cloud badges read off the recorded forecast. The `Next ISS` tag is absent: the showcase night has no ISS pass — its visible season over northern Patagonia starts on the 11th, past the elements' five days (FR-SHOW-9) — and the tag is on the per-task captures that showed it. 360 and 390 are the phone, 768 the tablet's capped column (FR-TAB-1), 1024 the mid-width laptop with two columns, 1280 the three panes and 1920 × 1080 the desk (FR-CAP-3). The full-page file is not the home as it opens (FR-CAP-1): every night is closed, so the whole document fits one reviewable picture — D-179 closed them because Paris in September had fifty visible passes a night and the open default made the phone capture 20 000 px tall; Bariloche's night has five, and the route is kept so the set's shape does not change (D-684). The `-view` twin is the true state cropped to the viewport, tonight open; at 360, 390, 1280 and 1920 it is FR-FLOW-12's `a later pass` file of the doors, beside `home-up-now`, `home-no-pass` and `home-daylight`. The Where pane's dome R94 shot from 1024 up is gone with `WhereDome` (FR-FLOW-2).",
  },
  { name: 'settings', widths: [360, 390, 768, 1280], what: 'The settings page inverted (FR-SET-1..4): Location first, then Saved places, then This browser — language, theme, the install offer and the clear action — and at 390 × 844 it fits the viewport in Spanish without scrolling, which is what FR-SET-2 is about. Reached by the header link on compact and by the hash on wide, where nothing links to it. 768 is the tablet, where the column is capped and centred (FR-TAB-3).' },
  { name: 'guide', widths: [360, 390, 768, 844, 1024, 1280], what: 'The night\'s brightest pass (Tiangong at 07:20 local, peak −2.1) open on the dome view, three minutes in, with the Sun and the Moon on the chart. The Moon-glare state D-179\'s Paris pass carried is absent: no pass on the showcase night is flagged with glare (D-684). Since v2.6 the head is the name, the countdown, the landmark line and the three times (FR-FLOW-7), above the view row, the drawing and its hint (FR-FLOW-4, FR-FLOW-6). At 768 it is the sheet inside the tablet\'s capped column (FR-TAB-3); at 844 × 390 the phone turned, the drawing left at full height and the rail beside it (FR-FLOW-15, R135); at 1024 it has the right column to itself (F-6).' },
  { name: 'polar', widths: [360, 390, 1280], what: 'The same pass on the polar view: the live marker and the flown arc as elements.' },
  {
    name: 'window',
    widths: [844],
    what: 'The sky screen opened from a pass detail (FR-FSC-1, FR-FSC-6, R66), aimed at that pass\'s peak by a stubbed orientation reading: the whole arc (FR-DOME-5) filling the viewport, the `×`, the facing readout and, since R79, the compass gutter where the legend strip was (FR-GUT-1). A phone held sideways, which since v1.3.1 is the only place the window is drawn.',
  },
  { name: 'legend', widths: [360, 390, 1280], what: 'The legend (FR-LEG-3): the live page with the hidden objects shown and one row activated so its arc is highlighted and the others dim (FR-LEG-4). Behind `[ list (n) ]` and open at 390, in the rail beside the box at 1280 (FR-LEG-6, FR-LEG-7). Shot watching: since R77 the hidden-objects toggle is the scrubbing row\'s on compact (D-478), so the screen seeds the preference on rather than clicking a control the state it photographs does not have. On the showcase night the one drawn row is `up` beside the Sun and the Moon: the night\'s passes do not overlap, so no instant holds `soon` or `gone` beside it, and nothing hidden is above the horizon in the morning twilight, so the FR-LIVE-6 rows are absent too (FR-SHOW-9); the per-task captures that showed them keep pointing at them.' },
  { name: 'favourites', widths: [360, 390, 1280], what: 'The saved places, with the one in use marked.' },
  { name: 'shortcuts', widths: [360, 390, 1280], what: 'The keyboard shortcuts overlay over an inert page.' },
  {
    name: 'live-watching',
    widths: [360, 390, 768, 844, 1024, 1200, 1280, 1920, 2560, 3840],
    what: "The live sky page in the state it opens in (FR-WATCH-1 a, FR-WATCH-4): the mark's bead running beside `live`, the headline, the conditions line, the drawing and the actions — and no stripe, no step row and no playback row anywhere in the document. Since v2.6 a phone with nothing saved opens on the window (FR-FLOW-14, D-876), following the pass that is up (`openingFacing`), so the compact files — 360, 390, 768 and 844 — show the window and the wide ones the dome; at 844 × 390 it is the turned arrangement, the drawing left at full height and the rail beside it (FR-FLOW-15). 360 is the narrow phone (FR-CAP-2) and 768 the tablet upright (FR-TAB-3); 844 is the landscape phone; 1024 is the desktop width the set had never shot the page at until R72 and 1200 × 450 the window dragged short (FR-SHP-5, F-65); 1280 and up are the rail beside the box, which since R71 is every wide width (FR-LEG-6) and not only R61's 1920, 2560 and 3840.",
  },
  {
    name: 'live-scrubbing',
    widths: [360, 390, 768, 844, 1024, 1200, 1280, 1920, 2560, 3840],
    what: "The same page one `[ scrub ]` on (FR-WATCH-1 b, FR-WATCH-4): the bead held and warm beside `held`, the time row, the stripe's chunk with its 24 h overview, the stepping row and the playback row, and `[ back to live ]` at the head of the block. The pair with `live-watching` is what a reviewer reads the state split off: at 1200 × 450 the block is a bar inside the box (FR-WATCH-6) and the box's height is the same in both pictures (FR-WATCH-7), and at 844 × 390 it is in the rail with the dome column unmoved.",
  },
  {
    name: 'sky-screen-sky',
    widths: [844],
    what: 'The sky screen (FR-FSC-1, R64, R66) on a phone held sideways, aimed at a pass: the drawing filling the viewport, the `×` in the top-right corner, the facing readout in the top-left and, since R79, the 28 px compass gutter along the bottom (FR-GUT-1..5) — the band of azimuth, the bracket of the field, a tick per pass — and nothing of the live page under it.',
  },
  {
    name: 'sky-screen-chip',
    widths: [844],
    what: 'The same screen turned away from every pass (FR-GUT-6, R79): the field is empty, so one chip over the gutter names the next pass, how far to turn and when it rises, and the gutter shows the pass as a marker at the end to turn to.',
  },
  { name: 'sky-screen-ground', widths: [844], what: 'The same screen swept 10° below the horizon (FR-FOL-5): the hatch fills the ground and the sky above it keeps drawing, under the same three overlays.' },
  { name: 'sky-screen-buried', widths: [844], what: 'The same screen swept 60° below the horizon (FR-FOL-5): no sky is left in the field, and the box is the hatched panel with its note — the `×` is still the way out.' },
  {
    name: 'sky-screen-portrait',
    widths: [360, 390],
    what: 'The sky screen with the phone held upright (FR-GUT-7, R79): five rows — the readout and the `×`, the next-event block with the advice to turn as secondary copy under its peak line, the band of sky at most as tall as it is wide, two legend rows and the compass gutter with its narrow bracket. It was a note with nothing behind it until v1.4.1, and the picture with a line of advice over it until v2.0.',
  },
  {
    name: 'sky-screen-turned',
    widths: [360, 390],
    themes: ['dark'],
    locales: ['en'],
    what: 'The same portrait phone viewport (360 or 390 px wide) with the pose of a phone held sideways under a rotation lock (FR-FSC-10, US-21 AC15, R73): the layer has turned a quarter, so the picture is landscape inside a portrait viewport and the readout, the gutter and the `×` are the right way up to the reader\'s eye. One theme and one language: the turn is a geometry, not a piece of copy.',
  },
  {
    name: 'stars',
    widths: [360, 390, 844, 1280, 1920],
    what: "The `#stars` page as it opens (FR-STAR-3, FR-STAR-6, R115–R117), over Bariloche at 05:00 local on the 6th, facing the pole side — south, 35° up — with every layer on: the stars on the ladder's three sizes, the figures as hairlines with their spaced names (Crux, Centaurus, Carina), the bright stars named (Canopus, Acrux, Hadar) and the horizon at the box's foot. No planet is in that field at that instant, so the planet layer is on and draws nothing there. At 360 and 390 (a touch phone, FR-WIN-4) it is the readout, the box full-bleed and square, the facing row and the layers, with `[ hold up to the sky ]` where the sensor is; `In this field` is under the fold, which the viewport shot leaves out. Since v2.6 the action comes first, then the layers, then the list (FR-FLOW-8). At 844 × 390 it is the same touch phone turned: the box left at full height and the rail beside it, scrolling inside itself (FR-FLOW-15, R135). At 1280 and 1920 it is the box at the left and the rail beside it — the facing picker, the layers and `In this field` with its rows.",
  },
  {
    name: 'stars-screen',
    widths: [844],
    what: 'The sky screen in the stars inventory (FR-STAR-5, FR-FSC-1 as amended v2.4, R117), opened from the page by `[ hold up to the sky ]` on a phone held sideways and aimed by a stubbed reading south, 35° up: the star field filling the viewport, the `×`, the readout with its true-north line (D-757) and the compass gutter with its bracket — and no pass, no arc, no chip and no legend.',
  },
  {
    name: 'live-window',
    widths: [1280, 1920],
    what: "The live page watching at the set's instant with the view control on `Window` (FR-SKY-2, R121): the window laid out in the box under the hand camera, the stars, the figures and the planets under the arcs (FR-SKY-3), the readout in the box's corner on wide and in its row on compact. The box takes the browser window's shape and the rail stands beside it with the facing picker, the highlighted pass's key after `up` (FR-SKY-13). A desk's screen since v2.6: a phone with nothing saved opens the live page on the window (FR-FLOW-14), so `live-watching` at 360 and 390 is the compact window in the box (FR-SKY-9's 390 px file), and a `live-window` file there was the same picture under a second name (R135).",
  },
  {
    name: 'live-window-follow',
    widths: [1280],
    what: "The same page at 1280 with `f` pressed (FR-SKY-13, FR-DESK-4 as amended v2.5, R127): the window turned to the highlighted pass and following it, the key pressed in the picker and the readout reading `Following` with the key's capital; the landmark's ring in the field where the pass's peak is near one (FR-SKY-11). A desk's screen: `f` is a key, and a phone has no rail to press the key in, so it is the one window file with no compact width.",
  },
  {
    name: 'guide-window',
    widths: [360, 390, 1280, 1920],
    what: "The night's brightest pass (the `guide` screen's) open on the window (FR-SKY-2, FR-SKY-7, R121): the hand camera facing the peak's azimuth at the tilt that keeps the peak in the field, the arc under the stars clipped at the box's edge, the picker with `peak` first and pressed, and the landmark line under the pass's name (FR-SKY-11). Wide is the window-shaped box in the sheet; at 360 and 390 it is the compact reader without a sensor, the square box by hand.",
  },
  {
    name: 'stars-passes',
    widths: [360, 390, 1280],
    what: "The `#stars` page at the set's instant with `[ passes ]` on (FR-SKY-6, R126), faced to the first of the eight points whose field holds the night's brightest pass (north, over Orion): the pass's mark with its key `A` among the stars, and `In this field` listing the pass ahead of the stars (D-825). At 360 and 390 a touch phone, as `stars` is, with `[ hold up to the sky ]` on the page and the list under the fold; at 1280 the rail beside the box.",
  },
  {
    name: 'stars-zoom',
    widths: [1280],
    what: 'The `#stars` page as `stars` opens it at 1280, zoomed by `+` to `WINDOW_FOV_MIN_DEG`, 20° (FR-SKY-14, R125): the same stars spread about the centre at their sizes, the readout naming the field and the facing unchanged. FR-SKY-9 names this one width for it.',
  },
  {
    name: 'stars-passes-screen',
    widths: [844],
    what: "The sky screen opened from the stars page with `[ passes ]` on (FR-SKY-6, FR-FSC-1 as amended v2.5, R126), on a phone held sideways and aimed where the page faced: the stars and the night's brightest pass together, its arc and key in the field, the gutter's tick in the bracket. The live page's own screen with the stars on is `sky-screen-sky`.",
  },
  {
    name: 'home-up-now',
    widths: [360, 390, 1280, 1920],
    what: "The home as it opens three minutes into the night's brightest pass (FR-FLOW-1, R130): the Satellites door reads `Up now` with what the pass does next and when, the Both door counts what is up and names the landmark star by the pass where it fits, and the Stars door keeps its dark window and brightest star. Cropped to the viewport, as the home's `-view` twin is.",
  },
  {
    name: 'home-no-pass',
    widths: [360, 390, 1280, 1920],
    what: "The home at the set's instant over a catalogue with nothing that rises visibly over Bariloche in 72 h — the fixtures' elements cut to the orbits under 32° of inclination, the state a reader where the catalogue never reaches is in (FR-FLOW-1): the Satellites door reads `No visible pass in 72 h` and opens the What reading in place, and the Both door says nothing is up. The forecast, the zone and the elements' age are the night's.",
  },
  {
    name: 'home-daylight',
    widths: [360, 390, 1280, 1920],
    what: "The home at 13:00 local on the 6th, the Sun up (FR-FLOW-1): the Stars door names when the stars come out instead of a star, and the Satellites and Both doors the evening's first pass.",
  },
  {
    name: 'where-opened',
    widths: [360, 390],
    what: "The compact Where opened by its `[ details ]` (FR-FLOW-2, D-844, R130): the place and `[ change ]`, the status line with its button pressed, and the panel in FR-FIRST-11's order under it. The folded Where is the top of the home's own 360 and 390 files. A phone's screen: on wide the Where reading is never folded, so there is nothing to open.",
  },
];

export const CAPTURE_DIR = 'docs/screenshots';
/**
 * `v1-<screen>-<width>-<theme>-<locale>.png`, the visual-review naming with the task prefix spent on the phase.
 * R94 (FR-CAP-1): the `-view` twin carries its suffix after the width, `v1-<screen>-<width>-view-<theme>-<locale>.png`.
 */
const captureName = (screen: string, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, view = false): string => `v1-${screen}-${String(width)}${view ? '-view' : ''}-${theme}-${locale}.png`;

/** What a file of the set is called: the screen, the width, an optional `-view`, the theme and the language. `captures.test.ts` holds every file to it. */
export const CAPTURE_FILE = /^v1-[a-z][a-z-]*-\d+(-view)?-(dark|night)-(en|es)\.png$/;

export interface Capture {
  readonly screen: CaptureScreen;
  readonly width: CaptureWidth;
  readonly theme: CaptureTheme;
  readonly locale: CaptureLocale;
  /** R94 (FR-CAP-1): the `-view` twin — the true state, cropped to the viewport. */
  readonly view: boolean;
  readonly file: string;
}

/**
 * R108 (FR-DS-6; D-706, D-728): the `design` group — the dev page
 * `dev/primitives.html`, every primitive in every state and tone, shot by
 * `tests/e2e/design-captures.spec.ts` under `playwright.design.config.ts`
 * (`npm run design:captures`) at the phone's and the wide width, one file per
 * theme, into a directory of its own so the `v1-` set and its filename rule are
 * untouched. English only: the primitives carry no copy (D-703), so a Spanish
 * twin would be the same picture. `captures.test.ts` holds the directory to
 * these four and `docs/DESIGN.md` links them, so a redesign's change to a
 * token or a primitive is a visible diff before any screen is touched (FR-DS-9).
 */
export const DESIGN_PAGE = '/dev/primitives.html';
export const DESIGN_CAPTURE_DIR = 'docs/screenshots/design';
const DESIGN_WIDTHS = [390, 1280] as const;
type DesignWidth = (typeof DESIGN_WIDTHS)[number];
/** `design-primitives-<width>-<theme>.png`: no screen (there is one page) and no language. */
export const DESIGN_FILE = /^design-primitives-\d+-(dark|night)\.png$/;

export interface DesignCapture {
  readonly width: DesignWidth;
  readonly theme: CaptureTheme;
  readonly file: string;
}

/** The four design captures, width-major: 390 dark, 390 night, 1280 dark, 1280 night. */
export function designCaptureSet(): DesignCapture[] {
  return DESIGN_WIDTHS.flatMap((width) => THEMES.map((theme) => ({ width, theme, file: `design-primitives-${String(width)}-${theme}.png` })));
}

/** The whole matrix, in a stable order: a screen's captures, then its `-view` twins in the same order. */
export function captureSet(): Capture[] {
  return SCREENS.flatMap((screen) =>
    (screen.view ? [false, true] : [false]).flatMap((view) =>
      screen.widths.flatMap((width) =>
        (screen.themes ?? THEMES).flatMap((theme) => (screen.locales ?? LOCALES).map((locale) => ({ screen, width, theme, locale, view, file: captureName(screen.name, width, theme, locale, view) }))),
      ),
    ),
  );
}
