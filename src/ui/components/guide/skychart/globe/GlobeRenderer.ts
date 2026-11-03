import type { StarCatalog } from '../../../../../data/stars/catalog';
import { DOT_RADIUS_PX, FIELD_DETAIL_STEPS, MOON_DISC_PX, STAR_DOT_MAG } from '../../../../../data/stars/constants';
import type { DeepCatalog } from '../../../../../data/stars/deepChunk';
import { STARS_PAGE_CATALOGS } from '../../../../../i18n/starsPageT';
import { CATALOGS } from '../../../../../i18n/useT';
import { compassPoint, type CompassPoint } from '../../../../../lib/compass';
import { degrees } from '../../../../../lib/format';
import { figureName, PLANETS, starName } from '../../../../../lib/skyStars';
import type { EpochMs, Locale, Observer } from '../../../../../model';
import { formatStarMag } from '../../../../screens/stars/field';
import { inkOffsetPx } from '../window/inkOffsets';
import { limbAngleDeg, litPath } from '../window/MoonDisc';
import { COLLISION_PX, dotRadiusPx, hitLine, hitTest, markFor, planetMarkFor, toneToken, type Point, type ToneToken } from '../window/starGlyphs';
import { ADVANCE_EM, placeLabels, STAR_NAME_PX, textWidth, type Box, type FigureLabel, type FixedLabel, type LabelMark, type LabelSegment, type MarkLabel } from '../window/starLabels';
import { GLOBE_DIM_OPACITY, GLOBE_GRID_STEP_DEG, GLOBE_GROUND_OPACITY, GLOBE_RADIUS_SHARE } from './constants';
import { add, dot, ECLIPTIC_POLE, EQUATORIAL, greatCircle, groundPath, meridian, normalize, parallel, pathOf, project, projector, radec, scale, type Frame, type Projector, type Vec3 } from './projection';
import { altAz, figureAnchor, globeSky, starVectors, surfaceAt, type GlobeSky } from './scene';
import styles from './SkyGlobe.module.css';

/**
 * R169 (FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-4, FR-GLOBE-10, FR-GLOBE-11,
 * FR-GLOBE-13, FR-GLOBE-14; PLAN D-744, D-751, D-1038, D-1041): the globe's
 * SVG, built once with `createElementNS` and written per frame outside React —
 * the window's ref path, ported from the spike's `renderer.ts`
 * (`spike-stars-desktop`) onto R167's geometry and the sheet's tokens.
 *
 * **The nodes are fixed at mount.** The disc and the ground; the grid, the
 * ecliptic and the Milky Way as one path each; one figure path per side of the
 * horizon; one `<text>` per star to `STAR_DOT_MAG` (the `*` marks) and per
 * named star and figure; the Sun, the Moon (`MoonDisc`'s geometry) and the
 * five planets, each with a name node; the horizon, the compass, the zenith
 * and the poles; and the 40 dot paths. Every dot star — the bright catalogue's
 * past `STAR_DOT_MAG` and, once `setDeep` lands, the deep chunk's 7 373 — is a
 * zero-length round-capped segment in one of those paths, keyed by its tone,
 * the nearest of `DOT_STEPS` and its side of the horizon, so the faint stars
 * add no node and the count stays under `GLOBE_MAX_NODES`
 * (`GlobeRenderer.test.ts` holds it).
 *
 * **A frame runs only when something moved.** `set(change)` merges a change
 * and, where a field differs, schedules one `requestAnimationFrame`; the frame
 * projects every direction, writes `d`, `x`, `y`, `visibility`, the dimmed
 * class and the opacities by ref, and places the names by `placeLabels` with
 * R168's two options (the bodies' names fixed after the compass, the poles and
 * the zenith; a figure's walk from its own vertex). There is no idle loop.
 *
 * **The ground side is dimmed, never cut.** What is below the shown place's
 * horizon keeps its node and takes `styles.dim` and `GLOBE_DIM_OPACITY` as an
 * attribute (FR-DS-2 admits a unitless opacity); the near disc's part below
 * the horizon is shaded in `--chart-ground` at `GLOBE_GROUND_OPACITY`.
 *
 * Colours are the stylesheet's classes over the tokens FR-GLOBE-14 names;
 * nothing here sets one. The words are the catalogs' for `state.lang`
 * (`chart.globe`, and the stars page's planets and readout line), written
 * when the language changes.
 */

export type Turn = 'you' | 'stars';

/** FR-GLOBE-10: the page's four layers, as the window has them. */
export interface GlobeLayers {
  stars: boolean;
  figures: boolean;
  planets: boolean;
  names: boolean;
}

type PlanetName = (typeof PLANETS)[number];

/** FR-GLOBE-11: what a hover, a tap or a click names. A figure keeps the segment hit, so its label stands beside that line. */
export type GlobeTarget = { kind: 'star'; index: number } | { kind: 'planet'; body: PlanetName } | { kind: 'sun' } | { kind: 'moon' } | { kind: 'figure'; index: number; segment: number };

function targetKey(target: GlobeTarget | null): string {
  if (target === null) return '';
  switch (target.kind) {
    case 'star':
      return `star:${String(target.index)}`;
    case 'planet':
      return `planet:${target.body}`;
    case 'figure':
      return `figure:${String(target.index)}`;
    default:
      return target.kind;
  }
}

export const sameTarget = (a: GlobeTarget | null, b: GlobeTarget | null): boolean => targetKey(a) === targetKey(b);

/** Everything a frame reads: the place, the instant, the view, the layers and the box. `set` merges a change. */
export interface GlobeState {
  place: Observer;
  t: EpochMs;
  /** FR-GLOBE-5: the frame the view is held in — the place's local frame (`you`) or the equatorial one (`stars`). */
  turn: Turn;
  /** The view centre's longitude and latitude in that frame, degrees. */
  lon: number;
  lat: number;
  zoom: number;
  layers: GlobeLayers;
  /** FR-GLOBE-10: whether the deep stars are drawn (once `setDeep` has handed them in). */
  faint: boolean;
  lang: Locale;
  /** The measured box, px. */
  width: number;
  height: number;
  /** FR-GLOBE-11: the named object, or none. */
  named: GlobeTarget | null;
}

