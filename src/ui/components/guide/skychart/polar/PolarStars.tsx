import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PINCH_HANDOFF_RATIO } from '../../../../../lib/layout';
import { FIELD_DETAIL_STEPS, HORIZON_BAND_DEG, MOON_DISC_PX } from '../../../../../data/stars/constants';
import { CONSTELLATION_NAMES, CONSTELLATION_WHOLE_NAMES } from '../../../../../data/stars/constellations';
import { useLocale } from '../../../../../i18n/useT';
import type { SunState } from '../../../../../lib/skyBodies';
import { figureName, starName, type StarNamesSource } from '../../../../../lib/skyStars';
import type { ChartOrientation, Locale, MoonState, Observer } from '../../../../../model';
import { useDeclination } from '../../../live/useDeclination';
import { drawsLayer, sceneFor, starsFor, type PlacedBody } from '../layers';
import type { FieldAim } from '../SkyChart.types';
import { BLOOM_STOPS, BLOOM_TONES, bloomGradientId, bloomRadiusPx } from '../window/bloom';
import { handRotation, type HandCamera } from '../window/camera';
import type { Mat3, View } from '../window/projection';
import { turnFor } from '../window/screenTurn';
import { useViewRotation } from '../window/useViewRotation';
import { inkMeasured, inkOffsetPx, inkOffsetsReady } from '../window/inkOffsets';
import { bandHalfWidthDeg, galacticOf, prepareHaze, hazeOpacity, type PreparedHaze } from '../window/milkyWay';
import { brightLimbPoint, limbAngleDeg, litPath } from '../window/MoonDisc';
import type { StarField } from '../window/scene';
import { skyFrameOf, unapplyFrame } from '../window/skyFrame';
import { HORIZON_BAND_STEPS, stripOpacity, tintStep } from '../window/skySurface';
import { bloomed, collide, LANDMARK_RING_PX, magnitudeOrder, markFor, planetMarkFor, type Mark, type Point } from '../window/starGlyphs';
import glyphStyles from '../window/starGlyphs.module.css';
import { ADVANCE_EM, placeLabels, type Box, type FigureLabel, type LabelMark, type LabelSegment, type MarkLabel, type PlacedLabel } from '../window/starLabels';
import { fieldOutline } from './fieldOutline';
import styles from './SkyPolar.module.css';

/**
 * R158 (FR-PHONE-8, FR-PHONE-9, FR-SKY-1 and FR-SKY-4 as amended, FR-LOOK-1,
 * FR-LOOK-3, FR-LOOK-6, FR-LOOK-7 on the chart; PLAN D-968, D-969, D-988,
 * D-989): the whole sky's star layer, its look, the Moon's disc and the
 * window's field — the polar chart's lazy chunk (D-813), on the window's pure
 * modules and its sheet, never on its field.
 *
 * Everything here is drawn at **the chart's unit** (D-812): a px of the window
 * is a user unit of the 250-unit viewBox, so a `*` of 20 px is 20 units, a dot
 * of radius 1.5 px is 1.5 units, the collision distance and the figures' gap
 * are `COLLISION_PX` units, a name's cell is 0.6 em of its 12 or 11 units, and
 * everything scales with the box as the compass letters do. One rule is the
 * chart's own (D-989): a figure line's gap at each end is that end's mark's
 * half cell — 0.3 em of a `*`, a dot's radius — and not the window's fixed
 * `COLLISION_PX`, since at the whole sky's scale half the segments are under
 * 6 units and the fixed gap left 43 of 404 drawn on the fixture night. Every place goes
 * through the chart's own projection, so the looking-up / map toggle turns the
 * surface, the haze, the figures, the stars, the names and the outline with
 * the arcs.
 */

/** The chart's projection: a sky direction to user units, in the convention given (`SkyPolar`'s `project`). */
type Project = (point: { azDeg: number; elDeg: number }, orientation: ChartOrientation) => Point;

/** FR-LOOK-9: the whole sky has no field, so it names to the widest row's magnitude (1.5). */
const NAME_MAG = FIELD_DETAIL_STEPS[0]?.[2] ?? 1.5;

const fmt = (n: number): string => n.toFixed(2);
const at = ({ x, y }: Point): string => `translate(${fmt(x)} ${fmt(y)})`;
/** The radius, in user units, of the altitude ring at `elDeg`: the projection's own, so it is right in either convention. */
const ringR = (project: Project, elDeg: number): number => {
  const p = project({ azDeg: 0, elDeg }, 'map');
  return Math.hypot(p.x, p.y);
};

// --- The surface and the band (FR-LOOK-1, FR-LOOK-2) ----------------------------

interface PolarSkyProps {
  positions: StarField['positions'];
  project: Project;
}

