/**
 * FR-MEAS-2 (D-1147): the route a load opened on, as `open`'s detail — read from the hash the way `App`'s route hooks
 * read it, so a `#live?…` that does not parse is the home page `App` draws for it. It cannot see a pass: a `#pass`
 * hash is `pass` whether or not the run still holds that pass.
 */
import { isLiveRoute, isPassPageRoute, isSettingsRoute, isStarsRoute, liveLinkFromHash, parseHash } from '../lib/shareLinks';
import type { MeasureDetail } from '../model/measure';

export function openedRoute(hash: string): MeasureDetail<'open'> {
  if (isLiveRoute(hash)) return hash.replace(/^#/, '') === 'live' || liveLinkFromHash(hash) !== null ? 'live' : 'home';
  if (isSettingsRoute(hash)) return 'settings';
  if (isStarsRoute(hash)) return 'stars';
  if (isPassPageRoute(hash)) return 'pass';
  const parsed = parseHash(hash);
  return parsed?.kind === 'passId' || parsed?.kind === 'pass' ? 'pass' : 'home';
}
