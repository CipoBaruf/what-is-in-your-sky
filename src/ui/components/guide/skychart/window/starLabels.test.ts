/**
 * R116 (FR-STAR-6 as amended, FR-STAR-7; V24-16; D-755): the label placement
 * as a table — the spaced capitals and the fit rule, the four places in their
 * order, what counts as occupied, the order of the kinds, the figure keeping
 * its name — and the two sky cases, Orion over Paris and Crux over Neuquén,
 * drawn from the real catalogue through the same frame the field draws.
 */
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../../../../../data/stars/catalog';
import { starsAt } from '../../../../../lib/skyStars';
import type { EpochMs } from '../../../../../model';
import { sceneCatalog } from '../../../../screens/stars/field';
import { handRotation } from './camera';
import { WINDOW_FOV, type View } from './projection';
import type { StarField as StarFieldData } from './scene';
import { frameOf, labelInput, prepare } from './StarField';
import { ADVANCE_EM, FIGURE_NAME_PX, placeLabels, SEGMENT_SAMPLE_PX, spaced, STAR_NAME_PX, textWidth, type Box, type LabelInput, type LabelMark, type PlacedLabel } from './starLabels';

const W = 400;
const H = 300;
const base = (over: Partial<LabelInput> = {}): LabelInput => ({ width: W, height: H, marks: [], segments: [], compass: [], named: null, stars: [], figures: [], ...over });
const centre = { x: 200, y: 150 };
const bright: LabelMark = { ...centre, sizePx: 15 };
const texts = (placed: readonly PlacedLabel[]): string[] => placed.map((p) => `${p.kind}:${p.text}`);
/** Which of the four places a star's name took, read from its box against its mark. */
const side = (label: PlacedLabel, mark: { x: number; y: number }): string => (label.box.x0 > mark.x ? 'right' : label.box.x1 < mark.x ? 'left' : label.box.y1 < mark.y ? 'above' : 'below');
const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** A label's box beside `mark` on `place`, to put an obstacle exactly there. */
const blockAt = (mark: LabelMark, text: string, place: 'right' | 'left' | 'above' | 'below'): LabelMark => {
  const half = (ADVANCE_EM * mark.sizePx) / 2 + 0.3 * STAR_NAME_PX;
  const w = textWidth(text, STAR_NAME_PX);
  const at = { right: { x: mark.x + half + w / 2, y: mark.y }, left: { x: mark.x - half - w / 2, y: mark.y }, above: { x: mark.x, y: mark.y - half - STAR_NAME_PX / 2 }, below: { x: mark.x, y: mark.y + half + STAR_NAME_PX / 2 } }[place];
  return { ...at, sizePx: 12 };
};

describe('spaced capitals and widths (FR-STAR-6, D-755)', () => {
  it.each([
    ['Crux', 'C R U X'],
    ['Canis Major', 'C A N I S   M A J O R'],
    ['CMa', 'C M A'],
    ['Boötes', 'B O Ö T E S'],
    ['Serpens Caput', 'S E R P E N S   C A P U T'],
  ])('%s → %s', (name, out) => {
    expect(spaced(name)).toBe(out);
  });

  it('measures n × 0.6 em, a code point a cell', () => {
    expect(textWidth('C R U X', FIGURE_NAME_PX)).toBeCloseTo(7 * 0.6 * 11);
    expect(textWidth('B O Ö T E S', 12)).toBeCloseTo(11 * 0.6 * 12);
  });
});

