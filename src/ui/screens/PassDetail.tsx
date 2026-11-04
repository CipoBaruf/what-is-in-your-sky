import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useT } from '../../i18n/useT';
import { landmarkLine, landmarkNames } from '../../lib/landmarkLine';
import { guideParams } from '../../lib/phrases';
import { passLinkFor, shareUrl } from '../../lib/shareLinks';
import { formatDate } from '../../lib/timeFormat';
import { formatClockDuration, formatDateZone } from '../../lib/format';
import { hintFitsBeside } from '../../lib/layout';
import type { ChartView, EpochMs, Observer, Pass } from '../../model';
import { countdownState } from '../components/common/Countdown';
import { ShareButton } from '../components/common/ShareButton';
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
import { viewFor } from './chartViewDefault';
import { PassGroup } from './sky/pass/Group';
import { PassTime } from './sky/pass/Time';
import { TextButton } from '../components/primitives/TextButton';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { useSkyScene } from '../components/guide/skychart/useSkyScene';
import { StarsToggle } from '../components/live/StarsToggle';
import { useStarSource } from '../components/live/useStarSource';
import { useWakeLock } from '../components/live/useWakeLock';
import { FollowControl } from '../components/live/FollowControl';
import { VisuallyHidden } from '../components/primitives/VisuallyHidden';
import { ControlsSheet } from '../components/sky/ControlsSheet';
import { FollowToggle } from '../components/sky/FollowToggle';
import { SkyHead } from '../components/sky/SkyHead';
import { useFollow, type Follow } from '../components/sky/useFollow';
import { SkyHint, useSkyHintLine, useSkyHintShown } from '../components/sky/SkyHint';
import { PICK_SELECTOR, SkyViewChartSlot, SkyViewLayout } from '../components/sky/SkyViewLayout';
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
 * can be made inert while the sheet is not (D-117). R186 (FR-WIDE-1, D-1098):
 * wide is the desk's one shell in the home's place — `SkyViewLayout`'s box and
 * rail, the head with the name and `[ × ]`, `View`, `Time`, the page group
 * (`sky/pass/Group.tsx`) and the home's pass list with this card highlighted;
 * the header is the app's, so neither the sheet's top row nor the scroll lock.
 * What both shells share is everything that is about the guide rather than its
 * frame: the heading and its focus, and the content.
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
 *
 * R164 (FR-CLEAN-1..3, FR-CLEAN-5..7; D-998, D-1012..D-1014): on compact the sheet's column is gone — the page is the
 * layout's `full` form, as the live page and the stars page are (`PassFull` below): the box is the screen, the head
 * (`[ ← ]`, the countdown, the name as its chip), the corner readout with the landmark line, `[ follow ]` and
 * `[ controls ]` over it, and everything above in `ControlsSheet`. It is still the portaled dialog of R23, its `h1`
 * visually hidden and focused on open. Wide is unchanged.
 */
export interface PassDetailProps {
  pass: Pass;
  observer: Observer;
  onClose: () => void;
  /** R186 (FR-WIDE-1): the home's pass list, the rail's `list` on wide with this pass's card highlighted. */
  passList?: ReactNode;
  /** R50 (F-45): the compact sheet portals out of everything `App` makes inert, so the overlay has to say so here. */
  inert?: boolean;
}

export const TICK_MS = 1000;

