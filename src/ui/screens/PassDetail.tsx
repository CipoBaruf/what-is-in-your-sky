import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useT } from '../../i18n/useT';
import { landmarkLine, landmarkNames } from '../../lib/landmarkLine';
import { guideParams } from '../../lib/phrases';
import { passLinkFor, shareUrl } from '../../lib/shareLinks';
import { formatDate } from '../../lib/timeFormat';
import type { Observer, Pass } from '../../model';
import { Countdown } from '../components/common/Countdown';
import { Header } from '../components/common/Header';
import { ShareButton } from '../components/common/ShareButton';
import { GuidePanel } from '../components/guide/GuidePanel';
import { GuideText } from '../components/guide/GuideText';
import { TimesRow } from '../components/guide/TimesRow';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import { useOpenerFocus } from '../hooks/useOpenerFocus';
import { MoonAtPeak } from '../components/moon/MoonAtPeak';
import { MoonGlareNote } from '../components/moon/MoonGlare';
import { PassNumbers } from '../components/guide/PassNumbers';
import { useAppStore } from '../../state';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { PEAK_FACING_OPTIONS } from '../components/guide/skychart/SkyChart.types';
import { useChartHand } from '../components/guide/skychart/useChartHand';
import { defaultChartView } from './chartViewDefault';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { useSkyScene } from '../components/guide/skychart/useSkyScene';
import { orientationApiPresent } from '../components/live/compassHeading';
import { StarsToggle } from '../components/live/StarsToggle';
import { useStarSource } from '../components/live/useStarSource';
import { FollowToggle } from '../components/sky/FollowToggle';
import { SkyHint, useSkyHintShown } from '../components/sky/SkyHint';
import { SkyViewChartSlot, SkyViewLayout } from '../components/sky/SkyViewLayout';
import styles from './PassDetail.module.css';

/**
 * US-6 (R6): the guide for one pass. A labelled modal dialog: focus moves to
 * its heading on open and back to the opener on close, and the close control
 * returns to the list. Escape returns to the list too, but from the shortcut
 * table rather than from here (R35, D-73): it is one of FR-DESK-4's keys, and
 * the one listener is what decides that Escape closes the shortcuts overlay
 * before it closes the guide. The parent decides what "close" means
 * (D-13: it clears the URL hash). R13: the sky chart (`SkyChart`, the
 * PLAN §8.1 boundary) sits between the countdown and the numbers; its
 * caption is the FR-GUIDE-1 sentence, so the screen shows it once. The
 * observer is passed whole: the chart wants it (PLAN §8.1), the times want
 * its zone. The page's own scroll is locked while the sheet is up: the sheet
 * is fixed and scrolls itself, so the list's scrollbar behind it was a
 * second, dead scrollbar on desktop (R13 review). R17 (D-94) and R20 put the
 * language and theme switches beside the back control; R129 (FR-FLOW-3,
 * V26-10, D-845) took them off again — they are the settings page's alone —
 * and the sheet's top row is the app's one `Header`: `[ ← ]`, `pass`, the date.
 *
 * R23 (FR-DESK-3, D-72): two shells over that one content. Compact keeps the
 * full-screen sheet, portaled to `document.body` so that the page behind it
 * can be made inert while the sheet is not (D-117). Wide renders
 * `GuidePanel` in place — the second track of the right column, beside a list
 * that stays live — so it carries neither the sheet's top row (the header is
 * right there and interactive) nor the scroll lock (nothing is covered). What both shells share is everything that is about the guide
 * rather than its frame: the heading and its focus, and the content.
 *
 * R30 (FR-MOON-2): the glare sentence follows the chart, directly under the
 * FR-GUIDE-1 sentence the chart captions itself with — one warning about this
 * pass, right where the reader has just been told what to expect from it.
 *
 * R51 (FR-LEG-3, US-23 AC3): the numeric table is no longer a block of its own
 * further down the sheet — it is the chart's legend, handed to `SkyChart` as
 * the block that stands in for the explained pass's row, so it lands directly
 * under the drawing with the drawing's key and the arc's colour in its
 * heading, and any other pass drawn dim is listed under it. The screen still
 * shows the FR-GUIDE-1 sentence once, above the drawing, as the figure's
 * caption.
 *
 * R50 (F-43, F-45): the focus in and out is `useOpenerFocus`, which reads the
 * opener during the render rather than in the mount effect — by the effect the
 * page around this is already `inert` and the card that opened it has been
 * blurred. And the sheet takes an `inert` of its own: it is portaled to the
 * body, so the flag `App` puts on the header, the main and the footer does not
 * reach it, and with the shortcuts overlay up its controls were live under it.
 *
 * R31 (US-12, FR-SHARE-1/2): the share action closes the guide, below the
 * numbers — the end of what there is to read about this pass is where handing
 * it on belongs, and it is part of the shared content, so both shells carry
 * it. The link is built here rather than in the button: the observer and the
 * pass are what identify it (D-83), and the page's own URL is what it is
 * relative to.
 */
