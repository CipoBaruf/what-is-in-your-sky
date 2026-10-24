/**
 * R114 (FR-STAR-6 as amended, V24-15; D-752): the ink offsets measured in a
 * real Chromium — the browser project (`vitest.config.ts`), where the canvas
 * has text metrics and `document.fonts` exists. This is the probe R114's Done
 * note reports: it prints the table and holds the shape the spike found
 * (`docs/stars/FINDINGS.md` §5) — `.` below the point, `*` and `+` at or above
 * it, `@` near the centre, nothing more than a few px out — without pinning
 * the numbers, which are the machine's monospace face's.
 */
import { describe, expect, it } from 'vitest';
import '../../../../styles/tokens.css';
import { inkMeasured, inkOffset, inkOffsetsReady, inkOffsetTable } from './inkOffsets';
import { GLYPH_SIZES, SIZE_PX } from './starGlyphs';

// The `ui` project collects every test under `src/ui` into jsdom too, where there are no fonts and no metrics: the probe is the browser's alone.
describe.skipIf(typeof document === 'undefined' || !document.fonts)('the ink offsets in Chromium (D-752)', () => {
  it('measures every glyph × size once the fonts are ready, to a tenth of a px', async () => {
    expect(await inkOffsetsReady()).toBe(true);
    expect(inkMeasured()).toBe(true);
    const table = inkOffsetTable();
    expect(table.size).toBe(GLYPH_SIZES.length);
    const rows: string[] = [];
    for (const [glyph, size] of GLYPH_SIZES) {
      const { dx, dy } = inkOffset(glyph, size);
      rows.push(`${glyph} at ${String(SIZE_PX[size])} px: dx ${dx.toFixed(1)}, dy ${dy.toFixed(1)}`);
      expect(Number.isFinite(dx) && Number.isFinite(dy), rows[rows.length - 1]).toBe(true);
      expect(Math.abs(dx), rows[rows.length - 1]).toBeLessThanOrEqual(4);
      expect(Math.abs(dy), rows[rows.length - 1]).toBeLessThanOrEqual(4);
      expect(dx).toBe(Math.round(dx * 10) / 10);
      expect(dy).toBe(Math.round(dy * 10) / 10);
    }
    console.log(`ink offsets (${getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim()}):\n  ${rows.join('\n  ')}`);
    // The shape the spike found: the period's ink is below the em centre, so its shift is up (negative dy); the asterisk's is not below it.
    expect(inkOffset('.', 'chart-text-12').dy).toBeLessThan(0);
    expect(inkOffset('*', 'chart-text-18').dy).toBeGreaterThanOrEqual(-0.5);
    expect(Math.abs(inkOffset('@', 'chart-text-12').dy)).toBeLessThanOrEqual(1.5);
    // A second call is the same promise and the same map.
    expect(await inkOffsetsReady()).toBe(true);
    expect(inkOffsetTable()).toBe(table);
  });
});