describe('a star name: right, left, above, below, or dropped', () => {
  const name = 'Vega';
  const star = { key: 7, mark: 0, text: name };
  it.each([
    [[], 'right'],
    [['right'], 'left'],
    [['right', 'left'], 'above'],
    [['right', 'left', 'above'], 'below'],
  ] as const)('with %j taken, it goes %s', (taken, expected) => {
    const marks = [bright, ...taken.map((place) => blockAt(bright, name, place))];
    const placed = placeLabels(base({ marks, stars: [star] }));
    expect(placed).toHaveLength(1);
    expect(side(placed[0] as PlacedLabel, bright)).toBe(expected);
    expect(placed[0]).toMatchObject({ kind: 'star', key: 7, text: name });
  });

  it('is dropped when all four are taken', () => {
    const marks = [bright, ...(['right', 'left', 'above', 'below'] as const).map((place) => blockAt(bright, name, place))];
    expect(placeLabels(base({ marks, stars: [star] }))).toEqual([]);
  });

  it('counts a segment, sampled every 4 px, and a compass box as occupied, and keeps inside the box', () => {
    const right = blockAt(bright, name, 'right');
    // A segment crossing the right-hand place vertically: its samples fall inside the box.
    const segment = { x1: right.x, y1: right.y - 20, x2: right.x, y2: right.y + 20 };
    expect(side(placeLabels(base({ marks: [bright], segments: [segment], stars: [star] }))[0] as PlacedLabel, bright)).toBe('left');
    const compass: Box = { x0: right.x - 2, y0: right.y - 2, x1: right.x + 2, y1: right.y + 2 };
    expect(side(placeLabels(base({ marks: [bright], compass: [compass], stars: [star] }))[0] as PlacedLabel, bright)).toBe('left');
    // At the right edge of the box the right-hand place is outside it.
    const edge: LabelMark = { x: W - 10, y: 150, sizePx: 15 };
    expect(side(placeLabels(base({ marks: [edge], stars: [star] }))[0] as PlacedLabel, edge)).toBe('left');
    expect(SEGMENT_SAMPLE_PX).toBe(4);
  });

  it('places the brightest first: a fainter neighbour takes what is left', () => {
    const a: LabelMark = { x: 100, y: 150, sizePx: 15 };
    const b: LabelMark = { x: 100 + 0.6 * 15 + 6 + textWidth('Alpha', 12) / 2, y: 150, sizePx: 12 };
    const placed = placeLabels(base({ marks: [a, b], stars: [{ key: 0, mark: 0, text: 'Alpha' }, { key: 1, mark: 1, text: 'Beta' }] }));
    expect(texts(placed)).toEqual(['star:Alpha', 'star:Beta']);
    expect(placed.every((p, i) => placed.every((q, j) => i === j || !overlaps(p.box, q.box)))).toBe(true);
  });
});

describe('the named mark (FR-STAR-7)', () => {
  it('is placed before the star names, and the named star’s own name is not drawn twice', () => {
    const placed = placeLabels(base({ marks: [bright], named: { key: 3, mark: 0, text: 'Canopus · mag −0.7' }, stars: [{ key: 3, mark: 0, text: 'Canopus' }] }));
    expect(texts(placed)).toEqual(['named:Canopus · mag −0.7']);
  });

  it('is never dropped: with no free place it takes the first one inside the box', () => {
    const text = 'Canopus · mag −0.7';
    const marks = [bright, ...(['right', 'left', 'above', 'below'] as const).map((place) => blockAt(bright, text, place))];
    const placed = placeLabels(base({ marks, named: { key: 3, mark: 0, text } }));
    expect(placed).toHaveLength(1);
    expect(side(placed[0] as PlacedLabel, bright)).toBe('right');
  });
});

