import type { MoonState, Pass } from '../../../../../model';
import {
  aheadStrip,
  compassAnchors,
  COMPASS_LABEL_RADIUS,
  diamond,
  flownStrip,
  gridPolygons,
  groundDisc,
  HIDDEN_LABEL_OFFSET_DEG,
  hiddenMarker,
  keyAnchor,
  lingerStrip,
  liveStrip,
  moonMarker,
  nowMarker,
  nowPoint,
  PASS_LABEL_RADIUS,
  passMarkers,
  passStrip,
  resolveLabels,
  riseMarker,
  ringAnchors,
  skyBowl,
  sunGlow,
  tickAnchors,
  type LabelBox,
  type LabelKind,
  type LabelRequest,
  type Poly,
  type Tuple3,
} from './domeGeometry';
import { arcOf, type ChartPass, type HiddenMarker } from '../SkyChart.types';
import { seriesColor, type DomePalette } from './palette';

/**
 * FR-DOME-8 (R21, D-74): which meshes belong to which scene. The dome is two
 * stacked `GlyphScene`s and one set of labels:
 *
 *   base   solid mode — the ground disc, the shaded sky bowl and the Sun glow
 *          (surfaces, lit by the scene's key light along the Sun's direction)
 *   lines  braille wireframe — the grid, the pass arcs, the markers, the
 *          arrowhead and the live marker
 *
 * Every mesh belongs to exactly one of them, which is the point of this file:
 * the component then renders each list into its own scene without deciding
 * anything, and the split is unit-tested rather than read off the screen.
 *
 * Pure: no React, no glyphcss, no clock and no words — the only text the
 * drawing carries since R45 (FR-LEG-1, D-186) is the compass names, the
 * FR-DOME-4 degree numbers and one legend key per drawn arc (and per hidden
 * object), which arrive as `legendKeys`; the label box is measured by the
 * caller, which is the only one that knows the font.
 *
 * R45 (FR-TRAJ-1, D-189): each pass is drawn in its `arc` state — `full` as
 * before, `live` as the cut track solid with the marker, `ahead` dotted and
 * faint with the rise marked, `linger` faint with nothing marked, `hidden`
 * not at all.
 */

export interface Mesh {
  id: string;
  polygons: Poly[];
}

export type DomeLabelKind = LabelKind | 'ring' | 'tick';

export interface DomeLabel {
  id: string;
  at: Tuple3;
  text: string;
  kind: DomeLabelKind;
  /** FR-DOME-2: the colour the label takes; absent leaves it in the page's foreground. */
  color?: string;
  /** Set on a pass's key, so a click on it selects that pass (D-56). */
  passId?: string;
  /** Set on a hidden object's key (FR-LIVE-6), which selects nothing. */
  hiddenId?: string;
  highlighted?: boolean;
  /** The `data-anchor` the contract test and the e2e read (D-56). */
  anchor?: string;
}

export interface LayersInput {
  passes: readonly ChartPass[];
  /** FR-LEG-1: the key each pass (by id) and each hidden object (by id) carries at its peak; an id with no key draws no label. */
  legendKeys?: Readonly<Record<string, string>> | undefined;
  highlightedPassId: string | null;
  /** The instant to mark on the arc, if it falls inside a pass, and the instant everything before it is drawn as flown (FR-DOME-5). */
  now?: number | undefined;
  /** Where the Sun is, for the glow and the key light (FR-DOME-6, FR-DOME-8a). */
  sun?: { azDeg: number; altDeg: number } | null | undefined;
  /** Where the Moon is, for its marker and its phase glyph (FR-DOME-6). */
  moon?: MoonState | null | undefined;
  /** FR-LIVE-6 (R33): the dimmed objects, already worded by the page (`SkyChartProps.hidden`). */
  hidden?: readonly HiddenMarker[] | undefined;
  /** FR-DOME-2 colours, or `null` for the monochrome reading. */
  palette: DomePalette | null;
  /**
   * FR-LIVE-2 (R32, D-158): `pass` colours every arc at full weight from the
   * series tokens in `passes` order, with the rise label only — the live page
   * has twenty arcs, not one to explain. Default `highlight`: the guide's
   * reading, the highlighted pass in the pass colour and the rest dim.
   */
  colorBy?: 'highlight' | 'pass' | undefined;
  camera: { rotYDeg: number; tiltDeg: number };
  /** How big a label is on the drawing, in world units. */
  measure: (text: string) => LabelBox;
}

export interface DomeLayers {
  base: Mesh[];
  lines: Mesh[];
  labels: DomeLabel[];
}

