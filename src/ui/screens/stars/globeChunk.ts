import { useEffect, useState } from 'react';

/**
 * R170 (FR-GLOBE-15; PLAN D-1035, D-1050): the globe's code, out of the `stars` chunk. Two dynamic imports, both of
 * the globe's own modules: `SkyGlobe` (R169's default export, so Rollup names its chunk `SkyGlobe-*.js`) for the
 * drawing, and `globe/scene.ts` for the rail's count and `Up from <place>` list (`upCount`, `upList`, D-1037) — the
 * page reads the globe's sky through the module the globe draws from, and the module stays out of `stars`. Rollup
 * makes `scene.ts` (with the projection it imports) its own chunk, which `SkyGlobe-*.js` imports; the `globe` budget
 * row counts the two together (`scripts/bundle-budget.ts`). Each import is asked once and a failure is dropped, so the
 * next ask fetches again (`starsChunk.ts`'s shape).
 */

type GlobeModule = typeof import('../../components/guide/skychart/globe/SkyGlobe');
export type GlobeSceneModule = typeof import('../../components/guide/skychart/globe/scene');

let globe: Promise<GlobeModule> | undefined;
let scene: Promise<GlobeSceneModule> | undefined;

export function loadGlobe(): Promise<GlobeModule> {
  globe ??= import('../../components/guide/skychart/globe/SkyGlobe').catch((reason: unknown) => {
    globe = undefined;
    throw reason;
  });
  return globe;
}

export function loadGlobeScene(): Promise<GlobeSceneModule> {
  scene ??= import('../../components/guide/skychart/globe/scene').catch((reason: unknown) => {
    scene = undefined;
    throw reason;
  });
  return scene;
}

/** The scene module once loaded and `wanted`, else `null`; asked for when `wanted` turns on. */
export function useGlobeScene(wanted: boolean): GlobeSceneModule | null {
  const [module, setModule] = useState<GlobeSceneModule | null>(null);
  useEffect(() => {
    if (!wanted || module !== null) return;
    let live = true;
    loadGlobeScene().then(
      (loaded) => {
        if (live) setModule(loaded);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [wanted, module]);
  return wanted ? module : null;
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
      loadGlobeScene().catch(() => undefined);
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
