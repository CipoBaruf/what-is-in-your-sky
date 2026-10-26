import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { CONSTELLATION_NAMES } from '../../../../../data/stars/constellations';
import { useLocale } from '../../../../../i18n/useT';
import { useStarsPageT, type StarsPageMessages } from '../../../../../i18n/starsPageT';
import { compassPoint } from '../../../../../lib/compass';
import { degrees } from '../../../../../lib/format';
import type { Locale } from '../../../../../model';
import { formatStarMag } from '../../../../screens/stars/field';
import { inkMeasured, inkOffset, inkOffsetsReady } from './inkOffsets';
import { COMPASS, converged, drawableDeg, EDGE_MARGIN_PX, groundClipPath, groundState, HORIZON, lookDirection, NAME_ALT_DEG, project, type Mat3, type View } from './projection';
import type { StarField as StarFieldData } from './scene';
import styles from './SkyWindow.module.css';
import { collide, COLLISION_PX, magnitudeOrder, planetRungFor, rungFor, SIZE_PX, type Point, type Rung, type SizeToken, type StarGlyph } from './starGlyphs';
import glyphStyles from './starGlyphs.module.css';
import { placeLabels, textWidth, type Box, type FigureLabel, type LabelInput, type LabelMark, type LabelSegment, type MarkLabel } from './starLabels';
import type { RotationListener } from './useViewRotation';

/**
 * R113 (FR-STAR-9 as amended, FR-STAR-11; PLAN D-751, D-744): the star field's
 * node set, the window's one layer written outside React. The component is a
 * `memo` child whose props change only when the catalogue, the positions, the
 * layer set, the box or the labelled object does; its nodes are rendered then
 * and never again, and each rotation the window publishes is written to them
 * by the subscriber below — one subscriber, one pass per published rotation,
 * no render of this component in between.
 *
 * R114 (FR-STAR-6 as amended, FR-DS-8 as amended; D-746, D-752, D-753, D-754)
 * fills the group, in this order under the horizon and the rings the window
 * draws over it:
 *
 * - **The ground**: one `<path>` of the horizon's closed image, filled with
 *   `--chart-ground` at `--window-fill-opacity`, so the sky has a floor. The
 *   image is `groundClipPath`'s; which side of it is the ground depends on
 *   where the centre of the field is (above the horizon the ground is outside
 *   the curve, below it inside), so the path is the image against the box
 *   with `evenodd` on one side and the image alone on the other. FR-FOL-5's
 *   hatch and notes sit over it unchanged, and the compass points are the
 *   window's own.
 * - **The figures**: one `<line>` per segment, `--chart-hairline` in
 *   `--chart-figure`, each end moved toward the other by the collision
 *   distance so a line never touches a star, a segment shorter than the two
 *   gaps hidden, a segment with both ends below the horizon hidden, and the
 *   group under a `clipPath` of the sky side of the same image (plus the
 *   field's edge, which the SVG clips at as it does an arc).
 * - **The stars and the planets**: one `<text>` per catalogue star and per
 *   planet, the glyph, size and tone from `starGlyphs`' ladder, the em box
 *   centred on the point by the stylesheet and the ink shifted onto it by
 *   `dx`/`dy` from `inkOffsets` — written when the node is made (or again,
 *   once, when the measurement lands after the first mount), never per frame.
 *   Per rotation each gets `x`, `y` and `visibility`: hidden below the horizon,
 *   outside the box, or when a brighter glyph is within half the small size.
 *
 * R116 (FR-STAR-6 as amended, FR-STAR-7; V24-16; D-755) adds the names, over
 * the marks: one `<text>` per star of V ≤ 1.5 with a proper name, one per
 * figure (its text, the full spaced name or the abbreviation, written by ref
 * when the placement changes it), and one for the labelled object — the mark
 * the reader tapped, hovered or picked from `In this field` — whose words are
 * React's, since they change only with `labelled`. `starLabels.placeLabels`
 * decides which are drawn and where; it reruns only when the rotation has moved
 * past `converged()` since it last ran (D-751), so the names do not re-collide
 * at the sensor's jitter. Each pass also leaves the glyphs as drawn in `hits`,
 * which the window's tap and hover read with `hitTest` (FR-STAR-6: no hit node
 * per star).
 *
 * The group's own `visibility` is still the first write of every pass: hidden
 * when FR-FOL-5's `buried` state leaves no sky in the field (the frame the
 * window itself draws nothing in), visible otherwise.
 */
