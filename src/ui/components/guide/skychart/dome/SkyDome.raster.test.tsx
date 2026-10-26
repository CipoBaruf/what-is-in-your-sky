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
 * base (D-92). R45 (D-187) re-baked all four: the fit rule's zoom is 162.5
 * at 390 px where it was 140, so the dome is 16 % larger on the same grid.
 *
 * The alignment assertion is the point of having two snapshots (D-74): the
 * base is exactly half the line layer's grid in both directions, so one base
 * cell covers exactly four line cells and the layers cannot drift apart as
 * the box changes size.
 */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { bitCount, brailleBits } from '../../../../../../tests/support/braille';
import { MOON_FIXTURE } from '../../../../../../tests/support/moonFixtures';
import type { Observer } from '../../../../../model';
import { DOME_STAR_MAG } from '../layers';
import type { SkyScene } from '../window/scene';
import { baseColsFor, CELL_ASPECT, DEFAULT_CELL_WIDTH_PX, GRID_COLS, GRID_ROWS } from './camera';
import { SkyDome } from './SkyDome';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const PROBE = Array(20).fill('M').join('\n');

interface HandBody {
  mag: number;
  azDeg: number;
  altDeg: number;
}
type HandPlanet = HandBody & { body: 'Venus' | 'Mars' | 'Jupiter' };

/** A scene written by hand: the stars in the order given (the catalogue's is by magnitude), the planets after them. */
function handScene(stars: readonly HandBody[], planets: readonly HandPlanet[] = []): SkyScene {
  return {
    stars: {
      catalog: { ra: stars.map(() => 0), dec: stars.map(() => 0), mag: stars.map((s) => s.mag), name: stars.map(() => ''), desig: stars.map((_, i) => `s${String(i)}`), con: stars.map(() => 'Ori'), figures: [] },
      positions: { altDeg: stars.map((s) => s.altDeg), azDeg: stars.map((s) => s.azDeg), planets },
      layers: { stars: true, figures: true, planets: true, names: true },
    },
  };
}

/**
 * R124 (FR-SKY-5, D-793): the snapshot's sky, the polar chart's (R122) so the
 * two rasters tell one story: of its seven stars the dome keeps the two at
 * `DOME_STAR_MAG` or brighter, and the three planets — five dots.
 */
const SNAPSHOT_STARS: readonly HandBody[] = [
  { mag: -0.7, azDeg: 160, altDeg: 55 },
  { mag: 1.1, azDeg: 220, altDeg: 35 },
  { mag: 2.0, azDeg: 20, altDeg: 25 },
  { mag: 2.2, azDeg: 20, altDeg: 25.2 },
  { mag: 3.1, azDeg: 300, altDeg: 70 },
  { mag: 4.2, azDeg: 90, altDeg: 45 },
  { mag: 1.6, azDeg: 250, altDeg: -10 },
];
const SNAPSHOT_PLANETS: readonly HandPlanet[] = [
  { body: 'Venus', mag: -4.1, azDeg: 275, altDeg: 12 },
  { body: 'Mars', mag: 1.4, azDeg: 120, altDeg: 18 },
  // Off the grid: at (60°, 80°) the dot fell on a meridian near the zenith, where a dot on a set dot counts for nothing.
  { body: 'Jupiter', mag: 2.1, azDeg: 60, altDeg: 70 },
];
const SNAPSHOT_SCENE = handScene(SNAPSHOT_STARS, SNAPSHOT_PLANETS);

/**
 * What `after` changed of `before`, cell by cell: the braille dots it raised
 * and the cells where it took something away (a dot cleared, or a cell that
 * is not braille changed). The two rasters are one grid, so cells pair up.
 */
