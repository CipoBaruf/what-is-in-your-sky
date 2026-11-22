/**
 * FR-MEAS-2 (D-1147): the route a load opened on, as `open`'s detail — read from the hash the way `App` reads it,
 * so no hash and one that names no route are the live page (FR-LAND-1). It cannot see a pass: a `#pass` hash is
 * `pass` whether or not the run still holds that pass.
 */
import { routeOfHash } from '../lib/shareLinks';
import type { MeasureDetail } from '../model/measure';

export function openedRoute(hash: string): MeasureDetail<'open'> {
  return routeOfHash(hash) ?? 'live';
}