/**
 * FR-LOOK-1, FR-LOOK-2 on the chart: the surface inside the horizon ring in the twilight step's tone (the Sun's
 * altitude the positions carry), and the band inside the rim — `HORIZON_BAND_STEPS` annuli of 3° of altitude from
 * the horizon up, each a stroked circle at its strip's alpha (the window's `stripOpacity`), since on a polar chart
 * every altitude ring is a circle about the zenith. Drawn under the Sun's glow and the grid.
 */
export const PolarSky = memo(function PolarSky({ positions, project }: PolarSkyProps) {
  const tint = tintStep(positions.sunAltDeg);
  const horizon = ringR(project, 0);
  const stripDeg = HORIZON_BAND_DEG / HORIZON_BAND_STEPS;
  return (
    <g data-layer="sky" data-tint={tint}>
      <circle className={styles.surface} data-sky-surface data-tint={tint} r={fmt(horizon)} />
      <g className={styles.band} data-horizon-band>
        {Array.from({ length: HORIZON_BAND_STEPS }, (_, k) => {
          const outer = ringR(project, k * stripDeg);
          const inner = ringR(project, (k + 1) * stripDeg);
          return <circle key={k} data-band-strip={k} r={fmt((outer + inner) / 2)} strokeWidth={fmt(outer - inner)} strokeOpacity={stripOpacity(k)} />;
        })}
      </g>
    </g>
  );
});

// --- The stars, the figures, the names (FR-PHONE-8) -----------------------------
// The collision walk is the window's (`collide`, `COLLISION_PX` user units, D-812): of a close pair the brighter alone.

/** One body the chart draws: `starsFor`'s place, its mark and where it lands, in user units. */
type PlacedMark = PlacedBody & { mark: Mark; p: Point };

/** The size a mark fills, in the label placement's terms: a `*`'s or `@`'s px, a dot's ink as the cell it fills (D-982). */
const sizeOf = (mark: Mark): number => (mark.kind === 'char' ? mark.px : (2 * mark.r) / ADVANCE_EM);
/** D-989: the gap a figure line keeps from a mark, user units — half its cell, so a dot's radius (FR-LOOK-4: the radius counts as its ink). */
const gapOf = (mark: Mark): number => (ADVANCE_EM * sizeOf(mark)) / 2;

/** R127 (D-832): the catalogue as the name readers take it; a catalogue without the Spanish tables (a test's) reads in English. */
function catalogNames(catalog: StarField['catalog']): StarNamesSource {
  return {
    name: catalog.name,
    nameEs: catalog.nameEs ?? [],
    desig: catalog.desig,
    figureNames: catalog.figureNames ?? { en: CONSTELLATION_NAMES, es: {} },
    wholeNames: catalog.wholeNames ?? { en: CONSTELLATION_WHOLE_NAMES, es: {} },
  };
}

/** A figure's name in `lang`, by the part its last word names (`''` whole, `Caput`, `Cauda`), the abbreviation where the table has none. */
function figureLabelName(names: StarNamesSource, con: string, part: string, lang: Locale): string {
  const parts = Object.hasOwn(names.figureNames.en, con) ? (names.figureNames.en[con] ?? []) : [];
  const found = part === '' ? 0 : parts.findIndex((name) => name.endsWith(` ${part}`));
  return figureName(names, con, Math.max(0, found), lang) ?? con;
}

/** The haze per positions object, as the window keeps it: a scene rebuilt around the same instant rotates nothing again. */
const hazeByPositions = new WeakMap<StarField['positions'], PreparedHaze | null>();

function hazeOf(catalog: StarField['catalog'], positions: StarField['positions']): PreparedHaze | null {
  if (hazeByPositions.has(positions)) return hazeByPositions.get(positions) ?? null;
  const frame = catalog.milkyWay === undefined ? null : skyFrameOf(catalog, positions);
  const haze = frame === null || catalog.milkyWay === undefined ? null : prepareHaze(catalog.milkyWay, frame);
  // The nadir's galactic place, for the flip rule below: read back through the same frame.
  if (haze !== null && frame !== null) nadirs.set(haze, galacticOfVector(unapplyFrame(frame, [0, 0, -1])));
  hazeByPositions.set(positions, haze);
  return haze;
}
const nadirs = new WeakMap<PreparedHaze, { lDeg: number; bDeg: number }>();

