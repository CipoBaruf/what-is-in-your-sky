/**
 * R116 (FR-STAR-6 as amended, FR-STAR-7; V24-16; PLAN D-755): the label
 * placement — which names the star field draws, and where, so that no label
 * covers a drawn mark, a drawn segment or another label. Pure: the field hands
 * in what it drew this frame, in the box's px, and gets back the placed labels
 * with their boxes; the DOM writes are `StarField`'s.
 *
 * Text is measured as `n × 0.6 em` at the token's size (`--font-mono`'s
 * advance), with the spacing already in the string (`C R U X`, three spaces
 * between words), so a box is the same in every engine and in jsdom. A mark's
 * box is its glyph's cell, 0.6 em square, centred on the ink (which is where
 * `inkOffsets` puts it). Occupied space is the mark boxes, the compass boxes
 * and each drawn segment sampled every `SEGMENT_SAMPLE_PX`.
 *
 * The order (FR-STAR-6, D-755):
 *
 * 1. The compass, fixed: its boxes are occupied before anything is placed.
 * 2. The named mark's label (FR-STAR-7), at the first of right, left, above and
 *    below that is free. The reader asked for it, so it is never dropped: with
 *    no free place it takes the first of the four that is inside the box.
 * 3. The star names, brightest first, at the first free place of the same four;
 *    a name with no free place is dropped.
 * 4. The figure names, the figure with the most drawn segments first: the full
 *    spaced name where its width fits the drawn endpoints' width plus two
 *    cells, else the abbreviation; at the centroid of the drawn endpoints, then
 *    one row above, then one below, then (V24-22) the free place nearest the
 *    centroid on a grid of one row by one cell over the figure's drawn extent;
 *    then the abbreviation the same way. A figure with no free place takes the
 *    first place of that walk that only star names are in the way of, and the
 *    star names it covers are removed,
 *    faintest first — so `Ori` is not lost to `Betelgeuse`. A removed star name
 *    is not retried, and no mark and no compass point is ever dropped for a name.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface LabelPoint {
  x: number;
  y: number;
}

/** A drawn glyph: where its ink is centred, and its size token's px. */
export interface LabelMark extends LabelPoint {
  sizePx: number;
}

/** A drawn figure segment, as the line node is written (the gaps already taken off its ends). */
export interface LabelSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A name beside a mark: the named object's label, or a star's proper name. `mark` indexes `LabelInput.marks`; `key` is the caller's. */
export interface MarkLabel {
  key: number;
  mark: number;
  text: string;
}

/** A figure that may be named: its Latin name and abbreviation as data, and its drawn endpoints. */
export interface FigureLabel {
  key: number;
  name: string;
  con: string;
  /** How many of its segments are drawn: a figure is named from two. */
  segments: number;
  endpoints: readonly LabelPoint[];
}

export interface LabelInput {
  width: number;
  height: number;
  marks: readonly LabelMark[];
  segments: readonly LabelSegment[];
  compass: readonly Box[];
  named: MarkLabel | null;
  /** The star-name candidates, brightest first. */
  stars: readonly MarkLabel[];
  figures: readonly FigureLabel[];
}

type LabelKind = 'named' | 'star' | 'figure';

/** A placed label: drawn centred on (`x`, `y`) with `text-anchor: middle` and `dominant-baseline: central`. */
export interface PlacedLabel {
  kind: LabelKind;
  key: number;
  text: string;
  x: number;
  y: number;
  box: Box;
}

/** The sheet's sizes for the two kinds of name (FR-STAR-6): star names and the named label at `--chart-text-12`, figure names at `--chart-text-11`. */
export const STAR_NAME_PX = 12;
export const FIGURE_NAME_PX = 11;
/** `--font-mono`'s advance, in em: a cell is this wide. */
export const ADVANCE_EM = 0.6;
/** D-755: a drawn segment is occupied space at every this many px along it. */
export const SEGMENT_SAMPLE_PX = 4;
/** The space between a mark's box and its name: half a cell at the name's size. */
const GAP_EM = ADVANCE_EM / 2;

/** FR-STAR-6: the figure's name in spaced capitals, `Crux` → `C R U X`, three spaces between two words. */
export function spaced(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => [...word.toLocaleUpperCase('en')].join(' '))
    .join('   ');
}

