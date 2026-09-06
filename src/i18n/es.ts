import { chart } from './es/chart';
import { live } from './es/live';
import { ui } from './es/ui';
import { windowMessages } from './es/window';
import type { Messages } from './messages';

/**
 * FR-I18N-2: the Spanish catalog, split per lane like `en.ts` (D-199 (2)).
 * `es/ui.ts`, `es/chart.ts` and `es/live.ts` are each typed against their own
 * `en/*.ts` shape, and this merge is typed as `Messages` on top, so a key
 * missing anywhere is still a `tsc -b` failure and never a runtime fallback
 * to English (D-69).
 */
export const es: Messages = { ...ui, ...chart, ...live, ...windowMessages };
