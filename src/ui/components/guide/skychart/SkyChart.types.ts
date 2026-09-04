import type { ComponentType } from 'react';
import type { ChartView, EpochMs, Observer, Pass } from '../../../../model';

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
  /** Optional: marks the satellite's current position on its arc. */
  now?: EpochMs;
  /** Default: the highlighted pass's start azimuth (D-17). The polar view has no facing; the dome (R15) uses it. */
  initialFacingAzDeg?: number;
  className?: string;
}

/** Both implementations export this shape; `SkyChart.tsx` is the only file that knows two exist. The toggle's label is `Messages['chart']['view'][id]` (R17), not a field here. */
export interface SkyChartView {
  Component: ComponentType<SkyChartProps>;
  id: ChartView;
}
