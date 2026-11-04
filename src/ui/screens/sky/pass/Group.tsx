import { useId, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import type { ChartView } from '../../../../model';
import { SectionHeading } from '../../../components/primitives/SectionHeading';
import { SkyViewChartSlot } from '../../../components/sky/SkyViewLayout';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098): the wide pass detail's group — the pass's times (FR-FLOW-7's row), the chart's table of
 * points (FR-LEG-3, the legend's lead), the prose and the Moon's lines, `Facing` while the window is the view, and
 * the share action. R188 adds `This satellite` (FR-FACT-2) here; the list slot under it is the home's pass list.
 */
export interface PassGroupProps {
  view: ChartView;
  times: ReactNode;
  /** The FR-GUIDE-1 sentence and the glare line, the drawing's text alternative (`describedBy`). */
  prose: ReactNode;
  /** The Moon-at-peak line and the share action. */
  foot: ReactNode;
  /** `[ follow the phone ]`, where the sensor is. */
  follow?: ReactNode;
}

export function PassGroup({ view, times, prose, foot, follow }: PassGroupProps) {
  const t = useT();
  const facingId = useId();
  return (
    <div className={styles.group} data-testid="pass-group">
      <div data-testid="pass-times">{times}</div>
      {/* FR-LEG-3: the table of points is the chart's legend, placed here. */}
      <SkyViewChartSlot name="list" />
      <div data-testid="pass-prose">{prose}</div>
      {view === 'window' && (
        <section aria-labelledby={facingId} data-testid="pass-facing-group">
          <SectionHeading id={facingId}>{t.skyView.facing}</SectionHeading>
          <SkyViewChartSlot name="picker" />
        </section>
      )}
      {follow}
      <div data-testid="pass-foot">{foot}</div>
    </div>
  );
}
