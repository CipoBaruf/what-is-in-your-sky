/**
 * PLAN D-1068 (FR-SDD-23): pixel diffs before images. Two PNGs are compared pixel by pixel with
 * pixelmatch's measure — the YIQ colour delta of the two pixels blended over white, a pixel counting
 * as different when its delta is past `PIXEL_THRESHOLD` (0.1, pixelmatch's default) of the largest
 * possible — and a capture counts as changed when more than `CAPTURE_DIFF_SHARE` of its pixels do.
 * Under it is anti-aliasing noise. Only a changed capture is looked at, as one image: base and
 * branch side by side, each at half size.
 *
 *   npx tsx scripts/captures/diff.ts <base-dir> <branch-dir> [--out <dir>] [--url <prefix>]
 *
 * compares every PNG under `<branch-dir>` with the file of the same relative path under
 * `<base-dir>`, writes the side-by-side image of each changed one to `<out>/<path>`, and prints a
 * markdown report for the job summary: the counts, then every new, gone, resized and changed file,
 * a changed file's image linked at `<url>/<path>` when `--url` is given. It always exits 0: the
 * report is evidence for a reviewer, not a gate.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

/** SPEC v2.13 constants: a capture is changed when more than this share of its pixels differ (0.1 %). */
export const CAPTURE_DIFF_SHARE = 0.001;
/** pixelmatch's default per-pixel threshold, as a share of the largest YIQ delta. */
export const PIXEL_THRESHOLD = 0.1;
/** The largest YIQ delta two pixels can have (black against white). */
const MAX_YIQ_DELTA = 35215;
/** The neutral gap between the two halves, in pixels of the composed image. */
export const SIDE_GAP_PX = 8;
const GAP_GREY = 128;

/** A channel blended over white by its alpha, as pixelmatch does. */
const blend = (channel: number, alpha: number): number => 255 + ((channel - 255) * alpha) / 255;

/** The YIQ delta between pixel `i` of `a` and pixel `i` of `b` (byte offsets into RGBA data). */
export function yiqDelta(a: Buffer, b: Buffer, i: number): number {
  const alphaA = a[i + 3] ?? 255;
  const alphaB = b[i + 3] ?? 255;
  const r1 = blend(a[i] ?? 0, alphaA);
  const g1 = blend(a[i + 1] ?? 0, alphaA);
  const b1 = blend(a[i + 2] ?? 0, alphaA);
  const r2 = blend(b[i] ?? 0, alphaB);
  const g2 = blend(b[i + 1] ?? 0, alphaB);
  const b2 = blend(b[i + 2] ?? 0, alphaB);
  const y = r1 * 0.29889531 + g1 * 0.58662247 + b1 * 0.11448223 - (r2 * 0.29889531 + g2 * 0.58662247 + b2 * 0.11448223);
  const iq = r1 * 0.59597799 - g1 * 0.2741761 - b1 * 0.32180189 - (r2 * 0.59597799 - g2 * 0.2741761 - b2 * 0.32180189);
  const q = r1 * 0.21147017 - g1 * 0.52261711 + b1 * 0.31114694 - (r2 * 0.21147017 - g2 * 0.52261711 + b2 * 0.31114694);
  return 0.5053 * y * y + 0.299 * iq * iq + 0.1957 * q * q;
}

export interface PixelDiff {
  /** False when the two images differ in size; every pixel then counts as changed. */
  readonly sameSize: boolean;
  /** Pixels past the per-pixel threshold. */
  readonly pixels: number;
  /** `pixels` over the branch image's pixel count. */
  readonly share: number;
  /** `share` past `CAPTURE_DIFF_SHARE`: the capture is to be looked at. */
  readonly changed: boolean;
}

export function diffPng(base: PNG, branch: PNG, threshold = PIXEL_THRESHOLD): PixelDiff {
  const total = branch.width * branch.height;
  if (base.width !== branch.width || base.height !== branch.height) return { sameSize: false, pixels: total, share: 1, changed: true };
  const limit = MAX_YIQ_DELTA * threshold * threshold;
  let pixels = 0;
  for (let i = 0; i < base.data.length; i += 4) {
    if (base.data[i] === branch.data[i] && base.data[i + 1] === branch.data[i + 1] && base.data[i + 2] === branch.data[i + 2] && base.data[i + 3] === branch.data[i + 3]) continue;
    if (yiqDelta(base.data, branch.data, i) > limit) pixels += 1;
  }
  const share = total === 0 ? 0 : pixels / total;
  return { sameSize: true, pixels, share, changed: share > CAPTURE_DIFF_SHARE };
}

/** The image at half size, each pixel the mean of the (up to) four it covers. */
export function halve(png: PNG): PNG {
  const width = Math.ceil(png.width / 2);
  const height = Math.ceil(png.height / 2);
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const sx = 2 * x + dx;
          const sy = 2 * y + dy;
          if (sx >= png.width || sy >= png.height) continue;
          const at = (sy * png.width + sx) * 4;
          for (let c = 0; c < 4; c += 1) sums[c] = (sums[c] ?? 0) + (png.data[at + c] ?? 0);
          count += 1;
        }
      }
      const to = (y * width + x) * 4;
      for (let c = 0; c < 4; c += 1) out.data[to + c] = Math.round((sums[c] ?? 0) / count);
    }
  }
  return out;
}

