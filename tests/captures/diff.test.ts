/**
 * R178 (FR-SDD-23, PLAN D-1068): the diff script on an identical pair, an anti-aliased pair and a
 * changed pair, and the side-by-side image with both halves in it.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { CAPTURE_DIFF_SHARE, compareDirs, diffPng, halve, report, SIDE_GAP_PX, sideBySide } from '../../scripts/captures/diff';

const SIZE = 200;

/** A white square with a dark disc, its rim anti-aliased by coverage — a stand-in for a glyph's edge. */
function picture(shift: (x: number, y: number) => number = () => 0): PNG {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const distance = Math.hypot(x - 100, y - 100) - 60;
      const coverage = Math.min(1, Math.max(0, 0.5 - distance));
      const edge = coverage > 0 && coverage < 1;
      const grey = Math.min(255, Math.max(0, Math.round(255 - coverage * 230 + (edge ? shift(x, y) : 0))));
      const at = (y * SIZE + x) * 4;
      png.data[at] = grey;
      png.data[at + 1] = grey;
      png.data[at + 2] = grey;
      png.data[at + 3] = 255;
    }
  }
  return png;
}

/** Fills a block with a colour: a real change of content. */
function withBlock(png: PNG, left: number, top: number, side: number): PNG {
  const out = new PNG({ width: png.width, height: png.height });
  png.data.copy(out.data);
  for (let y = top; y < top + side; y += 1) {
    for (let x = left; x < left + side; x += 1) {
      const at = (y * png.width + x) * 4;
      out.data[at] = 220;
      out.data[at + 1] = 40;
      out.data[at + 2] = 40;
    }
  }
  return out;
}

describe('FR-SDD-23: diffPng', () => {
  it('an identical pair is under CAPTURE_DIFF_SHARE, with no pixel counted', () => {
    const diff = diffPng(picture(), picture());
    expect(diff).toEqual({ sameSize: true, pixels: 0, share: 0, changed: false });
  });

  it('an anti-aliased pair — the rim a few levels off, as the Mac moves it — is under CAPTURE_DIFF_SHARE', () => {
    const base = picture();
    const branch = picture((x, y) => ((x + y) % 2 === 0 ? 9 : -9));
    expect(base.data.equals(branch.data)).toBe(false);
    const diff = diffPng(base, branch);
    expect(diff.sameSize).toBe(true);
    expect(diff.share).toBeLessThanOrEqual(CAPTURE_DIFF_SHARE);
    expect(diff.changed).toBe(false);
  });

  it('a handful of rim pixels moved hard stays under the share; a block of new content is over it', () => {
    const base = picture();
    // 30 pixels flipped, under 0.1 % of 40 000.
    const few = withBlock(base, 0, 0, 1);
    for (let i = 1; i < 30; i += 1) few.data.set([220, 40, 40], (i * SIZE + i) * 4);
    expect(diffPng(base, few).pixels).toBe(30);
    expect(diffPng(base, few).changed).toBe(false);
    const changed = diffPng(base, withBlock(base, 10, 10, 20));
    expect(changed.pixels).toBe(400);
    expect(changed.share).toBeGreaterThan(CAPTURE_DIFF_SHARE);
    expect(changed.changed).toBe(true);
  });

  it('a pair of different sizes is changed, every pixel counted', () => {
    const small = new PNG({ width: 10, height: 10 });
    expect(diffPng(small, picture())).toEqual({ sameSize: false, pixels: SIZE * SIZE, share: 1, changed: true });
  });
});

describe('sideBySide', () => {
  it('holds the base, halved, on the left and the branch, halved, on the right', () => {
    const base = picture();
    const branch = withBlock(base, 10, 10, 20);
    const image = sideBySide(base, branch);
    const half = SIZE / 2;
    expect(image.width).toBe(half + SIDE_GAP_PX + half);
    expect(image.height).toBe(half);
    const left = halve(base);
    const right = halve(branch);
    for (let y = 0; y < half; y += 1) {
      const row = image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4);
      expect(row.subarray(0, half * 4).equals(left.data.subarray(y * half * 4, (y + 1) * half * 4))).toBe(true);
      expect(row.subarray((half + SIDE_GAP_PX) * 4).equals(right.data.subarray(y * half * 4, (y + 1) * half * 4))).toBe(true);
    }
    // The halves differ where the block is: the branch's half shows it and the base's does not.
    const at = (8 * image.width + 8) * 4;
    expect([...image.data.subarray(at, at + 3)]).toEqual([255, 255, 255]);
    const there = (8 * image.width + half + SIDE_GAP_PX + 8) * 4;
    expect([...image.data.subarray(there, there + 3)]).toEqual([220, 40, 40]);
  });

  it('halves an odd size by rounding up', () => {
    const png = new PNG({ width: 5, height: 3 });
    expect([halve(png).width, halve(png).height]).toEqual([3, 2]);
  });
});

describe('compareDirs and report', () => {
  it('lists the new, gone and changed files, writes the changed one side by side, and counts the rest as same', () => {
    const root = mkdtempSync(join(tmpdir(), 'captures-diff-'));
    const base = join(root, 'base');
    const branch = join(root, 'branch');
    const out = join(root, 'out');
    for (const dir of [base, branch, join(branch, 'design'), join(base, 'design')]) mkdirSync(dir, { recursive: true });
    const write = (dir: string, file: string, png: PNG): void => writeFileSync(join(dir, file), PNG.sync.write(png));
    write(base, 'v1-same.png', picture());
    write(branch, 'v1-same.png', picture());
    write(base, 'v1-noise.png', picture());
    write(branch, 'v1-noise.png', picture((x) => (x % 2 === 0 ? 9 : -9)));
    write(base, 'design/v1-moved.png', picture());
    write(branch, 'design/v1-moved.png', withBlock(picture(), 10, 10, 20));
    write(base, 'v1-gone.png', picture());
    write(branch, 'v1-new.png', picture());
    const comparison = compareDirs(base, branch, out);
    expect(comparison.files).toBe(4);
    expect(comparison.same).toBe(2);
    expect(comparison.rows.map((row) => [row.kind, row.file])).toEqual([
      ['changed', 'design/v1-moved.png'],
      ['new', 'v1-new.png'],
      ['gone', 'v1-gone.png'],
    ]);
    const image = PNG.sync.read(readFileSync(join(out, 'design/v1-moved.png')));
    expect(image.width).toBe(SIZE + SIDE_GAP_PX);
    const markdown = report(comparison, 'The set', 'https://example.test/raw');
    expect(markdown).toContain('| changed | design/v1-moved.png | 400 (1.000 %) |');
    expect(markdown).toContain('![design/v1-moved.png](https://example.test/raw/design/v1-moved.png)');
    expect(markdown).toContain('| new | v1-new.png | |');
    expect(markdown).not.toContain('v1-noise');
  });
});
