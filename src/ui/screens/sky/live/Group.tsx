import { useId, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import type { ChartView } from '../../../../model';
import { SectionHeading } from '../../../components/primitives/SectionHeading';
import { SkyViewChartSlot } from '../../../components/sky/SkyViewLayout';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098): the wide live page's group — `Facing` while the window is the view (the chart's picker,
 * placed here), then the page's actions: `[ scrub here ]`, the next event's jump, `[ hidden ]` and `[ Share ]`.
 * R188 (FR-FACT-2, FR-FACT-3): a picked pass's or sky object's facts under `Facing` (`facts`, the lazy group).
 */
export function LiveGroup({ view, actions, facts = null }: { view: ChartView; actions: ReactNode; facts?: ReactNode }) {
  const t = useT();
  const facingId = useId();
  return (
    <div className={styles.group} data-testid="live-group">
      {view === 'window' && (
        <section aria-labelledby={facingId} data-testid="live-facing-group">
          <SectionHeading id={facingId}>{t.skyView.facing}</SectionHeading>
          <SkyViewChartSlot name="picker" />
        </section>
      )}
      {facts}
      {actions}
    </div>
  );
}
