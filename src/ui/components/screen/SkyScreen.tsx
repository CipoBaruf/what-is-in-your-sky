import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useT } from '../../../i18n/useT';
import { SCREEN_STATUS_ID } from '../guide/skychart/ChartFrame';
import { SkyChart } from '../guide/skychart/SkyChart';
import type { SkyChartProps } from '../guide/skychart/SkyChart.types';
import { nearestQuarter, type Quarter } from '../guide/skychart/window/screenTurn';
import { screenAngle } from '../live/compassHeading';
import styles from './SkyScreen.module.css';
import { ScreenTurnProvider } from './screenTurn';

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
 * readout's line (`SCREEN_STATUS_ID`) — R73 deleted the portrait state that
 * had no readout to be named by, so the branch went with it. Focus moves to
 * the `×` on open and `Tab` wraps inside the layer; the page's own `Esc`
 * listener closes the screen before it can leave the page (D-321), and the
 * page gives focus back to the view control on the way out.
 *
 * **The turn** (R73, FR-FSC-10, D-426, D-429). The screen is upright to the
 * reader, not to the viewport. The window reports the quarter it read from the
 * pose through `screenTurn`'s context, and the layer turns itself by
 * `quarter − screen.orientation.angle`: nothing at all on a phone whose
 * rotation is not locked, where those two numbers are the same, and a quarter
 * turn on one that is. A quarter turn takes the viewport's two sides swapped
 * (`100dvh` by `100dvw`) so the layer still covers the screen exactly, which
 * is also how the picture comes out landscape inside a portrait viewport: the
 * window measures the layer's *layout* box — `ResizeObserver` reports the
 * border box, before transforms — so `WINDOW_FOV` lands across the reader's
 * wide side by construction and not by a media query. FR-FSC-9 is untouched: a
 * fixed layer the size of the viewport still cannot scroll.
 */
export interface SkyScreenProps extends Required<Pick<SkyChartProps, 'passes' | 'observer' | 'now'>>, Partial<Pick<SkyChartProps, 'sun' | 'moon' | 'highlightedPassId' | 'initialFacingAzDeg'>> {
  /** FR-FSC-2: the `×` and `Esc`; the page decides what closing restores. */
  onClose: () => void;
}

/**
 * FR-FSC-10 (D-426): what the layer turns by — the shorter way round from the
 * viewport's own rotation to the reader's, so the four answers are `0`, `±90`
 * and `180` and a phone that reflowed turns by nothing.
 */
export function turnFor(quarter: number, screenAngleDeg: number): number {
  const difference = (((quarter - screenAngleDeg) % 360) + 360) % 360;
  return difference > 180 ? difference - 360 : difference;
}

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

  /*
   * FR-FSC-10 (D-429): the quarter the window read from the pose, and the browser's own angle to take it
   * against. The angle is not the sensor — it is the viewport's own rotation, two cheap listeners and no
   * permission — so this is not the duplicated `deviceorientation` work R68 removed: the layer adds no sensor
   * listener at all and reads the pose only through what the window reports.
   */
  const [quarter, setQuarter] = useState<Quarter>(0);
  const [angle, setAngle] = useState(() => (typeof window === 'undefined' ? 0 : nearestQuarter(screenAngle())));
  useEffect(() => {
    const update = (): void => {
      setAngle(nearestQuarter(screenAngle()));
    };
    const orientation = window.screen.orientation as ScreenOrientation | undefined;
    orientation?.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      orientation?.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  const turnDeg = useMemo(() => turnFor(quarter, angle), [quarter, angle]);
  const screenTurn = useMemo(() => ({ quarter, report: setQuarter }), [quarter]);

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
      aria-labelledby={SCREEN_STATUS_ID}
      data-testid="sky-screen"
      data-turn={turnDeg}
      style={{ '--screen-turn': `${String(turnDeg)}deg` } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <ScreenTurnProvider value={screenTurn}>
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
      </ScreenTurnProvider>
    </div>
  );
}
