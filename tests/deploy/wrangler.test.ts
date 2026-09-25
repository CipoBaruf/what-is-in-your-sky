/**
 * P6 (FR-ADDR-2, PLAN D-658): `wrangler.jsonc` binds the public address as a
 * custom-domain route the deploy applies, keeps the old address serving the same
 * build, keeps branch previews, and still has no Worker script (D-12 as amended
 * in PLAN §2.5). A later edit cannot drop the route or a flag silently.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface WranglerConfig {
  name?: string;
  main?: string;
  routes?: { pattern: string; custom_domain?: boolean }[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  assets?: { directory?: string; not_found_handling?: string };
}

/** The file is JSONC: whole-line `//` comments only, which is all it carries. */
function readWrangler(): WranglerConfig {
  const text = readFileSync('wrangler.jsonc', 'utf8')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  return JSON.parse(text) as WranglerConfig;
}

describe('wrangler.jsonc (FR-ADDR-2, D-658)', () => {
  const config = readWrangler();

  it('binds inyoursky.app as a custom domain the deploy creates', () => {
    expect(config.routes).toEqual([{ pattern: 'inyoursky.app', custom_domain: true }]);
  });

  it('keeps the old address serving the same build (FR-ADDR-3)', () => {
    expect(config.workers_dev).toBe(true);
  });

  it('keeps a preview URL per branch: a custom domain has no preview form', () => {
    expect(config.preview_urls).toBe(true);
  });

  it('has no Worker script: assets only, dist/ served as-is (D-12)', () => {
    expect(config.main).toBeUndefined();
    expect(config.assets?.directory).toBe('./dist');
    expect(config.assets?.not_found_handling).toBe('404-page');
  });

  it('keeps the worker name the old address is built from', () => {
    expect(config.name).toBe('in-your-sky');
  });
});
