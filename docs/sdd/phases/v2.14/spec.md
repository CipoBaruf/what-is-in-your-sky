# v2.14 — SPEC.md sections

Written by `sdd-spec` as a phase folder (V213-2); ids resolve through `docs/sdd/ids.md`.

### 2.21 Goals (v2.14, "one sky on a desk")

- **G62. One sky on every desk page.**
  On a desk the satellites, the live sky and the stars are one layout with one whole-sky view, one time control and the same controls in the same places, so moving between them moves nothing but what each page adds.
- **G63. Know what you are looking at.**
  On a desk every satellite, star and planet the reader picks says what it is: a satellite's country, operator, purpose, age, size and height; a star's or a planet's names, brightness, place and rise and set; in Spanish, by its Spanish name.
- **G64. A desk that works like a desk.**
  The list and the drawing answer each other under the pointer, the stripe shows when the sky is clear, every common action has a key, and the sky can fill the screen.
- **G65. Your sky as you left it.**
  On a phone and on a desk the views, layers and settings the reader chose are there on the next open, while the time is always now; the privacy note is read once and closed for good.
- **G66. The repository says what the app is now.**
  The README, its images, the reading order and the repository's description and topics describe 2.14.0 as released, not an earlier one.

**US-52 — One sky layout on a desk** *(v2.14)*
As a reader at a desk, I move between the satellites, the live sky and the stars and find the same sky in the same box, the same rail and the same time control.
- AC1: At 1280 × 800 and 1920 × 1080 the live page, the stars page and the home page with a pass open each show the sky box on the left and the rail on the right, in the rail order `head → View → Time → page group → list`, with the app's header and footer as on the stars page (FR-WIDE-1).
- AC2: The `View` row reads `[ Globe ] Window Dome` / `[ Globo ] Ventana Domo` on all three; a new reader opens on the globe; choosing a view on one page opens the other two on it, after a reload too (FR-WIDE-2).
- AC3: On the live page and on the pass detail the globe draws the passes' arcs in their legend colours, with the shown instant's marker, as FR-TRAJ-1 says for the dome (FR-WIDE-3).
- AC4: The three pages share one time control: the overview row, the stripe while scrubbing and the playback row; the stars page adds `−1 d` `−1 h` `+1 h` `+1 d` under it (FR-WIDE-4).
- AC5: The zoom buttons, the facing readout and the hint stand in the same corner of the box on every page and view that has them (FR-WIDE-5).
- AC6: The dome is drawn only after `Dome` is chosen, and its chunk is not requested before (FR-WIDE-6).
- AC7: At 390 × 844 every page is as on 2.13's `main` except the star names of FR-NAME-1 and FR-NAME-2, the remembered choices of FR-KEEP-1..3 and the privacy note's `[ × ]` (FR-WIDE-12).

**US-53 — What is that satellite** *(v2.14)*
As a reader at a desk, I open a pass or click a satellite on the live page and read who flies it, what for, since when, how big it is and how high.
- AC1: Every one of the 31 catalogue objects has a country, an operator, a purpose, a launch date and a size, each with a source, checked by a test against the catalogue (FR-FACT-1).
- AC2: The pass detail's rail shows a `This satellite` / `Este satélite` group under the pass's times: country and operator, purpose, launch year and age, size and height range, and the description, in the reader's language (FR-FACT-2).
- AC3: On the live page a click, a tap or `Enter` on a legend row or an arc shows the same group in the page group; `Esc` or `[ × ]` closes it (FR-FACT-2).
- AC4: The height range comes from the object's current orbital elements, not from the file (FR-FACT-1).

**US-54 — What is that star, by its name** *(v2.14)*
As a reader at a desk, I click a star or a planet and read its names, its brightness, where it is and when it rises and sets; in Spanish the names are Spanish where Spanish has one, and the bright stars all have a label.
- AC1: A click or `Enter` on a star, a planet or the Moon on the globe or the window shows its facts in the page group (FR-FACT-3).
- AC2: Every named star has a row in `names-es.tsv` with a source, a Spanish form or an explicit "same in Spanish"; every constellation's Spanish name has a source (FR-NAME-1).
- AC3: Every unnamed star brighter than `BAYER_LABEL_MAG` is labelled by its Bayer or Flamsteed designation, `γ Vel`, in both languages and at every width (FR-NAME-2).
- AC4: On a desk each planet has its own colour, a larger label and a label that shows with the names off (FR-NAME-3).

