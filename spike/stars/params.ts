/**
 * R111 (D-740): every knob of the stars spike is a URL parameter, so a capture
 * or a phone run is one address.
 *
 *   render=react|ref       positions through React state, or written to the nodes by ref
 *   mark=glyph|disc        FR-STAR-6's characters, or discs
 *   layers=stars,figures,planets,names
 *   mag=4.5                the faintest star drawn
 *   big=15 small=12        the ladder's two sizes, px
 *   collide=0.5            the collision distance, a fraction of the small size
 *   dot=period|middle      the faint steps' glyph: `.` (FR-STAR-6) or `·`
 *   inkfix=0|1             shift each glyph so its ink, not its em box, is centred on the point
 *   source=hand|sensor     the camera
 *   facing=180 tilt=35     the hand camera's start (facing defaults to the pole side)
 *   fov=60                 degrees across the shorter side
 *   at=<ISO instant>       default now
 *   site=neuquen|paris|singapore, or lat=&lon=
 */
import { WINDOW_FOV } from '../../src/ui/components/guide/skychart/window/projection';
import { SITES, type SiteName } from './sky';

export type Layer = 'stars' | 'figures' | 'planets' | 'names';
export const LAYERS: readonly Layer[] = ['stars', 'figures', 'planets', 'names'];

export interface StarsParams {
  render: 'react' | 'ref';
  mark: 'glyph' | 'disc';
  layers: readonly Layer[];
  mag: number;
  big: number;
  small: number;
  collide: number;
  dot: 'period' | 'middle';
  inkfix: boolean;
  source: 'hand' | 'sensor';
  facing: number | null;
  tilt: number;
  fov: number;
  at: string | null;
  site: SiteName | null;
  lat: number;
  lon: number;
}

export const STARS_DEFAULTS: StarsParams = {
  render: 'react',
  mark: 'glyph',
  layers: LAYERS,
  mag: 4.5,
  big: 15,
  small: 12,
  collide: 0.5,
  dot: 'period',
  inkfix: false,
  source: 'hand',
  facing: null,
  tilt: 35,
  fov: WINDOW_FOV,
  at: null,
  site: 'neuquen',
  lat: SITES.neuquen.lat,
  lon: SITES.neuquen.lon,
};

const num = (q: URLSearchParams, key: string, fallback: number): number => {
  const raw = q.get(key);
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const isSite = (s: string | null): s is SiteName => s !== null && s in SITES;

export function readStarsParams(search: string): StarsParams {
  const q = new URLSearchParams(search);
  const d = STARS_DEFAULTS;
  const hasCoords = q.has('lat') && q.has('lon');
  const siteParam = q.get('site');
  const site = hasCoords ? null : isSite(siteParam) ? siteParam : d.site;
  const coords = site === null ? { lat: num(q, 'lat', d.lat), lon: num(q, 'lon', d.lon) } : SITES[site];
  const layers = q.get('layers');
  return {
    render: q.get('render') === 'ref' ? 'ref' : 'react',
    mark: q.get('mark') === 'disc' ? 'disc' : 'glyph',
    layers: layers === null ? d.layers : LAYERS.filter((l) => layers.split(',').includes(l)),
    mag: num(q, 'mag', d.mag),
    big: num(q, 'big', d.big),
    small: num(q, 'small', d.small),
    collide: num(q, 'collide', d.collide),
    dot: q.get('dot') === 'middle' ? 'middle' : 'period',
    inkfix: q.get('inkfix') === '1',
    source: q.get('source') === 'sensor' ? 'sensor' : 'hand',
    facing: q.has('facing') ? num(q, 'facing', 0) : null,
    tilt: num(q, 'tilt', d.tilt),
    fov: num(q, 'fov', d.fov),
    at: q.get('at'),
    site,
    lat: coords.lat,
    lon: coords.lon,
  };
}

export function starsQuery(p: StarsParams): string {
  const q = new URLSearchParams();
  const d = STARS_DEFAULTS;
  if (p.render !== d.render) q.set('render', p.render);
  if (p.mark !== d.mark) q.set('mark', p.mark);
  if (p.layers.join(',') !== d.layers.join(',')) q.set('layers', p.layers.join(','));
  for (const key of ['mag', 'big', 'small', 'collide', 'tilt', 'fov'] as const) if (p[key] !== d[key]) q.set(key, String(p[key]));
  if (p.dot !== d.dot) q.set('dot', p.dot);
  if (p.inkfix) q.set('inkfix', '1');
  if (p.source !== d.source) q.set('source', p.source);
  if (p.facing !== null) q.set('facing', String(p.facing));
  if (p.at !== null) q.set('at', p.at);
  if (p.site !== null) {
    if (p.site !== d.site) q.set('site', p.site);
  } else {
    q.set('lat', String(p.lat));
    q.set('lon', String(p.lon));
  }
  return q.toString();
}

/** FR-STAR-3's default facing: the pole side, where the field is never empty. */
export const defaultFacing = (lat: number): number => (lat < 0 ? 180 : 0);
