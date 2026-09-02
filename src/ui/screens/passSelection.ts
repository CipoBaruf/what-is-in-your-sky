import { useCallback, useEffect, useState } from 'react';
import type { Pass } from '../../model';

/**
 * PLAN D-13: no router; the selected pass id is mirrored to the URL hash as
 * `#pass=<id>` so a reload (and a v1 share link) reopens the same pass. The
 * hash is the source of truth: opening assigns it (a history entry, so the
 * browser's Back closes the sheet), closing clears it in place.
 */
export const HASH_PREFIX = '#pass=';

export function passIdFromHash(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const id = decodeURIComponent(hash.slice(HASH_PREFIX.length));
  return id === '' ? null : id;
}

/** How far a pass start may drift from the id in the hash and still count as the same pass (D-31). */
export const SAME_PASS_TOLERANCE_MS = 120_000;

/**
 * The pass the id names. Ids are `${noradId}-${start.t}`; a recompute from
 * a new "now" moves the coarse grid and can shift a boundary by a second, so
 * when there is no exact match the same object's pass starting within the
 * tolerance is accepted.
 */
export function findSelectedPass(passes: readonly Pass[], id: string | null): Pass | null {
  if (id === null) return null;
  const exact = passes.find((p) => p.id === id);
  if (exact) return exact;
  const m = /^(\d+)-(\d+)$/.exec(id);
  if (!m) return null;
  const noradId = Number(m[1]);
  const startT = Number(m[2]);
  let best: Pass | null = null;
  for (const p of passes) {
    if (p.noradId !== noradId) continue;
    const drift = Math.abs(p.start.t - startT);
    if (drift <= SAME_PASS_TOLERANCE_MS && (best === null || drift < Math.abs(best.start.t - startT))) best = p;
  }
  return best;
}

export interface PassSelection {
  selectedId: string | null;
  open: (passId: string) => void;
  close: () => void;
}

export function usePassSelection(): PassSelection {
  const [selectedId, setSelectedId] = useState<string | null>(() => passIdFromHash(window.location.hash));

  useEffect(() => {
    const onHashChange = (): void => {
      setSelectedId(passIdFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const open = useCallback((passId: string) => {
    window.location.hash = `${HASH_PREFIX.slice(1)}${encodeURIComponent(passId)}`;
    setSelectedId(passId);
  }, []);

  const close = useCallback(() => {
    if (window.location.hash !== '') {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    }
    setSelectedId(null);
  }, []);

  return { selectedId, open, close };
}
