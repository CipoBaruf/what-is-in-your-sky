import type { HiddenReason } from '../../../i18n/messages';
import type { NoradId, NowItem, NowState, Pass, SkyState } from '../../../model';
import type { HiddenMarker } from '../guide/skychart/SkyChart.types';

/**
 * R33 (FR-LIVE-6, US-15 AC6): from the worker's `NowState.hidden` to the
 * markers the chart places. Pure; the words come in as a function so the
 * catalogs stay the only source of text (FR-I18N-2).
 *
 * **The reason** is read off the item's own fields in the order D-96 set:
 * below the minimum elevation is too low; unlit is Earth's shadow; a sky that
 * is not dark is daylight; anything else up there that the worker still calls
 * hidden is too faint for the magnitude limit.
 *
 * **The subtraction** is D-102's: an object appears in `hidden` and in a pass
 * at once for a few seconds while it dims past the limit at the end of its
 * arc. The page draws its passes first and dims only what it has not already
 * drawn, so no object gets two marks.
 */
export function hiddenReason(item: NowItem, sky: SkyState): HiddenReason {
  if (!item.aboveMinElevation) return 'low';
  if (!item.lit) return 'shadow';
  if (sky !== 'dark') return 'daylight';
  return 'faint';
}

/** The objects with a live marker at `t`: the passes whose interval contains it (D-160). */
export function drawnAt(passes: readonly Pass[], t: number): Set<NoradId> {
  return new Set(passes.filter((pass) => pass.start.t <= t && t <= pass.end.t).map((pass) => pass.noradId));
}

/** The markers for the chart: every hidden object not already drawn on an arc, worded by `label`. */
export function hiddenMarkers(state: NowState | null, drawn: ReadonlySet<NoradId>, label: (name: string, reason: HiddenReason) => string): HiddenMarker[] {
  if (!state?.hidden) return [];
  return state.hidden
    .filter((item) => !drawn.has(item.noradId))
    .map((item) => ({ id: `hidden-${String(item.noradId)}`, azDeg: item.azDeg, elDeg: item.elDeg, label: label(item.name, hiddenReason(item, state.sky)) }));
}
