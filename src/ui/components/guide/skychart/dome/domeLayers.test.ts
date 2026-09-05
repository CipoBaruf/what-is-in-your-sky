/**
 * PLAN §8.7 (R21): `domeLayers` decides which mesh belongs to which scene and
 * where every label sits, and it is pure — no React, no glyphcss, no clock —
 * so both are unit-tested here rather than eyeballed in a capture.
 *
 * The two things this file is the contract for:
 *   - FR-DOME-8: every mesh is on exactly one layer, surfaces on the base and
 *     marks on the lines, and an empty mesh is never emitted.
 *   - FR-DOME-3: labels resolve collisions in the order compass, peak, rise,
 *     end, moving along their own ring, and the FR-DOME-4 degree numbers
 *     never move.
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../../../tests/support/moonFixtures';
import type { Pass } from '../../../../../model';
import { LABEL_SHIFT_MAX_DEG, MOON_LABEL_OFFSET_DEG, RING_ELEVATIONS, TICK_LABEL_STEP_DEG, type LabelBox } from './domeGeometry';
import { baseLayer, domeLabels, domeLayers, lineLayer, type DomeLabel, type LayersInput, type PassLabelText } from './domeLayers';
import type { DomePalette } from './palette';
import { MEANINGS } from './palette';

const pass = goldenPassFixture();
const other: Pass = { ...pass, id: 'other', name: 'Tiangong', start: { ...pass.start, t: pass.start.t + 3_600_000 } };

/** A palette whose every value names its meaning, so a mesh's colour says where it came from. */
const palette = Object.fromEntries(MEANINGS.map((meaning) => [meaning, meaning])) as DomePalette;

const labelsFor = (p: Pass): PassLabelText => ({ rise: p.name, peak: 'max 10°', end: '09:52' });
/** Every label the same size, so a collision is about the geometry and not about the words. */
const measure = (): LabelBox => ({ halfWidth: 0.08, halfHeight: 0.03 });

const input = (over: Partial<LayersInput> = {}): LayersInput => ({
  passes: [pass],
  highlightedPassId: pass.id,
  palette,
  camera: { rotYDeg: 0, tiltDeg: 45 },
  labelsFor,
  measure,
  ...over,
});

const ids = (meshes: readonly { id: string }[]): string[] => meshes.map((mesh) => mesh.id);
const byId = (labels: readonly DomeLabel[], id: string): DomeLabel | undefined => labels.find((label) => label.id === id);

describe('baseLayer (FR-DOME-8a)', () => {
  it('carries the surfaces and nothing else, and drops the glow when there is no Sun', () => {
    expect(ids(baseLayer({ palette, sun: null }))).toEqual(['ground', 'bowl']);
    expect(ids(baseLayer({ palette, sun: { azDeg: 270, altDeg: -8 } }))).toEqual(['ground', 'bowl', 'glow']);
  });

  it('drops the glow once the Sun is below the FR-DOME-6 band, where it has no strength left', () => {
    expect(ids(baseLayer({ palette, sun: { azDeg: 270, altDeg: -20 } }))).toEqual(['ground', 'bowl']);
  });

  it('colours the surfaces from their own meanings, never from a mark', () => {
    const [ground, bowl] = baseLayer({ palette, sun: null });
    expect(ground?.polygons.every((poly) => poly.color === 'ground')).toBe(true);
    expect(bowl?.polygons.every((poly) => poly.color === 'sky')).toBe(true);
  });
});

