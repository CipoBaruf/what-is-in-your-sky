import { useAppStore } from '../../../../state';
import { OptionToggle } from '../../common/OptionToggle';
import { GuideText } from '../GuideText';
import { POLAR_VIEW } from './polar/SkyPolar';
import styles from './SkyChart.module.css';
import type { SkyChartProps, SkyChartView } from './SkyChart.types';

/**
 * PLAN §8.1 (R13): the single boundary the app mounts. A `<figure>` whose
 * `<figcaption>` is the FR-GUIDE-1 sentence of the highlighted pass (the
 * text alternative, FR-GUIDE-7); the view itself hides its drawing from
 * assistive technology. The view is chosen from the `chartView` preference
 * (US-6 AC5, persisted in `wiys:prefs:v1`) with a dome / polar toggle. R15
 * registers the dome as the first entry of `SKY_CHART_VIEWS`; until then the
 * polar view is the only one, the `dome` preference falls back to it and the
 * toggle is not shown (a toggle between two identical views would be a lie).
 */
export const SKY_CHART_VIEWS: readonly SkyChartView[] = [POLAR_VIEW];

export function viewFor(id: SkyChartView['id']): SkyChartView {
  const view = SKY_CHART_VIEWS.find((candidate) => candidate.id === id) ?? SKY_CHART_VIEWS[0];
  if (!view) throw new Error('SkyChart: no views registered');
  return view;
}

export function SkyChart(props: SkyChartProps) {
  const chartView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const view = viewFor(chartView);
  const { passes, highlightedPassId, observer, className } = props;
  const captioned = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  return (
    <figure className={[styles.figure, className].filter(Boolean).join(' ')} data-testid="sky-chart" data-view={view.id}>
      <figcaption className={styles.caption}>{captioned ? <GuideText pass={captioned} timeZone={observer.timeZone} /> : <p className={styles.empty}>No pass to draw.</p>}</figcaption>
      {SKY_CHART_VIEWS.length > 1 && (
        <OptionToggle
          name="Chart view"
          prefix="View:"
          options={SKY_CHART_VIEWS.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
          value={view.id}
          onChange={setChartView}
        />
      )}
      <view.Component {...props} />
    </figure>
  );
}
