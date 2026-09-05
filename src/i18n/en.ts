import type { AgeParts } from '../lib/elementsAge';
import type { CompassPoint } from '../lib/compass';
import type { MoonFacts, MoonGlareFacts, MoonLoreParams } from '../lib/moonPhrases';
import type { BrightnessBand, ElevationBand, GuideParams } from '../lib/phrases';
import type { ChartOrientation, ChartView, CloudState, MoonPhaseName, PassBoundaryReason, PassSort, ReadinessGap, SkyState, Theme } from '../model';
import type { CountdownPhase, HiddenReason, LinkedText } from './messages';

/**
 * FR-I18N-2 (D-69): every string the app renders, in English, and the type
 * `es.ts` must satisfy. Plain strings stay plain strings; anything with a
 * number, a name or a time in it is a **function**, so the other language can
 * put the words in its own order, agree in gender and number, and choose
 * where a link falls. Nothing outside `src/ui` reads this file: `src/lib`
 * returns bands, keys and already-formatted numbers (PLAN §3).
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

export const en = {
  app: {
    /** FR-I18N-5: also the document title. */
    title: 'What is in your sky right now',
    tagline: 'Naked-eye satellite passes for the coming night: which, when, and where to look.',
    language: 'Language',
    /** FR-THEME-1: the palette switch. Unlike the languages, both names are translated — whoever reads this can read the page. */
    theme: 'Theme',
    themes: { dark: 'Dark', night: 'Night' } satisfies Record<Theme, string>,
  },

  banner: { info: 'Note', warning: 'Warning' },

  compass,

  location: {
    heading: 'Location',
    placeLabel: 'Place name',
    placePlaceholder: 'e.g. Cipolletti',
    placeList: 'Matching places',
    searching: (query: string) => `Searching for “${query}”…`,
    noMatch: (query: string): LinkedText => ({ before: `No place matches “${query}”. Try another spelling, or `, link: coordsInstead, after: '.' }),
    searchFailed: (message: string): LinkedText => ({ before: `Could not search for places (${message}). Try again, or `, link: coordsInstead, after: '.' }),
    /**
     * FR-OFF-8: place search is the one input that cannot fail soft, because it
     * needs a provider. With no connection it is not attempted at all, and the
     * line names the two inputs that still work instead of reporting a failure.
     */
    searchOffline: { before: 'No connection, so places cannot be searched. The device location button still works, or ', link: coordsInstead, after: '.' } satisfies LinkedText,
    placeCentre: (p: { place: string; coords: string }) => `Using the centre of ${p.place} (${p.coords}).`,
    coordsLabel: 'Coordinates (lat, lon)',
    coordsPlaceholder: '-38.93, -67.99',
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
    precisionNote: 'Precision is city-level: a pass looks the same from anywhere within a few kilometres, so no street address is resolved.',
  },

  now: {
    heading: 'Right now',
    noObserver: 'Enter a place name or coordinates to see what is overhead right now.',
    checking: 'Checking the sky…',
    error: (message: string) => `Could not check the sky: ${message}`,
    visible: (count: number) => (count === 1 ? '1 satellite visible right now' : `${String(count)} satellites visible right now`),
    noDarkness: 'No darkness tonight at this latitude: the sun never gets low enough for satellites to be seen.',
    daylight: (p: { sunDegrees: string; above: boolean }) => `Daylight: the sun is ${p.sunDegrees} ${p.above ? 'above' : 'below'} the horizon. Satellites are not visible until the sky is dark.`,
    nothingUp: (minElevation: string) => `Nothing visible right now: no catalog satellite is above ${minElevation}.`,
    allInShadow: (count: number) =>
      count === 1 ? "Nothing visible right now: 1 satellite is up but in Earth's shadow." : `Nothing visible right now: ${String(count)} satellites are up but all in Earth's shadow.`,
    elevation: (degrees: string) => `${degrees} up`,
    remaining: (p: { reason: PassBoundaryReason; countdown: string }) =>
      `${{ horizon: 'sets in', shadow: "enters Earth's shadow in", twilight: 'fades into the brightening sky in' }[p.reason]} ${p.countdown}`,
    remainingUnknown: 'visible for a while yet',
    clouds: 'Clouds now:',
    asOf: (time: string) => `as of ${time}`,
  },

  moon: {
    phase: moonPhase,
    /**
     * FR-MOON-3: the Moon's own line. Phase and illumination always; the
     * direction and the elevation only while it is up, because a compass
     * point for something under the ground is not a place to look.
     */
    line: (p: MoonFacts) => `Moon: ${moonPhase[p.phase]}, ${p.illumination} % lit, ${p.up ? `${p.direction} ${p.azimuth}, ${p.elevation} up` : 'below the horizon'}.`,
    glare: {
      /** FR-MOON-2's label on the pass card. */
      label: 'moon glare',
      /** …and the sentence the guide adds, in the requirement's own words. */
      sentence: 'The Moon is bright and close to the track.',
      tooltip: (p: MoonGlareFacts) =>
        `The Moon is ${p.illumination} % lit and ${p.separation} from the pass peak. A pass is marked when the Moon is above the horizon at the peak, at least ${p.minIllumination} % lit and closer than ${p.maxSeparation}.`,
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
    elementsError: (message: string) => `Could not load orbital elements: ${message}`,
    noElements: 'No catalog objects have orbital elements right now.',
    computing: 'Computing passes…',
    computingProgress: (p: { done: number; total: number; found: number }) => `Computing passes… ${String(p.done)} of ${String(p.total)}, ${String(p.found)} visible so far`, // the count is (night, object) pairs from R18 on, so it names no unit
    passesError: (message: string) => `Could not compute passes: ${message}`,
    unknownError: 'unknown error',
    noDarkness: (p: { hours: number; place: string }) => `No darkness tonight at this latitude: the sun never gets low enough in the next ${String(p.hours)} h from ${p.place}.`,
    none: (p: { hours: number; place: string }) => `No visible passes in the next ${String(p.hours)} h from ${p.place}.`,
    found: (p: { count: number; hours: number; place: string }) => `${String(p.count)} visible passes in the next ${String(p.hours)} h from ${p.place}`,
    sortGroup: 'Sort passes',
    sortPrefix: 'Sort:',
    sort: { chronological: 'Soonest first', best: 'Best first' } satisfies Record<PassSort, string>,
    heroKicker: (p: { name: string; iss: boolean }) => (p.iss ? 'Next ISS pass' : `Next ${p.name} pass`),
    twilightLabel: 'sky still bright',
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
      empty: 'No visible passes.',
      /** The night's only pass is the hero card above the list, so the group is not empty even though its list is. */
      heroOnly: 'Its only pass is the one above.',
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

  chart: {
    viewGroup: 'Chart view',
    viewPrefix: 'View:',
    view: { dome: 'Dome', polar: 'Polar' } satisfies Record<ChartView, string>,
    loadingDome: 'Loading the sky dome…',
    noPass: 'No pass to draw.',
    orientationGroup: 'Chart orientation',
    orientation: { 'looking-up': 'Looking up', map: 'Map' } satisfies Record<ChartOrientation, string>,
    orientationNote: {
      'looking-up': 'Looking up: east on the left, as when lying on your back.',
      map: 'Map: east on the right, as on a map.',
    } satisfies Record<ChartOrientation, string>,
    /** The label beside a pass's rise marker: the object's name (never translated) and its rise time. */
    passLabel: (p: { name: string; time: string }) => `${p.name} ${p.time}`,
    peakLabel: (degrees: string) => `max ${degrees}`,
    /** FR-DOME-6: the label beside the Sun's glow on the horizon. */
    sunLabel: 'Sun',
    /** FR-DOME-6: the label beside the Moon's marker; the glyph is its phase and carries no words. */
    moonLabel: (glyph: string) => `${glyph} Moon`,
    domeGroup: 'Sky dome',
    domeHint: 'Drag the dome, or use the arrow keys, to look around.',
    /** FR-GUIDE-4: where the dome's camera faces, e.g. "Facing SSW (203°) · tilt 25°". */
    readout: (p: { point: CompassPoint; azimuth: string; tilt: string }) => `Facing ${p.point} (${p.azimuth}) · tilt ${p.tilt}`,
    /** FR-LIVE-1 (R32): the live page's chart has no pass to caption, so the figure is named instead; the status strip carries the facts. */
    liveLabel: 'The whole sky at the shown instant',
  },

  /**
   * R32 (FR-LIVE-1, FR-LIVE-3, FR-LIVE-9; US-15). The live page: how it is
   * reached, what it says when it cannot draw, and the five fields of the
   * status strip. Later `live` tasks (R33, R34) extend this section and no
   * other (PLAN §16.2).
   */
  live: {
    /** The header control (FR-LIVE-1). */
    open: 'Live sky',
    /** The Now panel's link to the same page. */
    openFromNow: 'Watch the sky live',
    back: '← Back',
    loading: 'Loading the live sky…',
    /** FR-LIVE-1's two inert states: one line each, beside the return control. */
    noObserver: 'The live sky needs somewhere to look from: a place name or coordinates on the home page.',
    noElements: 'No orbital elements yet, so there is nothing to draw.',
    /** The status strip's accessible name; the five fields below are its labels (FR-LIVE-3). */
    strip: 'Sky status',
    timeLabel: 'Time',
    skyLabel: 'Sky',
    cloudLabel: 'Clouds',
    countLabel: 'Visible',
    moonLabel: 'Moon',
    /** The sky state in words (FR-LIVE-3, `SkyState`). */
    sky: { day: 'day', 'bright-twilight': 'bright twilight', dark: 'dark' } satisfies Record<SkyState, string>,
    /** A field whose value is not known yet — the astronomy is still loading. */
    pending: '…',
    /** How many satellites have a marker on the dome at the shown instant. */
    visible: (count: number) => (count === 1 ? '1 satellite' : `${String(count)} satellites`),
    /** The Moon's phase and illumination, and nothing about where it is: the dome shows that. */
    moon: (p: Pick<MoonFacts, 'phase' | 'illumination'>) => `${moonPhase[p.phase]}, ${p.illumination} % lit`,
    /** FR-SHARE-1's live form: the same button as the pass's, with the page's own words. */
    share: 'Share this sky',
    shareTitle: 'The sky right now',
    shareText: (place: string) => `The whole sky over ${place}, live.`,
    /** R33 (FR-LIVE-4): the time stripe is a slider; its value text is the cursor's clock time. */
    stripe: 'Time stripe: the coming 24 hours',
    /** R33 (FR-LIVE-5): the playback controls. */
    playback: 'Playback',
    play: 'Play',
    pause: 'Pause',
    /** The action that returns the shown instant to real time. */
    now: 'Now',
    speedGroup: 'Playback speed',
    speed: (factor: number) => `${String(factor)}×`,
    /** The strip's sixth field, shown while playing (FR-LIVE-3). */
    speedLabel: 'Speed',
    /** R33 (FR-LIVE-6): the toggle, and the reasons an object up there is not worth looking for. */
    hiddenToggle: 'Hidden objects',
    hiddenReason: { low: 'too low', shadow: 'in shadow', daylight: 'daylight', faint: 'too faint' } satisfies Record<HiddenReason, string>,
    hiddenLabel: (p: { name: string; reason: string }) => `${p.name} · ${p.reason}`,
  },

  /**
   * R31 (US-12, FR-SHARE-1..3). The link itself is the whole payload — there
   * is no server to word anything for us — so these are the only strings a
   * recipient ever sees about sharing: what the action does, what the share
   * sheet is titled, that the link is on the clipboard, and what happened when
   * the pass someone was sent is no longer in the window.
   */
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

  footer: {
    celestrak: { before: 'Orbital elements by ', link: 'CelesTrak', after: '.' } satisfies LinkedText,
    openMeteo: { before: 'Weather data by ', link: 'Open-Meteo.com', after: ' (CC BY 4.0).' } satisfies LinkedText,
    geonames: { before: 'Place search by Open-Meteo geocoding, with data from ', link: 'GeoNames', after: ' (CC BY 4.0).' } satisfies LinkedText,
    privacy: 'No analytics, no tracking: your location is saved in this browser only.',
    credit: { before: 'Built by ', link: 'Ezequiel Baruf', after: '.' } satisfies LinkedText,
    /* R23 (D-120): the wide footer says the same in one row. The provider
       names carry the credit on their own, the licence is still named, and
       the privacy note keeps its subject. */
    short: {
      sources: 'Data:',
      licence: '(CC BY 4.0)',
      privacy: 'No tracking',
    },
  },
};