export interface StarFieldProps {
  field: StarFieldData;
  view: View;
  /** `useViewRotation`'s channel: one call per rotation the window draws, in the commit that draws it. */
  subscribe: (listener: RotationListener) => () => void;
  /** FR-STAR-7: the object whose label is drawn — the hovered one, else `namedStar` — in `namedStar`'s index space, or `null`. */
  labelled?: number | null;
  /** Written each pass: the glyphs as drawn, `null` for one hidden, in `namedStar`'s index space, for the window's hit test. */
  hits?: { current: readonly (Point | null)[] };
}

const fmt = (n: number): string => n.toFixed(1);
const vis = (show: boolean): 'visible' | 'hidden' => (show ? 'visible' : 'hidden');
/** What each mark or line was last written, so a frame writes `visibility` only where it changes (the per-frame path's cost is its DOM writes). */
const lastShown = new WeakMap<Element, boolean>();
const setShown = (node: Element, show: boolean): void => {
  if (lastShown.get(node) === show) return;
  lastShown.set(node, show);
  node.setAttribute('visibility', vis(show));
};
/** How far outside the box a glyph is still drawn, so the largest leaves the frame rather than winking out at its edge: half the top size. */
const EDGE_PX = SIZE_PX['chart-text-18'] / 2;
/** A segment's end this far beyond the drawable field is still projected, so a line to a star just outside the frame is drawn to the edge (the spike's margin). */
const SEGMENT_MARGIN_DEG = 15;
/** The gap a figure line keeps from the glyph at each end, and the least a segment may measure to be drawn at all. */
const GAP_PX = COLLISION_PX;
/** FR-STAR-6: the star names are the IAU proper names of the stars this bright or brighter. */
const NAMED_MAG = 1.5;
/** The compass names' sizes, the window stylesheet's `.compass` and `.compassMajor`. */
const COMPASS_PX = { major: 15, minor: 12 };

/** A figure's Latin name: the table's (data, the same in both languages), the half of Serpens by its part's word, the abbreviation where the table has none. */
function latinName(con: string, part: string): string {
  const names = Object.hasOwn(CONSTELLATION_NAMES, con) ? (CONSTELLATION_NAMES[con] ?? []) : [];
  return (part === '' ? names[0] : (names.find((name) => name.endsWith(` ${part}`)) ?? names[0])) ?? con;
}

/** What a field needs computed once per props and not per frame. */
export interface Prepared {
  /** Each star's rung, in catalogue order. */
  rungs: readonly Rung[];
  /** Each planet's rung at its magnitude now. */
  planetRungs: readonly Rung[];
  /** Every segment as a pair of star indices, in the order the line nodes are rendered. */
  segments: readonly (readonly [number, number])[];
  /** Each figure's segments, as `[first, end)` into `segments`. */
  figureRanges: readonly (readonly [number, number])[];
  /** Each figure's Latin name. */
  figureNames: readonly string[];
  /** The stars that may be named, brightest first: V ≤ 1.5 with a proper name. */
  nameStars: readonly number[];
  /** The stars (index `i`) and the planets (index `n + k`) by magnitude, brightest first: the collision walk's order. */
  order: readonly number[];
}

export function prepare(field: StarFieldData): Prepared {
  const { catalog, positions } = field;
  const n = catalog.mag.length;
  const rungs: Rung[] = [];
  for (let i = 0; i < n; i += 1) rungs.push(rungFor(catalog.mag[i] ?? 0));
  const planetRungs = positions.planets.map((planet) => planetRungFor(planet.mag));
  const segments = catalog.figures.flatMap((figure) => figure.segments);
  let at = 0;
  const figureRanges = catalog.figures.map((figure): readonly [number, number] => {
    const range = [at, at + figure.segments.length] as const;
    at += figure.segments.length;
    return range;
  });
  const figureNames = catalog.figures.map((figure) => latinName(figure.con, figure.part));
  const mag = (k: number): number => (k < n ? (catalog.mag[k] ?? 0) : (positions.planets[k - n]?.mag ?? 0));
  const order = magnitudeOrder([...Array.from(catalog.mag), ...positions.planets.map((planet) => planet.mag)]);
  const nameStars = order.filter((k) => k < n && mag(k) <= NAMED_MAG && (catalog.name[k] ?? '') !== '');
  return { rungs, planetRungs, segments, figureRanges, figureNames, nameStars, order };
}