type Body = GlobeSky['sun'];
type Attrs = Record<string, string | number | undefined>;

const TONES: readonly ToneToken[] = ['chart-star-blue', 'chart-star', 'chart-star-yellow', 'chart-star-orange'];
/** FR-GLOBE-4: the five dot sizes a bucket stands for, `DOT_RADIUS_PX.faint` to `.bright` in even steps; a dot takes the nearest. */
export const DOT_STEPS: readonly number[] = Array.from({ length: 5 }, (_, k) => Math.round((DOT_RADIUS_PX.faint + ((DOT_RADIUS_PX.bright - DOT_RADIUS_PX.faint) * k) / 4) * 100) / 100);
/** The stars whose proper name has a node: the window's base row (`FIELD_DETAIL_STEPS`' first `nameMag`). */
const NAMED_MAG = FIELD_DETAIL_STEPS[0]?.[2] ?? 1.5;
/** How far a pole's or the zenith's word stands above its `+`, px of the drawing. */
const MARK_WORD_DY = -12;
/** A mark on the rim is drawn from this depth, so a compass point or a pole does not flicker at the limb. */
const RIM_DEPTH = 0.02;
/** A body's disc as the placer's mark: the disc's diameter as an em box of `ADVANCE_EM` cells. */
const DISC_MARK_PX = MOON_DISC_PX / ADVANCE_EM;
/** The limb point a degree from the Moon toward the Sun (`MoonDisc`'s `LIMB_STEP_DEG`), radians. */
const LIMB_RAD = Math.PI / 180;
/** The horizon's samples. */
const HORIZON_STEPS = 240;

const fmt = (n: number): string => n.toFixed(1);
/** The sheet's class for a name; the name itself where the module has none (a test without the sheet). */
const cls = (name: string): string => styles[name] ?? name;
const DIM = cls('dim');

/** A child of `parent` in the SVG namespace — the root `<svg>`'s own, so no namespace string is written here. */
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent: Element): SVGElementTagNameMap[K] {
  const node = parent.ownerDocument.createElementNS(parent.namespaceURI, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) node.setAttribute(k, String(v));
  parent.appendChild(node);
  return node;
}

function text(className: string, words: string, attrs: Attrs, parent: Element): SVGTextElement {
  const node = el('text', { class: className, ...attrs }, parent);
  node.textContent = words;
  return node;
}

/** One dot bucket: its tone, its size step, its members as flat J2000 xyz (the bright catalogue's first, the deep stars after `bright`), and its two paths. */
export interface DotBucket {
  tone: ToneToken;
  r: number;
  dirs: number[];
  /** How many numbers of `dirs` are the bright catalogue's (three per star); the rest are the deep chunk's. */
  bright: number;
  above: SVGPathElement;
  below: SVGPathElement;
}

interface GlyphStar {
  index: number;
  node: SVGTextElement;
  px: number;
}

interface FigureNode {
  index: number;
  node: SVGTextElement;
  /** The figure's first segment's slot in `lines`, and how many it has. */
  first: number;
  count: number;
}

interface BodyNode {
  target: BodyTarget;
  /** The hit slot: `n + k` for a planet, then the Sun's and the Moon's. */
  slot: number;
  mark: SVGElement;
  name: SVGTextElement;
  /** The planet's `@`, for its size; the Sun and the Moon have none. */
  glyph: SVGTextElement | null;
  px: number;
}

interface NamedParts {
  name: string;
  mag: string;
  altitude: string;
  point: CompassPoint;
}

interface Words {
  label: string;
  zenith: string;
  poles: { north: string; south: string };
  sun: string;
  moon: string;
  planets: Readonly<Record<PlanetName, string>>;
  mag: (p: { mag: string }) => string;
  named: (p: NamedParts) => string;
  namedBelow: (p: NamedParts) => string;
  bodyUp: (p: BodyParts) => string;
  bodyBelow: (p: BodyParts) => string;
}

type BodyParts = Omit<NamedParts, 'mag'>;
type BodyTarget = Extract<GlobeTarget, { kind: 'planet' | 'sun' | 'moon' }>;

/** A planet's, the Sun's or the Moon's name in `w`'s language. */
const bodyWord = (w: Words, target: BodyTarget): string => (target.kind === 'planet' ? w.planets[target.body] : target.kind === 'sun' ? w.sun : w.moon);

function wordsFor(lang: Locale): Words {
  const page = STARS_PAGE_CATALOGS[lang];
  return { ...CATALOGS[lang].chart.globe, planets: page.planets, mag: page.mag, named: page.named };
}

/** FR-GLOBE-5: the frame the view is held in — the equatorial one turning with the stars, the place's local one at `t` turning with you. */
export function frameFor(turn: Turn, place: Observer, t: EpochMs): Frame {
  return turn === 'stars' ? EQUATORIAL : globeSky(place, t).frame;
}

/** The projector a state draws with: the frame by `turn`, the centre of the box, the radius by `GLOBE_RADIUS_SHARE` and the zoom. */
export function projectorFor(s: Pick<GlobeState, 'place' | 't' | 'turn' | 'lon' | 'lat' | 'zoom' | 'width' | 'height'>): Projector {
  const w = Math.max(0, s.width);
  const h = Math.max(0, s.height);
  return projector({ frame: frameFor(s.turn, s.place, s.t), lon: s.lon, lat: s.lat }, w / 2, h / 2, Math.min(w, h) * GLOBE_RADIUS_SHARE * s.zoom);
}

/** A figure segment is on the ground side when its midpoint (the sum of its ends) is: one rule for its line and its name. */
const segmentBelow = (mid: Vec3, zenith: Vec3): boolean => dot(mid, zenith) < 0;

