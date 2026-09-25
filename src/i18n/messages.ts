import type { en } from './en';

/**
 * FR-I18N-2 (D-69): `en.ts` is the source of truth and this is its type, so
 * `const es: Messages` in `es.ts` fails `tsc -b` the moment a key is missing,
 * misspelled, or given the wrong parameter list. There is no runtime lookup
 * and no fallback path: a message is a property or a function on a plain
 * object, and both catalogs ship in the main chunk (PLAN §11).
 *
 * The parameter shapes messages take, beyond the ones `src/lib` already owns
 * (`GuideParams`, `AgeParts`, the bands), live here so both catalogs and
 * their callers name the same thing.
 */
export type Messages = typeof en;

/**
 * A sentence with one link in it. The catalog decides where the link falls,
 * which is the whole point: "Weather data by <CelesTrak>." and "Datos del
 * clima de <CelesTrak>." put it in different places, and a placeholder in a
 * template string could not move the words around it.
 */
export interface LinkedText {
  before: string;
  link: string;
  after: string;
}

/**
 * R33 (FR-LIVE-6, US-15 AC6): why an object above the horizon is not worth
 * looking for, read off its `NowItem` by the live page (`components/live/
 * hiddenObjects.ts`) in D-96's order — too low, in Earth's shadow, a sky
 * that is not dark, or fainter than the limit.
 */
export type HiddenReason = 'low' | 'shadow' | 'daylight' | 'faint';

/**
 * Where a pass is against the clock (`common/Countdown.tsx`): before its
 * rise, on the way to its peak, on the way to its end, or over. The
 * countdown's headline is one message per language, so the phase reaches the
 * catalog rather than a label built outside it.
 */
export type CountdownPhase = 'before' | 'to-peak' | 'to-end' | 'over';