/** The size, in px, the glyph of object `k` (`namedStar`'s index space) is drawn at. */
const sizeOf = (prepared: Prepared, n: number, k: number): number => SIZE_PX[(k < n ? prepared.rungs[k] : prepared.planetRungs[k - n])?.sizeToken ?? 'chart-text-12'];

/**
 * FR-STAR-7: the label's words — the proper name, or the designation where
 * there is none, or the planet's name in the reader's language — and the
 * magnitude, `Canopus · mag −0.7`.
 */
function labelText(field: StarFieldData, k: number, p: StarsPageMessages, locale: Locale): string | null {
  const { catalog, positions } = field;
  const n = catalog.mag.length;
  if (k < n) {
    const name = catalog.name[k] ?? '';
    return `${name === '' ? (catalog.desig[k] ?? '') : name} · ${p.mag({ mag: formatStarMag(catalog.mag[k] ?? 0, locale) })}`;
  }
  const planet = positions.planets[k - n];
  return planet ? `${p.planets[planet.body]} · ${p.mag({ mag: formatStarMag(planet.mag, locale) })}` : null;
}

/** FR-STAR-7: the readout's second line for object `k`, the list row's words, "Canopus · mag −0.7 · 28° up · S". */
export function namedReadout(field: StarFieldData, k: number, p: StarsPageMessages, locale: Locale): string | null {
  const { catalog, positions } = field;
  const n = catalog.mag.length;
  const planet = k < n ? null : positions.planets[k - n];
  if (k >= n && !planet) return null;
  const starName = catalog.name[k] ?? '';
  const name = planet ? p.planets[planet.body] : starName === '' ? (catalog.desig[k] ?? '') : starName;
  const mag = planet ? planet.mag : (catalog.mag[k] ?? 0);
  const altDeg = planet ? planet.altDeg : (positions.altDeg[k] ?? 0);
  const azDeg = planet ? planet.azDeg : (positions.azDeg[k] ?? 0);
  return p.named({ name, mag: formatStarMag(mag, locale), altitude: degrees(altDeg), point: compassPoint(azDeg) });
}

/** What one rotation draws, before any node is written: pure, so the label test reads the same frame the field draws. */
export interface FieldFrame {
  state: ReturnType<typeof groundState>;
  /** The sky clip's and the ground fill's `d`. */
  clip: string;
  ground: string;
  /** Every star projected: x, y. */
  xs: Float64Array;
  ys: Float64Array;
  /** The glyphs as drawn, `null` for one hidden: stars at `i`, planets at `n + k`. */
  drawn: (Point | null)[];
  /** Each segment as its line is drawn, `null` for one hidden. */
  lines: (LabelSegment | null)[];
  /** The compass names' boxes, where they are drawn. */
  compass: Box[];
}

