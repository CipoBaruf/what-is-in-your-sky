import { useId, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import { moonFacts } from '../../../../lib/moonPhrases';
import type { ChartView, CloudVerdict, MoonState } from '../../../../model';
import { SectionHeading } from '../../../components/primitives/SectionHeading';
import { SettingRow } from '../../../components/primitives/SettingRow';
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

/** The cover's percentage, whole, as the cloud badge writes it; `null` with no forecast. */
const coverPercent = (pct: number | null): string | null => (pct === null ? null : String(Math.round(pct)));

/**
 * R216 (FR-NOW-1, D-1239) → R219 (FR-NOW-2): the wide live page's `Up now` group — its heading, a picked pass's or sky
 * object's facts (R188, FR-FACT-2, FR-FACT-3), then `children`: the legend's up-only form (the chart's `list` slot)
 * and `LiveSkyRows`.
 */
export function LiveUpNow({ facts = null, children }: { facts?: ReactNode; children: ReactNode }) {
  const t = useT();
  const headingId = useId();
  return (
    <section className={styles.group} aria-labelledby={headingId} data-testid="live-group">
      <SectionHeading id={headingId}>{t.live.upNowHeading}</SectionHeading>
      {facts}
      {children}
    </section>
  );
}

/**
 * R219 (FR-NOW-3, D-1239): the sky's state as two `SettingRow`s at the end of `Up now`, in place of the status line:
 * `Clouds` with the cover in its tone, `Moon` with its phase and light (`…` until the astronomy chunk has it). `Sky`
 * and `Up` went with `StatusStrip`: the darkness is the daytime line's (FR-DARK-3), the count is the list above.
 */
export function LiveSkyRows({ cloud, moon }: { cloud: CloudVerdict; moon: MoonState | null }) {
  const t = useT();
  return (
    <div data-testid="live-sky-rows">
      <SettingRow label={t.live.cloudLabel} data-testid="live-cloud">
        <span className={styles.cloud} data-state={cloud.state}>
          {t.live.cloudRow({ state: cloud.state, percent: coverPercent(cloud.effectivePct) })}
        </span>
      </SettingRow>
      <SettingRow label={t.live.moonLabel} data-testid="live-moon">
        <span>{moon ? t.live.moonRow(moonFacts(moon)) : t.live.pending}</span>
      </SettingRow>
    </div>
  );
}
