import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useT } from '../../../../i18n/useT';
import { bodyLines, legendKeys, legendRows, promoteRow } from '../../../../lib/legend';
import { useAppStore } from '../../../../state';
import { OptionToggle } from '../../common/OptionToggle';
import { GuideText } from '../GuideText';
import { moonVisible, sunVisible } from './bodies';
import { ChartFrame } from './ChartFrame';
import { Legend } from './Legend';
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
 *
 * R45 (FR-LEG-1..5, D-186): this boundary derives the legend from the same
 * props the view draws — `legendRows` in `lib/legend.ts` — and hands the
 * view both the keys to draw at each peak and the rendered list to place
 * in the frame's slot, so the legend and the drawing cannot disagree
 * whichever view is mounted. A row the reader activates (tap, click or
 * focus) pins that pass as the highlighted one, listed first, until another
 * row or the chart is activated (FR-LEG-4); the pin is dropped when the
 * caller's own highlight changes or the pass leaves the set.
 */
const SkyDome = lazy(() => import('./dome/SkyDome').then((module) => ({ default: module.SkyDome })));

function DomeView(props: SkyChartProps) {
  const t = useT();
  return (
    <Suspense
      fallback={
        <ChartFrame status={<p className={styles.loading}>{t.chart.loadingDome}</p>} legend={props.legend} fill={props.fill ?? false}>
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
  const { passes, observer, className, fill = false, now, hidden, colorBy, onSelectPass } = props;
  // FR-DOME-6: one evaluation for whichever view is mounted, so the toggle
  // never changes where the Sun and the Moon are (R22).
  const bodies = useSkyBodies(props);

  // FR-LEG-4: the row (or arc) the reader activated, remembered against the caller's own highlight so a new pass drops it.
  const [pinned, setPinned] = useState<{ id: string; over: string | null } | null>(null);
  const pinnedId = pinned !== null && pinned.over === props.highlightedPassId && (passes.some((pass) => pass.id === pinned.id) || hidden?.some((marker) => marker.id === pinned.id)) ? pinned.id : null;
  const highlightedPassId = pinnedId ?? props.highlightedPassId;
  const select = useCallback(
    (passId: string) => {
      setPinned({ id: passId, over: props.highlightedPassId });
      onSelectPass?.(passId);
    },
    [props.highlightedPassId, onSelectPass],
  );

  // FR-LEG-1, FR-LEG-2: the rows and the keys from the caller's props; the pinned row moves first but keeps its key.
  const baseRows = useMemo(() => legendRows({ passes, highlightedPassId: props.highlightedPassId, now, hidden, colorBy }), [passes, props.highlightedPassId, now, hidden, colorBy]);
  const rows = useMemo(() => promoteRow(baseRows, pinnedId), [baseRows, pinnedId]);
  const keys = useMemo(() => legendKeys(baseRows), [baseRows]);
  const lines = bodyLines({ sun: bodies.sun, moon: bodies.moon }, { sun: bodies.sun ? sunVisible(bodies.sun) : false, moon: bodies.moon ? moonVisible(bodies.moon) : false });

  const captioned = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  const legend = <Legend rows={rows} bodies={lines} timeZone={observer.timeZone} highlightedPassId={highlightedPassId} onActivate={select} />;
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
      <view.Component {...props} highlightedPassId={highlightedPassId} onSelectPass={select} sun={bodies.sun} moon={bodies.moon} legendKeys={keys} legend={legend} />
    </figure>
  );
}
