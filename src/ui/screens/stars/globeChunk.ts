import { useEffect } from 'react';

/**
 * R170 (FR-GLOBE-15; PLAN D-1035): the globe's code, out of the `stars` chunk. Two dynamic imports: `SkyGlobe`
 * (R169's default export, so Rollup names its chunk `SkyGlobe-*.js`) for the drawing, and `GlobeRail.tsx` for the
 * rail's `Time`, `Turn`, `Place` groups and the count with `Up from <place>` (`GlobeRail-*.js`), which reads the
 * globe's sky through `globe/scene.ts` (`upCount`, `upList`, D-1037). Rollup makes `scene.ts` (with the projection it
 * imports) a chunk the two share; the `globe` budget row counts the three together (`scripts/bundle-budget.ts`), so
 * `stars` keeps only the page's wiring (`GLOBE_STARS_KB`). Each import is asked once and a failure is dropped, so the
 * next ask fetches again (`starsChunk.ts`'s shape).
 */

type GlobeModule = typeof import('../../components/guide/skychart/globe/SkyGlobe');
type GlobeRailModule = typeof import('./GlobeRail');

let globe: Promise<GlobeModule> | undefined;
let rail: Promise<GlobeRailModule> | undefined;

export function loadGlobe(): Promise<GlobeModule> {
  globe ??= import('../../components/guide/skychart/globe/SkyGlobe').catch((reason: unknown) => {
    globe = undefined;
    throw reason;
  });
  return globe;
}

export function loadGlobeRail(): Promise<GlobeRailModule> {
  rail ??= import('./GlobeRail').catch((reason: unknown) => {
    rail = undefined;
    throw reason;
  });
  return rail;
}

type IdleWindow = Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void };

/**
 * FR-GLOBE-15: on wide only, once the `stars` chunk is up (this page has mounted), the globe's chunks are fetched on
 * idle, so the first press of `Globe` draws at once; on compact nothing is asked and `SkyGlobe-*.js` is never fetched.
 */
export function useGlobePrefetch(wide: boolean): void {
  useEffect(() => {
    if (!wide) return;
    const idle = window as IdleWindow;
    const fetchBoth = (): void => {
      loadGlobe().catch(() => undefined);
      loadGlobeRail().catch(() => undefined);
    };
    if (typeof idle.requestIdleCallback === 'function') {
      const id = idle.requestIdleCallback(fetchBoth);
      return () => {
        idle.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(fetchBoth, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [wide]);
}
