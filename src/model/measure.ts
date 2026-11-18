/**
 * FR-MEAS-1, FR-MEAS-2 (D-1145): the closed list of what a visit may count, read by the browser's sender and the route alike.
 * It imports nothing, so the Worker route can bundle it without the app. It cannot widen itself: a name or a detail is
 * added only by amending FR-MEAS-2's table, and every value here but `id` comes from a list below (FR-MEAS-5).
 */
export const EVENTS = {
  open: ['home', 'pass', 'live', 'stars', 'settings'],
  where_shown: [],
  place_set: ['search', 'coords', 'device', 'favourite', 'link'],
  device_refused: ['denied', 'unavailable', 'timeout'],
  search_empty: [],
  when_shown: [],
  what_shown: [],
  door: ['satellites', 'stars', 'live'],
  pass_open: [],
  live_open: [],
  stars_open: [],
  sky_screen_open: [],
  settings_open: [],
  follow_answer: ['allow', 'not_now', 'refused'],
  no_passes: [],
  failure: ['elements', 'forecast', 'search', 'passes', 'live'],
} as const satisfies Record<string, readonly string[]>;

export type MeasureName = keyof typeof EVENTS;
/** The details a name allows; `never` for a name that takes none. */
export type MeasureDetail<N extends MeasureName> = (typeof EVENTS)[N][number];

export const VISITS = ['first', 'return'] as const;
export const LAYOUTS = ['compact', 'wide'] as const;
export const LANGS = ['en', 'es'] as const;
/** A load's random id: 16 hex characters, made in memory and never stored (FR-MEAS-1). */
export const ID_PATTERN = /^[0-9a-f]{16}$/;

/** What is fixed at load and rides on every event of that load. */
export interface MeasureContext {
  visit: (typeof VISITS)[number];
  layout: (typeof LAYOUTS)[number];
  lang: (typeof LANGS)[number];
  id: string;
}

/** FR-MEAS-1's six fields: one name with one of its details (or none), and the load's context. */
export type MeasureEvent = {
  [N in MeasureName]: MeasureContext & { name: N } & ([MeasureDetail<N>] extends [never] ? { detail?: never } : { detail?: MeasureDetail<N> });
}[MeasureName];

const KEYS = new Set(['name', 'detail', 'visit', 'layout', 'lang', 'id']);

const within = (list: readonly string[], value: unknown): boolean => typeof value === 'string' && list.includes(value);

/** D-1145: the runtime guard. Exactly the known keys, every value in its list, `detail` only where the name takes one. */
export function isMeasureEvent(value: unknown): value is MeasureEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => KEYS.has(key))) return false;
  const name = record['name'];
  if (typeof name !== 'string' || !Object.hasOwn(EVENTS, name)) return false;
  const detail = record['detail'];
  if (detail !== undefined && !within(EVENTS[name as MeasureName], detail)) return false;
  return within(VISITS, record['visit']) && within(LAYOUTS, record['layout']) && within(LANGS, record['lang']) && typeof record['id'] === 'string' && ID_PATTERN.test(record['id']);
}
