import type { AgeParts } from '../lib/elementsAge';
import type { CompassPoint } from '../lib/compass';
import type { BrightnessBand, ElevationBand, GuideParams } from '../lib/phrases';
import type { ChartOrientation, ChartView, CloudState, PassBoundaryReason, PassSort, Theme } from '../model';
import type { CountdownPhase, LinkedText } from './messages';

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
    domeGroup: 'Sky dome',
    domeHint: 'Drag the dome, or use the arrow keys, to look around.',
    /** FR-GUIDE-4: where the dome's camera faces, e.g. "Facing SSW (203°) · tilt 25°". */
    readout: (p: { point: CompassPoint; azimuth: string; tilt: string }) => `Facing ${p.point} (${p.azimuth}) · tilt ${p.tilt}`,
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

  footer: {
    celestrak: { before: 'Orbital elements by ', link: 'CelesTrak', after: '.' } satisfies LinkedText,
    openMeteo: { before: 'Weather data by ', link: 'Open-Meteo.com', after: ' (CC BY 4.0).' } satisfies LinkedText,
    geonames: { before: 'Place search by Open-Meteo geocoding, with data from ', link: 'GeoNames', after: ' (CC BY 4.0).' } satisfies LinkedText,
    privacy: 'No analytics, no tracking: your location is saved in this browser only.',
  },
};
