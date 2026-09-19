import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n/useT';
import { arcState } from '../../../lib/arcReveal';
import type { EpochMs, Observer, Pass } from '../../../model';
import type { ChartPass } from '../guide/skychart/SkyChart.types';
import { useSkyBodies } from '../guide/skychart/useSkyBodies';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useNow } from '../../hooks/useNow';
import styles from './WhereDome.module.css';

/**
 * R81 (FR-FIRST-11, D-512, OQ-32): the Where pane's dome — the sky at the
 * current instant, as the live page opens on it: FR-DOME-1's drawing with the
 * stored run's passes of the next day, each arc in the state it is in now,
 * the Sun and the Moon where they are, facing north so `W`, `N` and `E` stand
 * at its rim. No controls and no legend: the whole drawing is one link to
 * `#live`, where the sky can be turned and played.
 *
 * Wide only (`useLayoutMode`), so a phone never fetches the chart chunk for it,
 * and loaded after the page as the live page's is (D-148): the dome's chunk is
 * the one `SkyChart` loads, imported here only once the page has painted, so
 * the main chunk does not grow. The drawing is `inert` inside the link — the
 * dome's own keyboard and drag would be a control inside a control — and the
 * link's name says where it goes.
 */
const SkyDome = lazy(() => import('../guide/skychart/dome/SkyDome').then((module) => ({ default: module.SkyDome })));

/** The live page's window (FR-LIVE-11): what starts within a day and has not ended. */
const WINDOW_MS = 24 * 3_600_000;
/** The dome is the sky now: re-read every ten seconds, the live page's own tick. */
export const WHERE_DOME_TICK_MS = 10_000;

export function domePasses(passes: readonly Pass[], now: EpochMs): ChartPass[] {
  return passes.filter((pass) => pass.start.t <= now + WINDOW_MS && pass.end.t >= now).map((pass) => ({ ...pass, arc: arcState(pass, now) }));
}

export interface WhereDomeProps {
  observer: Observer;
  passes: readonly Pass[];
}

export function WhereDome(props: WhereDomeProps) {
  const mode = useLayoutMode();
  // After the first paint, so the chunk never competes with the page for it.
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setPainted(true);
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, []);
  if (mode !== 'wide' || !painted) return null;
  return <Dome {...props} />;
}

function Dome({ observer, passes }: WhereDomeProps) {
  const t = useT();
  const now = useNow(WHERE_DOME_TICK_MS);
  const drawn = useMemo(() => domePasses(passes, now), [passes, now]);
  const bodies = useSkyBodies({ observer, now });
  return (
    <a href="#live" className={styles.link} aria-label={t.nextEvent.openLive} data-testid="where-dome">
      <div className={styles.box} inert>
        <Suspense fallback={null}>
          <SkyDome passes={drawn} observer={observer} highlightedPassId={null} now={now} sun={bodies.sun} moon={bodies.moon} colorBy="pass" fill initialFacingAzDeg={0} />
        </Suspense>
      </div>
    </a>
  );
}
