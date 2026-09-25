import type { AgeParts } from '../../lib/elementsAge';
import type { CompassPoint } from '../../lib/compass';
import type { MoonNote } from '../../lib/moonNote';
import type { MoonFacts, MoonGlareFacts, MoonLoreParams, MoonPeakFacts } from '../../lib/moonPhrases';
import type { BrightnessBand, ElevationBand, GuideParams } from '../../lib/phrases';
import type { NextEventKind, NoEventReason } from '../../lib/nextEvent';
import type { PassPath, PathEnd } from '../../lib/passPath';
import type { ShortcutId } from '../../lib/shortcuts';
import type { CloudState, MoonPhaseName, PassBoundaryReason, PassSort, ReadinessGap, Theme } from '../../model';
import type { CountdownPhase, LinkedText } from '../messages';

/**
 * FR-I18N-2 (D-69): every string the `ui` lane renders, in English — the
 * `chart` and `live` lanes carry their own sections in `en/chart.ts` and
 * `en/live.ts` (D-199 (2)); `../en.ts` merges the three (plus `en/window.ts`)
 * into the `en` this file used to export whole. Plain strings stay plain
 * strings; anything with a number, a name or a time in it is a **function**,
 * so the other language can put the words in its own order, agree in gender
 * and number, and choose where a link falls. Nothing outside `src/ui` reads
 * this file: `src/lib` returns bands, keys and already-formatted numbers
 * (PLAN §3).
 *
 * Never translated (FR-I18N-6): catalogued satellite names, provider names,
 * and place names as geocoding returns them. Identical in both languages
 * (FR-I18N-4): the compass abbreviations, degrees, magnitudes and the SI
 * symbols `m`, `km`, `min`, `s`, `d` and `h`.
 */

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Spelled-out 16-point names for prose ("west-southwest"); the cards and the table keep the abbreviations. */
const compass = {
  N: 'north',
  NNE: 'north-northeast',
  NE: 'northeast',
  ENE: 'east-northeast',
  E: 'east',
  ESE: 'east-southeast',
  SE: 'southeast',
  SSE: 'south-southeast',
  S: 'south',
  SSW: 'south-southwest',
  SW: 'southwest',
  WSW: 'west-southwest',
  W: 'west',
  WNW: 'west-northwest',
  NW: 'northwest',
  NNW: 'north-northwest',
} satisfies Record<CompassPoint, string>;

/** The elevation band as it reads before "in the north" ("appears **low** in the north"). */
const elevationWord = { low: 'low', mid: 'mid-sky', high: 'high', overhead: 'almost overhead' } satisfies Record<ElevationBand, string>;
/** The same band inside the sentence's parenthesis. */
const elevationPhrase = { low: 'low in the sky', mid: 'mid-sky', high: 'high in the sky', overhead: 'almost overhead' } satisfies Record<ElevationBand, string>;

const brightness = {
  venus: 'brighter than Venus',
  'any-star': 'brighter than any star',
  'bright-star': 'like a bright star',
  'average-star': 'like an average star',
  faint: 'faint, needs dark sky',
} satisfies Record<BrightnessBand, string>;

/** How the pass begins, in the table's words; `horizon` is the 10° cutoff, worded as the horizon for the reader. */
const startReason = {
  horizon: 'appears',
  shadow: "emerges from Earth's shadow",
  twilight: 'becomes visible as the sky darkens',
} satisfies Record<PassBoundaryReason, string>;

/** The same, as the sentence opens with it: capitalised, and comma'd where English needs a comma. */
const sentenceStart = {
  horizon: 'Appears',
  shadow: "Emerges from Earth's shadow",
  twilight: 'Becomes visible as the sky darkens,',
} satisfies Record<PassBoundaryReason, string>;

const endReason = {
  horizon: 'drops below the horizon',
  shadow: "disappears into Earth's shadow",
  twilight: 'fades into the brightening sky',
} satisfies Record<PassBoundaryReason, string>;

const coordsInstead = 'enter coordinates instead';

const cloudState = { clear: 'Clear', partly: 'Partly cloudy', obscured: 'Likely obscured', unknown: 'Weather unknown' } satisfies Record<CloudState, string>;

/** FR-MOON-1's eight phases as they are read out. The keys are the physics', spelled as the lore file spells them (D-103). */
const moonPhase = {
  new: 'new',
  waxingCrescent: 'waxing crescent',
  firstQuarter: 'first quarter',
  waxingGibbous: 'waxing gibbous',
  full: 'full',
  waningGibbous: 'waning gibbous',
  lastQuarter: 'last quarter',
  waningCrescent: 'waning crescent',
} satisfies Record<MoonPhaseName, string>;

/** R82 (D-513): the what step's count in words, one to twelve; figures after. */
const numberWords = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];


