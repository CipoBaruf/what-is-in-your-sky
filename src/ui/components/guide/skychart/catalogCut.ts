import type { StarField } from './window/scene';

/**
 * D-748's prefix cut, the one copy: the catalogue to a magnitude, shared by
 * the views' caps (`layers.ts`'s `sceneFor`) and the scene's twilight step
 * (`useSkyScene`, R123). Its own module so the scene hook, which the main
 * chunk carries for the pass detail, takes these few lines and not the table.
 */
type Catalog = StarField['catalog'];

/** The first `n` of a column. */
export function prefix<T>(column: ArrayLike<T>, n: number): ArrayLike<T> {
  return n >= column.length ? column : Array.prototype.slice.call(column, 0, n);
}

/**
 * How far into the catalogue a cap reaches: one past the last star at `cap` or
 * brighter. In D-748's magnitude order that is exactly the stars at the cap;
 * out of order, no bright star is lost behind a faint one, and a missing or
 * NaN magnitude never counts — `starsFor` holds the cap star by star.
 */
function reach(mag: ArrayLike<number>, cap: number): number {
  for (let i = mag.length - 1; i >= 0; i -= 1) if ((mag[i] ?? Number.NaN) <= cap) return i + 1;
  return 0;
}

/** The catalogue cut to each cap, once per catalogue: only the positions change from tick to tick. */
const cuts = new WeakMap<Catalog, Map<number, Catalog>>();

/**
 * The catalogue cut to the stars at `cap` or brighter (D-748's prefix), with no figures — a figure's segments
 * index the whole catalogue. Memoised per catalogue and cap, so a memo on the cut holds from tick to tick.
 */
export function cutCatalog(catalog: Catalog, cap: number): Catalog {
  let byCap = cuts.get(catalog);
  if (!byCap) {
    byCap = new Map();
    cuts.set(catalog, byCap);
  }
  let cut = byCap.get(cap);
  if (!cut) {
    const n = reach(catalog.mag, cap);
    cut = {
      ra: prefix(catalog.ra, n),
      dec: prefix(catalog.dec, n),
      mag: prefix(catalog.mag, n),
      name: catalog.name.slice(0, n),
      desig: catalog.desig.slice(0, n),
      con: catalog.con.slice(0, n),
      figures: [],
    };
    byCap.set(cap, cut);
  }
  return cut;
}