**US-55 — When and where, at a glance** *(v2.14)*
As a reader at a desk, I point at a pass in the list and see its arc, see which way it moves and when, and see on the stripe when the clouds clear.
- AC1: Hovering or focusing a list or legend row emphasises its arc, and hovering an arc emphasises its row; leaving restores both (FR-WIDE-7).
- AC2: The highlighted pass's arc carries a tick every `ARC_TICK_MIN` minutes and an arrow in its direction of travel on the globe and the window (FR-WIDE-7).
- AC3: The overview row and the stripe shade each forecast hour by its cloud cover in `CLOUD_STEPS`, with a text alternative (FR-WIDE-8).

**US-56 — Keys and the full sky** *(v2.14)*
As a reader at a desk, I drive the sky from the keyboard and can give it the whole screen.
- AC1: `g`, `w` and `d` choose the view; `,` and `.` step the shown instant an hour; `t` returns to now; `Space` plays and pauses; `a` faces the highlighted pass; `?` lists every key (FR-WIDE-9).
- AC2: `f` or the box's `[ full screen ]` control gives the box the whole screen with the time readout and an exit control; `Esc` leaves it; the view, the camera and the instant do not change across it (FR-WIDE-10).

**US-57 — As I left it** *(v2.14)*
As a reader on a phone or at a desk, I find my views and layers as I left them when I come back, the sky at now, and the privacy note gone once I closed it.
- AC1: Each choice of FR-KEEP-1 survives a reload and a new tab, at 390 × 844 and at 1280 × 800 (FR-KEEP-1).
- AC2: A reload opens at now with the opening aim and the reader's own place, whatever was scrubbed, turned or picked (FR-KEEP-2).
- AC3: An empty store opens on FR-KEEP-3's table (FR-KEEP-3).
- AC4: After `[ × ]` on either privacy line, neither shows on any page after a reload; the settings page still states it (FR-KEEP-4).

### 4.57 One sky on a desk *(v2.14)*

The owner, 2026-11-04, at the desk: "We have different ways to view the stars, the live sky and the satellites on desktop."
On 2.13's `main` at 1280 × 800 the three wide pages draw three things three ways.
The pass detail draws a 200 px dome inside the pass card under the home's doors.
The live page draws a full-height dome beside a rail, with a squeezed header and no footer.
The stars page draws the globe beside a rail, with its own time buttons.
The views on offer differ (`Window Polar Dome` against `Window Globe`), the defaults differ (the saved view against the globe, unsaved), the time controls differ (the stripe against the day and hour steps), and the dome draws a monochrome braille mesh with the twenty brightest stars where the globe draws every star, figure and name in colour.
The owner chose one layout, the globe as every desk page's whole sky, the dome kept as a choice, the stripe as the one time control (V214-2..V214-5), and on top of it the facts, names and desk controls of G63 and G64 (V214-6..V214-13).
The phone is unchanged except for the corrected and added star names (V214-11), the remembered choices and the privacy note (V214-15..V214-17).
Later the same day the owner asked that the repository's README, description and topics be brought up to date (FR-PUB-14..16), and that every choice be kept on the device for the next open, phone included, and that the privacy note be read once (FR-KEEP-1..4).

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `ARC_TICK_MIN` | 1 min | A visible pass lasts 3 to 7 minutes, so one tick a minute gives 3 to 7 ticks: enough to read the pace, few enough not to crowd the arc. |
| `ARC_ARROW_SHARE` | 0.5 | The direction arrow stands at the drawn part's middle when the pass is not up, and at the marker while it is, so it never sits on the rise or set label. |
| `CLOUD_STEPS` | 20 / 50 / 80 % | Four bands of cloud cover — clear, some, mostly, overcast — the same cuts as the three-state indicator's (FR-WX-3) with "overcast" split off, so the stripe and the pass card never disagree. |
| `CLOUD_BAND_PX` | 4 px | The cloud band's height under the overview row and the stripe: readable, and short enough that the pass segments stay the row's subject. |
| `BAYER_LABEL_MAG` | 3.0 | The faintest unnamed star that gets its designation as a label: 33 stars on 2.13's catalogue, the ones bright enough to be asked about in a city sky. |
| `PLANET_MARK_PX` | 5 px | A planet's disc radius on the globe and the window at zoom 1: one step over the brightest star's mark (`STAR_SIZES_PX`), so a planet reads as a planet. |
| `FACT_HEIGHT_STEP_KM` | 10 km | The height range's rounding: orbits drift by kilometres a week, so a finer number would be false precision. |
| `SKY_MAIN_KB` | 1.0 KB | What `main` may grow over 2.13.0's measure: the view row's third value and the key table; every other string rides in a lazy chunk, because `main` has about 2 KB left under its 185 ceiling. |
| `FACTS_BUDGET_KB` | 6 KB gzipped | The `facts` chunk: 31 objects' facts and descriptions in two languages and the facts groups' code. |
| `SKY_GLOBE_KB` | 4 KB | What the `globe` chunk may grow: the arcs, the ticks, the arrow, the planet marks and the hover hit test. |