/** The pure half of the per-rotation pass: where everything goes. `drawField` writes it; `labelInput` names it. */
export function frameOf(rotation: Mat3, view: View, field: StarFieldData, prepared: Prepared): FieldFrame {
  const { catalog, positions, layers } = field;
  const n = catalog.mag.length;
  const look = lookDirection(rotation);
  const state = groundState(look.altDeg, view);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const drawn: (Point | null)[] = Array.from({ length: n + positions.planets.length }, () => null);
  const lines: (LabelSegment | null)[] = prepared.segments.map(() => null);
  if (state === 'buried') return { state, clip: '', ground: '', xs, ys, drawn, lines, compass: [] };

  // The horizon's closed image, and which side of it is the sky (D-754).
  const image = groundClipPath(HORIZON.map((p) => project(rotation, p.azDeg, p.elDeg, view)));
  const box = `M0 0H${fmt(view.width)}V${fmt(view.height)}H0Z`;
  const outside = image === '' ? '' : `${box}${image}`;
  const skyUp = look.altDeg >= 0;
  const clip = (skyUp ? image : outside) || box;
  const ground = skyUp ? outside : image;

  const limit = drawableDeg(view);
  const inBox = (x: number, y: number): boolean => x >= -EDGE_PX && x <= view.width + EDGE_PX && y >= -EDGE_PX && y <= view.height + EDGE_PX;

  // Every star projected once: the glyphs need the ones up and in the box, the segments need both ends whatever they are.
  const off = new Float64Array(n);
  const front = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const q = project(rotation, positions.azDeg[i] ?? 0, positions.altDeg[i] ?? 0, view);
    xs[i] = q.x;
    ys[i] = q.y;
    off[i] = q.offAxisDeg;
    front[i] = q.front ? 1 : 0;
  }

  // The glyphs in view, then the collision walk in magnitude order over stars and planets together.
  const points: (Point | null)[] = Array.from({ length: n + positions.planets.length }, () => null);
  if (layers.stars) {
    for (let i = 0; i < n; i += 1) {
      const x = xs[i] ?? 0;
      const y = ys[i] ?? 0;
      if ((positions.altDeg[i] ?? -1) >= 0 && front[i] === 1 && (off[i] ?? 180) <= limit && inBox(x, y)) points[i] = { x, y };
    }
  }
  if (layers.planets) {
    positions.planets.forEach((planet, k) => {
      if (planet.altDeg < 0) return;
      const q = project(rotation, planet.azDeg, planet.altDeg, view);
      if (q.front && q.offAxisDeg <= limit && inBox(q.x, q.y)) points[n + k] = { x: q.x, y: q.y };
    });
  }
  const kept = collide(prepared.order.map((k) => points[k] ?? null));
  prepared.order.forEach((k, j) => {
    if (kept[j]) drawn[k] = points[k] ?? null;
  });

  // The figures: the gap at each end, the short ones and the buried ones hidden; the clip keeps the rest on the sky side.
  if (layers.figures) {
    const segmentLimit = limit + SEGMENT_MARGIN_DEG;
    prepared.segments.forEach(([a, b], s) => {
      const up = (positions.altDeg[a] ?? -1) >= 0 || (positions.altDeg[b] ?? -1) >= 0;
      const seen = front[a] === 1 && front[b] === 1 && (off[a] ?? 180) <= segmentLimit && (off[b] ?? 180) <= segmentLimit;
      const x1 = xs[a] ?? 0;
      const y1 = ys[a] ?? 0;
      const x2 = xs[b] ?? 0;
      const y2 = ys[b] ?? 0;
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (!(up && seen && length >= 2 * GAP_PX)) return;
      const ux = ((x2 - x1) / length) * GAP_PX;
      const uy = ((y2 - y1) / length) * GAP_PX;
      lines[s] = { x1: x1 + ux, y1: y1 + uy, x2: x2 - ux, y2: y2 - uy };
    });
  }

  // The compass names, as the window draws them (`textAnchor: middle` on the alphabetic baseline), where they are in the box.
  const compass: Box[] = [];
  for (const { azDeg, name, major } of COMPASS) {
    const q = project(rotation, azDeg, NAME_ALT_DEG, view);
    // The window's own rule for a compass name in view (`inFrame`), not the glyphs' margin.
    if (!q.front || q.x < -EDGE_MARGIN_PX || q.x > view.width + EDGE_MARGIN_PX || q.y < -EDGE_MARGIN_PX || q.y > view.height + EDGE_MARGIN_PX) continue;
    const size = major ? COMPASS_PX.major : COMPASS_PX.minor;
    const w = textWidth(name, size);
    compass.push({ x0: q.x - w / 2, y0: q.y - 0.8 * size, x1: q.x + w / 2, y1: q.y + 0.2 * size });
  }
  return { state, clip, ground, xs, ys, drawn, lines, compass };
}

