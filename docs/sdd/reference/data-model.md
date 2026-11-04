## 5. Data Model

*(v1.1)* Three additions, all UI-side; the worker protocol and `Pass` are unchanged.
`ArcState = 'hidden' | 'ahead' | 'live' | 'linger' | 'full'` (D-189) travels on `SkyChartProps.passes[i].arc`.
`LegendRow` (D-186) is derived, never stored.
`Prefs.chartView` widens to `'dome' | 'polar' | 'window'` (D-57, D-188).
The live slice gains `declinationDeg: number | null` (D-185) and `windowMode: boolean` (FR-WIN-6).

All times are `EpochMs = number` (UTC).
All angles in the model are **degrees**; conversion to radians happens inside `src/physics` only.
Distances are kilometres.

```ts
// src/model/catalog.ts
export type NoradId = number;
export type SatCategory = 'station' | 'payload' | 'rocket-body';
export interface CatalogEntry {
  noradId: NoradId;
  name: string;                       // display name, e.g. "ISS (Zarya)"
  category: SatCategory;
  stdMag: number;                     // standard magnitude at 1000 km, 90° phase (D-1)
  stdMagSource: { source: string; date: string; note?: string }; // FR-SAT-5 provenance
  description?: string;               // one sentence for the card
  featured?: boolean;                 // ISS hero card (spec §8 rank 1)
}

// src/model/elements.ts — CelesTrak OMM JSON field names, verbatim
export interface OmmRecord {
  OBJECT_NAME: string; OBJECT_ID: string; NORAD_CAT_ID: number;
  EPOCH: string;                      // ISO 8601, UTC
  MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number;
  RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number; CLASSIFICATION_TYPE: string; ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number; BSTAR: number; MEAN_MOTION_DOT: number; MEAN_MOTION_DDOT: number;
}
export type ElementGroup = 'visual' | 'stations';
export interface CachedGroup { group: ElementGroup; fetchedAt: EpochMs; records: OmmRecord[] }
export interface SatelliteRecord {          // what the UI and worker share; satrec stays in the worker
  catalog: CatalogEntry;
  omm: OmmRecord;
  epochMs: EpochMs;                         // parsed from omm.EPOCH, for the age warning (FR-SAT-4)
}

// src/model/observer.ts
export type ObserverSource = 'geocode' | 'coords' | 'device';
export interface Observer {
  lat: number; lon: number; altM: number;
  label: string;                            // "Neuquén, Neuquén, Argentina" or "−38.93, −67.99"
  source: ObserverSource;
  timeZone: string | null;                  // IANA; null until known (D-3)
  accuracyM?: number;                       // Geolocation only
}

// src/model/thresholds.ts
export interface VisibilityThresholds {
  minElevationDeg: number;                  // 10
  sunAltMaxDeg: number;                     // −6
  twilightLabelSunAltDeg: number;           // −12
  magLimit: number;                         // 4.5
}
export interface TimeWindow { startMs: EpochMs; endMs: EpochMs }

// src/model/pass.ts
export interface PassPoint { t: EpochMs; azDeg: number; elDeg: number; rangeKm: number }
export type PassBoundaryReason = 'horizon' | 'shadow' | 'twilight';
export interface Pass {
  id: string;                               // `${noradId}-${start.t}`
  noradId: NoradId; name: string;
  start: PassPoint; peak: PassPoint; end: PassPoint;
  startReason: PassBoundaryReason;          // rose above 10° | exited shadow | sky got dark enough
  endReason: PassBoundaryReason;
  durationS: number;
  peakMagnitude: number;
  sunAltAtPeakDeg: number;
  twilight: boolean;                        // FR-VIS-7: sun in (−12°, −6°] at peak
  track: PassPoint[];                       // 10 s samples over [start, end] for the sky chart
  elementsEpochMs: EpochMs;                 // provenance
  moonAtPeak: MoonState;                    // v1: always there — US-18 AC1 shows the phase whether or not it is up (D-109)
  moonGlare: MoonGlare;                     // v1, FR-MOON-2
}

export interface NowItem {
  noradId: NoradId; name: string;
  azDeg: number; elDeg: number; rangeKm: number;
  magnitude: number | null;                 // null when below horizon or in shadow
  lit: boolean; aboveMinElevation: boolean; visible: boolean;
  visibleUntil?: EpochMs; endReason?: PassBoundaryReason;
}
export type SkyState = 'day' | 'bright-twilight' | 'dark';   // sun > −6°, (−12°, −6°], ≤ −12°
export interface NowState {
  t: EpochMs; sunAltDeg: number; sunAzDeg: number; sky: SkyState;
  items: NowItem[];                         // every loaded object, below the horizon included
  hidden?: NowItem[];                       // v1, FR-LIVE-6: above the horizon and not worth looking for *now*; only when asked (D-96); overlaps the drawn passes at a pass's end (D-102)
  moon: MoonState;
}  // sunAzDeg and moon added in v1 (FR-DOME-6, FR-MOON-3)

// src/model/weather.ts
export interface HourlyCloud { t: EpochMs; totalPct: number; lowPct?: number; midPct?: number; highPct?: number }
export interface WeatherSnapshot {
  provider: 'open-meteo';
  lat: number; lon: number; cellKey: string;   // "-38.9,-68.0"
  fetchedAt: EpochMs; timeZone: string;
  hourly: HourlyCloud[];                        // covers at least the prediction window
}
export type CloudState = 'clear' | 'partly' | 'obscured' | 'unknown';
export interface CloudVerdict { state: CloudState; effectivePct: number | null; at: EpochMs }

// ---- v1 ----

// src/model/prefs.ts (additions)
export type Locale = 'en' | 'es';                 // FR-I18N-1
export type Theme = 'dark' | 'night';             // FR-THEME-1

// src/model/moon.ts
export type MoonPhaseName =                 // spelled as data/moon's MoonPhaseKey (D-103)
  | 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous'
  | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent';
export interface MoonState {
  t: EpochMs;
  phaseAngleDeg: number;                    // elongation: 0 = new, 90 = first quarter, 180 = full; always [0, 360)
  illuminatedFraction: number;              // 0..1
  phase: MoonPhaseName;                     // band boundaries are constants (FR-MOON-1)
  azDeg: number; elDeg: number;             // topocentric, geometric like the Sun (D-2)
  eclipticLonDeg: number;                   // tropical, for the zodiac sign (FR-MOON-4)
}
export interface MoonGlare { glare: boolean; separationDeg: number | null }  // FR-MOON-2
export interface MoonGlareThresholds {      // FR-MOON-2's three numbers; defaults in physics/constants.ts, not carried by the protocol
  minAltDeg: number; minIlluminatedFraction: number; maxSeparationDeg: number;
}

// src/model/offline.ts
export interface PassRun {                  // FR-OFF-2, D-78
  cellKey: string;                          // observer rounded to 0.01°, "-38.93,-67.99"
  observer: Observer;
  window: TimeWindow;                       // 72 h from computedAt
  computedAt: EpochMs;
  newestElementsEpochMs: EpochMs;           // provenance for the FR-SAT-4 banner offline: newest, as the age is defined (D-108)
  hasDarkness: boolean;                     // an empty run means "nothing visible" or "no darkness"; offline nothing can retell them apart (D-108)
  passes: Pass[];
}
export interface Favourite {                // FR-OFF-7, D-85
  cellKey: string;                          // the observer's 0.01° cell, the key its stored run uses (D-138)
  observer: Observer; addedAt: EpochMs; lastUsedAt: EpochMs;
}
export const MAX_FAVOURITES = 8;            // FR-OFF-7; the eviction is `data/favourites.ts`, the limit is stated by R28's panel
export interface Readiness {                // FR-OFF-4
  offlineUntil: EpochMs | null;             // min(last pass end, forecast end)
  storedAt: EpochMs | null;
  missing: ('elements' | 'forecast' | 'passes')[];
}
```