- **FR-WIDE-1** *(V214-2)* **One layout on a desk.**
  On wide (FR-DESK-1) the live page, the stars page and the home page with a pass selected are one layout, the stars page's `SkyViewLayout` as 2.13 has it: the sky box on the left, cut by `fitBox` from the room beside the rail and over the hint's row, and the rail on the right at the layout's width.
  The rail's groups are in this order on every page: the head (the page's title and its one context line), `View`, `Time`, the page group, and the list or legend, which takes what is left and scrolls.
  The page groups are: on the pass detail, the pass's times (FR-FLOW-7's row) and `This satellite` (FR-FACT-2); on the live page, `Facing` and the status line, and a picked object's facts (FR-FACT-2, FR-FACT-3); on the stars page, `Turn`, `Place`, `Layers` and the count, and a picked object's facts (FR-FACT-3).
  The lists are: the pass detail's, the pass list (the home's, the selected card highlighted); the live page's, the legend; the stars page's, `Up from <place>` or `In this field`.
  Every page has the app's full header and its footer under the layout, as the stars page has them on 2.13; the live page's one-row header and its hidden footer are gone on wide.
  *(amends FR-DESK-3)* A selected pass no longer opens the guide in a panel beside the list: it opens this layout in the home's place, its hash `#pass=<id>` as before (D-13); `Esc`, the `[ × ]` in the head and the header's `[ home ]` return to the home with the list scrolled to the card; `WIDE_SPLIT_MIN_CELLS` and the split are retired.
  The home without a selected pass is unchanged.
  *Verification:* `sky-layout.spec.ts` at 1024 × 640, 1280 × 800 and 1920 × 1080 — the box's left and top, the rail's left and width and the group order equal on the three pages to the pixel; a test that `Esc` on the pass detail returns to the home with the card in view.

- **FR-WIDE-2** *(V214-3)* **One set of views, one choice.**
  On wide the `View` row reads `[ Globe ] Window Dome` / `[ Globo ] Ventana Domo` on all three pages.
  The polar chart is not offered on wide; on compact the rows are as on 2.13 (FR-GLOBE-1, FR-FLOW-14).
  The choice is the saved preference `chartView` (FR-WIN-5), which gains the value `globe`; it is shared by the three pages and saved on the stars page too.
  With nothing saved a desk opens on the globe (`defaultChartView`, D-876, amended); a saved `polar` opens the globe on wide, and a saved `globe` opens the polar chart on compact, so one choice crosses the breakpoint as FR-GLOBE-1's does.
  `v` cycles the three values on wide (FR-DESK-4).
  *(amends FR-GLOBE-1)* The stars page's view is saved and the row has three values; *(amends FR-DOME-7)* the dome is no longer the desk's default.
  *Verification:* `chartViewDefault.test.ts` for every pair of width and saved value; `sky-layout.spec.ts` chooses `Window` on the live page and finds it on the stars page and the pass detail after a reload.

