import type { ComponentType } from 'react';
import type { SunState } from '../../../../lib/skyBodies';
import type { ChartView, EpochMs, MoonState, Observer, Pass } from '../../../../model';

/**
 * PLAN §8.1 (R13): the one props interface both sky chart views implement.
 * The rest of the app knows `SkyChart` and this shape only; the geometry is
 * already observer-relative (`Pass.track`), the observer is for labels and
 * the time zone.
 */
export interface SkyChartProps {
  /** What to draw; usually one, may be several for a "tonight" overview. */
  passes: readonly Pass[];
  observer: Observer;
  /** Emphasised arc + peak; others drawn dim. */
  highlightedPassId: string | null;
  onSelectPass?: (passId: string) => void;
  /** Optional: marks the satellite's current position on its arc, and is the instant the Sun and Moon are drawn at (FR-DOME-5, FR-DOME-6). */
  now?: EpochMs;
  /**
   * FR-DOME-6, PLAN §8.8: where the Sun and the Moon are at `now`. Omitted,
   * `SkyChart` evaluates them itself from `observer` and `now` (`useSkyBodies`,
   * which loads `lib/skyBodies.ts` on demand). The live page supplies them so
   * it can hold the FR-LIVE-5 budget of one evaluation per second of wall time
   * across playback. `null` means "known to be nothing to draw".
   */
  sun?: SunState | null;
  moon?: MoonState | null;
  /** Default: the highlighted pass's start azimuth (D-17). The polar view has no facing; the dome (R15) uses it. */
  initialFacingAzDeg?: number;
  /**
   * FR-LIVE-2 (R32, D-158): how the arcs are coloured. `highlight` (the
   * default) is the guide's reading — the highlighted pass in the pass colour
   * and the others dim. `pass` is the live page's: every arc at full weight in
   * its own colour, the six `--chart-series-*` tokens taken in `passes` order.
   */
  colorBy?: 'highlight' | 'pass';
  /**
   * FR-LIVE-1 / PLAN §8.1 (R32): no caption, no square box — the drawing fills
   * whatever box the caller gives the chart, the live page's whole viewport
   * included. The guide's chart keeps the framed square and its sentence.
   */
  fill?: boolean;
  className?: string;
}

/** Both implementations export this shape; `SkyChart.tsx` is the only file that knows two exist. The toggle's label is `Messages['chart']['view'][id]` (R17), not a field here. */
export interface SkyChartView {
  Component: ComponentType<SkyChartProps>;
  id: ChartView;
}
