import { HOUR_MS } from '../../../lib/timeStripe';
import type { DeskView, SkyKeyActions } from '../../../lib/shortcuts';
import type { ChartView } from '../../../model';
import type { Playback } from './time/usePlayback';

/**
 * R189 (FR-WIDE-9, D-1102): the parts of a page's `SkyKeyActions` every desk page builds the same way — the view from
 * its `onChartView`, and `,` `.` `t` `Space` from its `Playback`. `null` playback (the stars page's window, which
 * shows real time and draws no time control) declines the four time keys.
 */
export function skyKeys(onChartView: (view: ChartView) => void, playback: Playback | null): SkyKeyActions {
  return {
    setView: (view: DeskView) => {
      onChartView(view);
      return true;
    },
    // FR-WIDE-9: one hour, clamped to the span (`stepTo`'s contract), playback carrying on from there.
    stepHour: (direction) => {
      if (playback === null) return false;
      playback.stepTo(playback.t + direction * HOUR_MS);
      return true;
    },
    toNow: () => {
      if (playback === null) return false;
      playback.toNow();
      return true;
    },
    togglePlay: () => {
      if (playback === null) return false;
      if (playback.playing) playback.pause();
      else playback.play();
      return true;
    },
  };
}