export const ui = {
  app: {
    /** FR-I18N-5: also the document title. */
    title: 'What is in your sky right now',
    tagline: 'Naked-eye satellite passes for the coming night: which, when, and where to look.',
    language: 'Language',
    /** FR-THEME-1: the palette switch. Unlike the languages, both names are translated — whoever reads this can read the page. */
    theme: 'Theme',
    themes: { dark: 'Dark', night: 'Night' } satisfies Record<Theme, string>,
    /**
     * FR-COMP-1 (R52): the compact header's title. The full one is 29 cells and
     * the row it shares with `[ live ]` and `[ settings ]` has 36, so compact
     * gets a short name rather than a wrapped one. Meaning may not differ
     * between the widths (FR-COMP-4); a name may.
     */
    shortTitle: 'Your sky',
  },

  banner: { info: 'Note', warning: 'Warning' },

  /** R92 (FR-A11Y-3, FR-A11Y-5): the shell's words — the skip link and the document title of a route that is not home. */
  a11y: {
    skip: 'Skip to content',
    /** `document.title` on a route other than home: the route's name, then the app's. */
    title: (p: { route: string; app: string }) => `${p.route} · ${p.app}`,
    /** An open pass's route name: the satellite and its start time. */
    pass: (p: { name: string; time: string }) => `${p.name} ${p.time}`,
  },

  /** FR-COMP-2, US-20 (R52): the settings page and the compact header's way in. */
  settings: {
    /** The compact header's control. Lower case, like `[ live ]` beside it: they are one row of the same kind. */
    open: 'settings',
    /** The page's own way back, beside `Esc` and the browser's Back (US-20 AC4). */
    back: '\u2190 Back',
    /** Names the region for assistive technology; the page shows no title of its own (the mockup). */
    heading: 'Settings',
    /**
     * R75 (FR-SET-1): the one group for the facts about the device — language, theme, install — under one
     * heading, last on the page.
     */
    browser: 'This browser',
    /**
     * R75 (FR-SET-1): the disclosure beside `[ Use my location ]` that opens the coordinate and altitude fields.
     * Lower case, like the other bracketed text controls; the row is 35 of FR-COMP-4's 36 cells.
     */
    coordinates: 'coordinates',
    /**
     * R75 (FR-SET-1): the clear action on the saved places' row, beside `[ Save this place ]`. The full
     * `location.clearSaved` stays its accessible name; this is only what fits the row.
     */
    clearSaved: 'Clear saved',
    /** R91 (FR-SET-1 as amended v2.1, F-83): the Install row's label, so the row reads `App [ Install ]` rather than the action twice. */
    installLabel: 'App',
    /** R75 (FR-SET-1): the page's foot, which takes the place of the saved-here sentence and of the footer. */
    privacy: 'No tracking. Your location is saved in this browser only.',
  },

  compass,

  location: {
    heading: 'Location',
    placeLabel: 'Place name',
    placePlaceholder: 'e.g. Cipolletti',
    placeList: 'Matching places',
    searching: (query: string) => `Searching for “${query}”…`,
    noMatch: (query: string): LinkedText => ({ before: `No place matches “${query}”. Try another spelling, or `, link: coordsInstead, after: '.' }),
    /** R91 (FR-FAIL-1): what the search's failure line offers instead; the sentence before it is `failure.*`, and the raw message is its detail. */
    searchFailed: { before: 'Meanwhile you can ', link: coordsInstead, after: '.' } satisfies LinkedText,
    /**
     * FR-OFF-8: place search is the one input that cannot fail soft, because it
     * needs a provider. With no connection it is not attempted at all, and the
     * line names the two inputs that still work instead of reporting a failure.
     */
    searchOffline: { before: 'No connection, so places cannot be searched. The device location button still works, or ', link: coordsInstead, after: '.' } satisfies LinkedText,
    placeCentre: (p: { place: string; coords: string }) => `Using the centre of ${p.place} (${p.coords}).`,
    /** FR-FIRST-2 as amended v2.1 (F-73): the placeholder is the format and the label carries the example, so the empty field does not look filled. */
    coordsLabel: 'Coordinates · e.g. -38.93, -67.99',
    coordsPlaceholder: 'lat, lon',
    /** FR-FIRST-2 as amended v2.1 (F-86): the where step's way forward from a typed pair. */
    continue: 'continue',
    altitudeLabel: 'Altitude (m)',
    coordsHint: 'Enter latitude, longitude in decimal degrees, e.g. -38.93, -67.99 or 38.93 S, 67.99 W',
    suffixOnBoth: 'Use N/S/E/W on both values, or on neither',
    signOrSuffix: 'Use a sign or N/S/E/W, not both',
    oneOfEach: 'Give one latitude (N or S) and one longitude (E or W)',
    latitudeRange: (p: { min: number; max: number }) => `Latitude must be between ${String(p.min)} and ${String(p.max)}`,
    longitudeRange: (p: { min: number; max: number }) => `Longitude must be between ${String(p.min)} and ${String(p.max)}`,
    altitudeNumber: 'Altitude must be a number of metres, e.g. 270',
    altitudeRange: (p: { min: number; max: number }) => `Altitude must be between ${String(p.min)} and ${String(p.max)} m`,
    useMyLocation: 'Use my location',
    locating: 'Finding your location…',
    permissionDenied: 'Location permission was denied. You can still enter a place name or coordinates.',
    positionUnavailable: 'Your device could not determine its location. Enter a place name or coordinates instead.',
    positionTimeout: 'Finding your location took too long. Try again, or enter a place name or coordinates.',
    accuracy: (km: string) => `about ${km} km`,
    active: (p: { coords: string; fromDevice: boolean; altitude: string | null; accuracy: string | null }) =>
      `Using ${p.coords}${p.fromDevice ? ' from your device' : ''}${p.altitude === null ? '' : ` at ${p.altitude} m`}${p.accuracy === null ? '' : ` (accurate to ${p.accuracy})`}.`,
    savedHere: 'Saved in this browser only.',
    clearSaved: 'Clear saved location',
    precisionNote: 'Precision is city-level: a pass looks the same from anywhere within a few kilometres.',
    /** FR-FIRST-11 (R81): the Where reading's `[ change ]`, which opens the input group in place. */
    summaryChange: 'change',
    /** FR-FIRST-2 (R76): the one line under the primary action's label. */
    useMyLocationNote: 'Fastest. Your browser asks first; nothing is sent anywhere.',
  },

  /**
   * FR-FIRST-1, FR-FIRST-4, FR-FIRST-5 (R76): the home page's three readings.
   * The step words are lower case in the step line and capitalised as pane
   * headings, which is how the two are written in the spec.
   */
  home: {
    steps: { where: 'where', when: 'when', what: 'what' },
    stepsLabel: 'Steps',
    panes: { where: 'Where', when: 'When', what: 'What' },
    coldHeading: 'Where will you be looking from?',
    coldSentence: 'A pass looks the same from anywhere within a few kilometres, so city-level is enough. Pick any one.',
    /** FR-FIRST-1 (board 1B): the phone's cold open ends on this line, at the foot of the screen. */
    savedFoot: 'Saved in this browser only. No account, no tracking.',
    /** FR-FIRST-1 (board 1B): the wide cold open's two dimmed panes — what When and What will hold. */
    ghost: {
      whenHeading: 'When is it dark enough?',
      whenSentence: "The dark band for your place, with tonight's cloud and moon in it.",
      whatHeading: 'What crosses, and where to look',
      whatCard: 'Each pass as a card: time, direction, how high it climbs, how bright it gets.',
    },
    /**
     * FR-FIRST-11 (R81): the Where reading's sentence under the place, by where
     * the place came from (US-3 AC3's accuracy in the device's).
     */
    where: {
      centre: (place: string) => `Using the centre of ${place}.`,
      coords: 'Using these coordinates.',
      device: (accuracy: string | null) => (accuracy === null ? "Using your device's location." : `Using your device's location (±${accuracy} m).`),
    },
    /** FR-FIRST-9 (R81): the conditions table — a label and a value a row. */
    conditions: {
      label: 'Tonight’s conditions',
      dark: 'Dark',
      cloudsNow: 'Clouds now',
      moon: 'Moon',
      upNow: 'Up now',
    },
    /** FR-FIRST-9: tonight's dark window, the first `dark` band still open or to come. */
    darkWindow: (p: { from: string; to: string }) => `${p.from} → ${p.to}`,
    /** FR-FIRST-9: darkness that began before the day the bands cover — a polar winter — has no dusk to name. */
    darkUntil: (to: string) => `until ${to}`,
    noDarkWindow: 'No full darkness tonight.',
    /** FR-FIRST-9 (FR-MOON-3 as amended v2.0.2): the phase, the lit part and, while it is up, where. */
    moonRow: (p: { phase: MoonPhaseName; illumination: string; point: CompassPoint | null }) => `${moonPhase[p.phase]}, ${p.illumination} %${p.point === null ? '' : `, ${p.point}`}`,
    /** FR-FIRST-9 (US-4 AC3 as amended v2.0.2): the first satellite up, its time left, and how many more. */
    upNow: (p: { name: string; left: string | null; more: number }) => `${p.name}${p.left === null ? '' : ` · ${p.left} left`}${p.more > 0 ? ` +${String(p.more)}` : ''}`,
    /**
     * R82 (FR-FIRST-4 as amended v2.0.2, D-513): the phone's **what** step's heading — the count in words to
     * twelve, figures after it (`Five things cross tonight`, `13 things cross tonight`).
     */
    count: (n: number) => {
      if (n === 0) return 'Nothing crosses tonight';
      if (n === 1) return 'One thing crosses tonight';
      return `${n <= 12 ? capitalise(numberWords[n] ?? String(n)) : String(n)} things cross tonight`;
    },
    /** R82 (FR-FIRST-4 as amended v2.0.2): the phone's **when** step. */
    whenStep: {
      heading: 'When is it dark enough?',
      sentence: (place: string) => `${place}, tonight. Satellites are only lit in the dark band between dusk and dawn.`,
      nightLabel: 'Tonight’s dark band',
      skyLabel: 'Tonight’s sky',
      darkFrom: 'Dark from',
      until: 'Until',
      passesIn: 'Passes in it',
      passesValue: (p: { tonight: number; total: number; hours: number }) => `${String(p.tonight)} tonight, ${String(p.total)} in ${String(p.hours)} h`,
      clouds: 'Clouds tonight',
      /** The cloud word's tooltip: the instant it is judged at. */
      cloudsMoment: 'in the middle of the dark band',
      moon: 'Moon',
      moonValue: (p: { phase: MoonPhaseName; illumination: string }) => `${moonPhase[p.phase]}, ${p.illumination} % lit`,
      /** D-513: by whether the Moon is up and at least `MOON_BRIGHT_PCT` lit inside the dark window (`lib/moonNote`). */
      moonNote: (note: MoonNote) => `A bright moon washes out the faint ones. ${note === 'bright' ? 'Tonight it will.' : 'Tonight it will not.'}`,
      next: 'See what crosses',
    },
    /** R82 (FR-FIRST-4 as amended v2.0.2): the phone's **what** step. */
    whatStep: {
      sentence: 'Each one is a steady point of light, moving about as fast as a high aircraft, with no blinking.',
      moreTonight: (n: number) => `${String(n)} more tonight`,
      moreNights: (n: number) => (n === 1 ? '1 more night' : `${String(n)} more nights`),
      /**
       * The foot line's pieces, `Cipolletti · dark 20:14–05:31 · clear`; it breaks between them on a narrow screen.
       * `dark` is `'none'` on a night with no dark band, and null before the bands are known (the piece is left out).
       */
      foot: (p: { place: string; dark: { from: string; to: string } | 'none' | null; cloud: CloudState }): string[] => [
        p.place,
        ...(p.dark === null ? [] : [p.dark === 'none' ? 'no full darkness' : `dark ${p.dark.from}–${p.dark.to}`]),
        cloudState[p.cloud].toLowerCase(),
      ],
      edit: 'edit',
    },
  },

  /**
   * FR-FIRST-3, FR-WATCH-2 (R76, D-442): the next event, "ISS appears NW in
   * 4:12". One block with two hosts — the home page and the live page's
   * watching headline — so the wording is here once, for both.
   */
  nextEvent: {
    /** Names the block for assistive technology; its label line changes every second. */
    region: 'Next event',
    /**
     * R81 (FR-FIRST-3 as amended v2.0.2, D-508): the label line — `Next up · in 3:45:07` before the rise,
     * `Up now · peaks in 1:10` on the way up, `Up now · sets in 2:05` after the peak, the verb by the end's
     * boundary reason. `first` is the phone's first card, `First up · in 12:34`.
     */
    label: (p: { kind: NextEventKind; reason: PassBoundaryReason; countdown: string; first?: boolean }) => {
      switch (p.kind) {
        case 'rise':
          return `${p.first === true ? 'First up' : 'Next up'} · in ${p.countdown}`;
        case 'peak':
          return `Up now · peaks in ${p.countdown}`;
        case 'end':
          return `Up now · ${{ horizon: 'sets', shadow: 'enters shadow', twilight: 'fades' }[p.reason]} in ${p.countdown}`;
      }
    },
    /** D-507: `NW low → 68° N → SE` — the start, the peak (altitude then point) and the end. */
    path: (p: PassPath) => {
      const end = (e: PathEnd): string => (e.altitude === null ? e.point : `${e.point} ${e.altitude === 'low' ? 'low' : `${String(e.altitude)}°`}`);
      return `${end(p.start)} → ${String(p.peak.altitude)}° ${p.peak.point} → ${end(p.end)}`;
    },
    /** The block's path line: `ISS · NW low → 68° N → SE`. */
    named: (p: { name: string; path: string }) => `${p.name} · ${p.path}`,
    /** The first card's path line: `NW low → 68° N → SE · 6 min`. */
    withDuration: (p: { path: string; minutes: number }) => `${p.path} · ${String(p.minutes)} min`,
    /** The first card's brightness, FR-GUIDE-3's phrase with the magnitude: `Brighter than Venus (−3.4)`. */
    brightness: (p: { band: BrightnessBand; magnitude: string }) => `${capitalise(brightness[p.band])} (${p.magnitude})`,
    /** FR-LIVE-1: the block's way to the live page, which the Now panel's link was. */
    openLive: 'Open the live sky',
    pending: 'Looking for the next pass…',
    none: (p: { reason: NoEventReason; hours: number }) =>
      ({
        'no-passes': `No visible pass in the next ${String(p.hours)} h.`,
        'no-darkness': `No darkness in the next ${String(p.hours)} h at this latitude, so nothing to see.`,
        'no-elements': 'No orbital elements to compute passes from.',
      })[p.reason],
  },

  /**
   * FR-OFF-7, US-17: the saved places, in the location section. The limit is
   * stated with what happens at it, because the eviction is silent (D-85) and
   * "up to 8" alone would not warn anyone that a ninth costs them one.
   */
  favourites: {
    heading: 'Saved places',
    /** R81 (FR-FIRST-11): the Where reading's line, `Saved places · [ Save this place ]`, which has 41 small characters on a phone. */
    lineHeading: 'Saved places',
    save: 'Save this place',
    empty: 'No places saved yet.',
    use: (label: string) => `Use ${label}`,
    /** Marks the entry the app is currently computing for; the button still works, it just changes nothing. */
    current: 'in use',
    remove: (label: string) => `Remove ${label}`,
    limit: (max: number) => `Up to ${String(max)} places. Saving another forgets the one you have not used for longest.`,
  },

  moon: {
    phase: moonPhase,
    /**
     * FR-MOON-3: the Moon's own line. Phase and illumination always; the
     * direction and the elevation only while it is up, because a compass
     * point for something under the ground is not a place to look.
     */
    line: (p: MoonFacts) => `Moon: ${moonPhase[p.phase]}, ${p.illumination} % lit, ${p.up ? `${p.direction} ${p.azimuth}, ${p.elevation} up` : 'below the horizon'}.`,
    /**
     * US-18 AC1 (R49, F-14): the same two facts on a pass card and in the
     * guide, where the pass is what the reader is looking at and "at the peak"
     * is what makes them about it.
     */
    atPeak: (p: MoonPeakFacts) => `Moon at the peak: ${moonPhase[p.phase]}, ${p.illumination} % lit`,
    glare: {
      /** FR-MOON-2's label on the pass card. */
      label: 'moon glare',
      /** …and the sentence the guide adds, in the requirement's own words. */
      sentence: 'The Moon is bright and close to the track.',
      tooltip: (p: MoonGlareFacts) =>
        `The Moon is ${p.illumination} % lit and ${p.separation} from the pass peak. A pass is marked when the Moon is higher than ${p.minAltitude} at the peak, at least ${p.minIllumination} % lit and closer than ${p.maxSeparation}.`,
    },
    /**
     * FR-MOON-4 / FR-MOON-5: tradition, labelled as tradition, worded as
     * where a name comes from and never as what the night will bring. No
     * observing fact is stated here or derived from it.
     */
    lore: {
      heading: 'Moon tonight',
      tradition: 'lore',
      line: (p: MoonLoreParams) =>
        `The Moon is in ${p.sign}${p.fullMoonName === null ? '' : `, and this month's full Moon is known as the ${p.fullMoonName}`}. ${p.line}`,
    },
  },

  passes: {
    heading: 'Upcoming passes',
    noObserver: 'Enter a place name or coordinates to see the visible passes.',
    loadingElements: 'Loading orbital elements from CelesTrak…',
    noElements: 'No catalog objects have orbital elements right now.',
    computing: 'Computing passes…',
    computingProgress: (p: { done: number; total: number; found: number }) => `Computing passes… ${String(p.done)} of ${String(p.total)}, ${String(p.found)} visible so far`, // the count is (night, object) pairs from R18 on, so it names no unit
    noDarkness: (p: { hours: number; place: string }) => `No darkness tonight at this latitude: the sun never gets low enough in the next ${String(p.hours)} h from ${p.place}.`,
    none: (p: { hours: number; place: string }) => `No visible passes in the next ${String(p.hours)} h from ${p.place}.`,
    /** FR-FIRST-10 (R81, D-510): the count, which shares its line with the sort. */
    countLine: (p: { count: number; hours: number }) => `${String(p.count)} visible passes in ${String(p.hours)} h`,
    /**
     * FR-FAINT-2 (R97): the control after the count, `[ show 12 faint ]` / `[ hide 12 faint ]` (the brackets
     * are the control's own), and the same control after `[<n> more tonight]` on the phone's third step.
     */
    faintToggle: (p: { shown: boolean; count: number }) => `${p.shown ? 'hide' : 'show'} ${String(p.count)} faint`,
    /** FR-FAINT-2: the tag on a shown faint pass's third line. */
    faintTag: 'faint',
    sortGroup: 'Sort passes',
    sortPrefix: 'Sort:',
    sort: { chronological: 'Soonest first', best: 'Best first' } satisfies Record<PassSort, string>,
    /** US-5 AC2 as amended (v1.1), FR-COMP-4: the same two orders named short enough for a 36-cell row. */
    sortShort: { chronological: 'Soonest', best: 'Best' } satisfies Record<PassSort, string>,
    /** FR-FIRST-10 (§8 rank 1 as amended v2.0.2): the tag on the next featured pass's card, which the hero card was. */
    nextTag: (p: { name: string; iss: boolean }) => (p.iss ? 'Next ISS' : `Next ${p.name}`),
    /**
     * FR-FIRST-10 (US-5 AC1): the card's second line — `6 min · peak 68° N · mag −3.4`, or the brightness
     * phrase in place of the magnitude on the phone's third step (`like a bright star`).
     */
    cardDetail: (p: { minutes: number; altitude: string; point: CompassPoint; brightness: { magnitude: string } | { band: BrightnessBand } }) =>
      `${String(p.minutes)} min · peak ${p.altitude} ${p.point} · ${'magnitude' in p.brightness ? `mag ${p.brightness.magnitude}` : brightness[p.brightness.band]}`,
    twilightLabel: 'sky still bright',
    /** FR-NIGHT-2: in place of the cloud word for the minute an ended pass stays a card. */
    ended: 'ended',
    openGuide: 'Open guide →',
    fields: {
      start: 'Start',
      maxElevation: 'Max elevation',
      peakDirection: 'Peak direction',
      duration: 'Duration',
      magnitude: 'Magnitude',
      clouds: 'Clouds',
    },
    /** "2026-09-11 21:14:32": a date and a clock, in that order in English. */
    stamp: (p: { date: string; time: string }) => `${p.date} ${p.time}`,
    /** "N (46°)" on the card; the abbreviation and the degrees are the same in both languages, their order is not. */
    direction: (p: { point: CompassPoint; degrees: string }) => `${p.point} (${p.degrees})`,
    magnitudeWithBand: (p: { magnitude: string; band: BrightnessBand }) => `${p.magnitude}, ${brightness[p.band]}`,
    /**
     * US-16 AC5 / FR-OFF-2: the 72 h list under one heading per 24 h night,
     * tonight open and the rest closed. The relative words are used only when
     * they are true of the reader's own clock; an older stored run's first
     * night is named by its date instead (D-146).
     */
    nights: {
      tonight: 'Tonight',
      tomorrow: 'Tomorrow night',
      dated: (date: string) => `Night of ${date}`,
      count: (count: number) => (count === 1 ? '1 pass' : `${String(count)} passes`),
      /** FR-FAINT-2: a night left with only faint passes while they are hidden — `0 passes · 3 faint`. */
      onlyFaint: (faint: number) => `0 passes · ${String(faint)} faint`,
      empty: 'No visible passes.',
      /** FR-FIRST-10: the row of the nights' toggles under the cards, as a group. */
      toggles: 'Nights',
    },
  },

  countdown: {
    /** US-5 AC4 / US-6: the live countdown's headline, "Appears in 12:34" or "Ended 3:00 ago". */
    headline: (p: { phase: CountdownPhase; reason: PassBoundaryReason; clock: string }) => {
      switch (p.phase) {
        case 'before':
          return `${{ horizon: 'Appears in', shadow: 'Leaves shadow in', twilight: 'Visible in' }[p.reason]} ${p.clock}`;
        case 'to-peak':
          return `Peak in ${p.clock}`;
        case 'to-end':
          return `${{ horizon: 'Sets in', shadow: 'Enters shadow in', twilight: 'Fades in' }[p.reason]} ${p.clock}`;
        case 'over':
          return `Ended ${p.clock} ago`;
      }
    },
    steps: 'Rise, peak and set times',
    rise: 'rise',
    peak: 'peak',
    set: 'set',
  },

  guide: {
    back: '← Back to the list',
    /** R23 (FR-DESK-3): the wide panel's close control. The glyph is `×`; this is what it is called. */
    close: 'Close the guide',
    /** The wide panel is a labelled region rather than a dialog (D-118), so it says what kind of region it is. */
    panelLabel: (p: { name: string }) => `Guide: ${p.name}`,
    /**
     * R50 (FR-DESK-3 as amended, F-6): between the wide breakpoint and the
     * width where both fit, the guide has the right column to itself and this
     * is what brings the list back. One word, bracketed by the stylesheet like
     * every other control.
     */
    toList: 'list',
    /**
     * FR-GUIDE-1 / US-6 AC1, plus the FR-VIS-7 clause. The whole sentence is
     * one function: English puts the direction after the elevation and the
     * magnitude last, and another language need not.
     */
    sentence: (p: GuideParams) => {
      const start = `${sentenceStart[p.startReason]} ${elevationWord[p.startBand]} in the ${compass[p.startDir]} at ${p.startTime}`;
      const peak = `climbs to ${p.peakDegrees} (${elevationPhrase[p.peakBand]}) in the ${compass[p.peakDir]} at ${p.peakTime}`;
      const end = `${endReason[p.endReason]} in the ${compass[p.endDir]} at ${p.endTime}`;
      const bright = `${capitalise(brightness[p.brightness])} (magnitude ${p.magnitude}).`;
      const twilight = p.twilight ? ' The sky will still be bright, so it may be hard to spot.' : '';
      return `${start}, ${peak}, ${end}. ${bright}${twilight}`;
    },
    startReason,
    endReason,
    numbers: {
      caption: 'Start, peak and end',
      point: 'Point',
      time: 'Time',
      azimuth: 'Azimuth',
      elevation: 'Elevation',
      range: 'Range',
      start: 'Start',
      peak: 'Peak',
      end: 'End',
      /** FR-LEG-3 (R51): the row of a boundary the satellite crosses in Earth's shadow, which is the drawing's shadow marker. */
      entersShadow: 'Enters shadow',
      leavesShadow: 'Leaves shadow',
      duration: 'Duration',
      magnitude: 'Magnitude',
      rangeAtPeak: 'Range at peak',
      startsWhen: 'Starts when it',
      endsWhen: 'Ends when it',
      sunAtPeak: 'Sun at peak',
      sunWithLabel: (p: { degrees: string; twilight: boolean }) => `${p.degrees}${p.twilight ? ' (sky still bright)' : ''}`,
    },
    /** "N 46°" in the table: abbreviation then degrees. */
    azimuth: (p: { point: CompassPoint; degrees: string }) => `${p.point} ${p.degrees}`,
  },

  share: {
    pass: 'Share this pass',
    /** The share sheet's title (FR-SHARE-2); the text beside it is the guide sentence. */
    title: (p: { name: string }) => `${p.name} in your sky`,
    copied: 'Link copied',
    /** The clipboard can be refused; the link is still shown so it can be copied by hand. */
    copyFailed: 'The link could not be copied. Here it is:',
    /** FR-SHARE-3, first branch: names the satellite and the time the link was made for. */
    nearest: (p: { name: string; time: string }) => `The ${p.name} pass this link was made for (${p.time}) is no longer in the window. This is the nearest ${p.name} pass instead.`,
    /** FR-SHARE-3, second branch: same naming, and nothing to show. */
    missing: (p: { name: string; time: string }) => `The ${p.name} pass this link was made for (${p.time}) is no longer in the window, and no other ${p.name} pass is in it either.`,
  },

  /**
   * R87 (FR-VISIT-2..4, D-539): the visit notice and the link notes. `showing`
   * is FR-VISIT-2's sentence, on one line with the controls where the page is
   * wide; `showingShort` is the phone's, one row of `--small` (41 characters)
   * over the two controls' row, so the notice stays inside two rows of 36 cells.
   */
  visit: {
    showing: (p: { place: string }) => `Showing the sky from ${p.place}, from a link`,
    showingShort: (p: { place: string }) => `Showing a link’s sky: ${p.place}`,
    back: 'back to my place',
    keep: 'keep this place',
    past: (p: { time: string }) => `This link was for ${p.time}, which has passed. Showing now.`,
    far: (p: { time: string }) => `This link was for ${p.time}, which is more than 24 h ahead. Showing the latest the page can.`,
    unreadable: 'That link could not be read.',
    dismiss: 'Dismiss',
  },

  weather: {
    state: cloudState,
    badge: (p: { state: CloudState; percent: string | null }) => (p.percent === null ? cloudState[p.state] : `${cloudState[p.state]}, ${p.percent} % cloud`),
    momentNow: 'right now',
    momentPeak: 'at the pass peak',
    tooltipHead: (p: { percent: string | null; moment: string }) => (p.percent === null ? `No cloud forecast ${p.moment}.` : `${p.percent} % effective cloud ${p.moment}.`),
    thresholds: (p: { clear: string; obscured: string }) =>
      `Clear below ${p.clear} %, partly cloudy ${p.clear}–${p.obscured} %, likely obscured above ${p.obscured} % effective cloud (low and mid cloud weigh more than high cloud).`,
    source: (p: { provider: string; fetched: string }) => `Forecast by ${p.provider}, fetched ${p.fetched}.`,
    noForecast: 'No forecast is available.',
  },

  elements: {
    region: 'Orbital elements',
    /** The age of the newest epoch: "2 d 4 h", "45 min", or the words for less than a minute. */
    age: (p: AgeParts) => {
      if (p.days > 0) return p.hours > 0 ? `${String(p.days)} d ${String(p.hours)} h` : `${String(p.days)} d`;
      if (p.hours > 0) return p.minutes > 0 ? `${String(p.hours)} h ${String(p.minutes)} min` : `${String(p.hours)} h`;
      return p.minutes > 0 ? `${String(p.minutes)} min` : 'under a minute';
    },
    /** FR-SAT-4 as amended v2.0.2 (R81): the Where reading's one line, whose `[ details ]` opens the rest. */
    line: (age: string) => `Elements ${age} old`,
    lineNone: 'No orbital elements',
    details: 'details',
    none: (checked: string) => `No orbital elements in use. Last checked with CelesTrak ${checked}.`,
    newest: (p: { age: string; epoch: string; checked: string }) => `Orbital elements: newest epoch ${p.age} old (${p.epoch}), confirmed with CelesTrak ${p.checked}.`,
    stale: (fetched: string) =>
      `CelesTrak could not be reached, so the elements fetched ${fetched} are in use. They are refreshed again as soon as the connection is back; until then passes may be off by a few minutes.`,
    oldEpoch: (p: { age: string; days: number }) =>
      `The orbital elements are ${p.age} old. Predictions lose accuracy after ${String(p.days)} days, and the ISS in particular changes orbit often: expect times to be off by minutes.`,
    notCached: 'The elements could not be saved in this browser, so they are kept in memory for this session only and will be fetched again next time.',
    unavailable: (p: { count: number; names: string }) =>
      `No current elements from CelesTrak for ${String(p.count)} catalog object${p.count === 1 ? '' : 's'}: ${p.names}. Left out of the list.`,
  },

  /**
   * FR-OFF-4: how long the app can keep answering with no signal, in one row
   * under the location. "Ready offline until" is the requirement's own wording;
   * the stamp is a date and a clock to the minute, which is what makes the
   * sentence fit one row at 390 px in both languages (D-145). The storage time
   * is its own row and shows only for a run that came out of the store.
   */
  readiness: {
    ready: (until: string) => `Ready offline until ${until}`,
    stored: (at: string) => `Stored ${at}`,
    notReady: (gaps: string) => `Not ready offline: no ${gaps} stored yet.`,
    gaps: { elements: 'orbital elements', forecast: 'cloud forecast', passes: 'passes' } satisfies Record<ReadinessGap, string>,
  },

  /**
   * FR-OFF-1 (OQ-14): the update is offered, never imposed. The line says what
   * is waiting and what the button will do, because the button reloads the
   * page and a reader on a pass or a live sky should be able to say "later".
   */
  update: {
    ready: 'A new version is ready.',
    reload: 'Reload now',
  },

  /**
   * FR-OFF-6: the install hint, shown once. The first line is the browser
   * that offers an install of its own; the second is iOS, where the event
   * never fires and the only route is the share sheet, so the note spells the
   * two taps out rather than offering a button that cannot exist (D-153).
   */
  install: {
    offer: 'Install this app to open it from your home screen and use it with no signal.',
    ios: 'To install: tap Share, then “Add to Home Screen”.',
    action: 'Install',
    dismiss: 'Not now',
  },

  /**
   * R35 (FR-DESK-4, US-14 AC4): the overlay `?` opens. `does` is keyed by
   * `ShortcutId`, so a row added to `lib/shortcuts.ts` without a description
   * here is a `tsc -b` failure in both catalogs (D-73, FR-I18N-2) — that is
   * what makes an undocumented shortcut impossible.
   */
  shortcuts: {
    title: 'Keyboard shortcuts',
    /** Read out for the key column; the keys themselves are printed as they are written on the keyboard. */
    keyHeading: 'Key',
    doesHeading: 'Does',
    close: 'Close',
    does: {
      next: 'Next pass in the list',
      previous: 'Previous pass in the list',
      open: 'Open the pass the cursor is on',
      close: 'Close the guide, or this list',
      live: 'Open the live sky',
      view: 'Switch the chart between the dome and the polar view',
      theme: 'Switch the palette between dark and night',
      help: 'Show this list',
    } satisfies Record<ShortcutId, string>,
  },

  footer: {
    celestrak: { before: 'Orbital elements by ', link: 'CelesTrak', after: '.' } satisfies LinkedText,
    openMeteo: { before: 'Weather data by ', link: 'Open-Meteo.com', after: ' (CC BY 4.0).' } satisfies LinkedText,
    geonames: { before: 'Place search by Open-Meteo geocoding, with data from ', link: 'GeoNames', after: ' (CC BY 4.0).' } satisfies LinkedText,
    privacy: 'No analytics, no tracking: your location is saved in this browser only.',
    credit: { before: 'Built by ', link: 'Ezequiel Baruf', after: '.' } satisfies LinkedText,
    /* R102 (FR-SHOW-8, FR-X-2 as amended v2.2, D-657; V22-15): the library
       the sky is drawn with — the library alone, its name a link and not
       translated (FR-I18N-6). */
    chart: { before: 'Sky chart: ', link: 'glyphcss', after: '.' } satisfies LinkedText,
    /* R23 (D-120): the wide footer says the same in one row. The provider
       names carry the credit on their own, the licence is still named, and
       the privacy note keeps its subject. R102: the library's name stands as
       a link after `chart`, the way the sources stand after `sources`. */
    short: {
      sources: 'Data:',
      licence: '(CC BY 4.0)',
      privacy: 'No tracking',
      chart: 'Chart:',
    },
  },
};
