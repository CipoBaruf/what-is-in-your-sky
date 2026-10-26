import { whenIdle } from './whenIdle';

/**
 * R115 (FR-STAR-9, D-756): the stars page is its own chunk, `stars` — the
 * page, the catalogue and the positions (`data/stars/catalog.ts`,
 * `lib/skyStars.ts`) — and this is the one place that fetches it, so the route
 * and the header's link share a single request: `settingsChunk.ts`'s pattern,
 * for the same reasons, a failure dropped rather than kept.
 *
 * The home page has no idle prefetch, unlike the settings page's 1 KB: the
 * chunk is some 30 KB gzipped and a reader who never opens `#stars` should not
 * pay for it on a phone's network. The link's `pointerenter` and `focus`
 * fetch it ahead of the tap; the service worker precaches it with the other
 * chunks (FR-OFF-1, D-79), so offline the route loads from the cache
 * (FR-STAR-8).
 *
 * R123 (FR-SKY-3, FR-SKY-10, D-791): the live page and the pass detail draw
 * the stars under the arcs from this chunk too (`Stars.tsx`'s `starSource`).
 * With `[ stars ]` on they load it when they mount; with it off they prefetch
 * it here, on idle, so turning the toggle on draws on the next tick.
 */
type StarsModule = typeof import('./Stars');

let chunk: Promise<StarsModule> | undefined;

/** Fetch the stars chunk once; later calls return the same promise, and a rejection is not kept. */
export function loadStarsChunk(): Promise<StarsModule> {
  chunk ??= import('./Stars').catch((reason: unknown) => {
    chunk = undefined;
    throw reason;
  });
  return chunk;
}

/**
 * R123 (D-791): fetch the chunk once the browser is idle (`whenIdle`, the
 * settings page's rule) and nothing more: the catalogue is built only when the
 * toggle turns on, from the module this has in hand. Returns the cancel, for
 * an unmount before it fires; a failure is dropped (the toggle's own load asks
 * again).
 */
export function prefetchStarsWhenIdle(): () => void {
  return whenIdle(() => void loadStarsChunk().catch(() => undefined));
}
