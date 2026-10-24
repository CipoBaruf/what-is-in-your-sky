import { compassPoint, type CompassPoint } from '../../../lib/compass';
import { INTL_LOCALE } from '../../../i18n/locale';
import type { StarCatalog } from '../../../data/stars/catalog';
import { CONSTELLATION_NAMES, figureName } from '../../../data/stars/constellations';
import type { StarsAt } from '../../../lib/skyStars';
import type { Locale } from '../../../model';
import { project, type Mat3, type View } from '../../components/guide/skychart/window/projection';
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
  /** A star's proper name or designation; `null` for a planet, whose name is the reader's language's. */
  name: string | null;
  planet: Planet | null;
  mag: number;
  altDeg: number;
  point: CompassPoint;
}

export interface FieldInput {
  catalog: Pick<StarCatalog, 'size' | 'mag' | 'name' | 'desig'>;
  positions: Pick<StarsAt, 'altDeg' | 'azDeg' | 'planets'>;
  rotation: Mat3;
  view: View;
  layers: Pick<StarField['layers'], 'stars' | 'planets'>;
}

/** Whether a sky direction is drawn in the box: in front of the camera, inside the box, and above the horizon (the ground hides the rest). */
function drawn(rotation: Mat3, view: View, azDeg: number, altDeg: number): boolean {
  if (altDeg < 0) return false;
  const p = project(rotation, azDeg, altDeg, view);
  return p.front && p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;
}

/** A star's name on the page: the IAU proper name, or the designation where it has none (FR-STAR-7). */
function starName(catalog: Pick<StarCatalog, 'name' | 'desig'>, i: number): string {
  const name = catalog.name[i] ?? '';
  return name === '' ? (catalog.desig[i] ?? '') : name;
}

/**
 * FR-STAR-7: the `FIELD_LIST_MAX` brightest objects drawn in the field,
 * brightest first. The catalogue is sorted by magnitude (D-748), so the walk
 * stops at the twelfth star in the box; the planets are merged in by their
 * magnitude at the instant. A layer that is off draws nothing, so lists
 * nothing. An unmeasured box draws nothing either.
 */
export function fieldObjects({ catalog, positions, rotation, view, layers }: FieldInput): FieldObject[] {
  if (view.width <= 0 || view.height <= 0) return [];
  const found: FieldObject[] = [];
  if (layers.stars) {
    for (let i = 0; i < catalog.size && found.length < FIELD_LIST_MAX; i += 1) {
      const altDeg = positions.altDeg[i] ?? -90;
      const azDeg = positions.azDeg[i] ?? 0;
      if (!drawn(rotation, view, azDeg, altDeg)) continue;
      found.push({ index: i, name: starName(catalog, i), planet: null, mag: catalog.mag[i] ?? 99, altDeg, point: compassPoint(azDeg) });
    }
  }
  if (layers.planets) {
    positions.planets.forEach((planet, k) => {
      if (drawn(rotation, view, planet.azDeg, planet.altDeg)) found.push({ index: catalog.size + k, name: null, planet: planet.body, mag: planet.mag, altDeg: planet.altDeg, point: compassPoint(planet.azDeg) });
    });
  }
  return found.sort((a, b) => a.mag - b.mag).slice(0, FIELD_LIST_MAX);
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
    const part = parts > 1 ? (figureName(figure.con, figure.part)?.split(' ').at(-1) ?? '') : '';
    return { con: figure.con, part, segments };
  });
  const shaped: StarField['catalog'] = { ra: catalog.ra, dec: catalog.dec, mag: catalog.mag, name: catalog.name, desig: catalog.desig, con: catalog.con, figures };
  converted.set(catalog, shaped);
  return shaped;
}