const colored = (mesh: Mesh): boolean => mesh.polygons.length > 0;

/** The base scene: surfaces only, and only where there is something to draw (no Sun below −18°, D-92). */
export function baseLayer(input: Pick<LayersInput, 'palette' | 'sun'>): Mesh[] {
  const { palette, sun } = input;
  return [
    { id: 'ground', polygons: groundDisc(palette?.ground) },
    { id: 'bowl', polygons: skyBowl(palette?.sky) },
    { id: 'glow', polygons: sun ? sunGlow(sun, palette?.sun) : [] },
  ].filter(colored);
}

/**
 * The line scene: the grid, one mesh per pass with its markers, the flown part
 * of each arc and the live marker (FR-DOME-5), and the Moon (FR-DOME-6). The
 * Moon comes last so it is drawn over whatever it sits on.
 */
export function lineLayer(input: Pick<LayersInput, 'passes' | 'highlightedPassId' | 'now' | 'moon' | 'hidden' | 'palette' | 'colorBy'>): Mesh[] {
  const { passes, highlightedPassId, now, moon, hidden = [], palette, colorBy = 'highlight' } = input;
  const meshes: Mesh[] = [{ id: 'grid', polygons: gridPolygons({ ...(palette ? { horizon: palette.horizon, rings: palette.rings } : {}) }) }];
  passes.forEach((pass, index) => {
    // FR-LEG-4 (R45): a highlight dims the others in either colouring — by weight in series mode, where the colour is the pass's identity.
    const highlighted = isHighlighted(pass, highlightedPassId);
    const arc = arcColor(pass, index, highlightedPassId, palette, colorBy);
    const color = arc ? { color: arc } : {};
    const state = arcOf(pass);
    switch (state) {
      case 'hidden':
        return;
      case 'live': {
        // FR-TRAJ-1: the arc from the rise to the position at `now`, solid, in its colour, with the marker; nothing beyond.
        const t = now ?? pass.end.t;
        meshes.push({ id: `pass-${pass.id}`, polygons: liveStrip(pass, t, { highlighted, ...color }) });
        const markers: Poly[] = [];
        if (pass.startReason === 'shadow') markers.push(...diamond(pass.start, undefined, undefined, palette?.shadow));
        if (t >= pass.peak.t) markers.push(...diamond(pass.peak, undefined, undefined, palette?.peak));
        meshes.push({ id: `markers-${pass.id}`, polygons: markers });
        const current = nowPoint(pass, t);
        if (current) meshes.push({ id: `now-${pass.id}`, polygons: nowMarker(current, palette?.now) });
        return;
      }
      case 'ahead':
        meshes.push({ id: `pass-${pass.id}`, polygons: aheadStrip(pass, arc) });
        meshes.push({ id: `rise-${pass.id}`, polygons: riseMarker(pass, arc) });
        return;
      case 'linger':
        meshes.push({ id: `pass-${pass.id}`, polygons: lingerStrip(pass, arc) });
        return;
      case 'full': {
        meshes.push({ id: `pass-${pass.id}`, polygons: passStrip(pass, { highlighted, ...color }) });
        // F-5: a dim pass's flown half takes the dim colour too, so it does not outshine the highlighted pass's own flown colour.
        meshes.push({ id: `flown-${pass.id}`, polygons: flownStrip(pass, now, { highlighted, ...(palette ? { color: highlighted ? palette.flown : palette.dim } : {}) }) });
        meshes.push({
          id: `markers-${pass.id}`,
          polygons: passMarkers(pass, { ...(palette ? { peak: palette.peak, shadow: palette.shadow } : {}), ...(arc ? { arrow: arc } : {}) }),
        });
        const current = nowPoint(pass, now);
        if (current) meshes.push({ id: `now-${pass.id}`, polygons: nowMarker(current, palette?.now) });
      }
    }
  });
  // FR-LIVE-6: the dimmed objects, in the dim pass colour, under the Moon.
  for (const marker of hidden) meshes.push({ id: marker.id, polygons: hiddenMarker(marker, palette?.dim) });
  if (moon) meshes.push({ id: 'moon', polygons: moonMarker(moon, palette?.moon) });
  return meshes.filter(colored);
}

const isHighlighted = (pass: Pass, highlightedPassId: string | null): boolean => highlightedPassId === null || highlightedPassId === pass.id;