function rasterChange(before: string, after: string): { raised: number; lost: number } {
  const a = [...before];
  const b = [...after];
  expect(b).toHaveLength(a.length);
  let raised = 0;
  let lost = 0;
  a.forEach((was, i) => {
    const now = b[i] ?? '';
    if (now === was) return;
    const wasBits = brailleBits(was);
    const nowBits = brailleBits(now);
    if ((wasBits === 0 && was !== '\u2800' && was !== ' ') || nowBits === 0 || (wasBits & ~nowBits) !== 0) lost++;
    raised += bitCount(nowBits & ~wasBits);
  });
  return { raised, lost };
}

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

  // R124 (FR-SKY-5, FR-SKY-9): re-baselined once, with the snapshot's sky under the arc.
  it('draws the golden pass at the initial camera, with the stars and the planets as dots, as the committed braille raster', async () => {
    const { container, getByTestId } = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={SNAPSHOT_SCENE} />);
    const { text, lines } = rasterOf(container, 'lines');
    expect(lines).toHaveLength(GRID_ROWS);
    for (const line of lines) expect(line).toHaveLength(GRID_COLS);
    expect(text.replace(/[\s⠀]/g, '').length).toBeGreaterThan(200);
    expect(getByTestId('dome-readout').textContent).toBe('Facing NE (46°) · tilt 45°');
    await expect(text).toMatchFileSnapshot('./__snapshots__/SkyDome.golden.txt');
  });

  /**
   * FR-SKY-5: "one braille dot each" — each body, drawn alone, raises one dot
   * at most and clears none (a dot that lands on a set one raises nothing,
   * D-818, so the count is not pinned to where the grid's dots happen to
   * fall: the snapshot above pins the picture); a star past the dome's cap
   * raises none; and the Where pane's scene with no stars (OQ-44), or no
   * scene at all, draws `ece8bfd`'s picture.
   */
  it('adds one braille dot at most per star at the cap and per planet, and none without a star field', () => {
    const lines = (scene?: SkyScene): string => rasterOf(render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} {...(scene ? { scene } : {})} />).container, 'lines').text;
    const bare = lines();
    expect(lines({ stars: null })).toBe(bare);

    const capped = SNAPSHOT_STARS.filter((star) => star.mag <= DOME_STAR_MAG);
    for (const star of SNAPSHOT_STARS.filter((s) => s.mag > DOME_STAR_MAG)) expect(lines(handScene([star])), `a mag ${String(star.mag)} star`).toBe(bare);
    const alone = [...capped.map((star) => handScene([star])), ...SNAPSHOT_PLANETS.map((planet) => handScene([], [planet]))].map((scene) => rasterChange(bare, lines(scene)));
    for (const change of alone) {
      expect(change.lost).toBe(0);
      expect(change.raised).toBeLessThanOrEqual(1);
    }
    // The mesh draws at all: the bodies, together, raise dots, and never more than one each.
    const together = rasterChange(bare, lines(SNAPSHOT_SCENE));
    expect(together.lost).toBe(0);
    expect(together.raised).toBeGreaterThan(0);
    expect(together.raised).toBeLessThanOrEqual(capped.length + SNAPSHOT_PLANETS.length);
  });

  it('draws the base layer of surfaces under it, on half the grid and aligned cell for cell', async () => {
    const { container } = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={SNAPSHOT_SCENE} />);
    const base = rasterOf(container, 'base');
    const lines = rasterOf(container, 'lines');

    // D-92: half the columns, and D-74's alignment — one base cell is exactly four line cells, in both directions.
    const baseCols = baseColsFor(GRID_COLS);
    expect(baseCols).toBe(GRID_COLS / 2);
    expect(base.lines).toHaveLength(lines.lines.length / 2);
    for (const line of base.lines) expect(line).toHaveLength(baseCols);

    // A wash, not a wireframe: the ground and the bowl cover most of the drawing.
    expect(base.text.replace(/\s/g, '').length).toBeGreaterThan(100);
    await expect(base.text).toMatchFileSnapshot('./__snapshots__/SkyDome.golden.base.txt');
  });

  /**
   * R22, FR-DOME-5 / FR-DOME-6: the same pass halfway through, with the Sun
   * eight degrees under the horizon and the Moon up. What the two committed
   * rasters show that the two above do not: the flown half of the arc, the
   * live marker on it, the Moon's disc (lines) and the Sun's glow (base).
   */
  it('draws the live marker, the flown arc, the Moon and the Sun glow at an instant inside the pass', async () => {
    const now = Math.round((pass.start.t + pass.end.t) / 2);
    const sun = { t: now, azDeg: 285, altDeg: -8 };
    const still = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} scene={SNAPSHOT_SCENE} />);
    const live = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} now={now} sun={sun} moon={MOON_FIXTURE} scene={SNAPSHOT_SCENE} />);

    // FR-DOME-6 as amended (R45): neither body is captioned on the drawing — the legend carries their lines.
    expect(live.container.querySelector('[data-anchor="sun"]')).toBeNull();
    expect(live.container.querySelector('[data-anchor="moon"]')).toBeNull();
    expect(live.container.textContent).not.toMatch(/Sun|Moon/);

    // More ink on both layers than the same drawing without them.
    const ink = (text: string): number => text.replace(/[\s⠀]/g, '').length;
    const lines = rasterOf(live.container, 'lines');
    expect(ink(lines.text)).toBeGreaterThan(ink(rasterOf(still.container, 'lines').text));
    // The base is a wash that already covers the sky, so the glow shows as a
    // change of shading rather than as more ink.
    expect(rasterOf(live.container, 'base').text).not.toBe(rasterOf(still.container, 'base').text);

    await expect(lines.text).toMatchFileSnapshot('./__snapshots__/SkyDome.live.txt');
    await expect(rasterOf(live.container, 'base').text).toMatchFileSnapshot('./__snapshots__/SkyDome.live.base.txt');
  });

  it('makes no worker call while the marker moves (FR-DOME-5)', () => {
    // The whole point of interpolating from `Pass.track`: a chart that ticks
    // every ten seconds must not ask the worker anything. Nothing may build a
    // worker or post to one while the instant advances.
    const construct = vi.fn();
    const post = vi.fn();
    class SpyWorker {
      constructor(...args: unknown[]) {
        construct(...args);
      }
      postMessage = post;
      addEventListener = vi.fn();
      terminate = vi.fn();
    }
    vi.stubGlobal('Worker', SpyWorker);
    vi.stubGlobal('SharedWorker', SpyWorker);

    // A mount per tick rather than a re-render: glyphcss rasterises on an
    // animation frame, which jsdom never runs, so a re-rendered scene keeps
    // the text it was mounted with. The component sees the same succession of
    // instants either way, which is what this test is about.
    const start = pass.start.t + 10_000;
    const rasters = Array.from({ length: 7 }, (_, tick) => {
      const { container } = render(<SkyDome passes={[pass]} observer={observer} highlightedPassId={pass.id} now={start + tick * 10_000} />);
      return rasterOf(container, 'lines').text;
    });

    // The drawing really did change — otherwise this would pass with a dead chart.
    expect(new Set(rasters).size).toBeGreaterThan(1);
    expect(construct).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