describe('lineLayer (FR-DOME-8b)', () => {
  it('is the grid and one mesh per pass, with the markers beside it', () => {
    expect(ids(lineLayer({ passes: [pass, other], highlightedPassId: pass.id, now: undefined, palette }))).toEqual([
      'grid',
      `pass-${pass.id}`,
      `markers-${pass.id}`,
      'pass-other',
      'markers-other',
    ]);
  });

  it('adds the live marker only for the pass the instant falls inside (FR-DOME-5)', () => {
    const inside = lineLayer({ passes: [pass, other], highlightedPassId: pass.id, now: pass.start.t + 10_000, palette });
    expect(ids(inside)).toContain(`now-${pass.id}`);
    expect(ids(inside)).not.toContain('now-other');
  });

  it('draws the highlighted pass in the pass colour and the others dim (FR-DOME-2)', () => {
    const meshes = lineLayer({ passes: [pass, other], highlightedPassId: pass.id, now: undefined, palette });
    expect(meshes.find((mesh) => mesh.id === `pass-${pass.id}`)?.polygons[0]?.color).toBe('highlighted');
    expect(meshes.find((mesh) => mesh.id === 'pass-other')?.polygons[0]?.color).toBe('dim');
  });

  it('leaves every polygon uncoloured without a palette, which is the monochrome reading FR-X-5 keeps', () => {
    const meshes = lineLayer({ passes: [pass], highlightedPassId: pass.id, now: undefined, palette: null });
    expect(meshes.flatMap((mesh) => mesh.polygons).every((poly) => poly.color === undefined)).toBe(true);
  });

  /** FR-LIVE-2 (R32, D-158): the live page's colouring, one series colour per pass in pass order, every arc at full weight. */
  it('colours every arc from the series in pass order with colorBy="pass", cycling after the sixth, and none is dim', () => {
    const many: Pass[] = Array.from({ length: 8 }, (_, i) => ({ ...pass, id: `p${String(i)}`, start: { ...pass.start, t: pass.start.t + i * 600_000 } }));
    const meshes = lineLayer({ passes: many, highlightedPassId: null, now: undefined, palette, colorBy: 'pass' });
    const colorOf = (id: string): string | undefined => meshes.find((mesh) => mesh.id === `pass-${id}`)?.polygons[0]?.color;
    expect(many.map((p) => colorOf(p.id))).toEqual(['series1', 'series2', 'series3', 'series4', 'series5', 'series6', 'series1', 'series2']);
    // Full weight: a series arc has the highlighted strip's polygon count, not the dim strip's.
    const highlighted = lineLayer({ passes: [pass], highlightedPassId: pass.id, now: undefined, palette }).find((mesh) => mesh.id === `pass-${pass.id}`);
    const series = meshes.find((mesh) => mesh.id === 'pass-p0');
    expect(series?.polygons.length).toBe(highlighted?.polygons.length);
  });

  it('keeps the guide reading by default: highlightedPassId decides the colour, not the position', () => {
    const meshes = lineLayer({ passes: [other, pass], highlightedPassId: pass.id, now: undefined, palette });
    expect(meshes.find((mesh) => mesh.id === `pass-${pass.id}`)?.polygons[0]?.color).toBe('highlighted');
    expect(meshes.find((mesh) => mesh.id === 'pass-other')?.polygons[0]?.color).toBe('dim');
  });
});

describe('domeLabels with colorBy="pass" (FR-LIVE-2)', () => {
  it('names every arc at its rise in its series colour, and explains none with peak or end labels', () => {
    const labels = domeLabels(input({ passes: [pass, other], highlightedPassId: null, colorBy: 'pass' }));
    expect(byId(labels, `${pass.id}-rise`)?.color).toBe('series1');
    expect(byId(labels, 'other-rise')?.color).toBe('series2');
    expect(labels.filter((label) => label.kind === 'peak' || label.kind === 'end')).toEqual([]);
    expect(labels.filter((label) => label.kind === 'rise').every((label) => label.highlighted)).toBe(true);
  });
});

describe('hidden objects (FR-LIVE-6, R33)', () => {
  const hidden = [
    { id: 'hidden-1', azDeg: 40, elDeg: 20, label: 'Cosmos 2369 · in shadow' },
    { id: 'hidden-2', azDeg: 200, elDeg: 5, label: 'Envisat · too faint' },
  ];

  it('adds one small mesh per object in the dim colour, under the Moon, and nothing without them', () => {
    const meshes = lineLayer({ passes: [pass], highlightedPassId: pass.id, now: undefined, moon: MOON_FIXTURE, hidden, palette });
    expect(ids(meshes).slice(-3)).toEqual(['hidden-1', 'hidden-2', 'moon']);
    const mark = meshes.find((mesh) => mesh.id === 'hidden-1');
    expect(mark?.polygons.length).toBeGreaterThan(0);
    expect(mark?.polygons.every((poly) => poly.color === 'dim')).toBe(true);
    expect(ids(lineLayer({ passes: [pass], highlightedPassId: pass.id, now: undefined, palette })).some((id) => id.startsWith('hidden-'))).toBe(false);
  });

  it('labels each with the words the page gave it, in the dim colour, with the anchor the tests read, and last in the order', () => {
    const labels = domeLabels(input({ hidden }));
    expect(byId(labels, 'hidden-1-label')).toMatchObject({ kind: 'hidden', text: 'Cosmos 2369 · in shadow', color: 'dim', anchor: 'hidden' });
    expect(byId(labels, 'hidden-2-label')?.text).toBe('Envisat · too faint');
    expect(byId(domeLabels(input({ hidden, palette: null })), 'hidden-1-label')?.color).toBeUndefined();
  });
});