describe('a figure name (V24-16, D-755)', () => {
  // A figure 120 px wide around (200, 150), its endpoints on the corners: the centroid is empty.
  const endpoints = [
    { x: 140, y: 110 },
    { x: 260, y: 110 },
    { x: 140, y: 190 },
    { x: 260, y: 190 },
  ];
  const figure = { key: 2, name: 'Canis Major', con: 'CMa', segments: 2, endpoints };

  it('is the full spaced name where it fits the drawn width plus two cells, centred on the centroid', () => {
    // `C A N I S   M A J O R` is 21 cells, 138.6 px; the drawn width plus two cells is 133.2: too wide.
    expect(texts(placeLabels(base({ figures: [figure] })))).toEqual(['figure:C M A']);
    const wide = { ...figure, endpoints: endpoints.map((p) => ({ x: centre.x + (p.x - centre.x) * 1.2, y: p.y })) };
    const placed = placeLabels(base({ figures: [wide] }));
    expect(texts(placed)).toEqual(['figure:C A N I S   M A J O R']);
    expect(placed[0]).toMatchObject({ x: 200, y: 150 });
  });

  it('tries one row above, then one below, then the grid over the drawn figure (V24-22)', () => {
    const wide = { ...figure, endpoints: endpoints.map((p) => ({ x: centre.x + (p.x - centre.x) * 1.2, y: p.y })) };
    const atRow = (dy: number): LabelMark => ({ x: 200 + 60, y: 150 + dy, sizePx: 12 });
    // The full name's three rows blocked at its right end (x 260), which the abbreviation (19.8 px) does not reach.
    expect(placeLabels(base({ marks: [atRow(0)], figures: [wide] }))[0]).toMatchObject({ text: 'C A N I S   M A J O R', y: 150 - FIGURE_NAME_PX });
    expect(placeLabels(base({ marks: [atRow(0), atRow(-FIGURE_NAME_PX)], figures: [wide] }))[0]).toMatchObject({ text: 'C A N I S   M A J O R', y: 150 + FIGURE_NAME_PX });
    // The three rows blocked: the full name moves two cells left on the centroid's row (one cell still reaches the mark), the nearest free place of the grid.
    expect(placeLabels(base({ marks: [atRow(0), atRow(-FIGURE_NAME_PX), atRow(FIGURE_NAME_PX)], figures: [wide] }))[0]).toMatchObject({ text: 'C A N I S   M A J O R', x: 200 - 2 * ADVANCE_EM * FIGURE_NAME_PX, y: 150 });
  });

  it('takes the abbreviation where no place on the full name grid is free (V24-22)', () => {
    const wide = { ...figure, endpoints: endpoints.map((p) => ({ x: centre.x + (p.x - centre.x) * 1.2, y: p.y })) };
    // A wall of marks every cell across the figure's extent, but for a gap the abbreviation fits and the full name does not.
    const wall: LabelMark[] = [];
    for (let y = 60; y <= 240; y += 4) for (let x = 60; x <= 340; x += 4) if (Math.abs(x - 200) > 16 || Math.abs(y - 150) > 10) wall.push({ x, y, sizePx: 1 });
    expect(placeLabels(base({ marks: wall, figures: [wide] }))[0]).toMatchObject({ text: 'C M A', x: 200, y: 150 });
  });

  it('is not drawn for a figure with fewer than two drawn segments', () => {
    expect(placeLabels(base({ figures: [{ ...figure, segments: 1 }] }))).toEqual([]);
  });

  it('keeps its name: the star names in its way go, faintest first, and are not retried; marks never go', () => {
    // Two stars whose names, to the right, both cover the centroid's row and its two neighbours.
    const s0: LabelMark = { x: 150, y: 150, sizePx: 15 };
    const s1: LabelMark = { x: 150, y: 150 + FIGURE_NAME_PX, sizePx: 12 };
    const s2: LabelMark = { x: 150, y: 150 - FIGURE_NAME_PX, sizePx: 12 };
    const stars = [
      { key: 10, mark: 0, text: 'Brightest' },
      { key: 11, mark: 1, text: 'Fainter' },
      { key: 12, mark: 2, text: 'Faintest' },
    ];
    const lone = { ...figure, endpoints: [{ x: 196, y: 150 }, { x: 204, y: 150 }] };
    const placed = placeLabels(base({ marks: [s0, s1, s2], stars, figures: [lone] }));
    const fig = placed.find((p) => p.kind === 'figure');
    expect(fig).toBeDefined();
    expect(fig?.y).toBe(150);
    // Only what overlapped the centroid's place went, the faintest first until it fitted; the marks stand.
    expect(placed.filter((p) => p.kind !== 'figure').every((p) => !overlaps(p.box, (fig as PlacedLabel).box))).toBe(true);
    expect(texts(placed)).toContain('figure:C M A');
  });
});

// --- The two sky cases (D-755), through the field's own frame ----------------

const catalog = starCatalog();
const PARIS = { lat: 48.86, lon: 2.35 };
const NEUQUEN = { lat: -38.95, lon: -68.06 };