export function PassDetail({ pass, observer, onClose, passList = null, inert = false }: PassDetailProps) {
  const t = useT();
  const locale = useLocale();
  const mode = useLayoutMode();
  const compact = mode === 'compact';
  const timeZone = observer.timeZone;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // R164: the compact page's root; its `h1` is a `VisuallyHidden` (no ref), found here before the focus moves to it.
  const pageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Wide's `h1` takes the ref itself; only the compact one is looked up.
    if (compact) headingRef.current = pageRef.current?.querySelector('h1') ?? null;
  }, [compact]);
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
   * state, the page's `useFollow()` (R159, FR-PHONE-1, FR-PHONE-2, D-962): on at mount where nothing has to be asked,
   * armed by a saved grant so the first touch on the sky asks (`onFirstTouch`), off otherwise. The toggle turns it on after the grant, in the `action` slot where
   * `[ hold up to the sky ]` stood (FR-FLOW-8's primary action); the window turns it off when a drag or a box key
   * takes the sky back (`onFollowEnd`). Drawn only where the sensor is (FR-WIN-4's presence test, asked once at
   * mount). R66's sky screen over the sheet is gone (FR-GYRO-6, D-945).
   */
  const follow = useFollow();
  const following = follow.on;
  const sensor = follow.sensor;
  // R157 (FR-PHONE-6, D-967): the screen stays awake while following; released when it ends or the page hides.
  useWakeLock(following);
  // R164 (FR-GYRO-1 as amended): on compact the toggle is the sheet's row; the wide panel keeps it in the action slot.
  const action = sensor && !compact ? <FollowToggle follow={follow} className={styles.follow} /> : null;
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
  // R186 (FR-WIDE-2, D-1095): the saved view as this page offers it, else the window on a phone and the globe on a desk.
  const view = viewFor('pass', mode, chartView);
  const hintShown = useSkyHintShown(view);
  const proseId = useId();
  const landmark =
    landmarkText !== null ? (
      <p className={styles.landmark} data-testid="pass-landmark">
        {landmarkText}
      </p>
    ) : null;
  // The wide band's date line with the twilight label; the compact sheet words its own (R164, `PassFull`).
  const meta = (
    <p className={styles.meta} data-testid="pass-meta">
      {formatDate(pass.start.t, timeZone, locale)}
      {pass.twilight && <span className={styles.twilight}>{t.passes.twilightLabel}</span>}
    </p>
  );
  // The wide band's three cells (the compact sheet draws its own one-row form, R164).
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
      page="pass"
      follow={following}
      onFollowEnd={follow.onFollowEnd}
      legendLead={(row) => <PassNumbers pass={pass} timeZone={timeZone} legendKey={row.key} colorToken={row.colorToken} among={among} />}
    />
  );
  // The FR-GUIDE-1 sentence and the glare line: wide's page group, compact's sheet with the table after them.
  const prose = (
    <>
      <GuideText pass={pass} timeZone={timeZone} id={proseId} />
      <MoonGlareNote moon={pass.moonAtPeak} glare={pass.moonGlare} />
    </>
  );
  const list = (
    <>
      <GuideText pass={pass} timeZone={timeZone} id={proseId} />
      {/* R30 (FR-MOON-2): the glare sentence directly under the FR-GUIDE-1 sentence. */}
      <MoonGlareNote moon={pass.moonAtPeak} glare={pass.moonGlare} />
      {/* R51 (FR-LEG-3): the table of points is the chart's legend, placed here. */}
      {/* R164 (FR-CLEAN-5): on compact the Moon-at-peak sentence is the prose's, before the table; wide keeps it in the foot. */}
      {compact && <MoonAtPeak moon={pass.moonAtPeak} variant="guide" />}
      <SkyViewChartSlot name="list" />
    </>
  );
  const foot = (
    <>
      <MoonAtPeak moon={pass.moonAtPeak} variant="guide" />
      <ShareButton url={shareUrl(window.location.href, passLinkFor(observer, pass))} title={t.share.title({ name: pass.name })} text={t.guide.sentence(guideParams(pass, timeZone, locale))} />
    </>
  );
  if (!compact) {
    // R186 (FR-WIDE-1): the head — the pass's name as the page's `h1` with `[ × ]` back to the home, the landmark line and the date.
    const head = (
      <div className={styles.deskHead} data-testid="pass-head">
        <div className={styles.deskTitle}>
          <h1 id={headingId} ref={headingRef} tabIndex={-1} className={styles.deskName}>
            {pass.name}
          </h1>
          <TextButton label="×" onClick={onClose} aria-label={t.guide.close} data-testid="pass-close" />
        </div>
        {landmark}
        {meta}
      </div>
    );
    return (
      <div className={styles.desk} data-pass-id={pass.id} data-testid="guide-panel" data-guide-panel="" aria-label={t.guide.panelLabel({ name: pass.name })} role="region">
        <SkyViewLayout
          onFirstTouch={follow.firstTouch}
          describedBy={proseId}
          labelledBy={headingId}
          data-testid="pass-layout"
          className={styles.layout}
          answer={head}
          viewRow={viewRow}
          drawing={chart}
          hint={hintShown && <SkyHint view={view} />}
          timeline={<PassTime pass={pass} now={now} timeZone={timeZone} />}
          action={<PassGroup view={view} times={times} prose={prose} foot={foot} follow={action} />}
          {...(passList === null ? {} : { list: passList })}
        />
      </div>
    );
  }

  /*
   * R164 (FR-CLEAN-1..3, FR-CLEAN-5..7; US-49 AC1..AC5; D-998, D-999, D-1012..D-1014): compact is the layout's `full`
   * form in both shapes, as the live page and the stars page are — the box is the screen, and over it only the head
   * (`SkyHead`: `[ ← ]`, the countdown at the heading size and the pass's name as its chip), the facing readout in the
   * top-right corner with the landmark line under it while the finger has the sky, `[ follow ]` and `[ controls ]` at
   * the bottom-right and the hint until the first gesture. `[ controls ]` opens the live page's `ControlsSheet` with
   * FR-CLEAN-5's rows. The page is still a portal to the body (D-117) with the dialog's role and name: the home behind
   * it is inert, and every visit opens with the sheet closed, the window facing the peak or following.
   */
  return createPortal(
    <div inert={inert} role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.page} data-pass-id={pass.id} ref={pageRef}>
      {/* FR-CLEAN-2: the name stays the page's `h1`, visually hidden, for the outline and assistive technology; it takes the focus on open. */}
      <VisuallyHidden as="h1" id={headingId} tabIndex={-1}>
        {pass.name}
      </VisuallyHidden>
      <PassFull
        pass={pass}
        observer={observer}
        now={now}
        follow={follow}
        view={view}
        proseId={proseId}
        headingId={headingId}
        landmarkText={landmarkText}
        chart={chart}
        list={list}
        onClose={onClose}
        rootRef={pageRef}
      />
    </div>,
    document.body,
  );
}