function galacticOfVector(v: readonly [number, number, number]): { lDeg: number; bDeg: number } {
  const ra = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  const dec = (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI;
  return galacticOf(((ra % 360) + 360) % 360, dec);
}

/** The horizon's disc as a closed path, for a band drawn as the sky outside its curve. */
const disc = (r: number): string => `M${fmt(r)} 0A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r)} 0A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r)} 0Z`;

/** A point held inside the horizon's radius: one under the horizon is put on the ring, along its own azimuth. */
function onSky(p: Point, r: number): Point {
  const d = Math.hypot(p.x, p.y);
  return d <= r ? p : { x: (p.x * r) / d, y: (p.y * r) / d };
}

/** Where the segment from `a` (inside the ring) toward `b` (outside it) meets the ring of radius `r`. */
function toRing(a: Point, b: Point, r: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const qa = dx * dx + dy * dy;
  const qb = 2 * (a.x * dx + a.y * dy);
  const qc = a.x * a.x + a.y * a.y - r * r;
  const t = qa === 0 ? 0 : (-qb + Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc))) / (2 * qa);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * FR-LOOK-3 on the chart: each ring of the outline through the chart's projection, closed. The polar projection is
 * azimuthal from the zenith and finite everywhere but at the nadir, whose image is the circle at twice the horizon's
 * radius: a band holding the nadir is the plane *outside* its drawn curve (D-770's rule with the nadir for the
 * antipode), so that band is drawn against the horizon's disc under `evenodd`. The sky is kept with no clip path
 * (D-989: a clip costs the chart's playback a paint per update): a point under the horizon is put on the ring along
 * its own azimuth, so the part of a band below it folds onto the ring and the fill stops there.
 */
function polarHazePaths(haze: PreparedHaze, orientation: ChartOrientation, project: Project, horizonR: number): { d: string; opacity: number }[] {
  const nadir = nadirs.get(haze);
  return haze.rings.map((ring, k) => {
    let d = '';
    for (let i = 0; i < ring.azDeg.length; i += 1) {
      const p = onSky(project({ azDeg: ring.azDeg[i] ?? 0, elDeg: ring.altDeg[i] ?? 0 }, orientation), horizonR);
      d += `${d ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    if (d === '') return { d, opacity: hazeOpacity(k) };
    const flipped = nadir !== undefined && Math.abs(nadir.bDeg) < bandHalfWidthDeg(k, nadir.lDeg);
    return { d: `${flipped ? disc(horizonR) : ''}${d}Z`, opacity: hazeOpacity(k) };
  });
}

interface Drawing {
  marks: PlacedMark[];
  lines: (LabelSegment & { figure: number })[];
  /**
   * D-989: the dots drawn as one path per tone, each dot a circle of two arcs, with the stars it holds in
   * `data-stars` — the whole sky draws about 180 of them, and as nodes they were most of a playback tick's render.
   */
  dotPaths: { tone: string; d: string; stars: number[] }[];
  /** The lines drawn as one path per figure: a render writes one `d` per figure and not four numbers per segment (D-989). */
  figurePaths: { figure: number; segments: number; d: string }[];
  haze: { d: string; opacity: number }[];
  labels: PlacedLabel[];
}

/**
 * The whole drawing, placed once per catalogue, instant, switch set, convention and language: the marks
 * (`starsFor`'s bodies on the marks, brightest first, then the collision walk), the figure lines (D-754's gap at
 * each end (D-989: the end's own half cell), a segment shorter than its two gaps or with both ends under the horizon dropped, one end under it cut at the ring; the horizon's ring keeps
 * the sky side), the haze, and the names through `starLabels.ts` with the compass's boxes first (D-755), the box
 * being the viewBox shifted to start at 0.
 */
function place(field: StarField, whole: StarField, orientation: ChartOrientation, project: Project, compass: readonly Box[], half: number, horizonR: number, lang: Locale): Drawing {
  const { catalog, layers } = field;
  // A figure's segments index the whole catalogue, whose last stars are figure endpoints past the cap (FR-LOOK-8):
  // the lines read the whole one's positions and magnitudes, the marks the capped field's.
  const { positions } = whole;
  const bodies = starsFor('polar', field);
  const ordered = magnitudeOrder(bodies.map((body) => body.mag))
    .flatMap((k) => bodies[k] ?? [])
    .map((body): PlacedMark => ({ ...body, mark: body.planet === undefined ? markFor(body.mag, catalog.bv?.[body.star ?? 0]) : planetMarkFor(body.mag), p: project({ azDeg: body.azDeg, elDeg: body.altDeg }, orientation) }));
  const keep = collide(ordered.map((g) => g.p));
  const marks = ordered.filter((_, i) => keep[i]);

  const lines: Drawing['lines'] = [];
  const figureLabels: FigureLabel[] = [];
  const names = catalogNames(catalog);
  if (layers.figures) {
    catalog.figures.forEach((figure, f) => {
      const ends = new Set<number>();
      let count = 0;
      for (const [a, b] of figure.segments) {
        const aAlt = positions.altDeg[a];
        const bAlt = positions.altDeg[b];
        if (aAlt === undefined || bAlt === undefined || !(aAlt >= 0 || bAlt >= 0)) continue;
        const pa = project({ azDeg: positions.azDeg[a] ?? 0, elDeg: aAlt }, orientation);
        const pb = project({ azDeg: positions.azDeg[b] ?? 0, elDeg: bAlt }, orientation);
        const length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        const gapA = gapOf(markFor(whole.catalog.mag[a] ?? Number.NaN, whole.catalog.bv?.[a]));
        const gapB = gapOf(markFor(whole.catalog.mag[b] ?? Number.NaN, whole.catalog.bv?.[b]));
        if (!(length >= gapA + gapB)) continue;
        const ux = (pb.x - pa.x) / length;
        const uy = (pb.y - pa.y) / length;
        // One end under the horizon: the line stops at the ring (no clip path, D-989); where the gap at the end that is
        // up already reaches past the ring, nothing of the line is on the sky side and it is not drawn.
        let start: Point = { x: pa.x + ux * gapA, y: pa.y + uy * gapA };
        let end: Point = { x: pb.x - ux * gapB, y: pb.y - uy * gapB };
        const startOut = Math.hypot(start.x, start.y) > horizonR;
        const endOut = Math.hypot(end.x, end.y) > horizonR;
        if (startOut && endOut) continue;
        if (startOut) start = toRing(end, start, horizonR);
        else if (endOut) end = toRing(start, end, horizonR);
        lines.push({ figure: f, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
        count += 1;
        if (aAlt >= 0) ends.add(a);
        if (bAlt >= 0) ends.add(b);
      }
      if (count < 2) return;
      const endpoints = [...ends].map((i) => {
        const p = project({ azDeg: positions.azDeg[i] ?? 0, elDeg: positions.altDeg[i] ?? 0 }, orientation);
        return { x: p.x + half, y: p.y + half };
      });
      figureLabels.push({ key: f, name: figureLabelName(names, figure.con, figure.part, lang), con: figure.con, segments: count, endpoints });
    });
  }

  const haze = layers.stars && drawsLayer('polar', 'haze') ? (() => {
    const prepared = hazeOf(whole.catalog, whole.positions);
    return prepared === null ? [] : polarHazePaths(prepared, orientation, project, horizonR);
  })() : [];

  let labels: PlacedLabel[] = [];
  if (layers.names) {
    const labelMarks: LabelMark[] = marks.map((m) => ({ x: m.p.x + half, y: m.p.y + half, sizePx: sizeOf(m.mark) }));
    const stars: MarkLabel[] = [];
    marks.forEach((m, k) => {
      if (m.star === undefined || !(m.mag <= NAME_MAG)) return;
      stars.push({ key: m.star, mark: k, text: starName(names, m.star, lang) });
    });
    labels = placeLabels({
      width: 2 * half,
      height: 2 * half,
      marks: labelMarks,
      segments: lines.map((s) => ({ x1: s.x1 + half, y1: s.y1 + half, x2: s.x2 + half, y2: s.y2 + half })),
      compass: compass.map((b) => ({ x0: b.x0 + half, y0: b.y0 + half, x1: b.x1 + half, y1: b.y1 + half })),
      named: null,
      stars,
      figures: figureLabels,
      lang,
    }).map((label) => ({ ...label, x: label.x - half, y: label.y - half }));
  }
  const figurePaths: Drawing['figurePaths'] = [];
  for (const s of lines) {
    const last = figurePaths.at(-1);
    const piece = `M${fmt(s.x1)} ${fmt(s.y1)}L${fmt(s.x2)} ${fmt(s.y2)}`;
    if (last?.figure === s.figure) {
      last.d += piece;
      last.segments += 1;
    } else figurePaths.push({ figure: s.figure, segments: 1, d: piece });
  }
  const byTone = new Map<string, { tone: string; d: string; stars: number[] }>();
  for (const { mark, p, star } of marks) {
    if (mark.kind !== 'dot' || star === undefined) continue;
    let path = byTone.get(mark.tone);
    if (!path) {
      path = { tone: mark.tone, d: '', stars: [] };
      byTone.set(mark.tone, path);
    }
    const r = fmt(mark.r);
    path.d += `M${fmt(p.x - mark.r)} ${fmt(p.y)}a${r} ${r} 0 1 0 ${fmt(2 * mark.r)} 0a${r} ${r} 0 1 0 ${fmt(-2 * mark.r)} 0`;
    path.stars.push(star);
  }
  return { marks, lines, figurePaths, dotPaths: [...byTone.values()], haze, labels };
}

interface PolarStarsProps {
  catalog: StarField['catalog'];
  /** The positions at the shown instant: one object per instant, `starsAt` memoising on `t` (D-791). */
  positions: StarField['positions'];
  /** The scene's four switches; the table decides which this chart draws (all four since R158). */
  stars: boolean;
  figures: boolean;
  planets: boolean;
  names: boolean;
  orientation: ChartOrientation;
  /** The chart's own projection, so the group follows the looking-up / map toggle with the arcs. */
  project: Project;
  /** The compass letters' boxes in user units, the placement's first obstacles (D-755: compass first). */
  compass: readonly Box[];
  /** Half the viewBox's side, user units: the placement's box is the viewBox shifted to start at 0. */
  half: number;
  /** The horizon's radius, user units: the ring the haze and the figures stop at. */
  horizonR: number;
  /** R127 (FR-SKY-11, D-796): the landmark star to ring, a catalogue index (`layers.ts`'s `landmarkFor`), or `null`. */
  landmark?: number | null;
}

/**
 * R122 (FR-SKY-4, D-792, D-813), rewritten by R158 (FR-PHONE-8; D-968): the scene's stars to `POLAR_STAR_MAG` (4.5)
 * and the planets on the window's marks (FR-LOOK-4, FR-LOOK-5: `*` to 2.5, a dot below, four tones from B−V, `@`
 * for a planet), with, in FR-STAR-6's order under the grid and the arcs: the haze (FR-LOOK-3), the bloom under the
 * brightest (FR-LOOK-6, the five gradients defined once), the figures as hairlines in `--chart-figure` with the gap (one path per figure, a sub-path per segment),
 * the marks, the landmark's ring, and the names where `names` is on — the proper names to 1.5 and the figures' in
 * spaced capitals, by FR-STAR-6's placement at the chart's unit. A `*` or `@` keeps R119's anchor, `data-star` or
 * `data-planet` with the `translate`, which the contract test reads, a `<text>` whose ink is moved onto the point by
 * the measured offsets; the dots are one path per tone, a circle each, naming the stars they hold (D-989).
 *
 * The props are the scene's parts, not the scene, and the drawing is memoised on them: a page that rebuilds the
 * scene around the same positions neither places nor renders the group again.
 */
export const PolarStars = memo(function PolarStars({ catalog, positions, stars, figures, planets, names, orientation, project, compass, half, horizonR, landmark = null }: PolarStarsProps) {
  const lang = useLocale();
  const drawing = useMemo(() => {
    const whole: StarField = { catalog, positions, layers: { stars, figures, planets, names } };
    // FR-SKY-1: what the table leaves this chart of the scene — since R158 the star layer whole, to `POLAR_STAR_MAG`.
    const field = sceneFor('polar', { stars: whole })?.stars;
    return field ? place(field, whole, orientation, project, compass, half, horizonR, lang) : null;
  }, [catalog, positions, stars, figures, planets, names, orientation, project, compass, half, horizonR, lang]);
  const [, setMeasured] = useState(inkMeasured);
  useEffect(() => {
    if (inkMeasured()) return;
    let live = true;
    void inkOffsetsReady().then((measured) => {
      if (live && measured) setMeasured(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const id = useId().replace(/:/g, '');
  if (!drawing) return null;
  const ringAlt = landmark === null ? undefined : positions.altDeg[landmark];
  const ring = landmark !== null && stars && ringAlt !== undefined && ringAlt >= 0 ? project({ azDeg: positions.azDeg[landmark] ?? 0, elDeg: ringAlt }, orientation) : null;
  const blooms = drawsLayer('polar', 'bloom') ? drawing.marks.filter((m) => bloomed(m.mag)) : [];
  return (
    <g className={`${styles.stars} ${glyphStyles.glyphs}`} data-layer="stars">
      <defs>
        {/* FR-LOOK-6: one gradient per tone and one for the planets, the colour the sheet's by `data-bloom-tone`. */}
        {blooms.length > 0 &&
          BLOOM_TONES.map((tone) => (
            <radialGradient key={tone} id={bloomGradientId(id, tone)} data-bloom-tone={tone}>
              {BLOOM_STOPS.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopOpacity={stop.alpha} />
              ))}
            </radialGradient>
          ))}
      </defs>
      {drawing.haze.length > 0 && (
        <g className={styles.haze} data-milky-way>
          {drawing.haze.map((band, k) => (
            <path key={k} data-haze-band={k} fillOpacity={band.opacity} d={band.d} />
          ))}
        </g>
      )}
      {blooms.length > 0 && (
        <g data-blooms>
          {blooms.map(({ key, star, planet, mag, mark, p }) => (
            <circle key={key} data-bloom={star ?? planet} r={bloomRadiusPx(mag)} fill={`url(#${bloomGradientId(id, mark.tone)})`} transform={at(p)} />
          ))}
        </g>
      )}
      {drawing.figurePaths.length > 0 && (
        <g className={styles.figures} data-figures>
          {drawing.figurePaths.map(({ figure, segments, d }) => (
            <path key={figure} data-figure={figure} data-segments={segments} d={d} />
          ))}
        </g>
      )}
      {drawing.dotPaths.map(({ tone, d, stars: held }) => (
        <path key={tone} data-dots={tone} data-tone={tone} data-stars={held.join(' ')} d={d} />
      ))}
      {drawing.marks.map(({ key, star, planet, mark, p }) => {
        if (mark.kind === 'dot') return null;
        const anchor = { ...(star === undefined ? {} : { 'data-star': star }), ...(planet === undefined ? {} : { 'data-planet': planet }) };
        const { dx, dy } = inkOffsetPx(mark.glyph, mark.px);
        return (
          <text key={key} {...anchor} data-glyph={mark.glyph} data-px={mark.px} fontSize={mark.px} data-tone={mark.tone} dx={dx} dy={dy} transform={at(p)}>
            {mark.glyph}
          </text>
        );
      })}
      {ring !== null && <circle className={styles.landmarkRing} data-landmark-ring={landmark} r={LANDMARK_RING_PX} transform={at(ring)} />}
      {drawing.labels.length > 0 && (
        <g data-names>
          {drawing.labels.map((label) => (
            <text key={`${label.kind}-${String(label.key)}`} className={label.kind === 'figure' ? styles.figureName : styles.starName} {...(label.kind === 'figure' ? { 'data-figure-name': label.key } : { 'data-star-name': label.key })} x={fmt(label.x)} y={fmt(label.y)}>
              {label.text}
            </text>
          ))}
        </g>
      )}
    </g>
  );
});

