import { whenIdle } from '../../screens/whenIdle';

/**
 * R123 (FR-SKY-3, FR-SKY-10, D-791) → R222 (FR-LAND-3, D-1240): the star catalogue and the positions
 * (`data/stars/catalog.ts`, `lib/skyStars.ts`) are a lazy chunk, `starSource-*.js`, and this is the one place that
 * fetches it, a failure dropped rather than kept. The live page and the pass detail load it when they mount with a star
 * layer on, and prefetch it on idle otherwise. The service worker precaches it with the other chunks (FR-OFF-1, D-79).
 * Until R222 it was the stars page's chunk (`screens/starsChunk.ts`, the page's import); the page is gone.
 */
type StarsModule = typeof import('./starSource');

let chunk: Promise<StarsModule> | undefined;

/** Fetch the chunk once; later calls return the same promise, and a rejection is not kept. */
export function loadStarsChunk(): Promise<StarsModule> {
  chunk ??= import('./starSource').then(
    (module) => module,
    (reason: unknown) => {
      chunk = undefined;
      throw reason;
    },
  );
  return chunk;
}

/**
 * R123 (D-791): fetch the chunk once the browser is idle (`whenIdle`) and nothing more: the catalogue is built only
 * when a layer turns on, from the module this has in hand. Returns the cancel, for an unmount before it fires; a
 * failure goes to `onError` or is dropped, and since `loadStarsChunk` does not keep it, the next request fetches again.
 */
export function prefetchStarsWhenIdle(onLoad?: (module: StarsModule) => void, onError?: () => void): () => void {
  return whenIdle(() => void loadStarsChunk().then(onLoad, () => onError?.()));
}
