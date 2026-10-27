import { cutTrack, type ArcState } from '../../../lib/arcReveal';
import { compassPoint, type CompassPoint } from '../../../lib/compass';
import { INTL_LOCALE } from '../../../i18n/locale';
import type { StarCatalog } from '../../../data/stars/catalog';
import { CONSTELLATION_NAMES } from '../../../data/stars/constellations';
import type { LegendColor, LegendPass, LegendRow } from '../../../lib/legend';
import { resampleArc } from '../../../lib/skyGeometry';
import { figureName, starName, type StarNamesSource, type StarsAt } from '../../../lib/skyStars';
import type { EpochMs, Locale, PassPoint } from '../../../model';
import { drawableDeg, project, type Mat3, type Projected, type View } from '../../components/guide/skychart/window/projection';
import type { StarField } from '../../components/guide/skychart/window/scene';

/**
 * R115 (FR-STAR-7, FR-STAR-3; D-756): the page's arithmetic over the field —
 * what of the catalogue is drawn in the box at the camera's rotation, the
 * `FIELD_LIST_MAX` brightest of it for `In this field`, the magnitude as the
 * page prints it, and the catalogue in the shape the window's scene types.
 * Pure: the page hands in the rotation, the box and the positions at the shown
 * instant; nothing here reads a clock or the DOM.
 */

/** FR-STAR-7: `In this field` lists at most this many objects, brightest first. */
export const FIELD_LIST_MAX = 12;

/** FR-STAR-7: a label, and the row that set it, clear after this many seconds. */
export const STAR_LABEL_HOLD_S = 4;

type Planet = StarsAt['planets'][number]['body'];

/** One object drawn in the field. `index` is `namedStar`'s value: a catalogue index, or past the catalogue's length a planet's (D-750's convention). */
export interface FieldObject {
  index: number;
  /** A star's name in the reader's language (`starName`, D-832); `null` for a planet, whose name is the page catalog's. */
  name: string | null;
  planet: Planet | null;
  mag: number;
  altDeg: number;
  point: CompassPoint;
}

export interface FieldInput {
  catalog: Pick<StarCatalog, 'size' | 'mag'> & StarNamesSource;
  positions: Pick<StarsAt, 'altDeg' | 'azDeg' | 'planets'>;
  rotation: Mat3;
  view: View;
  layers: Pick<StarField['layers'], 'stars' | 'planets'>;
  /** FR-STAR-10 as amended v2.5 (D-832): the language a star is named in. */
  lang: Locale;
}

/** Whether a sky direction is drawn in the box: in front of the camera, inside the box, and above the horizon (the ground hides the rest). */
function drawn(rotation: Mat3, view: View, azDeg: number, altDeg: number): boolean {
  if (altDeg < 0) return false;
  const p = project(rotation, azDeg, altDeg, view);
  return p.front && p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;
}

/**
 * FR-STAR-7: the `FIELD_LIST_MAX` brightest objects drawn in the field,
 * brightest first. The catalogue is sorted by magnitude (D-748), so the walk
 * stops at the twelfth star in the box; the planets are merged in by their
 * magnitude at the instant. A layer that is off draws nothing, so lists
 * nothing. An unmeasured box draws nothing either. A star is named through
 * `starName` in the reader's language (R126, D-832): `Sirio`, `Canopo`.
 */
export function fieldObjects({ catalog, positions, rotation, view, layers, lang }: FieldInput): FieldObject[] {
  if (view.width <= 0 || view.height <= 0) return [];
  const found: FieldObject[] = [];
  if (layers.stars) {
    for (let i = 0; i < catalog.size && found.length < FIELD_LIST_MAX; i += 1) {
      const altDeg = positions.altDeg[i] ?? -90;
      const azDeg = positions.azDeg[i] ?? 0;
      if (!drawn(rotation, view, azDeg, altDeg)) continue;
      found.push({ index: i, name: starName(catalog, i, lang), planet: null, mag: catalog.mag[i] ?? 99, altDeg, point: compassPoint(azDeg) });
    }
  }
  if (layers.planets) {
    positions.planets.forEach((planet, k) => {
      if (drawn(rotation, view, planet.azDeg, planet.altDeg)) found.push({ index: catalog.size + k, name: null, planet: planet.body, mag: planet.mag, altDeg: planet.altDeg, point: compassPoint(planet.azDeg) });
    });
  }
  return found.sort((a, b) => a.mag - b.mag).slice(0, FIELD_LIST_MAX);
}

/** FR-LEG-3's three words, the states a pass row in `In this field` can be in. */
type FieldPassState = Extract<ArcState, 'ahead' | 'live' | 'linger'>;

const isFieldPassState = (state: string): state is FieldPassState => state === 'ahead' || state === 'live' || state === 'linger';

/** FR-SKY-6 (D-794): one pass in `In this field` — its legend key and colour, its name, its FR-LEG-3 state, and where its peak is. */
export interface FieldPass {
  id: string;
  key: string;
  color: LegendColor;
  name: string;
  state: FieldPassState;
  peakAltDeg: number;
  peakPoint: CompassPoint;
}

export interface FieldPassesInput {
  passes: readonly LegendPass[];
  /** The legend's rows over the same passes (`legendRows`, `colorBy: 'pass'`), computed once by the page for the window's keys and this list. */
  rows: readonly LegendRow[];
  rotation: Mat3;
  view: View;
  now: EpochMs;
}

/** The window's arc step (`SkyWindow`'s `ARC_STEP_DEG`): the arc is drawn as straight segments between these samples. */
const ARC_STEP_DEG = 2;