// --- The Moon's disc (FR-LOOK-7) ---------------------------------------------

interface PolarMoonProps {
  moon: MoonState;
  sun: SunState | undefined;
  orientation: ChartOrientation;
  project: Project;
}

/**
 * FR-LOOK-7 on the chart: the Moon as a disc of `MOON_DISC_PX` user units with its phase — the dark part in
 * `--chart-sky-deep` with a hairline rim, the lit part `MoonDisc.tsx`'s `litPath` turned toward the Sun's side, read
 * off the chart's own projection of `brightLimbPoint` (a degree from the Moon toward the Sun), so in either
 * convention the lit limb faces where the Sun is on the drawing. The dark circle keeps `data-marker="moon"`.
 */
export function PolarMoon({ moon, sun, orientation, project }: PolarMoonProps) {
  const p = project(moon, orientation);
  const limb = sun === undefined ? null : brightLimbPoint(moon, sun);
  const angle = limb === null ? -90 : limbAngleDeg(p, project(limb, orientation));
  const r = MOON_DISC_PX / 2;
  return (
    <g data-body="moon" data-phase={moon.phase} data-lit={moon.illuminatedFraction.toFixed(2)} data-limb={Math.round(angle)} transform={at(p)}>
      <circle className={styles.moonDark} data-marker="moon" r={r} />
      <path className={styles.moonLit} data-moon-lit d={litPath(moon.illuminatedFraction, r)} transform={`rotate(${angle.toFixed(1)})`} />
    </g>
  );
}

