/**
 * R115 (FR-STAR-9, D-756): the stars page is its own chunk, `stars` — the
 * page, the catalogue and the positions (`data/stars/catalog.ts`,
 * `lib/skyStars.ts`) — and this is the one place that fetches it, so the route
 * and the header's link share a single request: `settingsChunk.ts`'s pattern,
 * for the same reasons, a failure dropped rather than kept.
 *
 * There is no idle prefetch, unlike the settings page's 1 KB: the chunk is
 * some 30 KB gzipped and a reader who never opens `#stars` should not pay for
 * it on a phone's network. The link's `pointerenter` and `focus` fetch it
 * ahead of the tap; the service worker precaches it with the other chunks
 * (FR-OFF-1, D-79), so offline the route loads from the cache (FR-STAR-8).
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
