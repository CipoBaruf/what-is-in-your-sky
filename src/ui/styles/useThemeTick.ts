import { useEffect } from 'react';
import { useAppStore } from '../../state';
import { NOW_TICK_MS } from '../../state/effects';
import { applyTheme, themeAt } from './theme';

/**
 * R156 (FR-PHONE-15, D-972, D-979): the shell's one call. Keeps `data-theme` on the saved preference after the first
 * paint (`main.tsx` wrote it before), and while it is `auto` with a saved place, on the Sun as well — every
 * `NOW_TICK_MS`, the tick the Now state already keeps, and at once when the page becomes visible again, since a
 * hidden page's timers are throttled or stopped and a phone reopened after dusk must not wait for the next tick.
 * Its own module so `theme.ts` stays pure: `main.tsx`, the spike and the e2e import that without the store.
 */
export function useThemeTick(): void {
  const pref = useAppStore((s) => s.theme);
  const observer = useAppStore((s) => s.observer);
  useEffect(() => {
    const write = (): void => {
      applyTheme(themeAt(pref, observer, Date.now()));
    };
    write();
    if (pref !== 'auto' || observer === null) return;
    const timer = setInterval(write, NOW_TICK_MS);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') write();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pref, observer]);
}