// --- The window's field (FR-PHONE-9) ----------------------------------------

interface PolarFieldOutlineProps {
  camera: HandCamera;
  orientation: ChartOrientation;
  project: Project;
  /** R160 (FR-PHONE-9): the page's window follows the phone — the outline is the sensor's pose, not the hand's. */
  follow: boolean;
  /** The observer, for the declination every sensor reading is turned to true north by (FR-WIN-3). */
  observer: Pick<Observer, 'lat' | 'lon' | 'altM'>;
}

/** The window's view for the outline: the box the chart is drawn in (a square where nothing is laid out, as in jsdom), at the camera's field. */
function outlineView(box: HTMLElement | null | undefined, fovDeg: number, screenAngleDeg: number, sideways: boolean): View {
  const width = box?.clientWidth ?? 0;
  const height = box?.clientHeight ?? 0;
  const sized = width > 0 && height > 0;
  const w = sized ? width : 1;
  const h = sized ? height : 1;
  return { fovDeg, width: sideways ? h : w, height: sideways ? w : h, screenAngleDeg };
}

/**
 * FR-PHONE-9 (D-969, D-988): the window's field as a closed outline in `--chart-compass` at `--chart-hairline`,
 * written by ref on the camera's channel — every drag, key and zoom the camera takes moves it without a render of
 * the chart. The box is the frame's: the shape the window would draw in, read off the drawing's own box when it has
 * one (a square without, as in jsdom), at the camera's field, and drawn again when that box changes shape.
 *
 * R160 (FR-PHONE-9; D-992): while the page's window follows the phone the outline is the sensor's: `FollowingFieldOutline`
 * reads the phone's pose through the window's own `useViewRotation` (the sensor armed, the declination folded in, the
 * quarter the window would turn its box by) and writes the outline on its rotation channel, so the field moves with
 * every reading; the hand's form stays R158's, with no sensor armed and no render per move.
 */
