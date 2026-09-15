/**
 * R74 (FR-MARK-6, D-438): the committed rasters are the generator's output and
 * nothing else. The test runs the generator — a Vite dev server, a Chromium,
 * the page under `spike/mark/` rasterising the whole ladder through glyphcss —
 * and asserts that what it produces is byte-identical to
 * `src/ui/components/mark/rasters.json`.
 *
 * It is the one thing standing between the drawing and a hand-edited asset: a
 * cell "fixed" in the JSON, or a change to the scene's constants that was never
 * re-run, fails here. It is slow (a browser and a build tool) and it belongs to
 * the build suite for that reason, beside `flags.test.ts`, which also runs a
 * real build; FR-CI-1's ten minutes are what its timeout is set against.
 *
 * If this fails on a machine with no Chromium, the fix is `npx playwright
 * install chromium`, not a snapshot update.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateRasters, RASTERS_PATH, serialise } from '../../scripts/build-mark';

describe('src/ui/components/mark/rasters.json (FR-MARK-6)', () => {
  it('is exactly what the generator produces, byte for byte', async () => {
    const regenerated = serialise(await generateRasters());
    const committed = readFileSync(RASTERS_PATH, 'utf8');
    if (regenerated !== committed) {
      // A 20 KB diff is unreadable; say which tier moved and by how much.
      const parse = (text: string) => JSON.parse(text) as Record<string, { body: string; frames: unknown[] }>;
      const now = parse(regenerated);
      const then = parse(committed);
      for (const tier of Object.keys(now)) {
        const a = now[tier];
        const b = then[tier];
        if (!a || !b) continue;
        const cells = [...a.body].filter((glyph, index) => glyph !== [...b.body][index]).length;
        const frames = a.frames.filter((frame, index) => JSON.stringify(frame) !== JSON.stringify(b.frames[index])).length;
        if (cells > 0 || frames > 0) console.log(`${tier}: ${String(cells)} body cells and ${String(frames)} of the 60 frames differ`);
      }
    }
    expect(regenerated, 'the rasters are stale or hand-edited: run npm run build:icons').toBe(committed);
  }, 240_000);
});
