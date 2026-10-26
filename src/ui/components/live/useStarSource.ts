import { useEffect, useState } from 'react';
import { loadStarsChunk, prefetchStarsWhenIdle } from '../../screens/starsChunk';
import type { StarSource } from '../guide/skychart/useSkyScene';

/** The source once any page has had it: a second pass detail, or the live page after one, draws its stars from the first frame. */
let loaded: StarSource | null = null;

/** A failed load is asked for again this long after, or as soon as the browser says it is back online. */
export const STARS_RETRY_MS = 30_000;

/**
 * R123 (FR-SKY-3, FR-SKY-10, D-791): the stars the live page and the pass
 * detail hand `useSkyScene` — `null` until the `stars` chunk is in. With
 * `[ stars ]` on the chunk is asked for when the page mounts and the source
 * built from it; with it off the module is only prefetched on idle after the
 * page's own chunk, and nothing is built from it, so a reader who turned the
 * stars off pays the download once and never the catalogue — turning the
 * toggle on then builds it from the module in hand on the next tick. While it
 * loads the views draw without stars; a failed load is asked for again on the
 * browser's `online` event or after `STARS_RETRY_MS`, whichever comes first.
 */
export function useStarSource(starsLayer: boolean): StarSource | null {
  const [source, setSource] = useState<StarSource | null>(loaded);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (source) return;
    if (!starsLayer) return prefetchStarsWhenIdle();
    let mounted = true;
    let stopRetry = (): void => undefined;
    loadStarsChunk().then(
      (module) => {
        loaded = module.starSource();
        if (mounted) setSource(loaded);
      },
      () => {
        if (!mounted) return;
        const again = (): void => {
          stopRetry();
          setAttempt((n) => n + 1);
        };
        const timer = window.setTimeout(again, STARS_RETRY_MS);
        window.addEventListener('online', again);
        stopRetry = () => {
          window.clearTimeout(timer);
          window.removeEventListener('online', again);
        };
      },
    );
    return () => {
      mounted = false;
      stopRetry();
    };
  }, [starsLayer, source, attempt]);
  return source;
}
