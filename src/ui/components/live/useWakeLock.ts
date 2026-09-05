import { useEffect, useState } from 'react';

/**
 * R34 (FR-LIVE-7, US-15 AC7, D-174): the screen stays awake while the live
 * page is open. A Screen Wake Lock is requested while the document is visible
 * and released when it is hidden, on `document.visibilitychange` — the
 * browser drops the lock on its own when the tab is hidden, but it does not
 * hand it back, so the visible half is the one that matters. Where the API
 * is absent nothing is rendered and nothing is asked (PLAN §8.8); a request
 * the browser refuses (a battery saver, an insecure context, a headless
 * browser) is `refused` and asked again on the next visibility change.
 *
 * The state is for tests and the page's `data-wake-lock`: the lock itself is
 * silent, with no indicator either way — a control that could only be read
 * as "the screen might sleep" is noise on a page held up at the sky.
 */
export type WakeLockState = 'absent' | 'held' | 'released' | 'refused';

const wakeLockApi = (): WakeLock | null => (typeof navigator !== 'undefined' && 'wakeLock' in navigator ? navigator.wakeLock : null);

export function useWakeLock(enabled = true): WakeLockState {
  const [state, setState] = useState<WakeLockState>(() => (wakeLockApi() === null ? 'absent' : 'released'));

  useEffect(() => {
    const api = wakeLockApi();
    if (!api || !enabled) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const release = (): void => {
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => undefined);
      setState('released');
    };
    const request = async (): Promise<void> => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const next = await api.request('screen');
        if (cancelled) {
          void next.release().catch(() => undefined);
          return;
        }
        sentinel = next;
        setState('held');
        // The browser releases it on its own (the tab hidden, the battery saver on): the state follows.
        next.addEventListener('release', () => {
          if (sentinel === next) {
            sentinel = null;
            setState('released');
          }
        });
      } catch {
        if (!cancelled) setState('refused');
      }
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void request();
      else release();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void request();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [enabled]);

  return state;
}
