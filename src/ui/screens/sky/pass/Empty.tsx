import { lazy, Suspense, useCallback, useEffect, useId, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import { MOON_LORE } from '../../../../lib/flags';
import { firstPassFor } from '../../../../lib/livePasses';
import { BODIES_EVERY_MS } from '../../../../lib/playback';
import { passIdHash } from '../../../../lib/shareLinks';
import type { ChartView, Observer } from '../../../../model';
import { useAppStore } from '../../../../state';
import { InstallHint } from '../../../components/common/InstallHint';
import { ReadinessLine } from '../../../components/common/ReadinessLine';
import { ElementsLine } from '../../../components/elements/ElementsLine';
import { SkyChart } from '../../../components/guide/skychart/SkyChart';
import { useChartHand } from '../../../components/guide/skychart/useChartHand';
import { useSkyBodies } from '../../../components/guide/skychart/useSkyBodies';
import { useSkyScene } from '../../../components/guide/skychart/useSkyScene';
import { StarsToggle } from '../../../components/live/StarsToggle';
import { useStarSource } from '../../../components/live/useStarSource';
import { useWallThrottle } from '../../../components/live/useWallThrottle';
import { ConditionsTable } from '../../../components/now/ConditionsTable';
import { TonightStripe } from '../../../components/now/TonightStripe';
import { PassList } from '../../../components/passes/PassList';
import { TextButton } from '../../../components/primitives/TextButton';
import { VisuallyHidden } from '../../../components/primitives/VisuallyHidden';
import { SkyViewChartSlot, SkyViewLayout } from '../../../components/sky/SkyViewLayout';
import { useNow } from '../../../hooks/useNow';
import { replace } from '../../../navigation';
import { requestPlace } from '../../home/placeRequest';
import { useShownClock, useShownPasses } from '../../home/shownPasses';
import { useNight } from '../../home/useNight';
import { viewFor } from '../../chartViewDefault';
import styles from '../../PassDetail.module.css';
import tonightStyles from './Empty.module.css';

const NO_PASSES: readonly never[] = [];
const TICK_MS = 1000;

/** FR-FLAG-1 (D-183): the import lives inside the condition, so with the flag off the lore is in no chunk of the build. */
const MoonLore = MOON_LORE ? lazy(() => import('../../../components/moon/MoonLore').then((module) => ({ default: module.MoonLore }))) : undefined;

/**
 * v2.14.1 (FR-CLEAN-14 as amended, D-1134): the wide pass page with no pass — `#pass`, what `[ satellites ]` opens
 * when the span holds none. The page's name as its `h1`, the view row, the sky at now with no arc, and the rail's
 * list (D-1135), which says there is nothing in its 24 h.
 *
 * D-1134 (V214-35): a bare `#pass` opened before the passes are known — a reload, a typed address — is not left
 * empty: once a pass is known it becomes the pass `[ satellites ]` names (`firstPassFor`), the entry replaced in place
 * (`replace`, the opener kept), so Back still leaves the page for where it was opened from.
 *
 * R212 (FR-ROUTE-3): also the page of a `#pass=<id>` the run has not produced, or no longer holds. That one keeps its
 * address (`settle` off): the pass may still be coming, and the list says when it is gone (FR-SHARE-3).
 */
export function PassEmpty({ observer, passList, settle = true }: { observer: Observer; passList: ReactNode; settle?: boolean }) {
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
    if (settle && firstId !== null) replace(passIdHash(firstId));
  }, [settle, firstId]);
  return (
    <div className={styles.desk} data-testid="pass-empty" role="region" aria-labelledby={headingId}>
      <SkyViewLayout
        labelledBy={headingId}
        data-testid="pass-layout"
        className={styles.layout}
        strip={
          <div className={styles.deskHead} data-testid="pass-head">
            <h1 id={headingId} tabIndex={-1} className={styles.deskName}>
              {t.header.pages.pass}
            </h1>
          </div>
        }
        view={
          <>
            <SkyViewChartSlot name="control" />
            <StarsToggle />
          </>
        }
        drawing={<SkyChart passes={NO_PASSES} observer={observer} highlightedPassId={null} now={now} sun={bodies.sun} moon={bodies.moon} scene={scene} fill chartHand={chartHand} page="pass" view={view} onViewChange={onChartView} />}
        upFrom={passList}
      />
    </div>
  );
}

export interface PassTonightProps {
  /** The page's observer (`usePageObserver`); null with no place and no example. */
  observer: Observer | null;
  /** FR-SHARE-3's sentence, where a link's pass is not the one listed. */
  notice: ReactNode;
  selectedPassId: string | null;
  onOpenPass: (passId: string) => void;
}

/**
 * R212 (FR-LAND-6, D-1231, D-1266): the phone's satellites page, `#pass` — tonight's stripe and the pass list, tonight's
 * night open, a card opening its pass's sheet over it. The lines that stood beside them and that no requirement removed
 * follow: the conditions with the Moon's line (FR-FIRST-9, FR-MOON-4), the readiness and the elements (FR-OFF-4), and
 * over them the install offer (FR-OFF-6). With no place and no example it asks for one, as the live page does.
 */
export function PassTonight({ observer, ...list }: PassTonightProps) {
  const t = useT();
  return (
    <div className={tonightStyles.page} data-testid="pass-tonight">
      <VisuallyHidden as="h1">{t.header.pages.pass}</VisuallyHidden>
      <InstallHint />
      {list.notice}
      {observer === null ? (
        <>
          <p className={tonightStyles.line}>{t.live.noPlace}</p>
          <TextButton label={t.live.setPlace} data-testid="pass-set-place" onClick={requestPlace} />
        </>
      ) : (
        <Tonight observer={observer} {...list} />
      )}
    </div>
  );
}

function Tonight({ observer, selectedPassId, onOpenPass }: Omit<PassTonightProps, 'notice' | 'observer'> & { observer: Observer }) {
  // R97: the open pass is kept here as the list keeps it, so the stripe's ticks and the list's count agree.
  const passes = useShownPasses(selectedPassId);
  const tonight = useNight(observer);
  const now = useAppStore((s) => s.now);
  const moon = now.observer === observer ? (now.state?.moon ?? null) : null;
  const example = observer.source === 'example';
  // FR-FLOW-10: each block is a group (`data-rhythm`), the page's grid gap `--space-3` apart.
  return (
    <>
      <div data-rhythm="group">
        <TonightStripe bands={tonight.bands} passes={passes} observer={observer} now={tonight.now} />
      </div>
      <div data-rhythm="group">
        <PassList onOpenPass={onOpenPass} selectedPassId={selectedPassId} plain={example} />
      </div>
      <div data-rhythm="group">
        <ConditionsTable observer={observer} bands={tonight.bands} sampledFrom={tonight.sampledFrom} now={tonight.now} />
      </div>
      {MoonLore && moon && (
        <div data-rhythm="group">
          <Suspense fallback={null}>
            <MoonLore moon={moon} timeZone={observer.timeZone} />
          </Suspense>
        </div>
      )}
      {/* FR-OPEN-4: nothing of the example is saved, so it has no readiness. */}
      {!example && (
        <div data-rhythm="group">
          <ReadinessLine form="line" />
        </div>
      )}
      <div data-rhythm="group">
        <ElementsLine />
      </div>
    </>
  );
}
