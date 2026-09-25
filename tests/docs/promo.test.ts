/**
 * P4 (SPEC §4.43, FR-SHOW-6, FR-SHOW-7; PLAN D-652, D-653): the recording run
 * is a list and a project, and both are held here without a browser.
 *
 * `tests/e2e/promoFlows.ts` names the flows; each must say its device, its
 * language, a duration under 40 s and at least one still. `playwright.config.ts`
 * must have the `promo` project and no other project may run the file, so
 * `npm run e2e` and CI never record. And when a run has left `promo/media/`
 * on this machine, every flow has its `.webm` and its stills there — the one
 * read of `promo/` any test makes (FR-SHOW-7), and only when the directory
 * exists, because the run is the owner's and nothing under `promo/` is tracked.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config, { PROMO_PROJECT, PROMO_SPEC, promoSelected } from '../../playwright.config';
import { EPOCH_WARN_MS } from '../../src/lib/elementsAge';
import { PARIS, PARIS_NIGHT, STORED_RUN_PARIS_FILE } from '../e2e/observers';
import { DEVICES, MEDIA_DIR, PROMO_FLOWS, promoStill, promoVideo } from '../e2e/promoFlows';

const SPEC_FILE = 'tests/e2e/promo-record.spec.ts';

/** A project's `testMatch` or `testIgnore` as the patterns it is, whatever shape it was given in. */
const patterns = (value: unknown): (string | RegExp)[] => (value === undefined ? [] : Array.isArray(value) ? (value as (string | RegExp)[]) : [value as string | RegExp]);
const matches = (pattern: string | RegExp, path: string): boolean => (typeof pattern === 'string' ? path.endsWith(pattern) : pattern.test(path));