/** Liang–Barsky: whether the segment from `a` to `b` crosses the box `[0, width] × [0, height]`. */
function segmentInBox(a: Projected, b: Projected, view: View): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let lo = 0;
  let hi = 1;
  const edges: [number, number][] = [
    [-dx, a.x],
    [dx, view.width - a.x],
    [-dy, a.y],
    [dy, view.height - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) lo = Math.max(lo, r);
    else hi = Math.min(hi, r);
    if (lo > hi) return false;
  }
  return true;
}

/**
 * Whether any part of an arc, as the window draws it, is in the box: the track
 * resampled at the window's step and each segment between two drawable samples
 * (in front, inside the drawable field, above the horizon) tested against the
 * box, so an arc that only crosses a zoomed-in field between two samples counts.
 */
function arcInField(track: readonly PassPoint[], rotation: Mat3, view: View): boolean {
  const limitDeg = drawableDeg(view);
  let previous: Projected | null = null;
  for (const point of resampleArc(track, ARC_STEP_DEG)) {
    const p = project(rotation, point.azDeg, point.elDeg, view);
    const ok = point.elDeg >= 0 && p.front && p.offAxisDeg <= limitDeg && Number.isFinite(p.x) && Number.isFinite(p.y);
    if (!ok) {
      previous = null;
      continue;
    }
    if (segmentInBox(previous ?? p, p, view)) return true;
    previous = p;
  }
  return false;
}

/**
 * FR-SKY-6 (D-794): the passes drawn in the field, ahead of the stars, in the
 * legend's order and with the legend's keys and colours (the rows the page
 * computed over the same passes the window is given, `colorBy: 'pass'`). A
 * pass is in the field when any part of the arc the window draws at `now` is:
 * the part flown so far while it is up (`cutTrack`), the whole track before and
 * after; above the horizon, in front and in the box. A pass with no FR-LEG-3
 * word for its state (`'full'`, an arc handed in with no state) is not listed:
 * this page hands every pass with its state at now.
 */
export function fieldPasses({ passes, rows, rotation, view, now }: FieldPassesInput): FieldPass[] {
  if (view.width <= 0 || view.height <= 0) return [];
  const byId = new Map(passes.map((pass) => [pass.id, pass]));
  const found: FieldPass[] = [];
  for (const row of rows) {
    const pass = byId.get(row.passId);
    const { state } = row;
    if (pass === undefined || !isFieldPassState(state)) continue;
    const track = state === 'live' ? cutTrack(pass, now) : pass.track;
    if (!arcInField(track, rotation, view)) continue;
    found.push({ id: pass.id, key: row.key, color: row.colorToken, name: pass.name, state, peakAltDeg: pass.peak.elDeg, peakPoint: compassPoint(pass.peak.azDeg) });
  }
  return found;
}

/**
 * FR-STAR-7's twelve rows with the passes in them (R126, D-825): the passes in
 * the field first, then the brightest objects in what is left of
 * `FIELD_LIST_MAX`, so the list is never longer than twelve.
 */
export function fieldRows(passes: readonly FieldPass[], objects: readonly FieldObject[]): { passes: readonly FieldPass[]; objects: readonly FieldObject[] } {
  const listed = passes.slice(0, FIELD_LIST_MAX);
  return { passes: listed, objects: objects.slice(0, FIELD_LIST_MAX - listed.length) };
}

/**
 * FR-STAR-7's magnitude: one decimal in the language's decimal mark, the
 * typographic minus, no plus — `mag 0.6`, `mag −0.7`, `mag 1,3` in Spanish.
 * The pass card's `formatMagnitude` signs both ways; a star's is read as a
 * brightness, and the sky atlases print it so.
 */
export function formatStarMag(mag: number, locale: Locale): string {
  const rounded = Math.round(mag * 10) / 10;
  const digits = new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(rounded));
  return rounded < 0 ? `−${digits}` : digits;
}

/**
 * The catalogue as the window's scene types it (`scene.ts`, R113): figures
 * with their segments as index pairs and their part as a word, `Caput` and
 * `Cauda` for the halves of Serpens. The reader's catalogue stores the
 * segments flat and the part as a number (`catalog.ts`, R112); the two lanes
 * agreed on the shape without importing each other's file, so the page — the
 * one place both meet — converts once and keeps the result.
 */
const converted = new WeakMap<StarCatalog, StarField['catalog']>();

export function sceneCatalog(catalog: StarCatalog): StarField['catalog'] {
  const known = converted.get(catalog);
  if (known) return known;
  const figures = catalog.figures.map((figure) => {
    const segments: (readonly [number, number])[] = [];
    for (let k = 0; k + 1 < figure.segments.length; k += 2) segments.push([figure.segments[k] ?? 0, figure.segments[k + 1] ?? 0]);
    // A constellation drawn in parts (Serpens alone) names each by its last word, `Serpens Caput` → `Caput`; a whole one is `''`.
    const parts = CONSTELLATION_NAMES[figure.con]?.length ?? 1;
    const part = parts > 1 ? (figureName(catalog, figure.con, figure.part, 'en')?.split(' ').at(-1) ?? '') : '';
    return { con: figure.con, part, segments };
  });
  const shaped: StarField['catalog'] = { ra: catalog.ra, dec: catalog.dec, mag: catalog.mag, name: catalog.name, desig: catalog.desig, con: catalog.con, figures };
  converted.set(catalog, shaped);
  return shaped;
}
