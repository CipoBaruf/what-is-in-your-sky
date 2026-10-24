import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { inkMeasured, inkOffset, inkOffsetsReady } from './inkOffsets';
import { drawableDeg, groundClipPath, groundState, HORIZON, lookDirection, project, type Mat3, type View } from './projection';
import type { StarField as StarFieldData } from './scene';
import styles from './SkyWindow.module.css';
import { collide, COLLISION_PX, planetRungFor, rungFor, SIZE_PX, type ColourToken, type Point, type Rung, type SizeToken, type StarGlyph } from './starGlyphs';
import type { RotationListener } from './useViewRotation';

/**
 * R113 (FR-STAR-9 as amended, FR-STAR-11; PLAN D-751, D-744): the star field's
 * node set, the window's one layer written outside React. The component is a
 * `memo` child whose props change only when the catalogue, the positions, the
 * layer set or the box does; its nodes are rendered then and never again, and
 * each rotation the window publishes is written to them by the subscriber
 * below — one subscriber, one pass per published rotation, no render of this
 * component in between.
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
 * The group's own `visibility` is still the first write of every pass: hidden
 * when FR-FOL-5's `buried` state leaves no sky in the field (the frame the
 * window itself draws nothing in), visible otherwise.
 */
export interface StarFieldProps {
  field: StarFieldData;
  view: View;
  /** `useViewRotation`'s channel: one call per rotation the window draws, in the commit that draws it. */
  subscribe: (listener: RotationListener) => () => void;
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

const SIZE_CLASS: Readonly<Record<SizeToken, string | undefined>> = { 'chart-text-18': styles.size18, 'chart-text-15': styles.size15, 'chart-text-12': styles.size12 };
const TONE_CLASS: Readonly<Record<ColourToken, string | undefined>> = { 'chart-star': styles.star, 'chart-star-dim': styles.starDim, 'chart-star-faint': styles.starFaint, 'chart-planet': styles.planet };
const glyphClass = (rung: Rung): string => [styles.glyph, SIZE_CLASS[rung.sizeToken], TONE_CLASS[rung.colourToken]].filter(Boolean).join(' ');

/** What a field needs computed once per props and not per frame. */
interface Prepared {
  /** Each star's rung, in catalogue order. */
  rungs: readonly Rung[];
  /** Each planet's rung at its magnitude now. */
  planetRungs: readonly Rung[];
  /** Every segment as a pair of star indices, in the order the line nodes are rendered. */
  segments: readonly (readonly [number, number])[];
  /** The stars (index `i`) and the planets (index `n + k`) by magnitude, brightest first: the collision walk's order. */
  order: readonly number[];
}

function prepare(field: StarFieldData): Prepared {
  const { catalog, positions } = field;
  const n = catalog.mag.length;
  const rungs: Rung[] = [];
  for (let i = 0; i < n; i += 1) rungs.push(rungFor(catalog.mag[i] ?? 0));
  const planetRungs = positions.planets.map((planet) => planetRungFor(planet.mag));
  const segments = catalog.figures.flatMap((figure) => figure.segments);
  const mag = (k: number): number => (k < n ? (catalog.mag[k] ?? 0) : (positions.planets[k - n]?.mag ?? 0));
  const order = Array.from({ length: n + positions.planets.length }, (_, k) => k).sort((a, b) => mag(a) - mag(b));
  return { rungs, planetRungs, segments, order };
}

/** The nodes the per-rotation pass writes, found once per node set. */
interface Nodes {
  clip: SVGPathElement | null;
  ground: SVGPathElement | null;
  lines: SVGLineElement[];
  stars: SVGTextElement[];
  planets: SVGTextElement[];
}

const collect = (group: SVGGElement): Nodes => ({
  clip: group.querySelector<SVGPathElement>('[data-sky-clip]'),
  ground: group.querySelector<SVGPathElement>('[data-ground-fill]'),
  lines: [...group.querySelectorAll<SVGLineElement>('[data-figures] > line')],
  stars: [...group.querySelectorAll<SVGTextElement>('[data-marks] > text')],
  planets: [...group.querySelectorAll<SVGTextElement>('[data-planet-marks] > text')],
});

/** The per-rotation write: everything the field changes outside render goes through here. */
function drawField(group: SVGGElement, nodes: Nodes, rotation: Mat3, view: View, field: StarFieldData, prepared: Prepared): void {
  const look = lookDirection(rotation);
  const state = groundState(look.altDeg, view);
  group.setAttribute('visibility', vis(state !== 'buried'));
  // A child written `visible` overrides an inherited `hidden` in SVG, so the buried frame takes the whole group out of the drawing.
  if (state === 'buried') {
    group.setAttribute('display', 'none');
    return;
  }
  group.removeAttribute('display');

  // The horizon's closed image, and which side of it is the sky (D-754).
  const image = groundClipPath(HORIZON.map((p) => project(rotation, p.azDeg, p.elDeg, view)));
  const box = `M0 0H${fmt(view.width)}V${fmt(view.height)}H0Z`;
  const inside = image;
  const outside = image === '' ? '' : `${box}${image}`;
  const skyUp = look.altDeg >= 0;
  nodes.clip?.setAttribute('d', (skyUp ? inside : outside) || box);
  nodes.ground?.setAttribute('d', skyUp ? outside : inside);

  const { catalog, positions, layers } = field;
  const n = catalog.mag.length;
  const limit = drawableDeg(view);
  const inBox = (x: number, y: number): boolean => x >= -EDGE_PX && x <= view.width + EDGE_PX && y >= -EDGE_PX && y <= view.height + EDGE_PX;

  // Every star projected once: the glyphs need the ones up and in the box, the segments need both ends whatever they are.
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
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
  const shown = new Uint8Array(points.length);
  prepared.order.forEach((k, j) => {
    shown[k] = kept[j] ? 1 : 0;
  });
  const write = (node: SVGElement | undefined, p: Point | null | undefined, on: boolean): void => {
    if (!node) return;
    const show = on && p !== null && p !== undefined;
    setShown(node, show);
    if (!show) return;
    node.setAttribute('x', fmt(p.x));
    node.setAttribute('y', fmt(p.y));
  };
  if (layers.stars) for (let i = 0; i < n; i += 1) write(nodes.stars[i], points[i], shown[i] === 1);
  if (layers.planets) positions.planets.forEach((_, k) => write(nodes.planets[k], points[n + k], shown[n + k] === 1));

  // The figures: the gap at each end, the short ones and the buried ones hidden; the clip above keeps the rest on the sky side.
  if (!layers.figures) return;
  const segmentLimit = limit + SEGMENT_MARGIN_DEG;
  prepared.segments.forEach(([a, b], s) => {
    const node = nodes.lines[s];
    if (!node) return;
    const up = (positions.altDeg[a] ?? -1) >= 0 || (positions.altDeg[b] ?? -1) >= 0;
    const seen = front[a] === 1 && front[b] === 1 && (off[a] ?? 180) <= segmentLimit && (off[b] ?? 180) <= segmentLimit;
    const x1 = xs[a] ?? 0;
    const y1 = ys[a] ?? 0;
    const x2 = xs[b] ?? 0;
    const y2 = ys[b] ?? 0;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const show = up && seen && length >= 2 * GAP_PX;
    setShown(node, show);
    if (!show) return;
    const ux = ((x2 - x1) / length) * GAP_PX;
    const uy = ((y2 - y1) / length) * GAP_PX;
    node.setAttribute('x1', fmt(x1 + ux));
    node.setAttribute('y1', fmt(y1 + uy));
    node.setAttribute('x2', fmt(x2 - ux));
    node.setAttribute('y2', fmt(y2 - uy));
  });
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
    <text className={glyphClass(rung)} data-glyph={rung.glyph} data-size={rung.sizeToken} data-tone={rung.colourToken} dx={dx} dy={dy} visibility="hidden" {...rest}>
      {rung.glyph}
    </text>
  );
}

export const StarField = memo(function StarField({ field, view, subscribe }: StarFieldProps) {
  const group = useRef<SVGGElement>(null);
  const clipId = `${useId().replaceAll(':', '')}-sky`;
  const prepared = useMemo(() => prepare(field), [field]);
  const measuredAtRender = inkMeasured();

  // A layout effect, like the publisher's: the subscription is in place before the window's first publish of
  // this commit reaches the list, and a late mount is given the current rotation by `subscribe` itself. The
  // nodes are found again whenever the node set may have changed, which is exactly when this effect re-runs.
  useLayoutEffect(() => {
    let nodes: Nodes | null = null;
    return subscribe((rotation) => {
      const g = group.current;
      if (!g) return;
      nodes ??= collect(g);
      drawField(g, nodes, rotation, view, field, prepared);
    });
  }, [subscribe, view, field, prepared]);

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
    <g ref={group} className={styles.stars} data-layer="stars" data-stars={catalog.mag.length} data-planets={positions.planets.length}>
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
    </g>
  );
});
