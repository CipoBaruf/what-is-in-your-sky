/**
 * PLAN §9.1 "Sky dome raster snapshot" (R15, extended by R21): the `<pre>`
 * text of *both* layers for the golden pass at the initial camera,
 * snapshotted to files that are reviewed in the PR and regenerated
 * deliberately (`vitest -u`), never auto-updated. glyphcss rasterises
 * deterministically, so a diff means an intentional geometry change or a
 * library upgrade changed the output. jsdom lays nothing out, so the test
 * answers glyphcss's cell probe (a `<pre>` of twenty `M` lines) with the
 * 6.5 × 13 px cell the stylesheet sets at 390 px, and the rasters are the
 * ones a phone shows: 60 × 30 braille cells of lines over 30 × 15 blocks of
 * base (D-92).
 *
 * The alignment assertion is the point of having two snapshots (D-74): the
 * base is exactly half the line layer's grid in both directions, so one base
 * cell covers exactly four line cells and the layers cannot drift apart as
 * the box changes size.
 */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import type { Observer } from '../../../../../model';
import { baseColsFor, CELL_ASPECT, DEFAULT_CELL_WIDTH_PX, GRID_COLS, GRID_ROWS } from './camera';
import { SkyDome } from './SkyDome';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const PROBE = Array(20).fill('M').join('\n');

/**
 * The phone's layout: the 390 × 390 px box, filled by either layer. One line
 * cell is 6.5 × 13 px on the 60 × 30 grid; one base cell is twice that on the
 * 30 × 15 grid (D-92), which is what makes the two rasters cover the same
 * world. glyphcss measures its own cell from a `<pre>` of twenty `M`s inside
 * the scene, so the probe is answered with the cell of the layer it sits in —
 * in a browser that is the layer's `--dome-font-size` doing the same job.
 */
export function stubCellMetrics(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const rect = (width: number, height: number): DOMRect => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) });
    const base = this.closest('[data-layer="base"]') !== null;
    const cellWidth = base ? DEFAULT_CELL_WIDTH_PX * (GRID_COLS / baseColsFor(GRID_COLS)) : DEFAULT_CELL_WIDTH_PX;
    const cellHeight = cellWidth * CELL_ASPECT;
    if (this.tagName === 'PRE' && this.textContent === PROBE) return rect(cellWidth, 20 * cellHeight);
    if (this.classList.contains('glyph-output')) return rect(GRID_COLS * DEFAULT_CELL_WIDTH_PX, GRID_ROWS * DEFAULT_CELL_WIDTH_PX * CELL_ASPECT);
    return rect(0, 0);
  });
}

/** The raster text of one layer, as its lines. */
function rasterOf(container: HTMLElement, layer: 'base' | 'lines'): { text: string; lines: string[] } {
  const pre = container.querySelector(`[data-layer="${layer}"] pre.glyph-output`);
  if (!pre) throw new Error(`no ${layer} raster`);
  const text = pre.textContent ?? '';
  return { text, lines: text.split('\n') };
}

describe('<SkyDome> raster', () => {
  beforeEach(stubCellMetrics);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws the golden pass at the initial camera as the committed braille raster', async () => {
    const { container, getByTestId } = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const { text, lines } = rasterOf(container, 'lines');
    expect(lines).toHaveLength(GRID_ROWS);
    for (const line of lines) expect(line).toHaveLength(GRID_COLS);
    expect(text.replace(/[\s⠀]/g, '').length).toBeGreaterThan(200);
    expect(getByTestId('dome-readout').textContent).toBe('Facing NE (46°) · tilt 45°');
    await expect(text).toMatchFileSnapshot('./__snapshots__/SkyDome.golden.txt');
  });

  it('draws the base layer of surfaces under it, on half the grid and aligned cell for cell', async () => {
    const { container } = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const base = rasterOf(container, 'base');
    const lines = rasterOf(container, 'lines');

    // D-92: half the columns, and D-74's alignment — one base cell is exactly four line cells, in both directions.
    const baseCols = baseColsFor(GRID_COLS);
    expect(baseCols).toBe(GRID_COLS / 2);
    expect(base.lines).toHaveLength(lines.lines.length / 2);
    for (const line of base.lines) expect(line).toHaveLength(baseCols);

    // A wash, not a wireframe: the ground and the bowl cover most of the drawing.
    expect(base.text.replace(/[\s ]/g, '').length).toBeGreaterThan(100);
    await expect(base.text).toMatchFileSnapshot('./__snapshots__/SkyDome.golden.base.txt');
  });
});