describe('the two layers together', () => {
  it('put every mesh on exactly one of them', () => {
    const layers = domeLayers(input({ passes: [pass, other], sun: { azDeg: 270, altDeg: -8 } }));
    const base = new Set(ids(layers.base));
    expect(ids(layers.lines).some((id) => base.has(id))).toBe(false);
    expect(layers.base.length + layers.lines.length).toBe(ids(layers.base).length + ids(layers.lines).length);
  });

  it('never emit an empty mesh: a scene with nothing in it is a scene glyphcss should not rasterise', () => {
    const layers = domeLayers(input({ passes: [], highlightedPassId: null, sun: null }));
    expect([...layers.base, ...layers.lines].every((mesh) => mesh.polygons.length > 0)).toBe(true);
  });
});

describe('domeLabels (FR-DOME-3, FR-DOME-4)', () => {
  it('draws the eight compass names, the degree numbers and the highlighted pass s three labels', () => {
    const labels = domeLabels(input());
    const kinds = labels.reduce<Record<string, number>>((acc, label) => ({ ...acc, [label.kind]: (acc[label.kind] ?? 0) + 1 }), {});
    expect(kinds.compass).toBe(8);
    // FR-DOME-4: every 30° of azimuth except the four cardinals, whose compass name already says the number.
    expect(kinds.tick).toBe(360 / TICK_LABEL_STEP_DEG - 4);
    expect(kinds.ring).toBe(RING_ELEVATIONS.length);
    expect(kinds.peak).toBe(1);
    expect(kinds.rise).toBe(1);
    expect(kinds.end).toBe(1);
  });

  it('gives a pass that is not highlighted its name only: no peak and no end label to crowd the drawing', () => {
    const labels = domeLabels(input({ passes: [pass, other] }));
    const dim = labels.filter((label) => label.passId === 'other');
    expect(dim.map((label) => label.kind)).toEqual(['rise']);
    expect(dim[0]?.highlighted).toBe(false);
  });

  it('words nothing itself: the pass labels are exactly what the catalogs gave it (FR-I18N-2)', () => {
    const labels = domeLabels(input());
    expect(byId(labels, `${pass.id}-rise`)?.text).toBe(pass.name);
    expect(byId(labels, `${pass.id}-peak`)?.text).toBe('max 10°');
    expect(byId(labels, `${pass.id}-end`)?.text).toBe('09:52');
  });

  it('numbers the degrees identically in every language, so they are not catalog entries (FR-I18N-4)', () => {
    const labels = domeLabels(input());
    const ticks = labels.filter((label) => label.kind === 'tick').map((label) => label.text);
    expect(ticks).toContain('30°');
    expect(ticks).not.toContain('90°');
    expect(labels.filter((label) => label.kind === 'ring').map((label) => label.text)).toEqual(RING_ELEVATIONS.map((el) => `${String(el)}°`));
  });

  it('colours a label by what it names (FR-DOME-2)', () => {
    const labels = domeLabels(input());
    expect(byId(labels, 'compass-N')?.color).toBe('compass');
    expect(byId(labels, `${pass.id}-rise`)?.color).toBe('highlighted');
    expect(byId(labels, `${pass.id}-peak`)?.color).toBe('peak');
    expect(labels.find((label) => label.kind === 'tick')?.color).toBe('rings');
  });

  it('leaves every label uncoloured without a palette', () => {
    expect(domeLabels(input({ palette: null })).every((label) => label.color === undefined)).toBe(true);
  });

  it('keeps the FR-DOME-4 numbers exactly where they belong, whatever else has to move', () => {
    const alone = domeLabels(input({ passes: [] }));
    const crowded = domeLabels(input({ passes: [pass, other], measure: () => ({ halfWidth: 0.4, halfHeight: 0.2 }) }));
    const fixedOf = (labels: readonly DomeLabel[]) => labels.filter((label) => label.kind === 'ring' || label.kind === 'tick').map((label) => [label.id, label.at] as const);
    expect(fixedOf(crowded)).toEqual(fixedOf(alone));
  });

  it('moves a colliding label along its own ring rather than dropping it (FR-DOME-3)', () => {
    // Labels wide enough that the compass names cannot all keep their places.
    const crowded = domeLabels(input({ measure: () => ({ halfWidth: 0.35, halfHeight: 0.1 }) }));
    const compass = crowded.filter((label) => label.kind === 'compass');
    expect(compass).toHaveLength(8);
    // Every one still sits on the compass ring: the shift is in azimuth, so the radius is untouched.
    const radii = compass.map((label) => Math.hypot(...label.at));
    for (const radius of radii) expect(radius).toBeCloseTo(radii[0] as number, 9);
  });

  it('resolves in the order compass, peak, rise, end: the compass keeps its place and the pass labels give way', () => {
    const wide = () => ({ halfWidth: 0.3, halfHeight: 0.12 });
    const placedCompass = domeLabels(input({ passes: [], measure: wide })).filter((label) => label.kind === 'compass');
    const withPasses = domeLabels(input({ passes: [pass, other], measure: wide })).filter((label) => label.kind === 'compass');
    expect(withPasses.map((label) => label.at)).toEqual(placedCompass.map((label) => label.at));
  });

  it('leaves a label with nowhere to go where it was, rather than losing it', () => {
    // Half a radius wide: nothing fits anywhere, so every label must still come back.
    const labels = domeLabels(input({ passes: [pass, other], measure: () => ({ halfWidth: 0.5, halfHeight: 0.5 }) }));
    expect(labels.filter((label) => label.kind === 'compass')).toHaveLength(8);
    expect(byId(labels, `${pass.id}-rise`)).toBeDefined();
    expect(labels.every((label) => label.at.every(Number.isFinite))).toBe(true);
  });

  it('never shifts a label further than the cap allows', () => {
    const labels = domeLabels(input({ passes: [pass, other], measure: () => ({ halfWidth: 0.3, halfHeight: 0.12 }) }));
    const alone = domeLabels(input({ passes: [pass, other], measure: () => ({ halfWidth: 0.001, halfHeight: 0.001 }) }));
    for (const label of labels) {
      const home = byId(alone, label.id);
      if (!home || label.kind === 'ring' || label.kind === 'tick') continue;
      const turned = (Math.atan2(label.at[1], label.at[0]) - Math.atan2(home.at[1], home.at[0])) * (180 / Math.PI);
      const shift = Math.abs(((turned + 540) % 360) - 180);
      expect(shift).toBeLessThanOrEqual(LABEL_SHIFT_MAX_DEG + 1e-6);
    }
  });

  it('carries the anchors the contract test and the e2e read (D-56)', () => {
    const labels = domeLabels(input());
    expect(byId(labels, `${pass.id}-rise`)?.anchor).toBe('pass');
    expect(byId(labels, `${pass.id}-peak`)?.anchor).toBe('peak');
    expect(labels.filter((label) => label.kind === 'compass').map((label) => label.anchor)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  });

  it('treats a null highlight as "every pass is the subject", which is the overview the list draws', () => {
    const labels = domeLabels(input({ passes: [pass, other], highlightedPassId: null }));
    expect(labels.filter((label) => label.kind === 'peak')).toHaveLength(2);
    expect(labels.filter((label) => label.passId !== undefined).every((label) => label.highlighted)).toBe(true);
  });
});

describe('the live marker and the flown arc (FR-DOME-5)', () => {
  const midway = Math.round((pass.start.t + pass.end.t) / 2);

  it('adds a flown mesh in the flown colour and a marker in the now colour once the pass has started', () => {
    const before = lineLayer(input({ now: pass.start.t - 1000 }));
    expect(ids(before)).not.toContain(`flown-${pass.id}`);
    expect(ids(before)).not.toContain(`now-${pass.id}`);

    const during = lineLayer(input({ now: midway }));
    expect(ids(during)).toContain(`flown-${pass.id}`);
    expect(ids(during)).toContain(`now-${pass.id}`);
    const flown = during.find((mesh) => mesh.id === `flown-${pass.id}`);
    expect(flown?.polygons.every((poly) => poly.color === 'flown')).toBe(true);
    expect(during.find((mesh) => mesh.id === `now-${pass.id}`)?.polygons.every((poly) => poly.color === 'now')).toBe(true);
    // The arc itself keeps its own colour: the flown part is drawn over it, not instead of it.
    expect(during.find((mesh) => mesh.id === `pass-${pass.id}`)?.polygons.every((poly) => poly.color === 'highlighted')).toBe(true);
  });

  it('grows the flown mesh as the instant advances, and has the whole arc flown at the end', () => {
    const lengthAt = (now: number): number => lineLayer(input({ now })).find((mesh) => mesh.id === `flown-${pass.id}`)?.polygons.length ?? 0;
    const quarter = lengthAt(Math.round(pass.start.t + (pass.end.t - pass.start.t) / 4));
    const half = lengthAt(midway);
    const whole = lengthAt(pass.end.t);
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(whole).toBeGreaterThan(half);
    // Every quad of the arc, and no marker left to draw: the pass is over.
    expect(ids(lineLayer(input({ now: pass.end.t + 1000 })))).not.toContain(`now-${pass.id}`);
  });

  it('draws no flown part and no marker without an instant', () => {
    const meshes = ids(lineLayer(input()));
    expect(meshes).not.toContain(`flown-${pass.id}`);
    expect(meshes).not.toContain(`now-${pass.id}`);
  });

  it("takes highlighted into the flown mesh's colour, so a dim pass's flown half does not outshine the highlighted one (F-5)", () => {
    const meshes = lineLayer({ passes: [pass, other], highlightedPassId: pass.id, now: midway, palette });
    expect(meshes.find((mesh) => mesh.id === `flown-${pass.id}`)?.polygons.every((poly) => poly.color === 'flown')).toBe(true);
    expect(meshes.find((mesh) => mesh.id === 'flown-other')?.polygons.every((poly) => poly.color === 'dim')).toBe(true);
  });
});

describe('the Sun and the Moon (FR-DOME-6)', () => {
  const sun = { azDeg: 285, altDeg: -8 };
  const moonUp = { ...MOON_FIXTURE };
  const bodyLabels = { sun: 'Sun', moon: (state: typeof MOON_FIXTURE) => `${state.phase} Moon` };

  it('puts the Moon on the line layer while it is up, in the Moon colour, and nowhere while it is down', () => {
    const up = lineLayer(input({ moon: moonUp }));
    expect(ids(up)).toContain('moon');
    expect(up.find((mesh) => mesh.id === 'moon')?.polygons.every((poly) => poly.color === 'moon')).toBe(true);
    expect(ids(lineLayer(input({ moon: MOON_DOWN })))).not.toContain('moon');
    expect(ids(lineLayer(input()))).not.toContain('moon');
  });

  it('labels both bodies, in their own colours, only where each one is drawn', () => {
    const labels = domeLabels(input({ sun, moon: moonUp, bodyLabels }));
    expect(byId(labels, 'sun-label')?.text).toBe('Sun');
    expect(byId(labels, 'sun-label')?.color).toBe('sun');
    expect(byId(labels, 'sun-label')?.anchor).toBe('sun');
    expect(byId(labels, 'moon-label')?.text).toBe('waningGibbous Moon');
    expect(byId(labels, 'moon-label')?.color).toBe('moon');
    expect(byId(labels, 'moon-label')?.anchor).toBe('moon');

    // Below −18° there is no glow to label, and below the horizon no Moon.
    const dark = domeLabels(input({ sun: { azDeg: 285, altDeg: -30 }, moon: MOON_DOWN, bodyLabels }));
    expect(byId(dark, 'sun-label')).toBeUndefined();
    expect(byId(dark, 'moon-label')).toBeUndefined();
    // …and no names to give them means no labels either, whatever is in the sky.
    expect(byId(domeLabels(input({ sun, moon: moonUp })), 'sun-label')).toBeUndefined();
  });

  it('gives way to the pass labels, which the fixed order puts first', () => {
    // Both bodies sit exactly where the highlighted pass's peak label wants to
    // be; the pass keeps the place and the bodies are the ones that move.
    const collide = { azDeg: pass.peak.azDeg, altDeg: -1 };
    const moonOnPeak = { ...MOON_FIXTURE, azDeg: pass.peak.azDeg, elDeg: pass.peak.elDeg - MOON_LABEL_OFFSET_DEG };
    const labels = domeLabels(input({ sun: collide, moon: moonOnPeak, bodyLabels, measure: () => ({ halfWidth: 0.3, halfHeight: 0.12 }) }));
    const alone = domeLabels(input({ sun: collide, moon: moonOnPeak, bodyLabels, measure: () => ({ halfWidth: 0.001, halfHeight: 0.001 }) }));
    const moved = (id: string): boolean => byId(labels, id)?.at.join() !== byId(alone, id)?.at.join();
    expect(moved(`${pass.id}-peak`)).toBe(false);
    expect(moved('moon-label')).toBe(true);
  });
});