/** The colour an arc and its labels take: its series colour by pass order (FR-LIVE-2), or the guide's highlighted / dim pair (FR-DOME-2). */
function arcColor(pass: Pass, index: number, highlightedPassId: string | null, palette: DomePalette | null, colorBy: 'highlight' | 'pass'): string | undefined {
  if (!palette) return undefined;
  if (colorBy === 'pass') return seriesColor(palette, index);
  return isHighlighted(pass, highlightedPassId) ? palette.highlighted : palette.dim;
}

/**
 * Every label the dome draws, with FR-DOME-3's collision resolution already
 * applied: the compass names first, then the legend keys — the highlighted
 * pass's first, so it takes the nearest free place — and the hidden objects'
 * keys last (FR-LEG-1, R45). The degree numbers of FR-DOME-4 never move —
 * they name a fixed angle, so moving one would make it a lie — and are the
 * obstacles everything else gives way to. No name, no time, no body caption
 * and no reason is drawn: the legend carries them.
 */
export function domeLabels(input: LayersInput): DomeLabel[] {
  const { passes, highlightedPassId, hidden = [], palette, camera, measure, colorBy = 'highlight', legendKeys = {} } = input;
  const fixed: DomeLabel[] = [
    ...tickAnchors().map((anchor) => ({ id: anchor.id, at: anchor.at, text: degreeText(anchor.valueDeg), kind: 'tick' as const, ...(palette ? { color: palette.rings } : {}) })),
    ...ringAnchors().map((anchor) => ({ id: anchor.id, at: anchor.at, text: degreeText(anchor.valueDeg), kind: 'ring' as const, ...(palette ? { color: palette.rings } : {}) })),
  ];

  const requests: LabelRequest[] = [];
  const rendered = new Map<string, DomeLabel>();
  const add = (id: string, kind: LabelKind, point: { azDeg: number; elDeg: number }, radius: number, label: Omit<DomeLabel, 'id' | 'at' | 'kind'>): void => {
    requests.push({ id, kind, azDeg: point.azDeg, elDeg: point.elDeg, radius, ...measure(label.text) });
    rendered.set(id, { id, kind, at: [0, 0, 0], ...label });
  };

  for (const anchor of compassAnchors()) {
    add(anchor.id, 'compass', { azDeg: anchor.azDeg, elDeg: 0 }, COMPASS_LABEL_RADIUS, { text: anchor.label, anchor: anchor.label, ...(palette ? { color: palette.compass } : {}) });
  }

  // The highlighted pass first, so its key takes the nearest free place (FR-DOME-3's order is between kinds; within a kind it is this order).
  // The series index is the pass's place in `passes` (FR-LIVE-2), whatever order the labels are placed in.
  const ordered = passes.map((pass, index) => ({ pass, index })).sort((a, b) => Number(isHighlighted(b.pass, highlightedPassId)) - Number(isHighlighted(a.pass, highlightedPassId)));
  for (const { pass, index } of ordered) {
    // FR-LEG-1: one key at the peak of every drawn arc, whatever its state; a pass with no key (a view mounted alone) draws nothing.
    const key = legendKeys[pass.id];
    if (arcOf(pass) === 'hidden' || key === undefined) continue;
    const color = arcColor(pass, index, highlightedPassId, palette, colorBy);
    add(keyAnchor(pass).id, 'key', pass.peak, PASS_LABEL_RADIUS, { text: key, anchor: 'key', passId: pass.id, highlighted: isHighlighted(pass, highlightedPassId), ...(color ? { color } : {}) });
  }

  // FR-LIVE-6 as amended: each dimmed object's key, just above its mark, in the dim colour, last in the order; its reason is a legend row.
  for (const marker of hidden) {
    const key = legendKeys[marker.id];
    if (key === undefined) continue;
    add(`${marker.id}-key`, 'key', { azDeg: marker.azDeg, elDeg: Math.min(90, marker.elDeg + HIDDEN_LABEL_OFFSET_DEG) }, PASS_LABEL_RADIUS, {
      text: key,
      anchor: 'key',
      hiddenId: marker.id,
      highlighted: false,
      ...(palette ? { color: palette.dim } : {}),
    });
  }

  const placed = resolveLabels(
    requests,
    camera,
    fixed.map((label) => ({ at: label.at, ...measure(label.text) })),
  );
  return [...fixed, ...placed.map((label) => ({ ...(rendered.get(label.id) as DomeLabel), at: label.at }))];
}

/** FR-DOME-4's numbers: identical in both languages (FR-I18N-4), so they are not catalog entries. */
const degreeText = (valueDeg: number): string => `${String(valueDeg)}°`;

export function domeLayers(input: LayersInput): DomeLayers {
  return { base: baseLayer(input), lines: lineLayer(input), labels: domeLabels(input) };
}
