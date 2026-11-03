import { useEffect } from 'react';
import { useAppStore } from '../../state';
import { applyTheme } from './theme';

/**
 * R156 (D-972): the shell's one call. Keeps `data-theme` on the saved preference after the first paint (`main.tsx`
 * wrote it before). Since v2.12 (D-1020) there is no Auto to follow the Sun, so it writes on a change and nothing
 * ticks.
 */
export function useThemeTick(): void {
  const pref = useAppStore((s) => s.theme);
  useEffect(() => {
    applyTheme(pref);
  }, [pref]);
}
