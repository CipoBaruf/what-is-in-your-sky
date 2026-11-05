import { useCallback, useEffect, useId, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import { firstPassFor } from '../../../../lib/livePasses';
import { BODIES_EVERY_MS } from '../../../../lib/playback';
import { passIdHash } from '../../../../lib/shareLinks';
import type { ChartView, Observer } from '../../../../model';
import { useAppStore } from '../../../../state';
import { SkyChart } from '../../../components/guide/skychart/SkyChart';
import { useChartHand } from '../../../components/guide/skychart/useChartHand';
import { useSkyBodies } from '../../../components/guide/skychart/useSkyBodies';
import { useSkyScene } from '../../../components/guide/skychart/useSkyScene';
import { StarsToggle } from '../../../components/live/StarsToggle';
import { useStarSource } from '../../../components/live/useStarSource';
import { useWallThrottle } from '../../../components/live/useWallThrottle';
import { SkyViewChartSlot, SkyViewLayout } from '../../../components/sky/SkyViewLayout';
import { useNow } from '../../../hooks/useNow';
import { replace } from '../../../navigation';
import { useShownClock, useShownPasses } from '../../home/shownPasses';
import { viewFor } from '../../chartViewDefault';
import styles from '../../PassDetail.module.css';

const NO_PASSES: readonly never[] = [];
const TICK_MS = 1000;

/**
 * v2.14.1 (FR-CLEAN-14 as amended, D-1134): the wide pass page with no pass — `#pass`, what `[ satellites ]` opens
 * when the span holds none. The page's name as its `h1`, the view row, the sky at now with no arc, and the rail's
 * list (D-1135), which says there is nothing in its 24 h.
 *
 * D-1134 (V214-35): a bare `#pass` opened before the passes are known — a reload, a typed address — is not left
 * empty: once a pass is known it becomes the pass `[ satellites ]` names (`firstPassFor`), the entry replaced in place
 * (`replace`, the opener kept), so Back still leaves the page for where it was opened from.
 */
export function PassEmpty({ observer, passList }: { observer: Observer; passList: ReactNode }) {
  const t = useT();
  const headingId = useId();
  const now = useNow(TICK_MS);
  const bodies = useSkyBodies({ observer, now: useWallThrottle(now, BODIES_EVERY_MS) });
  const starsLayer = useAppStore((s) => s.starsLayer);
  const source = useStarSource(starsLayer);
  const scene = useSkyScene({ observer, now, starsLayer, source });
  const chartHand = useChartHand();
  const savedView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const onChartView = useCallback((next: ChartView) => setChartView(next), [setChartView]);
  const view = viewFor('pass', 'wide', savedView);
  const first = firstPassFor(useShownPasses(), useShownClock());
  const firstId = first?.id ?? null;
  useEffect(() => {
    if (firstId !== null) replace(passIdHash(firstId));
  }, [firstId]);
  return (
    <div className={styles.desk} data-testid="pass-empty" role="region" aria-labelledby={headingId}>
      <SkyViewLayout
        labelledBy={headingId}
        data-testid="pass-layout"
        className={styles.layout}
        answer={
          <div className={styles.deskHead} data-testid="pass-head">
            <h1 id={headingId} tabIndex={-1} className={styles.deskName}>
              {t.header.pages.pass}
            </h1>
          </div>
        }
        viewRow={
          <>
            <SkyViewChartSlot name="control" />
            <StarsToggle />
          </>
        }
        drawing={<SkyChart passes={NO_PASSES} observer={observer} highlightedPassId={null} now={now} sun={bodies.sun} moon={bodies.moon} scene={scene} fill chartHand={chartHand} page="pass" view={view} onViewChange={onChartView} />}
        list={passList}
        listFirst
      />
    </div>
  );
}
