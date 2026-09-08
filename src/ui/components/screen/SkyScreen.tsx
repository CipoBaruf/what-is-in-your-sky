import { useCallback, useRef, type KeyboardEvent } from 'react';
import { useT } from '../../../i18n/useT';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { SCREEN_STATUS_ID } from '../guide/skychart/ChartFrame';
import { SkyChart } from '../guide/skychart/SkyChart';
import type { SkyChartProps } from '../guide/skychart/SkyChart.types';
import styles from './SkyScreen.module.css';

/**
 * R64 (D-321, D-325) → R66 (FR-FSC-1, FR-FSC-2, FR-FSC-4, FR-FSC-5, FR-FSC-8,
 * FR-FSC-9; US-21 AC11..AC14; V13-6, V13-9, D-351): the **sky screen**.
 *
 * Choosing "window" from the chart's view control does not lay a third view
 * out in the page: it opens *this*, a layer over the whole visual viewport
 * with four things on it and nothing else — the sky the phone points at
 * filling the screen, the `×`, the facing readout and the legend. The readout
 * and the legend are the chart's own overlays (`screen`, R62's frame); this
 * file owns the layer, the `×` and the keyboard.
 *
 * It was `FollowScreen`, the live page's own, opened by `[ follow phone ]`.
 * R66 removed the control and gave the pass detail the same screen (V13-9), so
 * the layer belongs to neither page: each renders it over its own chrome and
 * hands it the passes, the observer and the instant *it* is showing (FR-FSC-8
 * — the live page's `shown`, not real time).
 *
 * **The layer, not a route.** `position: fixed; inset: 0; height: 100dvh` at
 * `--z-screen`, on the theme's page background, so the page under it — the
 * live page's one-row header, or the pass detail's sheet — is covered rather
 * than unmounted and every one of that page's hooks keeps running (the passes,
 * playback, the wake lock). Nothing goes in the hash and no history entry is
 * pushed (OQ-22): the back button leaves the page as it always did.
 *
 * **Hidden objects are not here** (FR-FSC-5). No `hidden` prop is passed at
 * all, so the screen cannot draw a dimmed mark whatever the toggle's saved
 * state; the page has already stopped asking the worker for them (D-325).
 *
 * **The keyboard.** `role="dialog"` with `aria-modal="true"`, named by the
 * readout's line where there is one (`SCREEN_STATUS_ID`) and by the screen's
 * own name in the portrait state, which has no readout (FR-FSC-4). Focus moves
 * to the `×` on open and `Tab` wraps inside the layer; the page's own `Esc`
 * listener closes the screen before it can leave the page (D-321), and the
 * page gives focus back to the view control on the way out.
 */
export interface SkyScreenProps extends Required<Pick<SkyChartProps, 'passes' | 'observer' | 'now'>>, Partial<Pick<SkyChartProps, 'sun' | 'moon' | 'highlightedPassId' | 'initialFacingAzDeg'>> {
  /** FR-FSC-2: the `×` and `Esc`; the page decides what closing restores. */
  onClose: () => void;
}

/** FR-FSC-4 (D-323): the screen draws only sideways; upright it is the note, and there is no readout to be named by. */
const LANDSCAPE_QUERY = '(orientation: landscape)';

/** What `Tab` may reach inside the layer: the `×` and the legend's rows (FR-LEG-4). */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The bodies are the page's where it has already evaluated them — the live page
 * has, for its status strip — and the chart's own `useSkyBodies` where it has
 * not, which is the pass detail (D-149: one evaluation either way). The
 * highlight is the pass detail's explained pass and nothing on the live page,
 * where every arc is equal.
 */
export function SkyScreen({ passes, observer, now, sun, moon, highlightedPassId = null, initialFacingAzDeg, onClose }: SkyScreenProps) {
  const t = useT();
  const layerRef = useRef<HTMLDivElement>(null);
  const landscape = useMediaQuery(LANDSCAPE_QUERY);

  /*
   * FR-FSC-2 / D-321: the keyboard's first stop on the screen is the way out of it. A callback ref and not a
   * mount effect, because the `×` is attached twice — the window is a lazy chunk (PLAN §11), so the frame that
   * carries the overlay is the Suspense fallback's first and the window's own a moment later, and React
   * replaces the button rather than moving it. Focus is only taken when nothing else holds it: on the mount the
   * control that opened the screen has just been removed and focus has fallen to the body, and after the swap it
   * has fallen there again — but a legend row the reader has tabbed to keeps it.
   */
  const closeRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && (document.activeElement === null || document.activeElement === document.body)) node.focus();
  }, []);

  /*
   * D-321: `Tab` wraps inside the layer. The page under it is `inert` for the
   * keyboard already (`Live.tsx`), so this is what keeps focus off the browser
   * chrome and back on the `×` — the one control that is always here, whatever
   * the drawing is doing.
   */
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const layer = layerRef.current;
    if (!layer) return;
    const stops = [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !layer.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <div
      className={styles.screen}
      ref={layerRef}
      role="dialog"
      aria-modal="true"
      {...(landscape ? { 'aria-labelledby': SCREEN_STATUS_ID } : { 'aria-label': t.chart.screenLabel })}
      data-testid="sky-screen"
      data-orientation={landscape ? 'landscape' : 'portrait'}
      onKeyDown={onKeyDown}
    >
      <SkyChart
        passes={passes}
        observer={observer}
        highlightedPassId={highlightedPassId}
        now={now}
        {...(sun === undefined ? {} : { sun })}
        {...(moon === undefined ? {} : { moon })}
        colorBy="pass"
        screen
        /*
         * The facing the window shows before its first reading. The live page passes 0 — its sky has no one
         * pass to aim at — and the pass detail passes none, so R47's placeholder aims the box at the pass the
         * guide is about and its key is in view from the first frame (D-188).
         */
        {...(initialFacingAzDeg === undefined ? {} : { initialFacingAzDeg })}
        overlay={
          <button type="button" ref={closeRef} className={styles.close} aria-label={t.chart.screenClose} onClick={onClose} data-testid="sky-screen-close">
            ×
          </button>
        }
      />
    </div>
  );
}