/** Copies `src` into `dst` at (`left`, 0). */
function blit(src: PNG, dst: PNG, left: number): void {
  for (let y = 0; y < src.height; y += 1) src.data.copy(dst.data, (y * dst.width + left) * 4, y * src.width * 4, (y + 1) * src.width * 4);
}

/** Base on the left and branch on the right, each at half size, a grey gap between and under the shorter one. */
export function sideBySide(base: PNG, branch: PNG): PNG {
  const left = halve(base);
  const right = halve(branch);
  const out = new PNG({ width: left.width + SIDE_GAP_PX + right.width, height: Math.max(left.height, right.height) });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = GAP_GREY;
    out.data[i + 1] = GAP_GREY;
    out.data[i + 2] = GAP_GREY;
    out.data[i + 3] = 255;
  }
  blit(left, out, 0);
  blit(right, out, left.width + SIDE_GAP_PX);
  return out;
}

export type Row =
  | { readonly kind: 'new' | 'gone'; readonly file: string }
  | { readonly kind: 'size'; readonly file: string; readonly from: string; readonly to: string }
  | { readonly kind: 'changed'; readonly file: string; readonly diff: PixelDiff };

export interface Comparison {
  readonly files: number;
  /** Byte-identical, or under `CAPTURE_DIFF_SHARE`. */
  readonly same: number;
  readonly rows: readonly Row[];
}

/** Every PNG under `dir`, as paths relative to it, sorted. */
export function pngsUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.png')) out.push(relative(dir, path).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** Compares the two directories; writes each changed file's side-by-side image under `out` when given. */
export function compareDirs(baseDir: string, branchDir: string, out?: string): Comparison {
  const before = new Set(pngsUnder(baseDir));
  const now = pngsUnder(branchDir);
  const rows: Row[] = [];
  let same = 0;
  for (const file of now) {
    if (!before.has(file)) {
      rows.push({ kind: 'new', file });
      continue;
    }
    const a = readFileSync(join(baseDir, file));
    const b = readFileSync(join(branchDir, file));
    if (a.equals(b)) {
      same += 1;
      continue;
    }
    const base = PNG.sync.read(a);
    const branch = PNG.sync.read(b);
    const diff = diffPng(base, branch);
    if (!diff.sameSize) rows.push({ kind: 'size', file, from: `${String(base.width)}×${String(base.height)}`, to: `${String(branch.width)}×${String(branch.height)}` });
    else if (diff.changed) rows.push({ kind: 'changed', file, diff });
    else same += 1;
    if (diff.changed && out) {
      const target = join(out, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, PNG.sync.write(sideBySide(base, branch), { deflateLevel: 9, colorType: 2, inputColorType: 6, inputHasAlpha: true }));
    }
  }
  const present = new Set(now);
  for (const file of before) if (!present.has(file)) rows.push({ kind: 'gone', file });
  return { files: now.length, same, rows };
}

const percent = (share: number): string => `${(share * 100).toFixed(3)} %`;

/** The job summary's markdown: the counts, the table, then one side-by-side image per changed file. */
export function report(comparison: Comparison, title: string, url?: string): string {
  const lines = [`### ${title}`, '', `${String(comparison.files)} files: ${String(comparison.same)} identical or under ${percent(CAPTURE_DIFF_SHARE)} of pixels, ${String(comparison.rows.length)} listed.`, ''];
  if (comparison.rows.length === 0) return `${lines.join('\n')}\n`;
  lines.push('| | File | Pixels |', '|---|---|---|');
  for (const row of comparison.rows) {
    if (row.kind === 'changed') lines.push(`| changed | ${row.file} | ${String(row.diff.pixels)} (${percent(row.diff.share)}) |`);
    else if (row.kind === 'size') lines.push(`| size | ${row.file} | ${row.from} → ${row.to} |`);
    else lines.push(`| ${row.kind} | ${row.file} | |`);
  }
  const looked = comparison.rows.filter((row) => row.kind === 'changed' || row.kind === 'size');
  if (looked.length > 0) {
    lines.push('', 'Base on the left, this run on the right, each at half size.', '');
    for (const row of looked) lines.push(url ? `**${row.file}**\n\n![${row.file}](${url}/${row.file})\n` : `**${row.file}**: \`${row.file}\` in the side-by-side artefact\n`);
  }
  return `${lines.join('\n')}\n`;
}

function main(argv: readonly string[]): void {
  const flag = (name: string): string | undefined => {
    const at = argv.indexOf(name);
    return at === -1 ? undefined : argv[at + 1];
  };
  const positional = argv.filter((arg, i) => !arg.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  const [baseDir, branchDir] = positional;
  if (!baseDir || !branchDir) throw new Error('usage: npx tsx scripts/captures/diff.ts <base-dir> <branch-dir> [--out <dir>] [--url <prefix>] [--title <text>]');
  const comparison = compareDirs(baseDir, branchDir, flag('--out'));
  process.stdout.write(report(comparison, flag('--title') ?? `The captures against ${baseDir}`, flag('--url')));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
