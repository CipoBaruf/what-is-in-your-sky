import { useEffect, useRef, useState } from 'react';
import { due } from '../../../lib/playback';

/**
 * R33 (FR-LIVE-5, FR-LIVE-6): a value that follows `value` at most once per
 * `everyMs` of wall time, with a trailing update so the last value always
 * arrives. The Sun and the Moon are evaluated from it once a second whatever
 * the playback speed, and the hidden-objects request is keyed on it at one
 * per 250 ms. UI code may read the clock (D-15); the arithmetic is `due`.
 */
export function useWallThrottle<T>(value: T, everyMs: number): T {
  const [held, setHeld] = useState(value);
  const lastWall = useRef<number | null>(null);
  useEffect(() => {
    const wall = Date.now();
    if (due(lastWall.current, wall, everyMs)) {
      lastWall.current = wall;
      setHeld(value);
      return;
    }
    const wait = (lastWall.current ?? wall) + everyMs - wall;
    const timer = window.setTimeout(() => {
      lastWall.current = Date.now();
      setHeld(value);
    }, wait);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, everyMs]);
  return held;
}
