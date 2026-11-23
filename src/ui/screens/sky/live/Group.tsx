import { useId, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import type { ChartView } from '../../../../model';
import { SectionHeading } from '../../../components/primitives/SectionHeading';
import { SkyViewChartSlot } from '../../../components/sky/SkyViewLayout';
import styles from '../sky.module.css';

/**
 * R216 (FR-NOW-1, D-1239): the wide live page's `View` group — the page's view row (the views, `[ Share ]` at its
 * right, `[ follow the phone ]`) and, while the window is the view, `Facing` (the chart's picker, placed here) on a
 * line of its own. A fragment, so every part is an item of the layout's view row.
 */
export function LiveView({ view, children }: { view: ChartView; children: ReactNode }) {
  const t = useT();
  const facingId = useId();
  return (
    <>
      {children}
      {view === 'window' && (
        <section className={styles.wholeRow} aria-labelledby={facingId} data-testid="live-facing-group">
          <SectionHeading id={facingId}>{t.skyView.facing}</SectionHeading>
          <SkyViewChartSlot name="picker" />
        </section>
      )}
    </>
  );
}

/**
 * R216 (FR-NOW-1, D-1239): the wide live page's `Up now` slot until R219 gives it `Legend`'s up-only form — a picked
 * pass's or sky object's facts (R188, FR-FACT-2, FR-FACT-3), then the legend and the conditions line.
 */
export function LiveUpNow({ facts = null, children }: { facts?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.group} data-testid="live-group">
      {facts}
      {children}
    </div>
  );
}