/** Which marks and lines a frame draws, as a key: the names are placed again when it changes, however small the move. */
function drawnKey(frame: FieldFrame): string {
  let marks = 0;
  let sum = 0;
  frame.drawn.forEach((p, k) => {
    if (!p) return;
    marks += 1;
    sum += k;
  });
  let lines = 0;
  for (const line of frame.lines) if (line) lines += 1;
  return `${frame.state}:${String(marks)}:${String(sum)}:${String(lines)}`;
}

/** The placement's input for one frame (D-755): the drawn marks and lines, the compass, the labelled object, the star names, the figures. */
export function labelInput(frame: FieldFrame, view: View, field: StarFieldData, prepared: Prepared, labelled: { index: number; text: string } | null): LabelInput {
  const { catalog, positions, layers } = field;
  const n = catalog.mag.length;
  const marks: LabelMark[] = [];
  const markOf = new Map<number, number>();
  frame.drawn.forEach((p, k) => {
    if (!p) return;
    markOf.set(k, marks.length);
    marks.push({ x: p.x, y: p.y, sizePx: sizeOf(prepared, n, k) });
  });
  const segments = frame.lines.filter((line): line is LabelSegment => line !== null);
  // A labelled star whose glyph the collision hid (a row of `In this field` can name it) is still named, at its own point.
  if (labelled && layers.stars && !markOf.has(labelled.index)) {
    const x = frame.xs[labelled.index] ?? Number.NaN;
    const y = frame.ys[labelled.index] ?? Number.NaN;
    if ((positions.altDeg[labelled.index] ?? -1) >= 0 && x >= 0 && y >= 0 && x <= view.width && y <= view.height) {
      markOf.set(labelled.index, marks.length);
      marks.push({ x, y, sizePx: sizeOf(prepared, n, labelled.index) });
    }
  }
  const namedMark = labelled ? markOf.get(labelled.index) : undefined;
  const named: MarkLabel | null = labelled && namedMark !== undefined ? { key: labelled.index, mark: namedMark, text: labelled.text } : null;
  const stars: MarkLabel[] = [];
  const figures: FigureLabel[] = [];
  if (layers.names) {
    for (const i of prepared.nameStars) {
      const mark = markOf.get(i);
      if (mark !== undefined) stars.push({ key: i, mark, text: catalog.name[i] ?? '' });
    }
    if (layers.figures) {
      catalog.figures.forEach((figure, f) => {
        const [first, end] = prepared.figureRanges[f] ?? [0, 0];
        let count = 0;
        const ends = new Set<number>();
        for (let s = first; s < end; s += 1) {
          if (!frame.lines[s]) continue;
          count += 1;
          const [a, b] = prepared.segments[s] ?? [0, 0];
          if ((positions.altDeg[a] ?? -1) >= 0) ends.add(a);
          if ((positions.altDeg[b] ?? -1) >= 0) ends.add(b);
        }
        if (count < 2) return;
        const endpoints = [...ends].map((i) => ({ x: frame.xs[i] ?? 0, y: frame.ys[i] ?? 0 }));
        figures.push({ key: f, name: prepared.figureNames[f] ?? figure.con, con: figure.con, segments: count, endpoints });
      });
    }
  }
  return { width: view.width, height: view.height, marks, segments, compass: frame.compass, named, stars, figures };
}

/** The nodes the per-rotation pass writes, found once per node set. */
interface Nodes {
  clip: SVGPathElement | null;
  ground: SVGPathElement | null;
  lines: SVGLineElement[];
  stars: SVGTextElement[];
  planets: SVGTextElement[];
  starNames: Map<number, SVGTextElement>;
  figureNames: SVGTextElement[];
  label: SVGTextElement | null;
}

const collect = (group: SVGGElement): Nodes => ({
  clip: group.querySelector<SVGPathElement>('[data-sky-clip]'),
  ground: group.querySelector<SVGPathElement>('[data-ground-fill]'),
  lines: [...group.querySelectorAll<SVGLineElement>('[data-figures] > line')],
  stars: [...group.querySelectorAll<SVGTextElement>('[data-marks] > text')],
  planets: [...group.querySelectorAll<SVGTextElement>('[data-planet-marks] > text')],
  starNames: new Map([...group.querySelectorAll<SVGTextElement>('[data-star-name]')].map((node) => [Number(node.dataset.starName), node])),
  figureNames: [...group.querySelectorAll<SVGTextElement>('[data-figure-name]')],
  label: group.querySelector<SVGTextElement>('[data-star-label]'),
});

