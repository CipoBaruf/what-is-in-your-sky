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
import type { Pass } from '../../../../../model';
import { LABEL_SHIFT_MAX_DEG, RING_ELEVATIONS, TICK_LABEL_STEP_DEG, type LabelBox } from './domeGeometry';
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
