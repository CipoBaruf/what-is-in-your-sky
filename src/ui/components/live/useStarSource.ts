import { useEffect, useState } from 'react';
import { loadStarsChunk, prefetchStarsWhenIdle } from '../../screens/starsChunk';
import type { StarSource } from '../guide/skychart/useSkyScene';

/** The source once any page has had it: a second pass detail, or the live page after one, draws its stars from the first frame. */
let loaded: StarSource | null = null;

/**
 * R123 (FR-SKY-3, FR-SKY-10, D-791): the stars the live page and the pass
 * detail hand `useSkyScene` — `null` until the `stars` chunk is in. With
 * `[ stars ]` on the chunk is asked for when the page mounts; with it off it
 * is prefetched on idle after the page's own chunk, so turning the toggle on
 * draws on the next tick. While it loads the views draw without stars; a
 * failed load leaves them so, and the next mount or toggle asks again.
 */
export function useStarSource(starsLayer: boolean): StarSource | null {
  const [source, setSource] = useState<StarSource | null>(loaded);
  useEffect(() => {
    if (source) return;
    let mounted = true;
    const take = (module: Awaited<ReturnType<typeof loadStarsChunk>>): void => {
      loaded = module.starSource();
      if (mounted) setSource(loaded);
    };
    if (starsLayer) {
      loadStarsChunk().then(take, () => undefined);
      return () => {
        mounted = false;
      };
    }
    const cancel = prefetchStarsWhenIdle(take);
    return () => {
      mounted = false;
      cancel();
    };
  }, [starsLayer, source]);
  return source;
}
