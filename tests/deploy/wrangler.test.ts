/**
 * P6 (FR-ADDR-2, PLAN D-658): `wrangler.jsonc` binds the public address as a
 * custom-domain route the deploy applies, keeps the old address serving the same
 * build and keeps branch previews. R195 (FR-MEAS-4, D-1148): it names one Worker
 * script, which runs for `/e` only, with the assets and the dataset bound and
 * request logs off. A later edit cannot drop the route or a flag silently.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface WranglerConfig {
  name?: string;
  main?: string;
  routes?: { pattern: string; custom_domain?: boolean }[];
  workers_dev?: boolean;
  preview_urls?: boolean;
  assets?: { directory?: string; not_found_handling?: string; binding?: string; run_worker_first?: unknown };
  analytics_engine_datasets?: { binding: string; dataset: string }[];
  observability?: { enabled?: boolean };
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

  it('serves dist/ as-is, with real 404s (D-12, D-13)', () => {
    expect(config.assets?.directory).toBe('./dist');
    expect(config.assets?.not_found_handling).toBe('404-page');
  });

  it('names edge/index.ts as the one Worker script, run first for /e alone (D-1148)', () => {
    expect(config.main).toBe('edge/index.ts');
    expect(existsSync(config.main ?? '')).toBe(true);
    expect(config.assets?.run_worker_first).toEqual(['/e']);
  });

  it('binds the assets as ASSETS and the dataset as EVENTS, and keeps request logs off (D-1148)', () => {
    expect(config.assets?.binding).toBe('ASSETS');
    expect(config.analytics_engine_datasets).toEqual([{ binding: 'EVENTS', dataset: 'inyoursky_events' }]);
    expect(config.observability).toEqual({ enabled: false });
  });

  it('keeps the worker name the old address is built from', () => {
    expect(config.name).toBe('in-your-sky');
  });
});