const starDirOf = (dirs: Float64Array, i: number): Vec3 => [dirs[3 * i] ?? 0, dirs[3 * i + 1] ?? 0, dirs[3 * i + 2] ?? 0];

function figureWord(catalog: StarCatalog, f: number, lang: Locale): string {
  const figure = catalog.figures[f];
  return figure ? (figureName(catalog, figure.con, figure.part, lang) ?? figure.con) : '';
}

function bodyOf(sky: GlobeSky, target: GlobeTarget): Body | undefined {
  switch (target.kind) {
    case 'planet':
      return sky.planets.find((q) => q.body === target.body);
    case 'sun':
      return sky.sun;
    case 'moon':
      return sky.moon;
    default:
      return undefined;
  }
}

/** The label beside a named mark: a star's or a planet's name with its magnitude, the Sun's or the Moon's word, a figure's name. */
function labelLine(catalog: StarCatalog, s: Pick<GlobeState, 'place' | 't' | 'lang'>, target: GlobeTarget): string {
  const w = wordsFor(s.lang);
  switch (target.kind) {
    case 'star':
      return `${starName(catalog, target.index, s.lang)} · ${w.mag({ mag: formatStarMag(catalog.mag[target.index] ?? 0, s.lang) })}`;
    case 'planet': {
      const planet = globeSky(s.place, s.t).planets.find((p) => p.body === target.body);
      return planet ? `${bodyWord(w, target)} · ${w.mag({ mag: formatStarMag(planet.mag, s.lang) })}` : bodyWord(w, target);
    }
    case 'sun':
    case 'moon':
      return bodyWord(w, target);
    default:
      return figureWord(catalog, target.index, s.lang);
  }
}

/**
 * FR-GLOBE-11: the readout's second line — "Canopus · mag −0.7 · 28° up · S", or "· 12° below · S" on the ground
 * side, the altitude and point at the shown place and instant; a figure's is its name. The Sun and the Moon carry
 * no magnitude: their line is `chart.globe`'s `bodyUp` / `bodyBelow`, the same sentence without the `mag` part.
 */
export function readoutLine(catalog: StarCatalog, s: Pick<GlobeState, 'place' | 't' | 'lang'>, target: GlobeTarget): string {
  const w = wordsFor(s.lang);
  const sky = globeSky(s.place, s.t);
  if (target.kind === 'figure') return figureWord(catalog, target.index, s.lang);
  let name: string;
  let mag: number | null;
  let altDeg: number;
  let azDeg: number;
  if (target.kind === 'star') {
    name = starName(catalog, target.index, s.lang);
    mag = catalog.mag[target.index] ?? 0;
    ({ altDeg, azDeg } = altAz(sky, starDirOf(starVectors(catalog), target.index)));
  } else {
    const body = bodyOf(sky, target);
    name = bodyWord(w, target);
    mag = target.kind === 'planet' ? (sky.planets.find((p) => p.body === target.body)?.mag ?? 0) : null;
    altDeg = body?.altDeg ?? 0;
    azDeg = body?.azDeg ?? 0;
  }
  const where: BodyParts = { name, altitude: degrees(Math.abs(altDeg)), point: compassPoint(azDeg) };
  if (mag === null) return altDeg >= 0 ? w.bodyUp(where) : w.bodyBelow(where);
  const parts: NamedParts = { ...where, mag: formatStarMag(mag, s.lang) };
  return altDeg >= 0 ? w.named(parts) : w.namedBelow(parts);
}

export class GlobeRenderer {
  readonly svg: SVGSVGElement;
  state: GlobeState;
  /** How many frames have been drawn: the tests' "no frame without a change". */
  frames = 0;
  /** FR-GLOBE-11: the marks as last drawn, `null` where hidden — stars at `i`, the planets at `n + k`, then the Sun and the Moon — for `targetAt`. */
  readonly hits: (Point | null)[];
  /** Each catalogue segment as last drawn, `null` where not, for the tap on a line. */
  readonly lines: (LabelSegment | null)[];
  /** The dot buckets, for the tests' segment counts. */
  readonly buckets: DotBucket[] = [];

  private readonly catalog: StarCatalog;
  private readonly dirs: Float64Array;
  private deep: DeepCatalog | null = null;
  private pending: number | null = null;
  private words: Words;
  private wordsLang: Locale;
  private projectorNow: Projector | null = null;
  private skyNow: GlobeSky | null = null;
  private readonly shown = new Map<Element, boolean>();
  private readonly dimmed = new Map<Element, boolean>();

  private readonly disc: SVGCircleElement;
  private readonly ground: SVGPathElement;
  private readonly gridPath: SVGPathElement;
  private readonly eclipticPath: SVGPathElement;
  private readonly milkyPath: SVGPathElement;
  private readonly figuresAbove: SVGPathElement;
  private readonly figuresBelow: SVGPathElement;
  private readonly horizon: SVGPathElement;
  private readonly glyphs: GlyphStar[] = [];
  private readonly starNames = new Map<number, SVGTextElement>();
  private readonly figureNodes: FigureNode[] = [];
  private readonly bodies: BodyNode[] = [];
  private readonly moonLit: SVGPathElement;
  private moonFraction = -1;
  private readonly label: SVGTextElement;
  private readonly compass: SVGTextElement[];
  private readonly zenith: SVGTextElement;
  private readonly zenithName: SVGTextElement;
  private readonly poles: [SVGTextElement, SVGTextElement];
  private readonly poleNames: [SVGTextElement, SVGTextElement];
  private readonly grid: Vec3[][];
  private readonly ecliptic: Vec3[];
  private readonly milky: Vec3[][];
  /** Every catalogue segment's star pair, flat, with the figure each belongs to. */
  private readonly segments: { a: number; b: number; figure: number }[] = [];
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  private readonly near: Uint8Array;
  private readonly up: Uint8Array;