export function PolarFieldOutline({ follow, ...props }: PolarFieldOutlineProps) {
  return follow ? <FollowingFieldOutline {...props} /> : <HandFieldOutline {...props} />;
}

type OutlineProps = Omit<PolarFieldOutlineProps, 'follow'>;

function HandFieldOutline({ camera, orientation, project }: OutlineProps) {
  const path = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const node = path.current;
    if (!node) return undefined;
    const box = node.ownerSVGElement?.parentElement;
    const write = (): void => {
      const pose = camera.get();
      node.setAttribute('d', fieldOutline(pose, outlineView(box, pose.fovDeg, 0, false), (point) => project(point, orientation)));
    };
    write();
    const unsubscribe = camera.subscribe(write);
    // A box that changes shape (a phone turned, a desk window resized) redraws the outline without waiting for a move.
    const resized = box && typeof ResizeObserver === 'function' ? new ResizeObserver(write) : null;
    if (box) resized?.observe(box);
    return () => {
      unsubscribe();
      resized?.disconnect();
    };
  }, [camera, orientation, project]);
  return <path ref={path} className={styles.fieldOutline} data-field-outline d="" />;
}

/** The rotation `useViewRotation` falls back on before the hand has a state: never read for a hand camera, which always has one. */
const NO_ROTATION: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function FollowingFieldOutline({ camera, orientation, project, observer }: OutlineProps) {
  const path = useRef<SVGPathElement>(null);
  const declinationDeg = useDeclination(observer);
  // The window's own source: the sensor drives, the hand's rotation stands until the first reading (D-941).
  const { subscribe, orientation: sensor } = useViewRotation(camera, declinationDeg, NO_ROTATION, true);
  // The window following turns its box by the pose's quarter against the browser's angle (FR-FSC-10, D-941): the
  // field it draws is upright to the reader, its sides swapped for a quarter, and the outline is of that field.
  const sensed = sensor.rotation !== null;
  const quarter = sensed ? sensor.quarter : 0;
  const turn = sensed ? turnFor(sensor.quarter, sensor.screenAngleDeg) : 0;
  const sideways = Math.abs(turn) === 90;
  const latest = useRef<Mat3 | null>(null);
  useLayoutEffect(() => {
    const node = path.current;
    if (!node) return undefined;
    const box = node.ownerSVGElement?.parentElement;
    const write = (): void => {
      const pose = camera.get();
      node.setAttribute('d', fieldOutline(latest.current ?? handRotation(pose), outlineView(box, pose.fovDeg, quarter, sideways), (point) => project(point, orientation)));
    };
    // One call per rotation the window would draw, the current one at once (D-751); a zoom while following moves the camera's field alone.
    const unsubscribeRotation = subscribe((m) => {
      latest.current = m;
      write();
    });
    write();
    const unsubscribeCamera = camera.subscribe(write);
    const resized = box && typeof ResizeObserver === 'function' ? new ResizeObserver(write) : null;
    if (box) resized?.observe(box);
    return () => {
      unsubscribeRotation();
      unsubscribeCamera();
      resized?.disconnect();
    };
  }, [camera, orientation, project, subscribe, quarter, sideways]);
  return <path ref={path} className={styles.fieldOutline} data-field-outline data-following d="" />;
}