function sky(site: { lat: number; lon: number }, iso: string, con: string, width: number, height: number) {
  const positions = starsAt(catalog, site, Date.parse(iso) as EpochMs);
  const field: StarFieldData = { catalog: sceneCatalog(catalog), positions, layers: { stars: true, figures: true, planets: true, names: true } };
  const prepared = prepare(field);
  const members = [...new Set(field.catalog.figures.filter((f) => f.con === con).flatMap((f) => f.segments.flat()))];
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  // The camera on the figure's mean direction (neither figure straddles north at these instants).
  const rotation = handRotation({ azDeg: mean(members.map((i) => positions.azDeg[i] ?? 0)), altDeg: mean(members.map((i) => positions.altDeg[i] ?? 0)) });
  const view: View = { fovDeg: WINDOW_FOV, width, height, screenAngleDeg: 0 };
  const input = labelInput(frameOf(rotation, view, field, prepared), view, field, prepared, null);
  return { input, placed: placeLabels(input) };
}

const markBox = (m: LabelMark): Box => ({ x0: m.x - (0.3 * m.sizePx), y0: m.y - 0.3 * m.sizePx, x1: m.x + 0.3 * m.sizePx, y1: m.y + 0.3 * m.sizePx });
const inside = (b: Box, x: number, y: number): boolean => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;

describe.each([
  ['Orion over Paris', PARIS, '2026-12-15T23:00:00Z', 'Ori'],
  ['Crux over Neuquén', NEUQUEN, '2027-04-15T03:00:00Z', 'Cru'],
] as const)('%s', (_, site, iso, con) => {
  it.each([
    [390, 390],
    [798, 498],
  ])('at %i × %i no label covers a mark, a segment or another label', (width, height) => {
    const { input, placed } = sky(site, iso, con, width, height);
    expect(input.figures.some((f) => f.con === con)).toBe(true);
    expect(placed.length).toBeGreaterThan(0);
    for (const label of placed) {
      expect(input.marks.some((m) => overlaps(markBox(m), label.box))).toBe(false);
      for (const s of input.segments) {
        const steps = Math.max(1, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / SEGMENT_SAMPLE_PX));
        for (let k = 0; k <= steps; k += 1) expect(inside(label.box, s.x1 + ((s.x2 - s.x1) * k) / steps, s.y1 + ((s.y2 - s.y1) * k) / steps)).toBe(false);
      }
      expect(placed.filter((other) => other !== label && overlaps(other.box, label.box))).toEqual([]);
      expect(label.box.x0 >= 0 && label.box.y0 >= 0 && label.box.x1 <= width && label.box.y1 <= height).toBe(true);
    }
  });
});

// The Done cases (D-755 as amended, V24-22, V24-23): 390 × 390 is the phone's box, 798 × 498 the box the page draws at 1280 × 800.
const figureText = (placed: PlacedLabel[]): string[] => placed.filter((p) => p.kind === 'figure').map((p) => p.text);
const starText = (placed: PlacedLabel[]): string[] => placed.filter((p) => p.kind === 'star').map((p) => p.text);

describe('Orion over Paris (D-755 as amended, V24-22, V24-23)', () => {
  it('places `O R I O N` at 390 and at 1280, and `Betelgeuse` at 1280', () => {
    const phone = sky(PARIS, '2026-12-15T23:00:00Z', 'Ori', 390, 390).placed;
    const desk = sky(PARIS, '2026-12-15T23:00:00Z', 'Ori', 798, 498).placed;
    expect(figureText(phone)).toContain('O R I O N');
    expect(figureText(desk)).toContain('O R I O N');
    expect(starText(desk)).toContain('Betelgeuse');
  });

  it('at 390 drops `Betelgeuse`, whose four places Orion covers; a tap names it (V24-23)', () => {
    expect(starText(sky(PARIS, '2026-12-15T23:00:00Z', 'Ori', 390, 390).placed)).not.toContain('Betelgeuse');
  });
});

describe('Crux over Neuquén (D-755 as amended, V24-22)', () => {
  // The cross is narrower than `C R U X` less two cells at 390 and at 1280, so the fit rule gives the abbreviation; a wider box gives the full name.
  it('places `C R U` at 390 and at 1280, and `C R U X` in a 900 × 640 box', () => {
    expect(figureText(sky(NEUQUEN, '2027-04-15T03:00:00Z', 'Cru', 390, 390).placed)).toContain('C R U');
    expect(figureText(sky(NEUQUEN, '2027-04-15T03:00:00Z', 'Cru', 798, 498).placed)).toContain('C R U');
    expect(figureText(sky(NEUQUEN, '2027-04-15T03:00:00Z', 'Cru', 900, 640).placed)).toContain('C R U X');
  });
});
