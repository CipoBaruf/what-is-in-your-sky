import { useEffect, useRef } from 'react';
import { installShortcuts, type ShortcutActions } from '../../lib/shortcuts';

/**
 * R35 (FR-DESK-4, D-73): mounts the one `keydown` listener for as long as the
 * screen that owns the shortcuts is up. The table, the guard and the listener
 * itself are `lib/shortcuts.ts`; React lives here, the way `useLayoutMode`
 * sits beside `lib/layout.ts` (D-116).
 *
 * `actions` is read through a ref, so handlers that close over fresh state do
 * not tear the listener down and rebuild it on every render — the listener is
 * installed once and asks for the current handlers when a key arrives.
 *
 * `enabled` is what keeps the home page's keys off the live page: `App` calls
 * this before it decides which page to render, because a hook cannot be
 * conditional, and the live sky has its own keys (R32, R33).
 */
export function useShortcuts(actions: ShortcutActions, enabled = true): void {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useEffect(() => {
    if (!enabled) return;
    return installShortcuts(document, () => latest.current);
  }, [enabled]);
}
