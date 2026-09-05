import type { MoonState, Pass } from '../../../../../model';
import { glowHeightDeg, glowStrength, moonVisible, sunVisible } from '../bodies';
import {
  compassAnchors,
  COMPASS_LABEL_RADIUS,
  flownStrip,
  gridPolygons,
  groundDisc,
  MOON_LABEL_OFFSET_DEG,
  moonMarker,
  nowMarker,
  nowPoint,
  PASS_LABEL_RADIUS,
  passAnchors,
  passMarkers,
  passStrip,
  resolveLabels,
  ringAnchors,
  RISE_LABEL_RADIUS,
  skyBowl,
  sunGlow,
  tickAnchors,
  type LabelBox,
  type LabelKind,
  type LabelRequest,
  type Poly,
  type Tuple3,
} from './domeGeometry';
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
 * Pure: no React, no glyphcss, no clock and no words — the label text arrives
 * already worded and formatted (FR-I18N-2 keeps the sentences in the
 * catalogs), and the label box is measured by the caller, which is the only
 * one that knows the font.
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
  /** Set on a pass's labels, so a click on one selects that pass (D-56). */
  passId?: string;
  highlighted?: boolean;
  /** The `data-anchor` the contract test and the e2e read (D-56). */
  anchor?: string;
}

export interface PassLabelText {
  /** The satellite's name and its rise time. */
  rise: string;
  /** The peak: its clock time and the maximum elevation. */
  peak: string;
  /** The end: its clock time (the arrowhead carries the direction). */
  end: string;
}

export interface LayersInput {
  passes: readonly Pass[];
  highlightedPassId: string | null;
  /** The instant to mark on the arc, if it falls inside a pass, and the instant everything before it is drawn as flown (FR-DOME-5). */
  now?: number | undefined;
  /** Where the Sun is, for the glow and the key light (FR-DOME-6, FR-DOME-8a). */
  sun?: { azDeg: number; altDeg: number } | null | undefined;
  /** Where the Moon is, for its marker and its phase glyph (FR-DOME-6). */
  moon?: MoonState | null | undefined;
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
  /** The worded labels of a pass (FR-I18N-2: the catalogs word them, this file only places them). */
  labelsFor: (pass: Pass) => PassLabelText;
  /** The worded names of the two bodies (FR-DOME-6); the Moon's carries its phase glyph. */
  bodyLabels?: { sun: string; moon: (moon: MoonState) => string };
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
export function lineLayer(input: Pick<LayersInput, 'passes' | 'highlightedPassId' | 'now' | 'moon' | 'palette' | 'colorBy'>): Mesh[] {
  const { passes, highlightedPassId, now, moon, palette, colorBy = 'highlight' } = input;
  const meshes: Mesh[] = [{ id: 'grid', polygons: gridPolygons({ ...(palette ? { horizon: palette.horizon, rings: palette.rings } : {}) }) }];
  passes.forEach((pass, index) => {
    const highlighted = colorBy === 'pass' || isHighlighted(pass, highlightedPassId);
    const arc = arcColor(pass, index, highlightedPassId, palette, colorBy);
    meshes.push({ id: `pass-${pass.id}`, polygons: passStrip(pass, { highlighted, ...(arc ? { color: arc } : {}) }) });
    meshes.push({ id: `flown-${pass.id}`, polygons: flownStrip(pass, now, { highlighted, ...(palette ? { color: palette.flown } : {}) }) });
    meshes.push({
      id: `markers-${pass.id}`,
      polygons: passMarkers(pass, { ...(palette ? { peak: palette.peak, shadow: palette.shadow } : {}), ...(arc ? { arrow: arc } : {}) }),
    });
    const current = nowPoint(pass, now);
    if (current) meshes.push({ id: `now-${pass.id}`, polygons: nowMarker(current, palette?.now) });
  });
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
 * applied: the compass names first, then the highlighted pass's peak, the
 * rise labels (the highlighted pass's first) and the end label. The degree
 * numbers of FR-DOME-4 never move — they name a fixed angle, so moving one
 * would make it a lie — and are the obstacles everything else gives way to.
 */
export function domeLabels(input: LayersInput): DomeLabel[] {
  const { passes, highlightedPassId, sun, moon, palette, camera, labelsFor, measure, bodyLabels, colorBy = 'highlight' } = input;
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

  // The highlighted pass first, so its labels take the nearest free places (FR-DOME-3's order is between kinds; within a kind it is this order).
  // The series index is the pass's place in `passes` (FR-LIVE-2), whatever order the labels are placed in.
  const ordered = passes.map((pass, index) => ({ pass, index })).sort((a, b) => Number(isHighlighted(b.pass, highlightedPassId)) - Number(isHighlighted(a.pass, highlightedPassId)));
  for (const { pass, index } of ordered) {
    // FR-LIVE-2: every arc named at its rise and nothing more — the peak and end labels are the guide's, for the one pass it explains.
    const explained = colorBy === 'highlight' && isHighlighted(pass, highlightedPassId);
    const text = labelsFor(pass);
    const anchors = passAnchors(pass);
    const color = arcColor(pass, index, highlightedPassId, palette, colorBy);
    const common = { passId: pass.id, highlighted: colorBy === 'pass' || explained, ...(color ? { color } : {}) };
    if (explained) {
      add(anchors.peak.id, 'peak', pass.peak, PASS_LABEL_RADIUS, { text: text.peak, anchor: 'peak', ...common, ...(palette ? { color: palette.peak } : {}) });
    }
    add(anchors.rise.id, 'rise', pass.start, RISE_LABEL_RADIUS, { text: text.rise, anchor: 'pass', ...common });
    if (explained) add(anchors.end.id, 'end', pass.end, PASS_LABEL_RADIUS, { text: text.end, ...common });
  }

  // FR-DOME-6: both bodies labelled. The Sun's name sits over its glow, the
  // Moon's just above its disc, and both give way to everything else.
  if (bodyLabels && sun && sunVisible(sun)) {
    add('sun-label', 'sun', { azDeg: sun.azDeg, elDeg: glowHeightDeg(glowStrength(sun.altDeg)) }, PASS_LABEL_RADIUS, {
      text: bodyLabels.sun,
      anchor: 'sun',
      ...(palette ? { color: palette.sun } : {}),
    });
  }
  if (bodyLabels && moon && moonVisible(moon)) {
    add('moon-label', 'moon', { azDeg: moon.azDeg, elDeg: Math.min(90, moon.elDeg + MOON_LABEL_OFFSET_DEG) }, PASS_LABEL_RADIUS, {
      text: bodyLabels.moon(moon),
      anchor: 'moon',
      ...(palette ? { color: palette.moon } : {}),
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
