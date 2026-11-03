/**
 * FR-LOC-1 (c) as amended 2026-11-02 (PLAN D-1025): the town nearest a device
 * fix, looked up on the device. `places.txt` (`scripts/build-places.ts`, from
 * GeoNames' `cities15000`) is read once into columns and a 1° grid; a lookup
 * reads the cells around the fix and returns the nearest town by great-circle
 * distance, or `null` when none is within `NEAR_PLACE_MAX_KM` — the
 * coordinates are then the honest label. Pure: the fetch is `nearestTown.ts`'s.
 */

/** Farther than this, a town is not "near" the reader and the coordinates stay the label. */
export const NEAR_PLACE_MAX_KM = 50;

const EARTH_RADIUS_KM = 6371;
const CELL_DEG = 1;
const LAT_CELLS = 180 / CELL_DEG;
const LON_CELLS = 360 / CELL_DEG;

export interface NearPlace {
  /** GeoNames' name for the town, e.g. "Cipolletti". */
  name: string;
  /** ISO 3166-1 alpha-2, e.g. "AR". */
  country: string;
  /** Great-circle distance from the fix, km. */
  km: number;
}

export interface Places {
  size: number;
  names: string[];
  countries: string[];
  /** Index into `countries` per town. */
  country: Uint16Array;
  /** Hundredths of a degree. */
  lat: Int16Array;
  lon: Int16Array;
  /** Towns by cell: the towns of cell `c` are `order[start[c]] … order[start[c + 1] - 1]`. */
  start: Uint32Array;
  order: Uint32Array;
}

const latCell = (latDeg: number): number => Math.min(LAT_CELLS - 1, Math.max(0, Math.floor((latDeg + 90) / CELL_DEG)));
const lonCell = (lonDeg: number): number => (((Math.floor((lonDeg + 180) / CELL_DEG) % LON_CELLS) + LON_CELLS) % LON_CELLS);

/** Reads `places.txt`: `=CC` opens a country, then `name<TAB>Δlat<TAB>Δlon` in hundredths from the line before. Throws on a malformed line. */
export function parsePlaces(text: string): Places {
  const names: string[] = [];
  const countries: string[] = [];
  const country: number[] = [];
  const lat: number[] = [];
  const lon: number[] = [];
  let a = 0;
  let o = 0;
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('=')) {
      countries.push(line.slice(1));
      a = 0;
      o = 0;
      continue;
    }
    const [name, dLat, dLon] = line.split('\t');
    a += Number(dLat);
    o += Number(dLon);
    if (!name || countries.length === 0 || !Number.isFinite(a) || !Number.isFinite(o)) throw new Error(`places: bad line "${line}"`);
    names.push(name);
    country.push(countries.length - 1);
    lat.push(a);
    lon.push(o);
  }
  const size = names.length;
  const cellOf = (i: number): number => latCell((lat[i] ?? 0) / 100) * LON_CELLS + lonCell((lon[i] ?? 0) / 100);
  const start = new Uint32Array(LAT_CELLS * LON_CELLS + 1);
  for (let i = 0; i < size; i++) {
    const next = cellOf(i) + 1;
    start[next] = (start[next] ?? 0) + 1;
  }
  for (let c = 0; c < LAT_CELLS * LON_CELLS; c++) start[c + 1] = (start[c + 1] ?? 0) + (start[c] ?? 0);
  const fill = start.slice(0, -1);
  const order = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    const cell = cellOf(i);
    const at = fill[cell] ?? 0;
    order[at] = i;
    fill[cell] = at + 1;
  }
  return { size, names, countries, country: Uint16Array.from(country), lat: Int16Array.from(lat), lon: Int16Array.from(lon), start, order };
}

const RAD = Math.PI / 180;

/** Haversine distance, km. */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const s = Math.sin(((lat2 - lat1) * RAD) / 2);
  const t = Math.sin(((lon2 - lon1) * RAD) / 2);
  const h = s * s + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * t * t;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest town within `maxKm` of the fix, or `null`. */
export function nearestPlace(places: Places, latDeg: number, lonDeg: number, maxKm = NEAR_PLACE_MAX_KM): NearPlace | null {
  // The cells that can hold a town within `maxKm`: the latitude span is fixed, the longitude span widens
  // towards the poles (and is the whole circle past the cosine's floor).
  const spanLat = Math.ceil(maxKm / (EARTH_RADIUS_KM * RAD) / CELL_DEG);
  const nearestCos = Math.cos(Math.min(90, Math.abs(latDeg) + spanLat * CELL_DEG) * RAD);
  const spanLon = nearestCos < 0.01 ? LON_CELLS : Math.min(LON_CELLS, Math.ceil(maxKm / (EARTH_RADIUS_KM * RAD * nearestCos) / CELL_DEG));
  const row = latCell(latDeg);
  const col = lonCell(lonDeg);
  const cols = spanLon * 2 + 1 >= LON_CELLS ? Array.from({ length: LON_CELLS }, (_, c) => c) : Array.from({ length: spanLon * 2 + 1 }, (_, k) => (((col - spanLon + k) % LON_CELLS) + LON_CELLS) % LON_CELLS);
  let best = -1;
  let bestKm = maxKm;
  for (let r = Math.max(0, row - spanLat); r <= Math.min(LAT_CELLS - 1, row + spanLat); r++) {
    for (const c of cols) {
      const cell = r * LON_CELLS + c;
      for (let k = places.start[cell] ?? 0; k < (places.start[cell + 1] ?? 0); k++) {
        const i = places.order[k] ?? 0;
        const km = greatCircleKm(latDeg, lonDeg, (places.lat[i] ?? 0) / 100, (places.lon[i] ?? 0) / 100);
        if (km <= bestKm) {
          bestKm = km;
          best = i;
        }
      }
    }
  }
  if (best < 0) return null;
  return { name: places.names[best] ?? '', country: places.countries[places.country[best] ?? 0] ?? '', km: bestKm };
}