// --- The pinch back to the window (FR-PHONE-10) --------------------------------

/**
 * R160 (FR-PHONE-10, D-970): `toPolar` run backwards — a point of the chart in user units (the horizon at `horizonR`)
 * to the sky direction under it, in the convention drawn: the altitude from the radius (90° at the centre, 0° on the
 * ring, under it past the ring, which the hand's tilt clamps), the azimuth from the angle with east on the left or the
 * right. The point a pinch's midpoint names, which the window then faces.
 */
export function skyAt(point: { x: number; y: number }, orientation: ChartOrientation, horizonR: number): FieldAim {
  const east = orientation === 'map' ? 1 : -1;
  const r = Math.hypot(point.x, point.y) / horizonR;
  const az = r < 1e-9 ? 0 : (Math.atan2(east * point.x, -point.y) * 180) / Math.PI;
  return { azDeg: ((az % 360) + 360) % 360, altDeg: 90 - 90 * r };
}

/** A client point to the chart's user units: the viewBox is square and centred in the drawing's box (`xMidYMid meet`). */
function chartPoint(svg: SVGSVGElement, half: number, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width, rect.height) / (2 * half) || 1;
  return { x: (clientX - rect.left - rect.width / 2) / scale, y: (clientY - rect.top - rect.height / 2) / scale };
}