describe('the recording run (FR-SHOW-6)', () => {
  it('names a device, a language, a duration under 40 s and at least one still for every flow', () => {
    expect(PROMO_FLOWS.length).toBeGreaterThan(0);
    for (const flow of PROMO_FLOWS) {
      expect(Object.keys(DEVICES), flow.name).toContain(flow.device);
      expect(['en', 'es'], flow.name).toContain(flow.locale);
      expect(['dark', 'night'], flow.name).toContain(flow.theme);
      expect(flow.seconds, `${flow.name} runs ${String(flow.seconds)} s`).toBeGreaterThan(0);
      expect(flow.seconds, `${flow.name} runs ${String(flow.seconds)} s`).toBeLessThan(40);
      expect(flow.stills.length, `${flow.name} names no still`).toBeGreaterThan(0);
      expect(new Set(flow.stills).size, `${flow.name} names a still twice`).toBe(flow.stills.length);
      for (const still of flow.stills) expect(still).toMatch(/^[a-z][a-z-]*$/);
    }
    // One file per flow and device: two flows may not write over each other.
    expect(new Set(PROMO_FLOWS.map(promoVideo)).size).toBe(PROMO_FLOWS.length);
  });

  it('records the flows FR-SHOW-6 lists: the phone first run in both themes and in Spanish, and the desktop pair', () => {
    const phone = PROMO_FLOWS.filter((flow) => flow.device === 'phone');
    const desktop = PROMO_FLOWS.filter((flow) => flow.device === 'desktop');
    expect(phone.length).toBeGreaterThanOrEqual(4);
    expect(desktop.length).toBeGreaterThanOrEqual(2);
    const firstRuns = phone.filter((flow) => flow.name.startsWith('first-run'));
    expect(new Set(firstRuns.map((flow) => flow.theme))).toEqual(new Set(['dark', 'night']));
    expect(firstRuns.some((flow) => flow.locale === 'es')).toBe(true);
    // The phone is 390 × 844 at a device pixel ratio of 3, portrait; the desk 1440 × 900, landscape (D-652).
    expect(DEVICES.phone.viewport).toEqual({ width: 390, height: 844 });
    expect(DEVICES.phone.deviceScaleFactor).toBe(3);
    expect(DEVICES.phone.frame.height).toBeGreaterThan(DEVICES.phone.frame.width);
    expect(DEVICES.desktop.viewport).toEqual({ width: 1440, height: 900 });
    expect(DEVICES.desktop.frame.width).toBeGreaterThan(DEVICES.desktop.frame.height);
  });

  it('is the `promo` project of the one config, there only when `--project=promo` asked for it (D-652)', () => {
    expect(PROMO_PROJECT.name).toBe('promo');
    expect(patterns(PROMO_PROJECT.testMatch).some((pattern) => matches(pattern, SPEC_FILE))).toBe(true);
    expect(PROMO_SPEC.test(SPEC_FILE)).toBe(true);
    expect(PROMO_PROJECT.use.video).toEqual({ mode: 'on', size: DEVICES.phone.frame });
    // A second take of a flow is the same file written twice, and a recording wants the box to itself.
    expect(PROMO_PROJECT.retries).toBe(0);
    expect(PROMO_PROJECT.fullyParallel).toBe(false);
    // What `npm run promo:record` passes selects it, in either spelling; a bare `playwright test` — `npm run e2e`, CI — does not.
    expect(promoSelected(['--project=promo'])).toBe(true);
    expect(promoSelected(['--project', 'promo'])).toBe(true);
    expect(promoSelected(['--project=chromium'])).toBe(false);
    expect(promoSelected([])).toBe(false);
    // This process is not a recording run, so the config it loaded has no such project.
    expect(promoSelected(process.argv)).toBe(false);
    expect((config.projects ?? []).map((project) => project.name)).not.toContain('promo');
  });

  it('is ignored by every other project, so `npm run e2e` never records (D-652)', () => {
    const projects = config.projects ?? [];
    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      const runs = patterns(project.testMatch);
      const ignores = patterns(project.testIgnore);
      const wouldRun = (runs.length === 0 || runs.some((pattern) => matches(pattern, SPEC_FILE))) && !ignores.some((pattern) => matches(pattern, SPEC_FILE));
      expect(wouldRun, `${project.name ?? '?'} would run ${SPEC_FILE}`).toBe(false);
    }
  });

  it('is what `npm run promo:record` runs, built as `npm run e2e` builds', async () => {
    const { scripts } = (await import('../../package.json')) as { scripts: Record<string, string> };
    expect(scripts['promo:record']).toBe('VITE_MOON_LORE=on vite build && playwright test --project=promo');
    expect(scripts['e2e']).toContain('VITE_MOON_LORE=on vite build');
  });

  it('seeds every flow on the capture set’s night, where the elements are under FR-SAT-4’s warning threshold (D-673)', () => {
    // The stored run the list flows seed is over Paris at `CLOCK`, computed by `scripts/build-stored-run.ts`
    // from the same fixtures the page loads, and its elements are hours old, not days: nine days on at
    // Neuquén, where the rest of the suite runs, the amber staleness line would sit on the home of every
    // list flow, and promo material must not show a warning a fresh install never does (D-179).
    const run = JSON.parse(readFileSync(STORED_RUN_PARIS_FILE, 'utf8')) as { observer: unknown; computedAt: number; newestElementsEpochMs: number; passes: unknown[] };
    expect(run.observer).toEqual(PARIS);
    expect(run.computedAt).toBe(PARIS_NIGHT);
    expect(run.passes.length).toBeGreaterThan(10);
    expect(run.computedAt - run.newestElementsEpochMs).toBeLessThan(EPOCH_WARN_MS);
    // And the spec seeds from that run and that night, never from the suite's nine-days-on clock.
    const spec = readFileSync(SPEC_FILE, 'utf8');
    expect(spec).toContain('STORED_RUN_PARIS_FILE');
    expect(spec).not.toMatch(/NINE_DAYS_ON|NEUQUEN|STORED_RUN\b/);
    expect(spec).toMatch(/import \{[^}]*\bCLOCK\b[^}]*\} from '\.\/captureSeeds'/);
  });

  it('converts each video on its own, so one ffmpeg failure costs one .mp4 and nothing else', () => {
    const spec = readFileSync(SPEC_FILE, 'utf8');
    const convert = /function convert\(webm: string, mp4: string\): boolean \{\s*try \{[\s\S]*?execFileSync\('ffmpeg'[\s\S]*?return true;\s*\} catch/;
    expect(spec).toMatch(convert);
    expect(spec).toMatch(/if \(convert\(target, mp4\)\) console\.log/);
  });
});

describe.skipIf(!existsSync(MEDIA_DIR))('the run this machine has made (FR-SHOW-6, FR-SHOW-7)', () => {
  it('has every flow’s video and its stills, and none of them empty', () => {
    const files = new Set(readdirSync(MEDIA_DIR));
    const has = (path: string): boolean => files.has(path.slice(MEDIA_DIR.length + 1));
    const missing: string[] = [];
    const empty: string[] = [];
    for (const flow of PROMO_FLOWS) {
      for (const path of [promoVideo(flow), ...flow.stills.map((still) => promoStill(flow, still))]) {
        if (!has(path)) missing.push(path);
        else if (statSync(path).size === 0) empty.push(path);
      }
    }
    expect(missing).toEqual([]);
    expect(empty).toEqual([]);
  });
});
