import { useSyncExternalStore } from 'react';

/**
 * R209 (FR-CTRL-4; D-932, D-1256): whether what pulses holds still. Reduced motion is asked in script, as a
 * stylesheet's conditions are sizes alone (FR-DS-3), and here because a primitive imports nothing of the app (D-703).
 */
const QUERY = '(prefers-reduced-motion: reduce)';

const list = (): MediaQueryList | null => (typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null);

const subscribe = (onChange: () => void): (() => void) => {
  const motion = list();
  motion?.addEventListener('change', onChange);
  return () => motion?.removeEventListener('change', onChange);
};

const unwatched = (): (() => void) => () => undefined;
const moves = (): boolean => false;
const still = (): boolean => list()?.matches ?? false;

/** Watched only while something pulses, so a page of buttons holds no listener each. */
export function useStill(pulsing: boolean): boolean {
  return useSyncExternalStore(pulsing ? subscribe : unwatched, pulsing ? still : moves, moves);
}