interface PolarPinchProps {
  orientation: ChartOrientation;
  /** The chart's horizon radius and half side, user units (`SkyPolar.tsx`'s `HORIZON_R` and `VIEW_HALF`). */
  horizonR: number;
  half: number;
  onFieldHandoff: (aim: FieldAim) => void;
}

/**
 * R160 (FR-PHONE-10; D-970, D-991): the pinch back to the window, as listeners on the chart's own `<svg>` (this node's
 * owner), installed from the chunk so `main` carries none of it. Two touch pointers on the drawing are tracked from
 * the second's press to the first's lift — captured by the svg only once the two make a pinch, so a tap on an arc
 * still clicks it (a captured pointer's click goes to the capture target) — and where the distance between them grew
 * by more than `PINCH_HANDOFF_RATIO` (the fingers spreading: the field narrowing, FR-PHONE-10's "a pinch that narrows",
 * the way in that the window's pinch out past its end mirrors) the lift hands the view back to the window facing the
 * sky under the pinch's midpoint where it began (`skyAt`). One pointer is nothing here (the chart has no drag), a
 * mouse never pinches, a third finger is ignored, a cancel or a lost capture hands nothing over, and the first touch's
 * request is not this gesture's (`SkyViewLayout` asks only on a tap's lift). While mounted the svg's `touch-action`
 * keeps the page's scroll under one finger and takes the two from the browser's own zoom; it is restored on unmount,
 * so a chart offering no way back leaves the browser's zoom alone.
 */
export function PolarPinch({ orientation, horizonR, half, onFieldHandoff }: PolarPinchProps) {
  const anchor = useRef<SVGGElement>(null);
  const latest = useRef({ orientation, horizonR, half, onFieldHandoff });
  useLayoutEffect(() => {
    latest.current = { orientation, horizonR, half, onFieldHandoff };
  });
  useLayoutEffect(() => {
    const svg = anchor.current?.ownerSVGElement;
    if (!svg) return undefined;
    const touchAction = svg.style.touchAction;
    svg.style.touchAction = 'pan-x pan-y';
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { a: number; b: number; from: number; last: number; mid: { x: number; y: number } } | null = null;
    const forget = (pointerId: number): void => {
      pointers.delete(pointerId);
      if (pinch !== null && (pinch.a === pointerId || pinch.b === pointerId)) pinch = null;
    };
    const onDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') return;
      if (event.isPrimary) for (const id of [...pointers.keys()]) forget(id);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size !== 2 || pinch !== null) return;
      const [first, second] = [...pointers.entries()] as [[number, { x: number; y: number }], [number, { x: number; y: number }]];
      const distance = Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y);
      pinch = { a: first[0], b: second[0], from: distance, last: distance, mid: chartPoint(svg, latest.current.half, (first[1].x + second[1].x) / 2, (first[1].y + second[1].y) / 2) };
      for (const id of [first[0], second[0]]) {
        try {
          svg.setPointerCapture(id);
        } catch {
          // jsdom and old browsers: the pinch still works while the pointers stay over the drawing.
        }
      }
    };
    const onMove = (event: PointerEvent): void => {
      const tracked = pointers.get(event.pointerId);
      if (!tracked) return;
      tracked.x = event.clientX;
      tracked.y = event.clientY;
      if (pinch === null || (pinch.a !== event.pointerId && pinch.b !== event.pointerId)) return;
      const a = pointers.get(pinch.a);
      const b = pointers.get(pinch.b);
      if (a && b) pinch.last = Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onUp = (event: PointerEvent): void => {
      const released = pinch !== null && (pinch.a === event.pointerId || pinch.b === event.pointerId) ? pinch : null;
      forget(event.pointerId);
      if (released === null) return;
      if (released.from > 0 && released.last / released.from > PINCH_HANDOFF_RATIO) latest.current.onFieldHandoff(skyAt(released.mid, latest.current.orientation, latest.current.horizonR));
    };
    const onCancel = (event: PointerEvent): void => {
      forget(event.pointerId);
    };
    const listeners = [
      ['pointerdown', onDown],
      ['pointermove', onMove],
      ['pointerup', onUp],
      ['pointercancel', onCancel],
      ['lostpointercapture', onCancel],
    ] as const;
    for (const [name, listener] of listeners) svg.addEventListener(name, listener);
    return () => {
      for (const [name, listener] of listeners) svg.removeEventListener(name, listener);
      svg.style.touchAction = touchAction;
    };
  }, []);
  return <g ref={anchor} data-pinch />;
}