/** The per-rotation write of the marks and the lines: everything but the names. */
function drawField(group: SVGGElement, nodes: Nodes, frame: FieldFrame, field: StarFieldData): void {
  group.setAttribute('visibility', vis(frame.state !== 'buried'));
  // A child written `visible` overrides an inherited `hidden` in SVG, so the buried frame takes the whole group out of the drawing.
  if (frame.state === 'buried') {
    group.setAttribute('display', 'none');
    return;
  }
  group.removeAttribute('display');
  nodes.clip?.setAttribute('d', frame.clip);
  nodes.ground?.setAttribute('d', frame.ground);

  const { catalog, positions, layers } = field;
  const n = catalog.mag.length;
  const write = (node: SVGElement | undefined, p: Point | null | undefined): void => {
    if (!node) return;
    const show = p !== null && p !== undefined;
    setShown(node, show);
    if (!show) return;
    node.setAttribute('x', fmt(p.x));
    node.setAttribute('y', fmt(p.y));
  };
  if (layers.stars) for (let i = 0; i < n; i += 1) write(nodes.stars[i], frame.drawn[i]);
  if (layers.planets) positions.planets.forEach((_, k) => write(nodes.planets[k], frame.drawn[n + k]));
  if (!layers.figures) return;
  frame.lines.forEach((line, s) => {
    const node = nodes.lines[s];
    if (!node) return;
    setShown(node, line !== null);
    if (!line) return;
    node.setAttribute('x1', fmt(line.x1));
    node.setAttribute('y1', fmt(line.y1));
    node.setAttribute('x2', fmt(line.x2));
    node.setAttribute('y2', fmt(line.y2));
  });
}

/** The names' write: every name node hidden unless the placement drew it, the figures' words where they changed. */
function drawNames(nodes: Nodes, input: LabelInput | null): void {
  const placed = input ? placeLabels(input) : [];
  const at = (node: SVGTextElement | null | undefined, x: number, y: number): void => {
    if (!node) return;
    node.setAttribute('x', fmt(x));
    node.setAttribute('y', fmt(y));
    setShown(node, true);
  };
  const shown = new Set<Element>();
  for (const label of placed) {
    const node = label.kind === 'named' ? nodes.label : label.kind === 'star' ? nodes.starNames.get(label.key) : nodes.figureNames[label.key];
    if (!node) continue;
    if (label.kind === 'figure' && node.textContent !== label.text) node.textContent = label.text;
    at(node, label.x, label.y);
    shown.add(node);
  }
  const hide = (node: SVGTextElement | null | undefined): void => {
    if (node && !shown.has(node)) setShown(node, false);
  };
  hide(nodes.label);
  for (const node of nodes.starNames.values()) hide(node);
  for (const node of nodes.figureNames) hide(node);
}

/** D-752: the measurement landed after the nodes were made — their `dx`/`dy` are written once more, and never again. */
function applyInk(group: SVGGElement): void {
  for (const node of group.querySelectorAll<SVGTextElement>('text[data-glyph]')) {
    const glyph = node.getAttribute('data-glyph') as StarGlyph;
    const size = node.getAttribute('data-size') as SizeToken;
    const { dx, dy } = inkOffset(glyph, size);
    node.setAttribute('dx', String(dx));
    node.setAttribute('dy', String(dy));
  }
}

function Glyph({ rung, ...rest }: { rung: Rung } & Record<`data-${string}`, string | number>) {
  const { dx, dy } = inkOffset(rung.glyph, rung.sizeToken);
  return (
    <text data-glyph={rung.glyph} data-size={rung.sizeToken} data-tone={rung.colourToken} dx={dx} dy={dy} visibility="hidden" {...rest}>
      {rung.glyph}
    </text>
  );
}