  /** `svg` is the caller's empty `<svg>` (React's, in `SkyGlobe`): the renderer fills it and owns every child, never the root. */
  constructor(svg: SVGSVGElement, catalog: StarCatalog, state: GlobeState) {
    this.catalog = catalog;
    this.state = state;
    this.dirs = starVectors(catalog);
    const n = catalog.size;
    this.xs = new Float64Array(n);
    this.ys = new Float64Array(n);
    this.near = new Uint8Array(n);
    this.up = new Uint8Array(n);
    this.words = wordsFor(state.lang);
    this.wordsLang = state.lang;
    this.svg = svg;
    const g = (className: string, attrs: Attrs = {}): SVGGElement => el('g', { class: className, ...attrs }, this.svg);

    const base = g(cls('base'));
    this.disc = el('circle', { class: cls('disc'), 'data-disc': '' }, base);
    this.ground = el('path', { class: cls('ground'), 'data-ground': '', 'fill-opacity': GLOBE_GROUND_OPACITY }, base);
    const lines = g(cls('lines'));
    this.gridPath = el('path', { class: cls('grid'), 'data-grid': '' }, lines);
    this.eclipticPath = el('path', { class: cls('ecliptic'), 'data-ecliptic': '' }, lines);
    this.milkyPath = el('path', { class: cls('milky'), 'data-milky-way': '' }, lines);
    this.figuresBelow = el('path', { class: `${cls('figures')} ${DIM}`, 'data-figures': 'below', opacity: GLOBE_DIM_OPACITY }, lines);
    this.figuresAbove = el('path', { class: cls('figures'), 'data-figures': 'above' }, lines);

    // FR-GLOBE-4: the 40 dot paths, 4 tones × 5 sizes × 2 sides; a bucket's stroke is twice its radius.
    const dots = g(cls('dots'), { 'data-dots': '' });
    for (const tone of TONES) {
      for (const r of DOT_STEPS) {
        const attrs = { 'data-tone': tone, 'data-size': r, 'stroke-width': r * 2 };
        const below = el('path', { class: `${cls('dot')} ${DIM}`, 'data-side': 'below', opacity: GLOBE_DIM_OPACITY, ...attrs }, dots);
        const above = el('path', { class: cls('dot'), 'data-side': 'above', ...attrs }, dots);
        this.buckets.push({ tone, r, dirs: [], bright: 0, above, below });
      }
    }

    const stars = g(cls('marks'), { 'data-stars': '' });
    const names = g(cls('names'), { 'data-names': '' });
    for (let i = 0; i < n; i += 1) {
      const mag = catalog.mag[i] ?? 99;
      const mark = markFor(mag, catalog.bv[i]);
      if (mark.kind === 'char') {
        const { dx, dy } = inkOffsetPx(mark.glyph, mark.px);
        const node = text(cls('mark'), mark.glyph, { 'data-star': i, 'data-glyph': mark.glyph, 'data-px': mark.px, 'data-tone': mark.tone, 'font-size': mark.px, dx, dy, visibility: 'hidden' }, stars);
        this.glyphs.push({ index: i, node, px: mark.px });
        if (mag <= NAMED_MAG && catalog.name[i]) this.starNames.set(i, text(cls('starName'), '', { 'data-star-name': i, visibility: 'hidden' }, names));
      } else {
        this.bucketFor(mark.tone, mark.r).dirs.push(this.dirs[3 * i] ?? 0, this.dirs[3 * i + 1] ?? 0, this.dirs[3 * i + 2] ?? 0);
      }
    }
    for (const bucket of this.buckets) bucket.bright = bucket.dirs.length;
    catalog.figures.forEach((figure, f) => {
      const first = this.segments.length;
      for (let k = 0; k + 1 < figure.segments.length; k += 2) this.segments.push({ a: figure.segments[k] ?? 0, b: figure.segments[k + 1] ?? 0, figure: f });
      this.figureNodes.push({ index: f, node: text(cls('figureName'), '', { 'data-figure-name': f, 'data-con': figure.con, visibility: 'hidden' }, names), first, count: this.segments.length - first });
    });
    this.lines = this.segments.map(() => null);

    // The bodies: the planets as `@`, the Sun as a disc, the Moon as `MoonDisc`'s geometry; each with its name node.
    const bodies = g(cls('marks'), { 'data-bodies': '' });
    PLANETS.forEach((body, k) => {
      const px = planetMarkFor(0).px;
      const { dx, dy } = inkOffsetPx('@', px);
      const glyph = text(cls('mark'), '@', { 'data-planet': body, 'data-glyph': '@', 'data-px': px, 'data-tone': 'chart-planet', 'font-size': px, dx, dy, visibility: 'hidden' }, bodies);
      this.bodies.push({ target: { kind: 'planet', body }, slot: n + k, mark: glyph, glyph, px, name: text(cls('starName'), '', { 'data-body-name': body, visibility: 'hidden' }, names) });
    });
    const sun = el('circle', { class: cls('sun'), 'data-body': 'sun', r: MOON_DISC_PX / 2, visibility: 'hidden' }, bodies);
    this.bodies.push({ target: { kind: 'sun' }, slot: n + PLANETS.length, mark: sun, glyph: null, px: 0, name: text(cls('starName'), '', { 'data-body-name': 'sun', visibility: 'hidden' }, names) });
    const moon = el('g', { 'data-body': 'moon', visibility: 'hidden' }, bodies);
    el('circle', { class: cls('moonDark'), 'data-marker': 'moon', r: MOON_DISC_PX / 2 }, moon);
    this.moonLit = el('path', { class: cls('moonLit'), 'data-moon-lit': '' }, moon);
    this.bodies.push({ target: { kind: 'moon' }, slot: n + PLANETS.length + 1, mark: moon, glyph: null, px: 0, name: text(cls('starName'), '', { 'data-body-name': 'moon', visibility: 'hidden' }, names) });
    this.label = text(cls('starLabel'), '', { 'data-label': '', visibility: 'hidden' }, names);
    this.hits = Array.from({ length: n + PLANETS.length + 2 }, () => null);

    const top = g(cls('frame'), { 'data-frame': '' });
    this.horizon = el('path', { class: cls('horizon'), 'data-horizon': '' }, top);
    this.compass = ['N', 'E', 'S', 'W'].map((point) => text(cls('compass'), point, { 'data-compass': point, visibility: 'hidden' }, top));
    this.zenith = text(cls('cross'), '+', { 'data-zenith': '', visibility: 'hidden' }, top);
    this.zenithName = text(cls('compass'), '', { 'data-zenith-name': '', visibility: 'hidden' }, top);
    this.poles = [text(cls('cross'), '+', { 'data-pole': 'north', visibility: 'hidden' }, top), text(cls('cross'), '+', { 'data-pole': 'south', visibility: 'hidden' }, top)];
    this.poleNames = [text(cls('compass'), '', { 'data-pole-name': 'north', visibility: 'hidden' }, top), text(cls('compass'), '', { 'data-pole-name': 'south', visibility: 'hidden' }, top)];
    this.writeWords();

    const meridians: Vec3[][] = [];
    for (let ra = 0; ra < 360; ra += GLOBE_GRID_STEP_DEG) meridians.push(meridian(ra));
    const parallels: Vec3[][] = [];
    for (let dec = -90 + GLOBE_GRID_STEP_DEG; dec < 90; dec += GLOBE_GRID_STEP_DEG) parallels.push(parallel(dec));
    this.grid = [...meridians, ...parallels];
    this.ecliptic = greatCircle(ECLIPTIC_POLE);
    this.milky = catalog.milkyWay.map((ring) => ring.map(([ra, dec]) => radec(ra ?? 0, dec ?? 0)));
    // The first frame: a `set` that repeats the opening state changes nothing and schedules none.
    this.request();
  }

