import { chart } from './en/chart';
import { live } from './en/live';
import { ui } from './en/ui';
import { windowMessages } from './en/window';

/**
 * FR-I18N-2 (D-69), split per lane (D-199 (2)): `en/ui.ts`, `en/chart.ts`,
 * `en/live.ts` and `en/window.ts` each carry the section their own lane owns,
 * so a `chart` or `live` task no longer conflicts with `ui` on this one file
 * (D-196's positional rule: a lane appends keys only inside its own section).
 * This file is the merge, and stays the type `es.ts` must satisfy — there is
 * no runtime lookup and no fallback path: a message is a property or a
 * function on a plain object, and both catalogs ship in the main chunk
 * (PLAN §11).
 */
export const en = { ...ui, ...chart, ...live, ...windowMessages };