interface PassFullProps {
  pass: Pass;
  observer: Observer;
  now: EpochMs;
  follow: Follow;
  view: ChartView;
  proseId: string;
  headingId: string;
  landmarkText: string | null;
  chart: ReactNode;
  /** The prose, the glare sentence and the table's slot: the sheet's last group. */
  list: ReactNode;
  onClose: () => void;
  /** The page's root, for the `Esc` listener's inert check. */
  rootRef: RefObject<HTMLDivElement | null>;
}

/**
 * R164 (FR-CLEAN-2, FR-CLEAN-3, FR-CLEAN-5, FR-CLEAN-6): the compact pass detail in the full form. Its own component so
 * the sheet's state — open, the picker — is this form's and the wide panel never carries it.
 */
function PassFull({ pass, observer, now, follow, view, proseId, headingId, landmarkText, chart, list, onClose, rootRef }: PassFullProps) {
  const t = useT();
  const locale = useLocale();
  const timeZone = observer.timeZone;
  const following = follow.on;
  const sensor = follow.sensor;

  /*
   * D-921's rule: the sheet's open state is the page's, so every visit opens with it closed and a turn of the phone,
   * which keeps this page mounted, keeps it. Closing by `Esc` gives the focus back to `[ controls ]`.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  // The facing row's picker (below) is the sheet's: however the sheet closes, it reopens with the picker folded.
  const [pickerOpen, setPickerOpen] = useState(false);
  const changeSheet = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) setPickerOpen(false);
  }, []);
  const closeSheet = useCallback(() => {
    changeSheet(false);
    rootRef.current?.querySelector<HTMLElement>('[data-testid="live-controls"]')?.focus();
  }, [changeSheet, rootRef]);
  /*
   * FR-CLEAN-6 (D-999, D-1011's device): `Esc` in two steps. With the sheet open a capture listener on the window closes
   * it and stops the event before the app's one `keydown` listener on the document (D-73); with it closed the key goes
   * through and that listener closes the guide (`close`, §4.37). Read through a ref so the open state does not rebuild it.
   */
  const sheetOpenRef = useRef(sheetOpen);
  useLayoutEffect(() => {
    sheetOpenRef.current = sheetOpen;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !sheetOpenRef.current) return;
      // The shortcuts overlay over the page makes it inert (D-73's "overlay first"): the key is the overlay's.
      if (rootRef.current?.closest('[inert]')) return;
      event.preventDefault();
      event.stopPropagation();
      closeSheet();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closeSheet, rootRef]);

  /*
   * FR-CLEAN-2 (D-965, D-1013): while the finger has the sky and the sheet is closed, the chart's readout stands in the
   * box's top-right corner with the landmark line under it; with the sheet open it is the facing row's. The polar
   * chart's readout is its convention, not a facing, and stays in the sheet.
   */
  const cornerReadout = !following && !sheetOpen && view !== 'polar';
  const landmark = (testId: string) =>
    landmarkText !== null ? (
      <p className={styles.landmark} data-testid={testId}>
        {landmarkText}
      </p>
    ) : null;

  /*
   * The sheet's facing row (D-923's row): the chart's readout as a button that opens the chart's picker under it — the
   * eight points with `peak` (FR-SKY-7) on the window, the looking-up / map toggle on the polar chart; the dome has no
   * picker. A pick closes the row from a `click` listener on the document, above React's root (D-1011), and the sheet
   * stays open (FR-CLEAN-6).
   */
  const facingLabelId = useId();
  const facingPickerId = useId();
  const facingPickerRef = useRef<HTMLDivElement>(null);
  const hasPicker = view !== 'dome';
  useEffect(() => {
    if (!pickerOpen) return;
    const onPick = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && facingPickerRef.current?.contains(target) && target.closest(PICK_SELECTOR)) setPickerOpen(false);
    };
    document.addEventListener('click', onPick);
    return () => {
      document.removeEventListener('click', onPick);
    };
  }, [pickerOpen]);
  const facing = (
    <div className={styles.facing} data-testid="pass-facing" data-rhythm="group">
      <div className={styles.facingReadout}>
        <div className={styles.facingWords} id={facingLabelId} {...(hasPicker ? { 'aria-hidden': true } : {})}>
          {!cornerReadout && <SkyViewChartSlot name="readout" />}
        </div>
        {hasPicker && (
          <button
            type="button"
            className={styles.facingHit}
            data-testid="sky-readout-toggle"
            aria-labelledby={facingLabelId}
            aria-expanded={pickerOpen}
            {...(pickerOpen ? { 'aria-controls': facingPickerId } : {})}
            onClick={() => {
              setPickerOpen(!pickerOpen);
            }}
          />
        )}
      </div>
      {hasPicker && pickerOpen && (
        <div className={styles.facingPicker} id={facingPickerId} ref={facingPickerRef} data-testid="pass-facing-picker">
          <SkyViewChartSlot name="picker" />
        </div>
      )}
    </div>
  );

  const hintLine = useSkyHintLine(view);
  const hintBeside = hintLine !== null && hintFitsBeside(hintLine.text, sensor ? [t.sheet.follow, t.sheet.controls] : [t.sheet.controls]);
  const state = countdownState(pass, now);

  const overlay = (
    <>
      <SkyHead
        line={
          <p className={styles.headLine} data-testid="pass-head-line">
            <span className={styles.headCount} role="timer" aria-live="off" data-phase={state.phase}>
              {t.countdown.head({ phase: state.phase, clock: formatClockDuration(state.seconds) })}
            </span>{' '}
            <span className={styles.headChip} data-testid="pass-head-chip" aria-hidden="true">
              {pass.name}
            </span>
          </p>
        }
        onBack={onClose}
        className={styles.head}
      />
      {/* R159 (D-987): while the refusal's line stands it takes the hint's row, so the hint steps aside until the next press. */}
      {hintLine !== null && !follow.refused && (
        <div className={styles.hintArea} data-beside={hintBeside ? 'true' : 'false'}>
          <SkyHint view={view} fit />
        </div>
      )}
    </>
  );
  const sheet = (
    <ControlsSheet open={sheetOpen} onOpenChange={changeSheet} place={observer.label} beside={sensor ? <FollowControl follow={follow} showRefusal={!sheetOpen} /> : null} className={styles.controls}>
      {/* FR-CLEAN-5: the name with the date and the zone, the landmark line under it (and the twilight label, as the column had it). */}
      <div className={styles.nameBlock} data-testid="pass-head" data-rhythm="group">
        <p className={styles.nameLine} data-testid="pass-name-line">
          {`${pass.name} · ${formatDateZone(pass.start.t, timeZone, locale)}`}
        </p>
        {landmark('pass-landmark')}
        {pass.twilight && (
          <p className={styles.meta} data-testid="pass-meta">
            <span className={styles.twilight}>{t.passes.twilightLabel}</span>
          </p>
        )}
      </div>
      <div data-testid="pass-times-row" data-rhythm="group">
        <TimesRow pass={pass} timeZone={timeZone} compact />
      </div>
      <div className={styles.viewRow} data-testid="pass-view-row" data-rhythm="group">
        <SkyViewChartSlot name="control" />
        <StarsToggle />
      </div>
      {sensor && (
        <div className={styles.follow} data-testid="pass-follow" data-rhythm="group">
          <FollowToggle follow={follow} />
        </div>
      )}
      {/* R152 (FR-GYRO-5, D-957): not drawn while following — nothing describes the sensor's view and a pick would fight it. */}
      {!following && facing}
      <div className={styles.share} data-testid="pass-share" data-rhythm="group">
        <ShareButton url={shareUrl(window.location.href, passLinkFor(observer, pass))} title={t.share.title({ name: pass.name })} text={t.guide.sentence(guideParams(pass, timeZone, locale))} />
      </div>
      <div className={styles.prose} data-testid="pass-prose" data-rhythm="group">
        {list}
      </div>
    </ControlsSheet>
  );
  return (
    <SkyViewLayout
      readoutIn="sheet"
      readoutLines={2}
      onFirstTouch={follow.firstTouch}
      describedBy={proseId}
      labelledBy={headingId}
      className={styles.layout}
      data-testid="pass-layout"
      drawing={chart}
      overlay={overlay}
      {...(cornerReadout
        ? {
            readout: (
              <>
                <SkyViewChartSlot name="readout" />
                {landmark('pass-corner-landmark')}
              </>
            ),
          }
        : {})}
      sheet={sheet}
    />
  );
}
