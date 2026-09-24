import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../../../i18n/useT';
import { arcState } from '../../../lib/arcReveal';
import { whereDomeSize } from '../../../lib/layout';
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
 *
 * R93 (FR-HOME-3, D-546, D-607; F-79): the dome takes the height its pane has
 * left rather than the pane's width — at 1280 × 800 a pane-wide square put the
 * saved-places line 40 px under the pane's fold and made Where scroll, which
 * only What may. The pane is the nearest box that scrolls itself (the reading
 * at three-pane widths, the left column with When under it on the two
 * columns), and the room is what `whereDomeSize` makes of its measured heights;
 * under `LIVE_BOX_MIN_PX` the dome is not drawn, and the lines stand where it
 * would have been. Measured on a `ResizeObserver` of the pane, its rows and
 * the reading's other blocks, as `ChartFrame` measures its box.
 */
const SkyDome = lazy(() => import('../guide/skychart/dome/SkyDome').then((module) => ({ default: module.SkyDome })));

/** The live page's window (FR-LIVE-11): what starts within a day and has not ended. */
const WINDOW_MS = 24 * 3_600_000;
/** The dome is the sky now: re-read every ten seconds, the live page's own tick. */
export const WHERE_DOME_TICK_MS = 10_000;

export function domePasses(passes: readonly Pass[], now: EpochMs): ChartPass[] {
  return passes.filter((pass) => pass.start.t <= now + WINDOW_MS && pass.end.t >= now).map((pass) => ({ ...pass, arc: arcState(pass, now) }));
}

/** The nearest ancestor that scrolls itself — the pane (D-119) — or the `main` when none does. */
function scrollPane(element: HTMLElement): HTMLElement {
  let pane: HTMLElement | null = element.parentElement;
  while (pane && pane.tagName !== 'MAIN') {
    const overflow = getComputedStyle(pane).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return pane;
    pane = pane.parentElement;
  }
  return pane ?? element;
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
  const slot = useRef<HTMLDivElement>(null);
  const [sizePx, setSizePx] = useState<number | null>(null);
  const wide = mode === 'wide' && painted;
  // The pane, its rows and the reading's other blocks: any of them changing size is a remeasure. The observer
  // reports once on `observe`, so nothing is measured here; and it is re-attached on every render, since the
  // reading's blocks come and go with the store (the readiness line, the saved places).
  useEffect(() => {
    const element = slot.current;
    if (!wide || !element || typeof ResizeObserver === 'undefined') return;
    const reading = element.parentElement;
    if (!reading) return;
    const pane = scrollPane(element);
    const observer = new ResizeObserver(() => {
      const gapPx = parseFloat(getComputedStyle(reading).rowGap) || 0;
      // The content's extent, first block to last: `scrollHeight` is floored at the pane's own height and says nothing of the room.
      const first = pane.firstElementChild?.getBoundingClientRect().top ?? 0;
      const last = pane.lastElementChild?.getBoundingClientRect().bottom ?? first;
      setSizePx(whereDomeSize({ paneClientHeightPx: pane.clientHeight, contentHeightPx: last - first, slotHeightPx: element.offsetHeight, gapPx, widthPx: reading.clientWidth }));
    });
    const watched = new Set<Element>([pane, ...pane.children, ...reading.children]);
    watched.delete(element);
    for (const target of watched) observer.observe(target);
    return () => {
      observer.disconnect();
    };
  });
  if (!wide) return null;
  return (
    <div ref={slot} className={styles.slot} data-testid="where-dome-slot">
      {sizePx !== null && <Dome {...props} sizePx={sizePx} />}
    </div>
  );
}

function Dome({ observer, passes, sizePx }: WhereDomeProps & { sizePx: number }) {
  const t = useT();
  const now = useNow(WHERE_DOME_TICK_MS);
  const drawn = useMemo(() => domePasses(passes, now), [passes, now]);
  const bodies = useSkyBodies({ observer, now });
  // The side in px, inline: a wide stylesheet block may not carry px (`tests/styles/breakpoint.test.ts`).
  const side = { '--dome-px': `${String(sizePx)}px` } as CSSProperties;
  return (
    <a href="#live" className={styles.link} style={side} aria-label={t.nextEvent.openLive} data-testid="where-dome" data-size-px={sizePx}>
      <div className={styles.box} inert>
        <Suspense fallback={null}>
          <SkyDome passes={drawn} observer={observer} highlightedPassId={null} now={now} sun={bodies.sun} moon={bodies.moon} colorBy="pass" fill initialFacingAzDeg={0} />
        </Suspense>
      </div>
    </a>
  );
}