  /** The bucket a dot of `tone` and radius `r` goes in: the nearest of `DOT_STEPS`. */
  private bucketFor(tone: ToneToken, r: number): DotBucket {
    let best = 0;
    DOT_STEPS.forEach((step, k) => {
      if (Math.abs(step - r) < Math.abs((DOT_STEPS[best] ?? 0) - r)) best = k;
    });
    const bucket = this.buckets[TONES.indexOf(tone) * DOT_STEPS.length + best];
    if (!bucket) throw new Error('GlobeRenderer: no bucket for the tone');
    return bucket;
  }

  /** FR-GLOBE-10: the deep stars appended to the buckets; no node is made. They are drawn while `state.faint` is on. */
  setDeep(deep: DeepCatalog): void {
    if (this.deep === deep) return;
    this.deep = deep;
    for (const bucket of this.buckets) bucket.dirs.length = bucket.bright;
    const dirs = starVectors(deep);
    for (let i = 0; i < deep.size; i += 1) {
      this.bucketFor(toneToken(deep.bv[i]), dotRadiusPx(deep.mag[i] ?? 99)).dirs.push(dirs[3 * i] ?? 0, dirs[3 * i + 1] ?? 0, dirs[3 * i + 2] ?? 0);
    }
    this.request();
  }

  get deepSize(): number {
    return this.deep?.size ?? 0;
  }

  /** Merge a change; where a field differs, one frame is scheduled (D-1038: no frame without a change). Says whether one was. */
  set(change: Partial<GlobeState>): boolean {
    let changed = false;
    for (const key of Object.keys(change) as (keyof GlobeState)[]) {
      const next = change[key];
      const was = this.state[key];
      if (key === 'layers') {
        const a = was as GlobeLayers;
        const b = next as GlobeLayers;
        if (a.stars === b.stars && a.figures === b.figures && a.planets === b.planets && a.names === b.names) continue;
      } else if (key === 'named') {
        if (sameTarget(was as GlobeTarget | null, next as GlobeTarget | null)) continue;
      } else if (key === 'place') {
        const a = was as Observer;
        const b = next as Observer;
        if (a.lat === b.lat && a.lon === b.lon && a.altM === b.altM) continue;
      } else if (was === next) continue;
      changed = true;
    }
    if (!changed) return false;
    this.state = { ...this.state, ...change };
    this.request();
    return true;
  }