Persistence:

| Store | Mechanism | Key | Content |
|---|---|---|---|
| Elements | IndexedDB (`idb`), DB `wiys` v2, store `elementGroups` | `group` | `CachedGroup` (raw, unfiltered — D-9) |
| Passes *(v1)* | IndexedDB, DB `wiys` v2, store `passRuns` | `cellKey` | `PassRun`; at most two kept, pruned on write (D-78) |
| Last observer, sort order, chart view, chart orientation; *(v1)* locale, theme, favourites, hidden-objects toggle, install-hint dismissal | `localStorage` | `wiys:prefs:v1` | JSON; v1 fields are optional, so an existing prefs object stays readable (no key bump) |
| Weather | in-memory `Map` + `localStorage` `wiys:wx:v1` | `cellKey` | `WeatherSnapshot`; fresh for 30 min, evicted after `FORECAST_DAYS × 24 h` (D-106) |
| Geocode results | in-memory `Map` | normalised query | `Place[]`, session only |
| App shell *(v1)* | Cache Storage via the service worker | Workbox precache manifest | HTML, JS, CSS, the braille font, manifest, icons (FR-OFF-1); never data responses |

**v2.6 additions** *(FR-FLOW-6)*

- `Prefs.skyHintSeen: boolean`, default `false`, persisted with the other prefs by `localPrefs.ts` and set once by the first gesture on any sky view (D-848).
  It is not reset by a change of language or theme.
- `DoorLines` (`screens/home/doorLines.ts`): `{ satellites: { lines: string[]; href: string }, stars: { lines: string[]; pending: boolean }, both: { lines: string[] } }`, built from data the home already holds.
  `pending` means the `stars` chunk has not resolved yet (D-843).

**v2.10 additions** *(FR-PHONE-2, FR-PHONE-15, FR-LOOK-3, FR-LOOK-8)*

- `Prefs.followGranted: boolean`, default `false`, written `true` by the first grant on a browser with a motion request and cleared by a refusal (D-962); never read where `permissionRequest()` is `null`.
- `Prefs.theme: 'dark' | 'night' | 'auto'`; `'auto'` resolves to one of the two at first paint and on the tick (D-972); an existing prefs object stays readable.
- `src/data/stars/deep.json`: `{ ra: number[], dec: number[], mag: number[], bv: number[] }`, integers (ra and dec in 0.01°, mag and bv in 0.1), sorted by magnitude so a prefix is the brightest n (D-973).
  `catalog.json` gains `bv: number[]` in the same unit.
- `src/data/stars/milkyWay.json`: `{ bands: [number, number][][] }`, three closed rings of `[ra, dec]` in degrees, outermost first (D-973).

---