export const StarField = memo(function StarField({ field, view, subscribe, labelled = null, hits }: StarFieldProps) {
  const group = useRef<SVGGElement>(null);
  const clipId = `${useId().replaceAll(':', '')}-sky`;
  const prepared = useMemo(() => prepare(field), [field]);
  const measuredAtRender = inkMeasured();
  const p = useStarsPageT();
  const locale = useLocale();
  const label = labelled === null ? null : labelText(field, labelled, p, locale);

  // A layout effect, like the publisher's: the subscription is in place before the window's first publish of
  // this commit reaches the list, and a late mount is given the current rotation by `subscribe` itself. The
  // nodes are found again whenever the node set may have changed, which is exactly when this effect re-runs.
  useLayoutEffect(() => {
    let nodes: Nodes | null = null;
    let placedAt: Mat3 | null = null;
    let placedSet = '';
    return subscribe((rotation) => {
      const g = group.current;
      if (!g) return;
      nodes ??= collect(g);
      const frame = frameOf(rotation, view, field, prepared);
      drawField(g, nodes, frame, field);
      if (hits) hits.current = frame.drawn;
      // D-751: the names are placed again only once the rotation has moved past `converged()` since they last were,
      // or the drawn set changed under a smaller move (the ground buried or not, a mark in or out of the box).
      const drawnSet = drawnKey(frame);
      if (placedAt !== null && drawnSet === placedSet && converged(placedAt, rotation)) return;
      placedAt = rotation;
      placedSet = drawnSet;
      drawNames(nodes, frame.state === 'buried' ? null : labelInput(frame, view, field, prepared, labelled !== null && label !== null ? { index: labelled, text: label } : null));
    });
  }, [subscribe, view, field, prepared, labelled, label, hits]);

  // D-752: the offsets are measured once, after the fonts are ready. Nodes made before that carry 0 and are
  // written once when the measurement lands; nodes made after it carry the measured values from their render.
  useEffect(() => {
    if (measuredAtRender) return;
    let live = true;
    void inkOffsetsReady().then((measured) => {
      if (live && measured && group.current) applyInk(group.current);
    });
    return () => {
      live = false;
    };
  }, [measuredAtRender, field]);

  const { catalog, positions, layers } = field;
  // A layer that is off is `display: none`, not only `hidden`: its children carry the `visible` the last frame wrote, which would override an inherited `hidden`.
  const hidden = (on: boolean): { visibility?: 'hidden'; display?: 'none' } => (on ? {} : { visibility: 'hidden', display: 'none' });
  return (
    <g ref={group} className={`${styles.stars} ${glyphStyles.glyphs}`} data-layer="stars" data-stars={catalog.mag.length} data-planets={positions.planets.length}>
      <defs>
        <clipPath id={clipId}>
          <path data-sky-clip clipRule="evenodd" d="" />
        </clipPath>
      </defs>
      <path className={styles.ground} data-ground-fill fillRule="evenodd" d="" />
      <g className={styles.figures} data-figures clipPath={`url(#${clipId})`} {...hidden(layers.figures)}>
        {catalog.figures.flatMap((figure, f) => figure.segments.map((_, s) => <line key={`${String(f)}-${String(s)}`} data-figure={f} visibility="hidden" />))}
      </g>
      <g data-marks {...hidden(layers.stars)}>
        {prepared.rungs.map((rung, i) => (
          <Glyph key={i} rung={rung} data-star={i} />
        ))}
      </g>
      <g data-planet-marks {...hidden(layers.planets)}>
        {positions.planets.map((planet, k) => (
          <Glyph key={planet.body} rung={prepared.planetRungs[k] ?? planetRungFor(planet.mag)} data-planet={planet.body} />
        ))}
      </g>
      {/* R116: the names, over the marks; placed by `starLabels`, written by ref like the marks. */}
      <g data-names {...hidden(layers.names)}>
        {prepared.nameStars.map((i) => (
          <text key={i} className={styles.starName} data-star-name={i} visibility="hidden">
            {catalog.name[i]}
          </text>
        ))}
        {catalog.figures.map((figure, f) => (
          <text key={`${figure.con}-${figure.part}`} className={styles.figureName} data-figure-name={f} data-con={figure.con} visibility="hidden" />
        ))}
      </g>
      <text className={styles.starLabel} data-star-label data-labelled={labelled ?? ''} visibility="hidden">
        {label}
      </text>
    </g>
  );
});
