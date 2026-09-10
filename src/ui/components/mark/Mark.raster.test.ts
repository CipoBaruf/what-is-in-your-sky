/**
 * R74 (FR-MARK-8 a and b), in the shape of `SkyDome.raster.test.tsx`: the six
 * tiers of FR-MARK-2's ladder as committed snapshots — each tier's body and
 * its frame-0 bead layer — plus the structural checks that hold whatever the
 * drawing is.
 *
 * The snapshots are reviewed in the PR and regenerated deliberately
 * (`vitest -u`), never automatically. What produced them is `npm run
 * build:icons`, which drives the scene under `spike/mark/` through glyphcss
 * (D-438); a snapshot that changed with no change to that scene means the
 * library rasterises differently, and a snapshot that changed with one is the
 * drawing the owner is being asked to accept (FR-MARK-2's rule).
 *
 * They are seeded from this implementation's output rather than from the
 * rasters embedded in FR-MARK-2: those were drawn by the design handoff's own
 * generator, whose radii and tick length were never written down, and the PR
 * carries the two side by side with the count of differing cells for the
 * owner's gate. The structural checks below are the part that does not depend
 * on which of the two is in the tree.
 */
import { describe, expect, it } from 'vitest';
import rastersJson from './rasters.json';
import { denseFrame, MARK_GRIDS, MARK_ORBIT_FRAMES, MARK_TIERS, type MarkRasters, type MarkTier } from './tiers';

const RASTERS = rastersJson as MarkRasters;

/** Cells with ink: the font draws the blank braille cell and the space the same way, so neither counts. */
const ink = (text: string): number => text.replace(/[\s⠀]/g, '').length;

describe('the mark, as committed rasters (FR-MARK-8 a)', () => {
  it.each(MARK_TIERS)('draws %s at its grid, and as the committed body and bead', async (tier: MarkTier) => {
    const raster = RASTERS[tier];
    const grid = MARK_GRIDS[tier];
    expect({ cols: raster.cols, rows: raster.rows }).toEqual(grid);
    expect(grid.cols).toBe(2 * grid.rows); // FR-MARK-2: a tier's grid is square on screen

    const lines = raster.body.split('\n');
    expect(lines).toHaveLength(grid.rows);
    for (const line of lines) expect([...line]).toHaveLength(grid.cols);
    expect(ink(raster.body)).toBeGreaterThan(0);

    await expect(raster.body).toMatchFileSnapshot(`./__snapshots__/mark.${tier}.body.txt`);
    await expect(denseFrame(raster.frames[0] ?? [], grid.cols, grid.rows)).toMatchFileSnapshot(`./__snapshots__/mark.${tier}.frame0.txt`);
  });
});

describe('the ladder, whatever the drawing is (FR-MARK-8 b)', () => {
  it('sheds a reading at every step: each tier inks fewer cells than the one above it', () => {
    const inked = MARK_TIERS.map((tier) => ink(RASTERS[tier].body));
    for (let i = 1; i < inked.length; i++) {
      expect(inked[i], `${MARK_TIERS[i]} inks as much as ${MARK_TIERS[i - 1]}`).toBeLessThan(inked[i - 1] ?? 0);
    }
  });

  it('keeps a ring and a bead at the favicon: ink on both rows, and one bead cell', () => {
    const raster = RASTERS['favicon16'];
    for (const line of raster.body.split('\n')) expect(ink(line)).toBeGreaterThan(0);
    expect(raster.frames[0]).toHaveLength(1);
  });

  it('keeps the bead inside the grid in every frame of every tier', () => {
    for (const tier of MARK_TIERS) {
      const raster = RASTERS[tier];
      expect(raster.frames).toHaveLength(MARK_ORBIT_FRAMES);
      for (const [frame, cells] of raster.frames.entries()) {
        expect(cells.length, `${tier} frame ${String(frame)} inks nothing`).toBeGreaterThan(0);
        for (const [row, col] of cells) {
          expect(row, `${tier} frame ${String(frame)}`).toBeGreaterThanOrEqual(0);
          expect(row, `${tier} frame ${String(frame)}`).toBeLessThan(raster.rows);
          expect(col, `${tier} frame ${String(frame)}`).toBeGreaterThanOrEqual(0);
          expect(col, `${tier} frame ${String(frame)}`).toBeLessThan(raster.cols);
        }
      }
    }
  });

  /**
   * Half an orbit apart the bead is somewhere else — except on the favicon,
   * which is a still picture the browser draws from a file and whose 4 × 2 grid
   * has no room for a journey (the generator holds its bead fixed).
   */
  it('moves the bead half an orbit at every tier but the favicon', () => {
    const half = MARK_ORBIT_FRAMES / 2;
    for (const tier of MARK_TIERS) {
      const raster = RASTERS[tier];
      const at = (frame: number): string => denseFrame(raster.frames[frame] ?? [], raster.cols, raster.rows);
      if (tier === 'favicon16') expect(at(half)).toBe(at(0));
      else expect(at(half), tier).not.toBe(at(0));
    }
  });
});