  /** One `requestAnimationFrame` at a time. */
  request(): void {
    if (this.pending !== null) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = null;
      this.draw();
    });
  }

  /** Stop: the pending frame is dropped and the SVG is emptied; the root stays the caller's. */
  dispose(): void {
    if (this.pending !== null) cancelAnimationFrame(this.pending);
    this.pending = null;
    this.svg.replaceChildren();
    this.svg.removeAttribute('aria-label');
    this.svg.removeAttribute('viewBox');
  }

  /** The last frame's projector, for the hand (a drag turns the globe in it) — `null` before the first frame. */
  get projector(): Projector | null {
    return this.projectorNow;
  }

  /** The last frame's sky, for the frame switch — `null` before the first frame. */
  get sky(): GlobeSky | null {
    return this.skyNow;
  }

  /** FR-GLOBE-11: what is under a box point, as last drawn — a mark within the hit distance, else a figure's line within it, else nothing. */
  targetAt(x: number, y: number): GlobeTarget | null {
    const mark = hitTest(this.hits, x, y);
    if (mark !== null) {
      if (mark < this.catalog.size) return { kind: 'star', index: mark };
      return this.bodies.find((b) => b.slot === mark)?.target ?? null;
    }
    if (!this.state.layers.figures) return null;
    const segment = hitLine(this.lines, x, y);
    if (segment === null) return null;
    return { kind: 'figure', index: this.segments[segment]?.figure ?? 0, segment };
  }

  /** `labelLine` for this state. */
  labelFor(target: GlobeTarget): string {
    return labelLine(this.catalog, this.state, target);
  }

  /** `readoutLine` for this state. */
  readoutFor(target: GlobeTarget): string {
    return readoutLine(this.catalog, this.state, target);
  }

  private figureWord(f: number): string {
    return figureWord(this.catalog, f, this.state.lang);
  }

  private starDir(i: number): Vec3 {
    return starDirOf(this.dirs, i);
  }

  /** The words in `state.lang`: the SVG's label, the names, the zenith's and the poles' labels. */
  private writeWords(): void {
    const { lang } = this.state;
    this.words = wordsFor(lang);
    this.wordsLang = lang;
    this.svg.setAttribute('aria-label', this.words.label);
    for (const [i, node] of this.starNames) node.textContent = starName(this.catalog, i, lang);
    for (const f of this.figureNodes) f.node.textContent = this.figureWord(f.index);
    for (const b of this.bodies) b.name.textContent = bodyWord(this.words, b.target);
    this.zenithName.textContent = this.words.zenith;
    const [north, south] = this.poleNames;
    north.textContent = this.words.poles.north;
    south.textContent = this.words.poles.south;
  }

  private show(node: Element, on: boolean): void {
    if (this.shown.get(node) === on) return;
    this.shown.set(node, on);
    node.setAttribute('visibility', on ? 'visible' : 'hidden');
  }

  /** FR-GLOBE-3: the dimmed class and `GLOBE_DIM_OPACITY` on what is below the horizon; neither on what is above. */
  private dim(node: Element, below: boolean): void {
    if (this.dimmed.get(node) === below) return;
    this.dimmed.set(node, below);
    node.classList.toggle(DIM, below);
    if (below) node.setAttribute('opacity', String(GLOBE_DIM_OPACITY));
    else node.removeAttribute('opacity');
  }

  private at(node: Element, x: number, y: number): void {
    node.setAttribute('x', fmt(x));
    node.setAttribute('y', fmt(y));
  }

  /** The frame: every direction projected and every node written. Public so a test can draw without waiting for a frame. */
  draw(): void {
    const s = this.state;
    if (s.lang !== this.wordsLang) this.writeWords();
    const sky = globeSky(s.place, s.t);
    this.skyNow = sky;
    const w = Math.max(0, s.width);
    const h = Math.max(0, s.height);
    const p = projectorFor(s);
    this.projectorNow = p;
    this.svg.setAttribute('viewBox', `0 0 ${String(w)} ${String(h)}`);
    const [zx, zy, zz] = sky.zenith;
    const { r: ar, u: au, c: ac } = p.axes;

    // The disc, its surface step (FR-GLOBE-13) and the ground (FR-GLOBE-3).
    this.disc.setAttribute('cx', fmt(p.cx));
    this.disc.setAttribute('cy', fmt(p.cy));
    this.disc.setAttribute('r', fmt(p.radius));
    this.disc.setAttribute('data-tint', surfaceAt(sky));
    this.ground.setAttribute('d', groundPath(p, sky.zenith));

    // The grid, the ecliptic, the Milky Way (FR-GLOBE-2).
    this.gridPath.setAttribute('d', this.grid.map((line) => pathOf(p, line)).join(''));
    this.eclipticPath.setAttribute('d', pathOf(p, this.ecliptic));
    this.milkyPath.setAttribute('d', this.milky.map((ring) => pathOf(p, ring)).join(''));

    // Every catalogue star projected once: the figures, the marks, the names and the hits read these.
    const n = this.catalog.size;
    const { xs, ys, near, up, dirs } = this;
    for (let i = 0; i < n; i += 1) {
      const x = dirs[3 * i] ?? 0;
      const y = dirs[3 * i + 1] ?? 0;
      const z = dirs[3 * i + 2] ?? 0;
      near[i] = x * ac[0] + y * ac[1] + z * ac[2] > 0 ? 1 : 0;
      up[i] = x * zx + y * zy + z * zz >= 0 ? 1 : 0;
      xs[i] = p.cx + p.radius * (x * ar[0] + y * ar[1] + z * ar[2]);
      ys[i] = p.cy - p.radius * (x * au[0] + y * au[1] + z * au[2]);
    }

    // The figures: a segment with both ends on the near side, on the side of the horizon its middle is on, each end
    // moved toward the other by the collision distance so a line never touches a star (D-754, as the window draws);
    // one shorter than the two gaps is not drawn.
    let dAbove = '';
    let dBelow = '';
    const drawnSegments: LabelSegment[] = [];
    this.segments.forEach((seg, k) => {
      const x1 = xs[seg.a] ?? 0;
      const y1 = ys[seg.a] ?? 0;
      const x2 = xs[seg.b] ?? 0;
      const y2 = ys[seg.b] ?? 0;
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (!s.layers.figures || !near[seg.a] || !near[seg.b] || length <= 2 * COLLISION_PX) {
        this.lines[k] = null;
        return;
      }
      const gap = COLLISION_PX / length;
      const line = { x1: x1 + (x2 - x1) * gap, y1: y1 + (y2 - y1) * gap, x2: x2 - (x2 - x1) * gap, y2: y2 - (y2 - y1) * gap };
      this.lines[k] = line;
      drawnSegments.push(line);
      const d = `M${fmt(line.x1)} ${fmt(line.y1)}L${fmt(line.x2)} ${fmt(line.y2)}`;
      const mid = add(this.starDir(seg.a), this.starDir(seg.b));
      if (segmentBelow(mid, sky.zenith)) dBelow += d;
      else dAbove += d;
    });
    this.figuresAbove.setAttribute('d', dAbove);
    this.figuresBelow.setAttribute('d', dBelow);

    // The dots (FR-GLOBE-4): one path per bucket and side; the deep members past `bright` only while `faint` is on.
    for (const bucket of this.buckets) {
      let above = '';
      let below = '';
      if (s.layers.stars) {
        const limit = s.faint ? bucket.dirs.length : bucket.bright;
        for (let k = 0; k + 2 < limit; k += 3) {
          const x = bucket.dirs[k] ?? 0;
          const y = bucket.dirs[k + 1] ?? 0;
          const z = bucket.dirs[k + 2] ?? 0;
          if (x * ac[0] + y * ac[1] + z * ac[2] <= 0) continue;
          const seg = `M${fmt(p.cx + p.radius * (x * ar[0] + y * ar[1] + z * ar[2]))} ${fmt(p.cy - p.radius * (x * au[0] + y * au[1] + z * au[2]))}h0`;
          if (x * zx + y * zy + z * zz >= 0) above += seg;
          else below += seg;
        }
      }
      bucket.above.setAttribute('d', above);
      bucket.below.setAttribute('d', below);
    }

    // The `*` marks, and the hits (a dot star is a hit at its point too, with no mark box: it is nameable, FR-GLOBE-11).
    const marks: LabelMark[] = [];
    const markOf = new Map<number, number>();
    const { hits } = this;
    for (let i = 0; i < n; i += 1) hits[i] = s.layers.stars && near[i] === 1 && (this.catalog.mag[i] ?? 0) > STAR_DOT_MAG ? { x: xs[i] ?? 0, y: ys[i] ?? 0 } : null;
    for (const glyph of this.glyphs) {
      const on = s.layers.stars && near[glyph.index] === 1;
      this.show(glyph.node, on);
      if (!on) continue;
      const x = xs[glyph.index] ?? 0;
      const y = ys[glyph.index] ?? 0;
      this.at(glyph.node, x, y);
      this.dim(glyph.node, up[glyph.index] === 0);
      hits[glyph.index] = { x, y };
      markOf.set(glyph.index, marks.length);
      marks.push({ x, y, sizePx: glyph.px });
    }

    // The bodies, from the sky (FR-GLOBE-4), with their fixed names (FR-GLOBE-11).
    const fixed: FixedLabel[] = [];
    const bodyBelow = new Map<number, boolean>();
    for (const b of this.bodies) {
      const body = bodyOf(sky, b.target);
      const on = body !== undefined && (b.target.kind !== 'planet' || s.layers.planets);
      const [x, y, depth] = body ? project(p, body.dir) : [0, 0, -1];
      const visible = on && depth > 0;
      this.show(b.mark, visible);
      hits[b.slot] = visible ? { x, y } : null;
      if (!visible || !body) continue;
      const below = body.altDeg < 0;
      bodyBelow.set(b.slot, below);
      this.dim(b.mark, below);
      if (b.glyph !== null) {
        const px = planetMarkFor('mag' in body ? (body as { mag: number }).mag : 0).px;
        if (px !== b.px) {
          b.px = px;
          const { dx, dy } = inkOffsetPx('@', px);
          b.glyph.setAttribute('font-size', String(px));
          b.glyph.setAttribute('data-px', String(px));
          b.glyph.setAttribute('dx', String(dx));
          b.glyph.setAttribute('dy', String(dy));
        }
        this.at(b.glyph, x, y);
      } else if (b.target.kind === 'sun') {
        b.mark.setAttribute('cx', fmt(x));
        b.mark.setAttribute('cy', fmt(y));
      } else {
        this.drawMoon(b.mark, p, sky, x, y);
      }
      markOf.set(b.slot, marks.length);
      marks.push({ x, y, sizePx: b.glyph !== null ? b.px : DISC_MARK_PX });
      fixed.push({ key: b.slot, mark: marks.length - 1, text: b.name.textContent ?? '' });
    }

    // The horizon, the compass, the zenith and the poles (FR-GLOBE-2, FR-GLOBE-3); their boxes are occupied before any name.
    this.horizon.setAttribute('d', pathOf(p, greatCircle(sky.zenith, HORIZON_STEPS)));
    const occupied: Box[] = [];
    const place = (node: SVGTextElement, v: Vec3, dy = 0, minDepth = 0): void => {
      const [x, y, z] = project(p, v);
      const on = z > minDepth;
      this.show(node, on);
      if (!on) return;
      this.at(node, x, y + dy);
      const width = textWidth(node.textContent ?? '', STAR_NAME_PX);
      occupied.push({ x0: x - width / 2, y0: y + dy - STAR_NAME_PX / 2, x1: x + width / 2, y1: y + dy + STAR_NAME_PX / 2 });
    };
    place(this.zenith, sky.zenith);
    place(this.zenithName, sky.zenith, MARK_WORD_DY);
    [sky.north, sky.east, scale(sky.north, -1), scale(sky.east, -1)].forEach((v, k) => {
      const node = this.compass[k];
      if (node) place(node, v, 0, RIM_DEPTH);
    });
    const southPole = scale(EQUATORIAL.pole, -1);
    place(this.poles[0], EQUATORIAL.pole, 0, RIM_DEPTH);
    place(this.poleNames[0], EQUATORIAL.pole, MARK_WORD_DY, RIM_DEPTH);
    place(this.poles[1], southPole, 0, RIM_DEPTH);
    place(this.poleNames[1], southPole, MARK_WORD_DY, RIM_DEPTH);

    // The names (FR-GLOBE-11): the named label, the bodies' fixed, the star names brightest first, the figures from their vertex.
    const drawn: (Point | null)[] = [];
    for (let i = 0; i < n; i += 1) drawn.push(near[i] === 1 && s.layers.stars ? { x: xs[i] ?? 0, y: ys[i] ?? 0 } : null);
    let named: MarkLabel | null = null;
    const target = s.named;
    if (target !== null) {
      const key = target.kind === 'star' ? target.index : target.kind === 'figure' ? -(target.index + 1) : (this.bodies.find((b) => sameTarget(b.target, target))?.slot ?? -1);
      let mark = markOf.get(key);
      const hit = target.kind === 'star' ? hits[target.index] : null;
      if (mark === undefined && hit) {
        // A dot star: a mark of no size at its point, as the window names a hidden glyph at its own point.
        mark = marks.length;
        marks.push({ x: hit.x, y: hit.y, sizePx: 0 });
      } else if (mark === undefined && target.kind === 'figure') {
        const line = this.figureLine(target);
        if (line) {
          mark = marks.length;
          marks.push({ x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2, sizePx: 0 });
        }
      }
      if (mark !== undefined) named = { key, mark, text: this.labelFor(target) };
    }
    const starLabels: MarkLabel[] = [];
    const figureLabels: FigureLabel[] = [];
    const anchorUp = new Map<number, boolean>();
    if (s.layers.names) {
      // Brightest first: the map was filled in catalogue order, which is magnitude order (D-748).
      for (const [i, node] of this.starNames) {
        const mark = markOf.get(i);
        if (mark !== undefined) starLabels.push({ key: i, mark, text: node.textContent ?? '' });
      }
      if (s.layers.figures) {
        for (const f of this.figureNodes) {
          const figure = this.catalog.figures[f.index];
          if (!figure) continue;
          let count = 0;
          const ends = new Set<number>();
          for (let k = 0; k < f.count; k += 1) {
            const seg = this.segments[f.first + k];
            if (!seg || !this.lines[f.first + k]) continue;
            count += 1;
            ends.add(seg.a);
            ends.add(seg.b);
          }
          if (count < 2) continue;
          const endpoints = [...ends].map((i) => ({ x: xs[i] ?? 0, y: ys[i] ?? 0 }));
          const anchor = figureAnchor(figure, drawn);
          if (anchor) anchorUp.set(f.index, up[anchor.index] === 1);
          figureLabels.push({ key: f.index, name: f.node.textContent ?? figure.con, con: figure.con, segments: count, endpoints, ...(anchor ? { anchor: { x: anchor.x, y: anchor.y } } : {}) });
        }
      }
    }
    const placed = placeLabels({ width: w, height: h, marks, segments: drawnSegments, compass: occupied, named, stars: starLabels, figures: figureLabels, lang: s.lang }, { fixed: s.layers.names ? fixed : [], figureStart: 'vertex' });
    const shown = new Set<Element>();
    for (const label of placed) {
      let node: SVGTextElement | undefined;
      let below = false;
      if (label.kind === 'named') {
        node = this.label;
        if (node.textContent !== label.text) node.textContent = label.text;
        below = target !== null && this.isBelow(target, sky);
      } else if (label.kind === 'fixed') {
        node = this.bodies.find((b) => b.slot === label.key)?.name;
        below = bodyBelow.get(label.key) ?? false;
      } else if (label.kind === 'star') {
        node = this.starNames.get(label.key);
        below = up[label.key] === 0;
      } else if (label.kind === 'figure') {
        node = this.figureNodes[label.key]?.node;
        if (node && node.textContent !== label.text) node.textContent = label.text;
        below = anchorUp.get(label.key) === false;
      }
      if (!node) continue;
      this.at(node, label.x, label.y);
      this.dim(node, below);
      this.show(node, true);
      shown.add(node);
    }
    const hide = (node: Element): void => {
      if (!shown.has(node)) this.show(node, false);
    };
    hide(this.label);
    for (const node of this.starNames.values()) hide(node);
    for (const f of this.figureNodes) hide(f.node);
    for (const b of this.bodies) hide(b.name);
    this.frames += 1;
  }

  /** The named figure's segment: the one hit while it is drawn, else the figure's first drawn one, else none. */
  private figureLineIndex(target: { index: number; segment: number }): number | null {
    if (this.lines[target.segment]) return target.segment;
    const f = this.figureNodes[target.index];
    if (!f) return null;
    for (let k = 0; k < f.count; k += 1) if (this.lines[f.first + k]) return f.first + k;
    return null;
  }

  /** The named figure's line, the label's segment. */
  private figureLine(target: { index: number; segment: number }): LabelSegment | null {
    const k = this.figureLineIndex(target);
    return k === null ? null : (this.lines[k] ?? null);
  }

  /** Whether the named target is on the ground side, for its label's dimming; a figure's by the side its line is drawn on (the segment's midpoint, as `draw` splits the lines). */
  private isBelow(target: GlobeTarget, sky: GlobeSky): boolean {
    if (target.kind === 'star') return this.up[target.index] === 0;
    if (target.kind === 'figure') {
      const seg = this.segments[this.figureLineIndex(target) ?? target.segment];
      return seg !== undefined && segmentBelow(add(this.starDir(seg.a), this.starDir(seg.b)), sky.zenith);
    }
    return (bodyOf(sky, target)?.altDeg ?? 0) < 0;
  }

  /** FR-LOOK-7: the Moon's disc with its phase — the lit path by the fraction, turned toward the Sun's side on the drawing. */
  private drawMoon(group: SVGElement, p: Projector, sky: GlobeSky, x: number, y: number): void {
    const { state } = sky.moon;
    const r = MOON_DISC_PX / 2;
    if (state.illuminatedFraction !== this.moonFraction) {
      this.moonFraction = state.illuminatedFraction;
      this.moonLit.setAttribute('d', litPath(state.illuminatedFraction, r));
      group.setAttribute('data-phase', state.phase);
      group.setAttribute('data-lit', state.illuminatedFraction.toFixed(2));
    }
    // A degree from the Moon toward the Sun along the great circle between them; its projection says which way the limb faces.
    const m = sky.moon.dir;
    const sun = sky.sun.dir;
    const along = dot(m, sun);
    const t: Vec3 = [sun[0] - along * m[0], sun[1] - along * m[1], sun[2] - along * m[2]];
    const len = Math.hypot(t[0], t[1], t[2]);
    let angle = -90;
    if (len > 1e-9) {
      const limb = normalize(add(scale(m, Math.cos(LIMB_RAD)), scale(t, Math.sin(LIMB_RAD) / len)));
      const [lx, ly] = project(p, limb);
      angle = limbAngleDeg({ x, y }, { x: lx, y: ly });
    }
    group.setAttribute('transform', `translate(${fmt(x)} ${fmt(y)})`);
    group.setAttribute('data-limb', String(Math.round(angle)));
    this.moonLit.setAttribute('transform', `rotate(${fmt(angle)})`);
  }
}
