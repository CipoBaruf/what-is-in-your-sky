import { FIELD_DETAIL_STEPS, type FieldDetailStep } from '../../../../../data/stars/constants';

/**
 * R154 (FR-LOOK-9, PLAN D-974): detail follows the field. The row of
 * `FIELD_DETAIL_STEPS` for a field of `fovDeg` — the field across the box's
 * shorter side, `projection.ts`'s `fov` — is the first whose `aboveDeg` the
 * field is wider than; the last row's 0 catches every field down to
 * `WINDOW_FOV_MIN_DEG`. The window draws every star to `magLimit` and names
 * every star to `nameMag` (R155); a row whose `magLimit` passes
 * `STAR_MAG_LIMIT` needs the deep chunk (`data/stars/deepChunk.ts`). Pure.
 */
export interface FieldDetail {
  /** The faintest magnitude drawn. */
  magLimit: number;
  /** The faintest magnitude named. */
  nameMag: number;
}

/** The detail for a field of `fovDeg`; a field that is not a number is taken as the widest. */
export function fieldDetail(fovDeg: number, steps: readonly FieldDetailStep[] = FIELD_DETAIL_STEPS): FieldDetail {
  const row = steps.find(([aboveDeg]) => !(fovDeg <= aboveDeg)) ?? steps.at(-1);
  if (row === undefined) throw new Error('fieldDetail: no steps');
  const [, magLimit, nameMag] = row;
  return { magLimit, nameMag };
}
