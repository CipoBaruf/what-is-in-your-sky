/**
 * PLAN §9.1 "Sky dome raster snapshot" (R15): the `<pre>` text for the golden
 * pass at the initial camera, snapshotted to a file that is reviewed in the
 * PR and regenerated deliberately (`vitest -u`), never auto-updated. glyphcss
 * rasterises deterministically, so a diff means an intentional geometry
 * change or a library upgrade changed the output. jsdom lays nothing out, so
 * the test answers glyphcss's cell probe (a `<pre>` of twenty `M` lines) with
 * the 6.5 × 13 px cell the stylesheet sets at 390 px, and the raster is the
 * one a phone shows on the default 60 × 30 grid.
 */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import type { Observer } from '../../../../../model';
import { CELL_ASPECT, DEFAULT_CELL_WIDTH_PX, GRID_COLS, GRID_ROWS } from './camera';
import { SkyDome } from './SkyDome';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const PROBE = Array(20).fill('M').join('\n');

/** The phone's layout: one cell is 6.5 × 13 px, the 60 × 30 grid is 390 × 390 px. */
export function stubCellMetrics(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const rect = (width: number, height: number): DOMRect => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) });
    const cellHeight = DEFAULT_CELL_WIDTH_PX * CELL_ASPECT;
    if (this.tagName === 'PRE' && this.textContent === PROBE) return rect(DEFAULT_CELL_WIDTH_PX, 20 * cellHeight);
    if (this.classList.contains('glyph-output')) return rect(GRID_COLS * DEFAULT_CELL_WIDTH_PX, GRID_ROWS * cellHeight);
    return rect(0, 0);
  });
}

describe('<SkyDome> raster', () => {
  beforeEach(stubCellMetrics);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws the golden pass at the initial camera as the committed braille raster', async () => {
    const { container, getByTestId } = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const pre = container.querySelector('pre.glyph-output');
    if (!pre) throw new Error('no raster');
    const text = pre.textContent ?? '';
    const lines = text.split('\n');
    expect(lines).toHaveLength(30);
    for (const line of lines) expect(line).toHaveLength(60);
    expect(text.replace(/[\s⠀]/g, '').length).toBeGreaterThan(200);
    expect(getByTestId('dome-readout').textContent).toBe('Facing NE (46°) · tilt 45°');
    await expect(text).toMatchFileSnapshot('./__snapshots__/SkyDome.golden.txt');
  });
});