/** A label's width at its size: `n × 0.6 em`, by code point (`Ö` is one cell). */
export const textWidth = (text: string, sizePx: number): number => [...text].length * ADVANCE_EM * sizePx;

const boxAt = (cx: number, cy: number, w: number, h: number): Box => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const markBox = (m: LabelMark): Box => boxAt(m.x, m.y, ADVANCE_EM * m.sizePx, ADVANCE_EM * m.sizePx);

/** The fixed obstacles — marks, segment samples, compass boxes — in a grid of `CELL` px, so a query is a few cells and not the whole field. */
const CELL = 24;
class Obstacles {
  private readonly cells = new Map<number, Box[]>();
  add(box: Box): void {
    this.each(box, (key) => {
      const list = this.cells.get(key);
      if (list) list.push(box);
      else this.cells.set(key, [box]);
    });
  }
  hits(box: Box): boolean {
    let hit = false;
    this.each(box, (key) => {
      if (!hit) hit = (this.cells.get(key) ?? []).some((b) => overlaps(b, box));
    });
    return hit;
  }
  private each(box: Box, visit: (key: number) => void): void {
    const cx0 = Math.floor(box.x0 / CELL);
    const cx1 = Math.floor(box.x1 / CELL);
    const cy0 = Math.floor(box.y0 / CELL);
    const cy1 = Math.floor(box.y1 / CELL);
    for (let cx = cx0; cx <= cx1; cx += 1) for (let cy = cy0; cy <= cy1; cy += 1) visit(cx * 65536 + cy);
  }
}

/** The four places beside a mark, in FR-STAR-6's order: right, left, above, below. */
function besideMark(mark: LabelMark, text: string): Box[] {
  const w = textWidth(text, STAR_NAME_PX);
  const h = STAR_NAME_PX;
  const half = (ADVANCE_EM * mark.sizePx) / 2;
  const gap = GAP_EM * STAR_NAME_PX;
  return [
    boxAt(mark.x + half + gap + w / 2, mark.y, w, h),
    boxAt(mark.x - half - gap - w / 2, mark.y, w, h),
    boxAt(mark.x, mark.y - half - gap - h / 2, w, h),
    boxAt(mark.x, mark.y + half + gap + h / 2, w, h),
  ];
}

/**
 * The grid of V24-22: offsets from the centroid, one cell across by one row
 * down, whose point falls inside `extent` (the caller's: the drawn extent
 * grown by half the name's box, so the box reaches into it), nearest first
 * (ties by row, then column, so the order is fixed). The three places of
 * D-755 are tried before it, so the centroid's own row is not repeated.
 */
function gridOffsets(cx: number, cy: number, extent: Box, cell: number, row: number): { dx: number; dy: number }[] {
  const out: { dx: number; dy: number; d: number }[] = [];
  const i0 = Math.ceil((extent.x0 - cx) / cell);
  const i1 = Math.floor((extent.x1 - cx) / cell);
  const j0 = Math.ceil((extent.y0 - cy) / row);
  const j1 = Math.floor((extent.y1 - cy) / row);
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      if (i === 0 && j >= -1 && j <= 1) continue;
      const dx = i * cell;
      const dy = j * row;
      out.push({ dx, dy, d: dx * dx + dy * dy });
    }
  }
  return out.sort((a, b) => a.d - b.d || a.dy - b.dy || a.dx - b.dx).map(({ dx, dy }) => ({ dx, dy }));
}

const centre = (box: Box): LabelPoint => ({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 });

