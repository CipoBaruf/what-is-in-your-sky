/**
 * R16 (FR-DOME-8, PLAN §8.7): every knob of the layered dome as one URL
 * parameter, so a candidate composition is a string the findings file can
 * quote and the capture script can replay. Pure: no React, no glyphcss.
 *
 * The parameter names are short because they end up in a findings table.
 * `read` never throws: an unknown or malformed value falls back to the
 * default, so a hand-edited URL degrades to the nearest sensible composition.
 */

export type PassName = 'golden' | 'high';
export type Theme = 'dark' | 'night';
export type ColorSet = 'cool' | 'warm' | 'mono';
export type MeridianSet = 'none' | 'cardinal' | 'eight' | 'sixteen';
export type Encoding = 'spans' | 'atlas';

export interface Params {
  /** Fixture pass: the R1 golden grazing pass or R14's synthetic high pass. */
  pass: PassName;
  theme: Theme;
  /** Which candidate colour map is used when `colors` is on. */
  colorSet: ColorSet;
  /** Camera tilt from top-down, degrees; FR-DOME-8 searches 35–55. */
  tilt: number;
  /** Azimuth the camera faces; `null` means the highlighted pass's rise azimuth (D-17). */
  facing: number | null;
  /** Host width in CSS px: 390 (phone) or 1280 (desktop panel). */
  width: number;
  /** Line-layer columns. FR-DOME-1: the column count grows with the width. */
  cols: number;
  /** Base layer on. Off leaves the line layer alone (the "no second scene" candidate). */
  base: boolean;
  /** Base-layer columns as a fraction of the line layer's (PLAN §8.7: "coarser density than the line layer"). */
  baseRatio: number;
  /** Base-layer ambient light, 0–1: how flat the sky bowl reads. */
  ambient: number;
  /** Base-layer directional light intensity. */
  key: number;
  /** Ground disc below the horizon (FR-DOME-3). */
  ground: boolean;
  /** Shaded sky bowl (FR-DOME-8a). */
  bowl: boolean;
  /** Sun altitude and azimuth at the shown instant (FR-DOME-6); the key light points at it. */
  sunAlt: number;
  sunAz: number;
  /** Moon marker (FR-DOME-6). */
  moon: boolean;
  moonAlt: number;
  moonAz: number;
  /** Illuminated fraction 0–1, for the phase glyph. */
  moonPhase: number;
  meridians: MeridianSet;
  /** 10° horizon ticks with the degree number every 30° (FR-DOME-4). */
  ticks: boolean;
  /** "30°" / "60°" labels on the altitude rings (FR-DOME-4). */
  ringLabels: boolean;
  /** Clock times at rise, peak and end (FR-DOME-4). */
  timeLabels: boolean;
  /** Line weights, as the half-width of the strip in degrees of sky. */
  horizonWeight: number;
  ringWeight: number;
  meridianWeight: number;
  passWeight: number;
  dimWeight: number;
  /** Per-mesh `density` on the highlighted pass (FR-DOME-8c); 1 keeps it in the shared `<pre>`. */
  passDensity: number;
  /** FR-DOME-2 colours on. Off is the R15 monochrome reading. */
  colors: boolean;
  /** glyphcss `colorTolerance` (0–765): fewer `<span>`s for less colour fidelity. */
  tol: number;
  /** glyphcss `interactiveDownscale`: render at 1/n while dragging. */
  downscale: number;
  /** glyphcss `colorEncoding`. */
  encoding: Encoding;
  /** Soft pulse on the live marker (FR-DOME-8d). */
  pulse: boolean;
  /** Pulse updates per second. */
  pulseHz: number;
  /** Fallback: hide the base layer while a drag is in progress. */
  dropBaseOnDrag: boolean;
  /** Where the satellite is, as a fraction of the pass; < 0 draws no live marker. */
  now: number;
  /** How many dim companion passes are drawn beside the highlighted one (FR-LIVE-2 load). */
  others: number;
}

export const DEFAULTS: Params = {
  pass: 'golden',
  theme: 'dark',
  colorSet: 'cool',
  tilt: 45,
  facing: null,
  width: 390,
  cols: 60,
  base: true,
  baseRatio: 0.5,
  ambient: 0.35,
  key: 0.85,
  ground: true,
  bowl: true,
  sunAlt: -9,
  sunAz: 285,
  moon: true,
  moonAlt: 34,
  moonAz: 55,
  moonPhase: 0.62,
  meridians: 'eight',
  ticks: true,
  ringLabels: true,
  timeLabels: true,
  horizonWeight: 0.05,
  ringWeight: 0.05,
  meridianWeight: 0.05,
  passWeight: 0.75,
  dimWeight: 0.05,
  passDensity: 1,
  colors: true,
  tol: 0,
  downscale: 1,
  encoding: 'spans',
  pulse: false,
  pulseHz: 20,
  dropBaseOnDrag: false,
  now: 0.55,
  others: 2,
};

const PASSES: readonly PassName[] = ['golden', 'high'];
const THEMES: readonly Theme[] = ['dark', 'night'];
const COLOR_SETS: readonly ColorSet[] = ['cool', 'warm', 'mono'];
const MERIDIAN_SETS: readonly MeridianSet[] = ['none', 'cardinal', 'eight', 'sixteen'];
const ENCODINGS: readonly Encoding[] = ['spans', 'atlas'];

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

