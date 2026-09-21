import type { EpochMs, Observer } from '../model';
import { observerFromLink, parseHash, sameHashPlace, type LiveLink, type PassLink } from '../lib/shareLinks';
import { activeObserver } from './slices/location';
import type { AppStore } from './store';

/**
 * R83 (FR-VISIT-1..4, FR-SHARE-3, D-539): one reading of a link, for the boot
 * and for a hash pasted into a running tab alike, which ends the split where a
 * pasted pass link was dropped and a pasted live link adopted (F-93).
 *
 * - `own`: the link names the saved place, at the rounding the hash carries
 *   (D-280, D-295), for a pass link as for a live one. Nothing about the saved
 *   place changes.
 * - `visit`: a saved place and a link for another one. The link's place is this
 *   tab's observer and is never stored (D-538).
 * - `adopt`: no saved place, so the link's becomes it, as before.
 * - `unreadable`: a known route (`#pass…`, `#live?…`) that does not parse.
 * - `unknown`: a hash that is none of the app's routes.
 *
 * `#live`, `#settings`, `#pass=<id>` and no hash at all are routes that carry
 * no place, and answer `null`: there is no link to report on.
 *
 * `note` is FR-VISIT-3's, for a live link's `t`: `past` when the clock is
 * already beyond it, `far` when it is further ahead than the stripe's span.
 */
export type LinkKind = 'own' | 'visit' | 'adopt' | 'unreadable' | 'unknown';
export type LinkNote = 'past' | 'far';

export interface ReadLink {
  kind: 'own' | 'visit' | 'adopt';
  link: PassLink | LiveLink;
  note?: LinkNote;
}

export type OpenLinkResult = ReadLink | { kind: 'unreadable' | 'unknown' };

const isRead = (result: OpenLinkResult): result is ReadLink => 'link' in result;

/** The span the live page's stripe draws, from now (FR-LIVE-2's `LIVE_WINDOW_MS`, which `src/state` cannot import). */
export const LINK_SPAN_MS = 24 * 3_600_000;

/** The hash's text without the `#`, and whether it is one of the routes that carry no place. */
function routeOf(hash: string): { text: string; placeless: boolean } {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  const placeless = text === '' || text === 'live' || text === 'settings' || (text.startsWith('pass=') && parseHash(text)?.kind === 'passId');
  return { text, placeless };
}

function noteFor(link: PassLink | LiveLink, now: EpochMs): LinkNote | undefined {
  if (link.kind !== 'live' || link.t === null) return undefined;
  if (link.t < now) return 'past';
  if (link.t > now + LINK_SPAN_MS) return 'far';
  return undefined;
}

export function openLink(hash: string, saved: Observer | null, now: EpochMs): OpenLinkResult | null {
  const { text, placeless } = routeOf(hash);
  if (placeless) return null;
  const parsed = parseHash(text);
  if (parsed === null || parsed.kind === 'passId') {
    const known = text.startsWith('pass?') || text.startsWith('pass=') || text.startsWith('live?');
    return { kind: known ? 'unreadable' : 'unknown' };
  }
  const note = noteFor(parsed, now);
  const kind = saved === null ? 'adopt' : sameHashPlace(saved, parsed.observer) ? 'own' : 'visit';
  return note === undefined ? { kind, link: parsed } : { kind, link: parsed, note };
}

/**
 * Applies what `openLink` answered to the store, and keeps the answer in the
 * ui slice (a `null` leaves the last one there: `#live` and a closed pass are
 * not new links). The saved place is the store's `observer`, which the
 * write-through keeps equal to `wiys:prefs:v1`.
 *
 * A link for the place already on screen — the same visit again, or the hash
 * FR-LIVE-9 writes while scrubbing — changes nothing, so the compute chain is
 * not restarted for the sky it is already showing (R39, D-280).
 */
export function applyLink(store: AppStore, result: OpenLinkResult | null): void {
  if (result === null) return;
  const state = store.getState();
  state.setLinkResult(result);
  if (!isRead(result)) return;
  if (result.kind === 'own') {
    // Pasted over a visit, the saved place comes back; the hash stays, since it may select a pass.
    // The same observer object goes back in, so the write-through writes nothing.
    if (state.visiting !== null) state.setObserver(state.observer);
    return;
  }
  if (sameHashPlace(activeObserver(state), result.link.observer)) return;
  const linked = observerFromLink(result.link);
  if (result.kind === 'visit') state.visit(linked);
  // `adopt`: nothing is saved, so the link's place is stored like any other (FR-LOC-5).
  else state.setObserver(linked);
}

/** The running tab's path (F-93): a hash that changed under the page is read like one the tab booted on. */
export function followHash(store: AppStore, hash: string, now: EpochMs): OpenLinkResult | null {
  const result = openLink(hash, store.getState().observer, now);
  applyLink(store, result);
  return result;
}
