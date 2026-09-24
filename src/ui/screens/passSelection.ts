import { useMemo } from 'react';
import { SAME_PASS_TOLERANCE_MS, SETTINGS_HASH, isSettingsRoute, nearestPassOf, parseHash, passIdHash, passIdOf, type PassLink } from '../../lib/shareLinks';
import type { Pass } from '../../model';
import { close, open, useHash } from '../navigation';

/**
 * PLAN D-13: no router; the selected pass id is mirrored to the URL hash as
 * `#pass=<id>` so a reload (and a share link) reopens the same pass. The hash
 * is the source of truth: opening pushes it (a history entry, so the
 * browser's Back closes the sheet), and closing goes back past it (R92).
 *
 * R31 (D-83): the grammar itself moved to `lib/shareLinks.ts`, which owns
 * `#pass=<id>` beside FR-SHARE-1's `#pass?lat=…&norad=…&start=…` and
 * FR-LIVE-9's `#live?…`. This file keeps what is about *selecting* a pass: the
 * hash subscription, and matching an id to a recomputed pass. A share link
 * selects a pass too — `link` is what it names, and the screen resolves it
 * through `resolvePassLink` so FR-SHARE-3's fallback has somewhere to happen.
 */
export { SAME_PASS_TOLERANCE_MS };

/** The pass id a hash selects: written out in `#pass=<id>`, and derived from the object and the instant in a share link. */
export function passIdFromHash(hash: string): string | null {
  const parsed = parseHash(hash);
  if (parsed === null) return null;
  if (parsed.kind === 'passId') return parsed.passId;
  if (parsed.kind === 'pass') return passIdOf(parsed);
  return null;
}

/** The shared pass a hash names, if it is a share link rather than a local selection (FR-SHARE-1). */
export function passLinkFromHash(hash: string): PassLink | null {
  const parsed = parseHash(hash);
  return parsed?.kind === 'pass' ? parsed : null;
}

/**
 * The pass the id names. Ids are `${noradId}-${start.t}`; a recompute from
 * a new "now" moves the coarse grid and can shift a boundary by a second, so
 * when there is no exact match the same object's pass starting within the
 * tolerance is accepted (D-33).
 */
export function findSelectedPass(passes: readonly Pass[], id: string | null): Pass | null {
  if (id === null) return null;
  const exact = passes.find((p) => p.id === id);
  if (exact) return exact;
  const m = /^(\d+)-(\d+)$/.exec(id);
  if (!m) return null;
  const nearest = nearestPassOf(passes, Number(m[1]), Number(m[2]));
  return nearest !== null && Math.abs(nearest.start.t - Number(m[2])) <= SAME_PASS_TOLERANCE_MS ? nearest : null;
}

export interface PassSelection {
  selectedId: string | null;
  /** Set while the hash is a share link; `null` for a local selection. */
  link: PassLink | null;
  open: (passId: string) => void;
  close: () => void;
}


/**
 * R52 (FR-COMP-2, US-20, D-184): the third route, read the way the other two
 * are. `#settings` is a screen, not a state — it survives a reload, the
 * browser's Back leaves it, and `Esc` and the page's own `[ ← Back ]` close it.
 *
 * The route exists at every width (FR-COMP-2); only the compact header links to
 * it (US-20 AC5), which is the header's business and not this file's.
 *
 * R92 (FR-ROUTE-1, D-533): neither this route nor the pass selection writes
 * the history itself. Opening is `navigation.open`, a marked entry; closing is
 * `navigation.close`, which goes back to it — so an open-and-close leaves the
 * history as it found it, and one press of the browser's Back leaves the app.
 */
export interface SettingsRoute {
  active: boolean;
  /** Opens the page, as a history entry, so the browser's Back closes it (US-20 AC4). */
  enter: () => void;
  /** Returns to where the page was opened from (FR-ROUTE-1). */
  leave: () => void;
}

const enterSettings = (): void => {
  open(SETTINGS_HASH);
};

export function useSettingsRoute(): SettingsRoute {
  const hash = useHash();
  return useMemo(() => ({ active: isSettingsRoute(hash), enter: enterSettings, leave: close }), [hash]);
}

const openPass = (passId: string): void => {
  open(passIdHash(passId));
};

export function usePassSelection(): PassSelection {
  const hash = useHash();
  // Parsed once per hash, not once per render: `link` is a fresh object every
  // time it is parsed, and the screen resolves the shared pass from it.
  const selection = useMemo(() => ({ selectedId: passIdFromHash(hash), link: passLinkFromHash(hash) }), [hash]);
  return useMemo(() => ({ ...selection, open: openPass, close }), [selection]);
}