function num(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | null, fallback: boolean): boolean {
  return value === null ? fallback : value === '1' || value === 'true';
}

/** Reads a composition from a query string. Unknown values fall back to `DEFAULTS`. */
export function read(search: string): Params {
  const q = new URLSearchParams(search);
  const g = (k: string) => q.get(k);
  const facing = g('facing');
  return {
    pass: oneOf(g('pass'), PASSES, DEFAULTS.pass),
    theme: oneOf(g('theme'), THEMES, DEFAULTS.theme),
    colorSet: oneOf(g('set'), COLOR_SETS, DEFAULTS.colorSet),
    tilt: num(g('tilt'), DEFAULTS.tilt),
    facing: facing === null || facing === '' ? null : num(facing, 0),
    width: num(g('width'), DEFAULTS.width),
    cols: Math.max(20, Math.round(num(g('cols'), DEFAULTS.cols))),
    base: bool(g('base'), DEFAULTS.base),
    baseRatio: num(g('baseratio'), DEFAULTS.baseRatio),
    ambient: num(g('ambient'), DEFAULTS.ambient),
    key: num(g('key'), DEFAULTS.key),
    ground: bool(g('ground'), DEFAULTS.ground),
    bowl: bool(g('bowl'), DEFAULTS.bowl),
    sunAlt: num(g('sunalt'), DEFAULTS.sunAlt),
    sunAz: num(g('sunaz'), DEFAULTS.sunAz),
    moon: bool(g('moon'), DEFAULTS.moon),
    moonAlt: num(g('moonalt'), DEFAULTS.moonAlt),
    moonAz: num(g('moonaz'), DEFAULTS.moonAz),
    moonPhase: num(g('moonphase'), DEFAULTS.moonPhase),
    meridians: oneOf(g('mer'), MERIDIAN_SETS, DEFAULTS.meridians),
    ticks: bool(g('ticks'), DEFAULTS.ticks),
    ringLabels: bool(g('ringlabels'), DEFAULTS.ringLabels),
    timeLabels: bool(g('timelabels'), DEFAULTS.timeLabels),
    horizonWeight: num(g('wh'), DEFAULTS.horizonWeight),
    ringWeight: num(g('wr'), DEFAULTS.ringWeight),
    meridianWeight: num(g('wm'), DEFAULTS.meridianWeight),
    passWeight: num(g('wp'), DEFAULTS.passWeight),
    dimWeight: num(g('wd'), DEFAULTS.dimWeight),
    passDensity: num(g('density'), DEFAULTS.passDensity),
    colors: bool(g('colors'), DEFAULTS.colors),
    tol: num(g('tol'), DEFAULTS.tol),
    downscale: num(g('downscale'), DEFAULTS.downscale),
    encoding: oneOf(g('encoding'), ENCODINGS, DEFAULTS.encoding),
    pulse: bool(g('pulse'), DEFAULTS.pulse),
    pulseHz: num(g('pulsehz'), DEFAULTS.pulseHz),
    dropBaseOnDrag: bool(g('dropbase'), DEFAULTS.dropBaseOnDrag),
    now: num(g('now'), DEFAULTS.now),
    others: Math.max(0, Math.round(num(g('others'), DEFAULTS.others))),
  };
}

const KEYS: Record<string, (p: Params) => string | number | boolean | null> = {
  pass: (p) => p.pass,
  theme: (p) => p.theme,
  set: (p) => p.colorSet,
  tilt: (p) => p.tilt,
  facing: (p) => p.facing,
  width: (p) => p.width,
  cols: (p) => p.cols,
  base: (p) => p.base,
  baseratio: (p) => p.baseRatio,
  ambient: (p) => p.ambient,
  key: (p) => p.key,
  ground: (p) => p.ground,
  bowl: (p) => p.bowl,
  sunalt: (p) => p.sunAlt,
  sunaz: (p) => p.sunAz,
  moon: (p) => p.moon,
  moonalt: (p) => p.moonAlt,
  moonaz: (p) => p.moonAz,
  moonphase: (p) => p.moonPhase,
  mer: (p) => p.meridians,
  ticks: (p) => p.ticks,
  ringlabels: (p) => p.ringLabels,
  timelabels: (p) => p.timeLabels,
  wh: (p) => p.horizonWeight,
  wr: (p) => p.ringWeight,
  wm: (p) => p.meridianWeight,
  wp: (p) => p.passWeight,
  wd: (p) => p.dimWeight,
  density: (p) => p.passDensity,
  colors: (p) => p.colors,
  tol: (p) => p.tol,
  downscale: (p) => p.downscale,
  encoding: (p) => p.encoding,
  pulse: (p) => p.pulse,
  pulsehz: (p) => p.pulseHz,
  dropbase: (p) => p.dropBaseOnDrag,
  now: (p) => p.now,
  others: (p) => p.others,
};

/** The query string for a composition: only the knobs that differ from `DEFAULTS`, so a candidate reads as its own diff. */
export function toQuery(params: Params): string {
  const q = new URLSearchParams();
  for (const [key, get] of Object.entries(KEYS)) {
    const value = get(params);
    const fallback = get(DEFAULTS);
    if (value === fallback) continue;
    q.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value === null ? '' : String(value));
  }
  return q.toString();
}

export const withDefaults = (patch: Partial<Params>): Params => ({ ...DEFAULTS, ...patch });
