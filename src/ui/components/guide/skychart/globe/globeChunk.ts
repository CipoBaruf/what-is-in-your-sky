import { useEffect } from 'react';

/**
 * R170 (FR-GLOBE-15; PLAN D-1035): the globe's code, its own chunk; R222 (D-1240) moved this file from `screens/stars/`.
 * `SkyGlobe` is R169's default export, so Rollup names its chunk `SkyGlobe-*.js`; it shares `scene-*.js` with the live
 * page's `Up from <place>` (`UpFrom-*.js`, D-1295). The import is asked once and a failure is dropped, so the next ask
 * fetches again (`starsChunk.ts`'s shape).
 */

type GlobeModule = typeof import('./SkyGlobe');

let globe: Promise<GlobeModule> | undefined;

export function loadGlobe(): Promise<GlobeModule> {
  globe ??= import('./SkyGlobe').catch((reason: unknown) => {
    globe = undefined;
    throw reason;
  });
  return globe;
}

type IdleWindow = Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void };

/**
 * FR-GLOBE-15: on wide only, once a sky page has mounted, the globe's chunk is fetched on
 * idle, so the first press of `Globe` draws at once; on compact nothing is asked and `SkyGlobe-*.js` is never fetched.
 */
export function useGlobePrefetch(wide: boolean): void {
  useEffect(() => {
    if (!wide) return;
    const idle = window as IdleWindow;
    const fetchGlobe = (): void => {
      loadGlobe().catch(() => undefined);
    };
    if (typeof idle.requestIdleCallback === 'function') {
      const id = idle.requestIdleCallback(fetchGlobe);
      return () => {
        idle.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(fetchGlobe, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [wide]);
}