export interface PassDetailProps {
  pass: Pass;
  observer: Observer;
  onClose: () => void;
  /** R50 (F-6): the wide panel's `[ list ]`; the compact sheet's top row has `[ ← ]` (R129), which closes instead. */
  onShowList: () => void;
  /** R50 (F-45): the compact sheet portals out of everything `App` makes inert, so the overlay has to say so here. */
  inert?: boolean;
}

export const TICK_MS = 1000;

export function PassDetail({ pass, observer, onClose, onShowList, inert = false }: PassDetailProps) {
  const t = useT();
  const locale = useLocale();
  const mode = useLayoutMode();
  const compact = mode === 'compact';
  const timeZone = observer.timeZone;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const now = useNow(TICK_MS);
  /*
   * R123 (FR-SKY-3, FR-SKY-8, FR-STAR-13; D-791): the stars under the arc at this page's own instant, thinned by
   * the twilight. The Sun and the Moon are evaluated here once and handed to the chart (D-149). `[ stars ]` is on
   * the view row, after the view control; on compact `inline`, so it takes the row's second text line and not a row
   * of its own (D-814). While the sheet is `inert` behind another layer none of the drawing is seen, so the
   * drawing's instant holds where it was and neither the bodies nor the stars are evaluated again until the sheet
   * is back; the countdown keeps the clock.
   */
  const [drawnNow, setDrawnNow] = useState(now);
  if (!inert && drawnNow !== now) setDrawnNow(now);
  const bodies = useSkyBodies({ observer, now: drawnNow });
  const starsLayer = useAppStore((s) => s.starsLayer);
  /*
   * R127 (FR-SKY-12, D-826): the source is asked for whatever the toggle says, because the `Among` column is about
   * the fixed sky and not about the drawing: the figures' lines are data the app ships, and the column stands with
   * the stars off. The scene still reads the toggle, so the drawing is unchanged by this.
   */
  const starSource = useStarSource(true);
  // FR-SKY-11 (D-796): the explained pass is the highlighted one, so the scene's landmark is its peak's.
  const scene = useSkyScene({ observer, now: drawnNow, starsLayer, source: starSource, pass });
  const { lat, lon } = observer;
  // FR-SKY-11: the line under the pass's name, worded once (`lib/landmarkLine.ts`) in the active language (D-832).
  const landmarkText = useMemo(() => {
    if (!starSource || scene.landmark?.passId !== pass.id) return null;
    return landmarkLine(
      scene.landmark,
      landmarkNames(starSource.names, starSource.catalog.con, locale),
      t.live,
    );
  }, [starSource, scene.landmark, pass.id, locale, t]);
  /*
   * FR-SKY-12 (D-796): the constellation each point is among, at the point's own instant — the pass is fixed, so
   * this is computed once per pass and source and not per tick. `null` past `AMONG_MAX_DEG`; the column is absent
   * until the source is in hand, since nothing could fill it.
   */
  const among = useMemo(() => {
    if (!starSource) return undefined;
    const at = (point: Pass['peak']): string | null => {
      const found = starSource.constellationAt({ azDeg: point.azDeg, altDeg: point.elDeg }, starSource.positionsAt({ lat, lon }, point.t));
      return found === null ? null : (starSource.names.constellation(found.con, locale) ?? found.con);
    };
    return { start: at(pass.start), peak: at(pass.peak), end: at(pass.end) };
  }, [starSource, pass, lat, lon, locale]);
  /*
   * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-4; D-943, D-944): whether this guide's window follows the phone — page
   * state, off on every open and never saved. The toggle turns it on after the grant, in the `action` slot where
   * `[ hold up to the sky ]` stood (FR-FLOW-8's primary action); the window turns it off when a drag or a box key
   * takes the sky back (`onFollowEnd`). Drawn only where the sensor is (FR-WIN-4's presence test, asked once at
   * mount). R66's sky screen over the sheet is gone (FR-GYRO-6, D-945).
   */
  const [following, setFollowing] = useState(false);
  const endFollow = useCallback(() => {
    setFollowing(false);
  }, []);
  const [sensor] = useState(() => typeof window !== 'undefined' && orientationApiPresent());
  const action = sensor ? <FollowToggle on={following} onChange={setFollowing} className={styles.follow} /> : null;
  // Focus in on open, back to the opener on close. Once, on open: crossing
  // the breakpoint swaps the shell around the same guide and must not take
  // the reader's focus away from wherever they had put it. R50 (F-8): a
  // second pass is a second instance — `App` keys this by the pass — so
  // "on open" is once per guide and not once per selection.
  useOpenerFocus(headingRef);

  // Lock the page scroll behind the sheet; the list keeps its scroll position
  // for the return. Only compact: the wide panel covers nothing.
  useEffect(() => {
    if (!compact) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [compact]);

  /*
   * R132 (FR-FLOW-4, FR-FLOW-7; D-842, D-849): the guide is `SkyViewLayout`'s slots. The head — the name, the
   * countdown line at the headline size, the landmark line, the three times — is `answer` on compact and the
   * panel's band on wide; the view row is the chart's control with `[x] stars` at its end; the readout and the
   * facing picker are the chart's, placed by the layout; the hint is the layout's `SkyHint`; the prose, the glare
   * sentence and the table of points are `list`, the Moon line and the share action `foot`. The chart is `fill`:
   * the box is the layout's to size (a square on the phone, the panel's remaining height on a desk).
   */
  const chartHand = useChartHand();
  const chartView = useAppStore((s) => s.chartView);
  // R136 (FR-FLOW-14, D-876): the saved view, else the window on a phone and the dome on a desk.
  const view = defaultChartView(mode, chartView);
  const hintShown = useSkyHintShown(view);
  const proseId = useId();
  const landmark =
    landmarkText !== null ? (
      <p className={styles.landmark} data-testid="pass-landmark">
        {landmarkText}
      </p>
    ) : null;
  // The date is the compact header's (R129); the band keeps it on wide. The twilight label stays on both.
  const meta =
    !compact || pass.twilight ? (
      <p className={styles.meta} data-testid="pass-meta">
        {!compact && formatDate(pass.start.t, timeZone, locale)}
        {pass.twilight && <span className={styles.twilight}>{t.passes.twilightLabel}</span>}
      </p>
    ) : null;
  const countdown = <Countdown pass={pass} now={now} timeZone={timeZone} steps={false} />;
  const times = <TimesRow pass={pass} timeZone={timeZone} />;
  const viewRow = (
    <>
      <SkyViewChartSlot name="control" />
      <StarsToggle />
    </>
  );
  // R121 (FR-SKY-7, D-790): the window here faces the pass's peak and its facing picker offers `peak` first.
  const chart = (
    <SkyChart
      passes={[pass]}
      observer={observer}
      highlightedPassId={pass.id}
      now={drawnNow}
      sun={bodies.sun}
      moon={bodies.moon}
      scene={scene}
      fill
      chartHand={chartHand}
      facingOptions={PEAK_FACING_OPTIONS}
      follow={following}
      onFollowEnd={endFollow}
      legendLead={(row) => <PassNumbers pass={pass} timeZone={timeZone} legendKey={row.key} colorToken={row.colorToken} among={among} />}
    />
  );
  const list = (
    <>
      <GuideText pass={pass} timeZone={timeZone} id={proseId} />
      {/* R30 (FR-MOON-2): the glare sentence directly under the FR-GUIDE-1 sentence. */}
      <MoonGlareNote moon={pass.moonAtPeak} glare={pass.moonGlare} />
      {/* R51 (FR-LEG-3): the table of points is the chart's legend, placed here. */}
      <SkyViewChartSlot name="list" />
    </>
  );
  const foot = (
    <>
      <MoonAtPeak moon={pass.moonAtPeak} variant="guide" />
      <ShareButton url={shareUrl(window.location.href, passLinkFor(observer, pass))} title={t.share.title({ name: pass.name })} text={t.guide.sentence(guideParams(pass, timeZone, locale))} />
    </>
  );
  const layout = (answer: ReactNode, wide: 'rail' | 'panel') => (
    <SkyViewLayout
      wide={wide}
      describedBy={proseId}
      labelledBy={headingId}
      data-testid="pass-layout"
      className={styles.layout}
      {...(answer === null ? {} : { answer })}
      viewRow={viewRow}
      readout={<SkyViewChartSlot name="readout" />}
      drawing={chart}
      picker={<SkyViewChartSlot name="picker" />}
      hint={hintShown && <SkyHint view={view} />}
      {...(action === null ? {} : { action })}
      list={list}
      foot={foot}
    />
  );

  if (!compact) {
    return (
      <GuidePanel
        passId={pass.id}
        name={pass.name}
        headingId={headingId}
        headingRef={headingRef}
        onClose={onClose}
        onShowList={onShowList}
        head={
          <>
            {countdown}
            {landmark}
            {meta}
          </>
        }
        times={times}
      >
        {layout(null, 'panel')}
      </GuidePanel>
    );
  }

  return createPortal(
    <div inert={inert} role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.sheet} data-pass-id={pass.id}>
      <div className={styles.frame}>
        {/* R129 (FR-FLOW-3, D-845; F10): the sheet's top row is the app's one header, told it is the pass detail —
            `[ ← ]`, `pass` and the pass's date. The language and theme switches that opened the page are the settings
            page's alone (V26-10). A `div`: the page behind the sheet has the `banner`. */}
        <Header page="pass" landmark={false} context={formatDate(pass.start.t, timeZone, locale)} onBack={onClose} />
        {layout(
          <div className={styles.head} data-testid="pass-head">
            {/* FR-FLOW-7: the name is the sheet's `h1` — the sheet is the whole screen, and the page behind it is inert. */}
            <h1 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
              {pass.name}
            </h1>
            {countdown}
            {landmark}
            {times}
            {meta}
          </div>,
          'rail',
        )}
      </div>
    </div>,
    document.body,
  );
}
