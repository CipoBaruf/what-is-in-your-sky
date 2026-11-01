import { BLOOM_RADIUS_PX, BLOOM_STRENGTH } from '../../../../../data/stars/constants';
import type { ToneToken } from './starGlyphs';

/**
 * R155 (FR-LOOK-6; V210-7; PLAN D-974): the bloom under the brightest — one
 * `<circle>` per star or planet brighter than `BLOOM_MAG`, of
 * `BLOOM_RADIUS_PX` by magnitude, filled with a radial gradient in the body's
 * tone from 0.32 × `BLOOM_STRENGTH` at the centre through 0.08 × it at 35 %
 * to nothing at the edge: five gradients, one per tone and one for the
 * planets, defined once in the field's `<defs>`. No filter: a gradient fill
 * costs the frame nothing a solid one does not. Pure: the ids, the stops and
 * the radius; the nodes and their writes are `StarField`'s.
 */

/** The tones a bloom is drawn in: the four star tones and the planets'. */
export const BLOOM_TONES: readonly (ToneToken | 'chart-planet')[] = ['chart-star', 'chart-star-blue', 'chart-star-yellow', 'chart-star-orange', 'chart-planet'];

/** The gradient's id for a tone, under the field's own prefix so two windows on a page do not share one. */
export const bloomGradientId = (prefix: string, tone: ToneToken | 'chart-planet'): string => `${prefix}-bloom-${tone}`;

/** FR-LOOK-6: the gradient's stops, offset 0..1 and alpha, at `BLOOM_STRENGTH`. */
export const BLOOM_STOPS: readonly { offset: number; alpha: number }[] = [
  { offset: 0, alpha: Math.round(0.32 * BLOOM_STRENGTH * 1000) / 1000 },
  { offset: 0.35, alpha: Math.round(0.08 * BLOOM_STRENGTH * 1000) / 1000 },
  { offset: 1, alpha: 0 },
];

/** FR-LOOK-6: `basePx + (pivotMag − V) × pxPerMag` — Sirius about 26 px, a first-magnitude star about 14. */
export function bloomRadiusPx(mag: number): number {
  return Math.round((BLOOM_RADIUS_PX.basePx + (BLOOM_RADIUS_PX.pivotMag - mag) * BLOOM_RADIUS_PX.pxPerMag) * 10) / 10;
}
