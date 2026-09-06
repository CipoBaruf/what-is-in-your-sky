/**
 * FR-FLAG-1, D-183: the only module that reads `import.meta.env`. Everything
 * else gets a typed constant, which is what lets the ESLint
 * `no-restricted-syntax` rule (eslint.config.js) forbid the raw read
 * everywhere else without carve-outs accumulating over time.
 */

/** The Moon tradition line (FR-MOON-4/5): off unless the build sets `VITE_MOON_LORE=on`. */
export const MOON_LORE: boolean = import.meta.env.VITE_MOON_LORE === 'on';

/** D-126: a development build gets no service worker, so a stale precache never hides an edit. */
export const IS_PROD: boolean = import.meta.env.PROD;