- **FR-WIDE-3** *(V214-3)* **The globe on every desk page, with the passes on it.**
  The live page and the pass detail draw the globe at the page's shown instant `t`, over the observer's place, turning with you (FR-GLOBE-5), opening on the view FR-GLOBE-1's opening rule gives; the `Turn` and `Place` groups are the stars page's alone.
  Each pass the page draws (FR-LIVE-2's set on the live page, the explained pass on the pass detail) is a polyline on the globe through its track's points, each point's azimuth and altitude turned into a direction at the shown place.
  It is drawn in its legend colour (FR-LEG-5) per FR-TRAJ-1's states at `t`, with its marker and its legend key (`A`, `B`, …) beside the marker; only the near side is drawn, as for the figures.
  The globe takes the layers the window takes on the page (FR-SKY-1's table gains a `globe` row equal to the window's, with `fieldOutline` off), so the stars toggle (FR-SKY-3) turns the stars off under the arcs here too.
  *Verification:* `globe/arcs.test.ts` — a fixed pass's polyline at three instants of FR-TRAJ-1's states; `globe.spec.ts` on the live page at the capture set's instant: three arcs, their colours the legend's.

- **FR-WIDE-4** *(V214-5)* **One time control.**
  The live page's time control — the overview row (FR-SPAN-2), the stripe while scrubbing (FR-WATCH-4, FR-LIVE-4) and the playback row (FR-LIVE-5) — is the `Time` group on all three desk pages, over the same span, FR-LIVE-4's `now` to `now + 24 h`.
  On the stars page it replaces FR-GLOBE-7's clock row and steps: the globe's instant is the stripe's `t`; `−1 d` `−1 h` `+1 h` `+1 d` stay as a row of small controls under the playback row; the time-lapse speeds are the playback row's.
  A day step past the span moves the span with it (the stripe then draws the 24 h from the stepped day's noon), up to `GLOBE_SPAN_DAYS` either way, and `[ now ]` brings it back.
  On the pass detail `t` opens at now and the pass's rise, peak and set cells (FR-FLOW-7) are buttons that set `t` to their instant.
  The clock reads in the place's zone on every page (FR-GLOBE-8).
  *Verification:* `sky-layout.spec.ts` — the three pages' `Time` groups have the same controls in the same order; `stars.spec.ts` — `+1 d` twice moves the globe two days and the stripe to that night; `guide.spec.ts` — the peak cell sets the readout to the peak time.

- **FR-WIDE-5** **The box's corners.**
  Every view keeps its extras in one corner on every page: the facing readout (FR-SKY-13, the globe's readout of FR-GLOBE-11) top-left, `[ full screen ]` (FR-WIDE-10) top-right, the hint (FR-STAR-7's) bottom-left, and `[ + ] [ − ]` bottom-right on the views that zoom (the globe, FR-GLOBE-6; the window, FR-SKY-14).
  The dome, which does not zoom, shows no zoom controls.
  *Verification:* `sky-layout.spec.ts` — each extra's corner on each view and page.

- **FR-WIDE-6** *(V214-4)* **The dome, by choice.**
  The dome is drawn as on 2.13 (FR-DOME-*, FR-SKY-5) when `Dome` is chosen, on any of the three pages.
  Its chunk and its font are requested only when the dome is first chosen, never on idle prefetch; the globe's chunk is prefetched on idle on wide in their place.
  glyphcss, `@glyphcss/react`, the braille font and their CSP allowances stay; the proposal's "obsolete after the renderer phase" list no longer names them.
  *Verification:* a test that a wide page with nothing saved requests no `SkyDome-*.js` and no `wiys-braille` font; `dome.spec.ts` green with `Dome` chosen.

- **FR-WIDE-7** **The list and the drawing answer each other.**
  On wide, a hover or keyboard focus on a pass's list card or legend row emphasises its arc as FR-LEG-4's highlight does (full colour and weight, the others dimmed) while the pointer or the focus stays, and a hover on an arc (within 8 px of its line) emphasises its row the same way; leaving both restores the highlight the page had; a hover changes no state, no hash and no saved value.
  The highlighted pass's arc carries a short tick across the line at every whole `ARC_TICK_MIN` of its track and an arrowhead along its direction of travel at `ARC_ARROW_SHARE` of its drawn part, or at the marker while it is up, on the globe and the window; the dome keeps FR-LEG-4's highlight alone.
  The ticks carry no labels: the rise, peak and set times are the rail's.
  *Verification:* `globe/arcs.test.ts` — the ticks' count and places for a fixed pass; `legend-hover.spec.ts` — hover a row, the arc's class; hover the arc, the row's class; leave, both restored.

- **FR-WIDE-8** **The clouds on the stripe.**
  On wide the overview row and the stripe carry a band `CLOUD_BAND_PX` high along their foot, one cell per forecast hour (FR-WX-1), shaded by `CLOUD_STEPS`' four bands in the `--chart-cloud-*` tokens; an hour with no forecast is left blank, never drawn as clear.
  The band's text alternative is one sentence in the stripe's description: "Clouds: clear until 23:00, mostly cloudy 23:00–02:00, then clear" / its Spanish, the runs of equal bands joined.
  *Verification:* `lib/cloudBand.test.ts` — bands and runs for a fixed forecast, the gap; `contrast.ts` gains the four tokens in every theme.

- **FR-WIDE-9** *(V214-13)* **The keys.**
  FR-DESK-4's rule holds (single keys, no modifier, active when no input has focus, listed in the `?` overlay), with these on the three desk pages:

  | Key | Does |
  |---|---|
  | `g` `w` `d` | choose Globe, Window, Dome (`v` still cycles) |
  | `,` `.` | move `t` back or forward one hour, clamped to the span |
  | `t` | `t` to now (the playback row's `[ now ]`) |
  | `Space` | play or pause; with a button focused it presses the button, as the browser does |
  | `a` | face the highlighted pass where the window is in the box (FR-SKY-13's key, moved from `f`) |
  | `f` | full screen (FR-WIDE-10) |

  The arrow keys, `+`, `-`, `0` and `Home` are the focused box's, as FR-STAR-4, FR-SKY-14 and FR-GLOBE-6 have them, and the stripe's own keys are the focused stripe's (FR-LIVE-4); `n` stays the night theme.
  *(amends FR-DESK-4 and FR-SKY-13)* `f` no longer faces the pass; `a` does.
  *Verification:* `keys.spec.ts` — each key on each page; a unit test that no two entries of the key table share a key.

- **FR-WIDE-10** **The full sky.**
  On wide, `f` or the box's `[ full screen ]` / `[ pantalla completa ]` control puts the layout's box element in full screen (the Fullscreen API): the box fills the screen, refitted by `fitBox` with the rail's width at zero, with the time readout (FR-TRAJ-4) and `[ × ]` over its top edge; `Esc`, `f` or `[ × ]` returns.
  The view, the camera, the zoom, the instant and the playback do not change across it; the globe and the window are not remounted (the dome may be, by FR-DOME-* sizing).
  Where the API is missing the control is absent and `f` does nothing.
  *Verification:* `fullscreen.spec.ts` — enter and leave on each view, the camera and `t` read back equal.

- **FR-FACT-1** *(V214-6)* **The satellite facts.**
  `src/data/catalog/facts.json` holds an entry for every NORAD id in the catalogue (FR-SAT-1) and no other, keyed by that id.
  An entry has `countries` (ISO 3166-1 alpha-2 codes, or `ESA`, in the order the operators are named), `operator` (its short name, the same in both languages), `purpose` (one key of the purpose table below), `launched` (the launch date, `YYYY-MM-DD`), `sizeM` (the largest dimension in metres, rounded to two figures),
  `descriptionEs` beside the catalogue's `description`, and `source` per fact (`{ source, date }`, as `stdMagSource`).
  The purpose keys are `crewed-station`, `space-telescope`, `earth-observation`, `ocean-observation`, `radar-observation`, `military`, `rocket-stage`; each has a phrase in both languages, and a `rocket-stage` entry names the payload it launched from the catalogue's name.
  *(amends FR-SAT-5)* The catalogue stays the single source of the orbit-relevant metadata; the facts are a second file, validated against it, lazy on wide only.
  The height is not data: it is the perigee and the apogee from the object's current elements, rounded to `FACT_HEIGHT_STEP_KM`, shown as one number when they round equal.
  Sessions have no network, so the file is compiled and its sources checked by an interactive session with the owner before the phase's breakdown (V22-17's reason, as FR-STAR-1's raw files).
  *Verification:* `facts.test.ts` — one entry per catalogue id, every field present and sourced, every country a known code, every purpose a key; `lib/orbitHeight.test.ts` against a fixed OMM.

- **FR-FACT-2** *(V214-7)* **This satellite.**
  The group reads, in the reader's language: the name; `China · CMSA · crewed space station` (the countries' names, the operator, the purpose's phrase); `launched 2021 · 5 years ago · about 55 m · 380–390 km up`; the description.
  On the pass detail it is the page group under the times; on the live page a click, a tap or `Enter` on a legend row or an arc highlights the pass (FR-LEG-4) and shows the group in the page group, under `Facing`, with `[ × ]`, until `Esc`, `[ × ]` or another pick.
  The group's heading takes the focus when it opens from the keyboard; it is not a live region.
  *Verification:* `factsGroup.test.tsx` in both languages, a rocket stage and a station; `live.spec.ts` — click the arc, the group; `Esc`, gone.

- **FR-FACT-3** *(V214-12)* **What is that star.**
  On wide a click or `Enter` on a star, a planet or the Moon that FR-GLOBE-11 or FR-STAR-7 names, on the globe or the window, shows its facts in the page group with `[ × ]`, until `Esc`, `[ × ]` or another pick.
  The facts are the name in the reader's language and, where it differs, the other (`Sirio · Sirius`); the designation (`α CMa`) and the constellation by its name in the reader's language; the magnitude; the altitude and the 16-point direction at `t`; and the rise and set at the shown place on the night that holds `t`, or `never sets` / `never rises`.
  A planet adds `planet` and its constellation now; the Moon adds its phase and lit share (FR-MOON-*).
  Rise and set are the geometric horizon crossings at `t`'s night, from the star's J2000 position (FR-GLOBE-17's rule) and from `astronomy-engine` for the planets and the Moon, to the minute.
  *Verification:* `lib/riseSet.test.ts` — Sirius over Bariloche on a fixed night against JPL Horizons to ±2 min, a circumpolar star, a never-rising star; `stars.spec.ts` — click the list's first row's mark, the group.

- **FR-NAME-1** *(V214-8)* **The Spanish names, checked.**
  `data-src/stars/names-es.tsv` gains a row for every one of the 289 named stars (FR-STAR-1) and keeps one for every constellation: each row is the Spanish form or `=` (the IAU name is the Spanish one), and a source key; the file's head lists the sources by key.
  The build step fails if a named star or a constellation has no row (D-832's check, widened).
  *(amends FR-STAR-10)* V25-16's list of fourteen becomes the rows' Spanish forms, whatever their count; every other star keeps its IAU name in both languages, now by a sourced row and not by absence.
  The review is compiled and sourced in the same interactive session as FR-FACT-1's file.
  *Verification:* `build-stars.test.ts` — the missing-row failure; `starCatalog.test.ts` — the count of Spanish forms pinned.

- **FR-NAME-2** *(V214-9)* **A label for every bright star.**
  Every catalogue star brighter than `BAYER_LABEL_MAG` with no proper name is named by its designation: the Bayer letter in Greek and the constellation's IAU abbreviation (`γ Vel`), else the Flamsteed number (`41 Ari`); the same in both languages, at every width, wherever names are drawn and listed (the window, the polar chart, the globe, the lists, the readouts).
  A designation name is placed after the proper names in `starLabels.ts`'s order, so it never displaces one.
  *Verification:* `starCatalog.test.ts` — the 33 labels and their count pinned; a capture at 390 showing one.

- **FR-NAME-3** *(V214-10)* **The planets stand out.**
  On wide, on the globe and the window, each planet is a filled disc of `PLANET_MARK_PX` in its own token (`--chart-planet-mercury`, `-venus`, `-mars`, `-jupiter`, `-saturn`, night restating them as the sheet's night ramp, V23-3), with its name one type step over the star names in `--fg`, drawn with the `names` layer off; the planets' boxes keep FR-GLOBE-11's precedence over every star name.
  On compact the planets are as on 2.13.
  *Verification:* `contrast.ts` — each token against the sky surface in every theme at the chart's ratio; `globe.spec.ts` — with names off, five planet labels and no star label.

- **FR-KEEP-1** *(V214-15)* **Your choices, kept on the device.**
  Every choice in this table is saved in the device's local store (FR-LOC-5's `wiys:prefs:v1`) when the reader makes it, and every page opens on it at every width, phone and desk alike:

  | Choice | Where it is made | Saved as |
  |---|---|---|
  | the view | every page's `View` row | `chartView` (FR-WIDE-2), one value for all pages; a page that does not offer the saved view opens on the one that stands for it (`dome` is the whole sky on the stars page; `globe` the polar chart on compact, and back) |
  | the stars under the arcs | `[x] stars` (FR-SKY-3) | `starsLayer`, as on 2.13 |
  | the stars page's layers | `stars`, `figures`, `planets` | `starLayers`, the three switches |
  | the names | `[x] names` | `namesChoice`, once tapped; until then R160's default by view and width holds (FR-KEEP-3) |
  | the faint stars | `[ ] faint` on the globe and the window | `faintStars` |
  | the globe's turn | `with you` / `with the stars` | `globeTurn` |
  | the zoom | the globe's and the window's `+`, `-`, wheel and pinch | `globeZoom` and `windowFov`, each clamped to its range on read |
  | the playback speed | the playback row's speeds and the globe's | `playSpeed`, the rate `play` starts at |

  The hidden objects, the faint passes, the sort, the sun glow, the theme and the language stay saved as on 2.13.
  A value the reader has not chosen is not written, so a later change to a default reaches them.
  *(amends FR-PHONE-7 and FR-GLOBE-10)* The stars page's view and the faint stars are saved, not reset at each open.
  *Verification:* `localPrefs.test.ts` — each key's round trip and its clamp; `keep.spec.ts` at 390 × 844 and 1280 × 800 — make every choice, reload, find it.

- **FR-KEEP-2** *(V214-15)* **Moments are not kept.**
  Every page opens at now, watching (real time, `t` = now), whatever speed is saved; the window's camera opens by its page's rule (FR-STAR-3, FR-FLOW-14, FR-SKY-7) and the globe's view by FR-GLOBE-1's; the globe's place is the reader's own place on every open.
  A share link's instant and pass (FR-SHARE-1) win over the saved values for that open and are not saved.
  Following the phone (FR-WIN-5's mode) is never saved.
  *Verification:* `keep.spec.ts` — scrub, turn the camera, pick a saved place on the globe, reload: now, the opening aim, the reader's place.

- **FR-KEEP-3** *(V214-16)* **The first visit's defaults.**
  With nothing saved, the pages open on:

  | Choice | Phone | Desk |
  |---|---|---|
  | view | Window | Globe |
  | stars under the arcs | on | on |
  | stars, figures, planets | on | on |
  | names | on in the window, off in the polar chart (R160) | on |
  | faint stars | off | off |
  | globe's turn | — | with you |
  | zoom | `WINDOW_FOV` | 1× and `WINDOW_FOV` |
  | speed | ×1 | ×1 |
  | sun glow, theme | off, dark | off, dark |

  These are 2.13's defaults with FR-WIDE-2's globe on the desk; they are held as constants in `src/model/prefs.ts` beside the others, one place.
  *Verification:* `prefs.test.ts` pins the table; `keep.spec.ts` opens each page with an empty store at both widths.

- **FR-KEEP-4** *(V214-17)* **The privacy notice, once.**
  The line under the place search on the first visit (`Saved in this browser only. No account, no tracking.`) and the footer's privacy sentence and word (`No analytics, no tracking: …`, `No tracking`) each carry `[ × ]` / `[ × ]` with the accessible name "Close the privacy note" / its Spanish.
  Either `[ × ]` hides both, on every page and every later visit on the device (`privacyNoteClosed`); the footer's row closes up with no gap.
  The settings page keeps the privacy sentence as plain text with no `[ × ]`, so the fact stays one tap away.
  *Verification:* `Footer.test.tsx` and `LocationInput.test.tsx` — shown, closed by either control, gone from both; `keep.spec.ts` — close on the home, reload, open the stars page: no note; the settings page still has the sentence.

- **FR-PUB-14** *(V214-18)* **The README for 2.14.0.**
  The release task rewrites `README.md` for the release it prepares, under FR-PUB-1's four questions.
  The prologue's sentence names the satellites, the stars and the planets and the desk's globe; the live line names the release (`2.14.0`), read from `package.json`.
  The hero (FR-PUB-2) and the social preview (FR-PUB-11) are composed again by `scripts/readme-hero.ts` from 2.14's captures: a phone in the window over a pass and a desk on the globe with a pass's arc and a satellite's facts.
  "How it is built" names the v2.13 layout: `AGENTS.md`, the index files, the phase folders under `docs/sdd/phases/`, the Decision Log, `ids.md` and the tiers of `sdd.agents.json`, and that any agent a config entry describes can run it.
  "By the numbers" is regenerated on the release commit by the commands `docs/HOW-THIS-WAS-BUILT.md` lists, with that date.
  "Stack" describes the views as they are: the globe on a desk, the window, the polar chart on a phone and the dome by choice, SVG and DOM, no canvas or WebGL; nothing is described as in progress.
  *Verification:* `readme.test.ts` — the live line's version equals `package.json`'s; no "in progress"; every relative link resolves; each figure of "By the numbers" carries the release date.

- **FR-PUB-15** *(V214-18)* **The reading order follows the layout.**
  *(amends FR-PUB-3)* `docs/HOW-THIS-WAS-BUILT.md`'s reading order starts at `AGENTS.md`, then `SPEC.md` and `PLAN.md` as indexes, a phase folder, `ids.md` and `npm run sdd:id`, the driver and one task end to end; its example task's links resolve on `main`.
  *Verification:* `readme.test.ts` covers its relative links too.

- **FR-PUB-16** *(V214-18)* **The repository's description and topics.**
  *(amends FR-PUB-11)* The release's `release.md` holds the exact text, and the owner applies it with `gh repo edit` (sessions have no network):
  the description "Naked-eye sky in the browser: which satellites cross your sky tonight, when and where to look, and the stars, constellations and planets on a celestial globe."; the homepage `https://inyoursky.app`;
  and these twenty topics, the twelve of 2.13 kept: `astronomy`, `iss`, `orbital-mechanics`, `pwa`, `react`, `satellite`, `satellite-tracking`, `sgp4`, `spec-driven-development`, `stargazing`, `typescript`, `web-worker`, `star-chart`, `constellations`, `celestial-globe`, `offline-first`, `i18n`, `cloudflare-workers`, `claude-code`, `ai-agents`.
  Tags and GitHub Releases are not in this phase: the release keeps the project's rule that the owner tags it.
  *Verification:* the release's checklist reads `gh repo view --json description,repositoryTopics` back equal to the text.

- **FR-WIDE-11** **The rate and the bundles.**
  With the arcs, the ticks and the planets on, the globe holds ≥ 30 updates/s under a drag and under ×3600 at 1280 × 800 and 1920 × 1080 with the CPU throttled 4× on the live page as FR-GLOBE-15 measures it on the stars page (`globe-perf.spec.ts` gains the live page, best of three, D-817).
  `main` grows by at most `SKY_MAIN_KB` over 2.13.0's measure, `globe` by at most `SKY_GLOBE_KB`; the new `facts` chunk has its own row at `FACTS_BUDGET_KB`, loaded on wide when a facts group first opens and prefetched on idle after the globe; compact requests neither; the release re-sets every row by D-178.
  *Verification:* `npm run bundle:budget`; `globe-perf.spec.ts`; a test that the compact pages request no `facts-*.js` and no `SkyGlobe-*.js`.

- **FR-WIDE-12** **Named moves and captures.**
  The phase's visible changes are the three wide pages' layout and views, the arcs, ticks and clouds, the facts groups, the planets on wide, the key overlay, and at every width the names of FR-NAME-1 and FR-NAME-2 and the privacy note's `[ × ]` (FR-KEEP-4); every other capture is byte-identical to 2.13.0's under FR-CAP-5's comparison.
  The capture set's wide dome captures are re-shot with `Dome` chosen, and it gains at 1280 × 800 over Bariloche at the set's instant: `sky-live-globe`, `sky-pass-globe`, `sky-pass-facts`, `sky-live-facts`, `sky-stars-star-facts`, `sky-hover`, `sky-clouds` and `sky-fullscreen`, in the set's languages and themes.
  Every string is in both catalogs, every rail row fits the rail in both (`controlRows.test.ts`), and the axe run (FR-A11Y-7) covers the three pages with the globe and with a facts group open.
  *Verification:* `captureIds.test.ts`; `axe.spec.ts`; the release's diff against 2.13.0 (FR-CAP-5).

---

### 5.18 v2.14 additions *(proposal; the plan decides)*

- `SkyViewLayout` as the one wide shell for the three pages; the pass detail moves out of `GuidePanel` on wide (FR-WIDE-1).
- `SkyGlobe` takes `passes`, `highlightedPassId` and `t` beside its layers, through the same `sceneFor` table (FR-WIDE-3).
- `facts.json` and the facts groups in their own lazy chunk; `orbitHeight.ts` and `riseSet.ts` pure in `src/lib` (FR-FACT-1..3).
- One key table module the overlay and the handlers read (FR-WIDE-9).

### Phase 2w — v2.14 ("one sky on a desk", as decided 2026-11-04, V214-1)

After v2.13 is on `main`.
Wide pages only, except the star names, the remembered choices and the privacy note, which reach every width.

- Before the breakdown, in an interactive session with the owner: `facts.json` and the reviewed `names-es.tsv`, sourced (FR-FACT-1, FR-NAME-1).
- The views and the layout: the saved globe, the three-value row, the one shell, the corners, the dome by choice (FR-WIDE-1, FR-WIDE-2, FR-WIDE-5, FR-WIDE-6).
- The globe's passes, the hover, the ticks and the arrow; the one time control and the clouds (FR-WIDE-3, FR-WIDE-4, FR-WIDE-7, FR-WIDE-8).
- The facts groups, the names and the planets (FR-FACT-1..3, FR-NAME-1..3).
- The keys and the full sky (FR-WIDE-9, FR-WIDE-10).
- The remembered choices, the first visit's defaults and the privacy note, at every width (FR-KEEP-1..4).
- With the release: the README, the reading order, the images, and the description and topics for the owner to apply (FR-PUB-14..16).
- The rate, the bundles, the captures and 2.14.0 (FR-WIDE-11, FR-WIDE-12).

Definition of done:
- FR-WIDE-1..12, FR-FACT-1..3, FR-NAME-1..3, FR-KEEP-1..4 and FR-PUB-14..16 met, each by its verification line; US-52..US-57's criteria green.
- `sky-layout.spec.ts`, `globe.spec.ts`, `globe-perf.spec.ts`, `keys.spec.ts`, `fullscreen.spec.ts`, `legend-hover.spec.ts`, `keep.spec.ts`, `readme.test.ts`, `axe.spec.ts`, `dome.spec.ts` and `stars.spec.ts` green; every compact spec green with only the names' and the privacy note's captures moved.
- Every task `Gate: auto`, merged on CI green and a clean review, at most one `hard` task per wave, the driver's wait-and-resume on (V213-11's rule).
- `npm run bundle:budget`: every row inside its budget, `main` within `SKY_MAIN_KB`, `globe` within `SKY_GLOBE_KB`, the new `facts` row inside `FACTS_BUDGET_KB`.
- The owner's desk run written into the phase's `release.md`; `package.json` reads 2.14.0; the owner tags v2.14.0 and deploys.