export function placeLabels(input: LabelInput): PlacedLabel[] {
  const { width, height, marks } = input;
  const inside = (b: Box): boolean => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= width && b.y1 <= height;

  const fixed = new Obstacles();
  for (const m of marks) fixed.add(markBox(m));
  for (const s of input.segments) {
    const steps = Math.max(1, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / SEGMENT_SAMPLE_PX));
    for (let k = 0; k <= steps; k += 1) {
      const x = s.x1 + ((s.x2 - s.x1) * k) / steps;
      const y = s.y1 + ((s.y2 - s.y1) * k) / steps;
      fixed.add({ x0: x, y0: y, x1: x, y1: y });
    }
  }
  for (const b of input.compass) fixed.add(b);

  // The placed labels, few enough to scan; a star name may be removed again by a figure.
  const placed: PlacedLabel[] = [];
  /** Star names by their rank among the candidates, for "faintest first". */
  const rank = new Map<PlacedLabel, number>();
  const labelHit = (b: Box): boolean => placed.some((p) => overlaps(p.box, b));
  const free = (b: Box): boolean => inside(b) && !fixed.hits(b) && !labelHit(b);
  const put = (kind: LabelKind, key: number, text: string, box: Box): PlacedLabel => {
    const { x, y } = centre(box);
    const label = { kind, key, text, x, y, box };
    placed.push(label);
    return label;
  };

  const named = input.named;
  const namedMark = named ? marks[named.mark] : undefined;
  if (named && namedMark) {
    const places = besideMark(namedMark, named.text);
    const box = places.find(free) ?? places.find(inside) ?? places[0];
    if (box) put('named', named.key, named.text, box);
  }

  input.stars.forEach((star, i) => {
    const mark = marks[star.mark];
    // The named mark carries its label already; its name is not drawn twice.
    if (!mark || (named !== null && star.mark === named.mark)) return;
    const box = besideMark(mark, star.text).find(free);
    if (box) rank.set(put('star', star.key, star.text, box), i);
  });

  const figures = input.figures.filter((f) => f.segments >= 2 && f.endpoints.length > 0);
  const order = figures.map((f, i) => ({ f, i })).sort((a, b) => b.f.segments - a.f.segments || a.i - b.i);
  for (const { f } of order) {
    let x0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    let sx = 0;
    let sy = 0;
    for (const p of f.endpoints) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
      sx += p.x;
      sy += p.y;
    }
    const cx = sx / f.endpoints.length;
    const cy = sy / f.endpoints.length;
    const full = spaced(f.name);
    const abbr = spaced(f.con);
    const cell = ADVANCE_EM * FIGURE_NAME_PX;
    const forms = textWidth(full, FIGURE_NAME_PX) <= x1 - x0 + 2 * cell ? [full, abbr] : [abbr];
    const row = FIGURE_NAME_PX;
    // V24-22: past the three places, the grid over the drawn extent (a place whose box reaches into it), one row by one cell, nearest the centroid first.
    // The extent is clipped to the places whose box fits the field, so a figure reaching far past the edge costs no more than the field.
    function* search(): Generator<{ text: string; box: Box }> {
      for (const text of forms) {
        const w = textWidth(text, FIGURE_NAME_PX);
        for (const dy of [0, -row, row]) yield { text, box: boxAt(cx, cy + dy, w, FIGURE_NAME_PX) };
        const extent = { x0: Math.max(x0 - w / 2, w / 2), y0: Math.max(y0 - row / 2, row / 2), x1: Math.min(x1 + w / 2, width - w / 2), y1: Math.min(y1 + row / 2, height - row / 2) };
        for (const { dx, dy } of gridOffsets(cx, cy, extent, cell, row)) yield { text, box: boxAt(cx + dx, cy + dy, w, FIGURE_NAME_PX) };
      }
    }
    const first = (test: (box: Box) => boolean): { text: string; box: Box } | undefined => {
      for (const place of search()) if (test(place.box)) return place;
      return undefined;
    };
    const found = first(free);
    if (found) {
      put('figure', f.key, found.text, found.box);
      continue;
    }
    // A figure keeps its name: the first place of the same walk that only star names are in the way of, and those names go, faintest first.
    const yielding = first((box) => inside(box) && !fixed.hits(box) && placed.every((p) => p.kind === 'star' || !overlaps(p.box, box)));
    if (!yielding) continue;
    const inWay = placed.filter((p) => p.kind === 'star' && overlaps(p.box, yielding.box)).sort((a, b) => (rank.get(b) ?? 0) - (rank.get(a) ?? 0));
    for (const p of inWay) {
      placed.splice(placed.indexOf(p), 1);
      if (!labelHit(yielding.box)) break;
    }
    put('figure', f.key, yielding.text, yielding.box);
  }
  return placed;
}
