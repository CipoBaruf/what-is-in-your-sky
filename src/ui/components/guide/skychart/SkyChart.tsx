import { lazy, Suspense } from 'react';
import { useT } from '../../../../i18n/useT';
import { useAppStore } from '../../../../state';
import { OptionToggle } from '../../common/OptionToggle';
import { GuideText } from '../GuideText';
import { ChartFrame } from './ChartFrame';
import { POLAR_VIEW } from './polar/SkyPolar';
import styles from './SkyChart.module.css';
import type { SkyChartProps, SkyChartView } from './SkyChart.types';
import { useSkyBodies } from './useSkyBodies';

/**
 * PLAN §8.1 (R13): the single boundary the app mounts. A `<figure>` whose
 * `<figcaption>` is the FR-GUIDE-1 sentence of the highlighted pass (the
 * text alternative, FR-GUIDE-7); the view itself hides its drawing from
 * assistive technology. The view is chosen from the `chartView` preference
 * (US-6 AC5, persisted in `wiys:prefs:v1`) with a polar / dome toggle. R15
 * registers the dome, code-split behind `React.lazy` (PLAN §11: the chart
 * chunk, `@glyphcss/react` and `dome/`, is fetched only when a detail sheet
 * opens on the dome view), so this file, the only one that knows two views
 * exist, imports nothing from `dome/` statically. The polar chart is first
 * and the default for now (D-68, the owner's call in the R15 review); the
 * toggle is shown only with more than one registered view (D-55). Both
 * views lay themselves out in `ChartFrame`, so the toggle moves nothing.
 */
const SkyDome = lazy(() => import('./dome/SkyDome').then((module) => ({ default: module.SkyDome })));

function DomeView(props: SkyChartProps) {
  const t = useT();
  return (
    <Suspense
      fallback={
        <ChartFrame status={<p className={styles.loading}>{t.chart.loadingDome}</p>}>
          <div className={styles.loadingBox} data-testid="dome-loading" />
        </ChartFrame>
      }
    >
      <SkyDome {...props} />
    </Suspense>
  );
}

export const DOME_VIEW: SkyChartView = { Component: DomeView, id: 'dome' };

export const SKY_CHART_VIEWS: readonly SkyChartView[] = [POLAR_VIEW, DOME_VIEW];

export function viewFor(id: SkyChartView['id']): SkyChartView {
  const view = SKY_CHART_VIEWS.find((candidate) => candidate.id === id) ?? SKY_CHART_VIEWS[0];
  if (!view) throw new Error('SkyChart: no views registered');
  return view;
}

/**
 * R32 (FR-LIVE-1, FR-LIVE-10): with `fill` the chart is the live page's whole
 * drawing. There is no single pass to caption — the page's status strip is
 * the text alternative (FR-GUIDE-7) — so the figure carries a name instead of
 * a caption, and it fills the box it is given rather than the guide's square.
 */
export function SkyChart(props: SkyChartProps) {
  const t = useT();
  const chartView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const view = viewFor(chartView);
  const { passes, highlightedPassId, observer, className, fill = false } = props;
  const captioned = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  // FR-DOME-6: one evaluation for whichever view is mounted, so the toggle
  // never changes where the Sun and the Moon are (R22).
  const bodies = useSkyBodies(props);
  return (
    <figure
      className={[styles.figure, fill ? styles.fill : undefined, className].filter(Boolean).join(' ')}
      data-testid="sky-chart"
      data-view={view.id}
      {...(fill ? { 'aria-label': t.chart.liveLabel } : {})}
    >
      {!fill && <figcaption className={styles.caption}>{captioned ? <GuideText pass={captioned} timeZone={observer.timeZone} /> : <p className={styles.empty}>{t.chart.noPass}</p>}</figcaption>}
      {SKY_CHART_VIEWS.length > 1 && (
        <OptionToggle
          name={t.chart.viewGroup}
          prefix={t.chart.viewPrefix}
          options={SKY_CHART_VIEWS.map((candidate) => ({ value: candidate.id, label: t.chart.view[candidate.id] }))}
          value={view.id}
          onChange={setChartView}
        />
      )}
      <view.Component {...props} sun={bodies.sun} moon={bodies.moon} />
    </figure>
  );
}
