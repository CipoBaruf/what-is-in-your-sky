import { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../../i18n/useT';
import { bodyLines, legendKeys, legendRows, promoteRow } from '../../../../lib/legend';
import { compactChartView, type ChartView } from '../../../../model';
import { useAppStore } from '../../../../state';
import { DEFAULT_CHART_VIEW } from '../../../../state/slices/prefs';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { ToggleGroup } from '../../primitives/ToggleGroup';
import { useSkyScreen } from '../../screen/useSkyScreen';
import { GuideText } from '../GuideText';
import { moonVisible, sunVisible } from './bodies';
import { ChartFrame, ChartFrameSlots } from './ChartFrame';
import { Legend } from './Legend';
import { POLAR_VIEW } from './polar/SkyPolar';
import styles from './SkyChart.module.css';
import type { SkyChartProps, SkyChartView } from './SkyChart.types';
import { useChartHand } from './useChartHand';
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
 *
 * R47 (FR-WIN-1, FR-WIN-4, FR-WIN-5, FR-GUIDE-2b as amended; D-188, D-240):
 * the sky window is the third registered view, code-split like the dome and
 * offered only where its `available()` — D-175's presence test, a touch
 * screen with the constructor — says so; a desktop never sees the option.
 *
 * R66 (FR-FSC-6, FR-WIN-4/FR-WIN-5 as amended v1.3.1; V13-6, V13-8, D-350,
 * D-352): the window's option is not a view this chart switches to. Choosing
 * it hands the tap to `useSkyScreen`, which asks for the permission inside the
 * gesture and opens the sky screen on the first reading that carries a heading
 * — the page renders that layer, and this chart, still showing the dome or the
 * polar chart, is what is underneath it. So nothing writes `'window'` to the
 * preference any more (it is not even in `SavedChartView`), there is no
 * `[ point at the sky ]` to gate a saved one, and the two answers a phone can
 * give — a refused permission, no compass heading — are the store's
 * `windowNote` and `windowLost`, because the window that gives them is the one
 * on the screen and this control is on the page beneath it.
 *
 * R121 (FR-SKY-2, FR-SKY-7, FR-WIN-4, FR-WIN-5, FR-FSC-6 as amended v2.5;
 * US-41 AC1, AC2; D-789, D-790): the window is offered everywhere, to every
 * reader — `WINDOW_VIEW` has no `available()` any more, and the presence test
 * answers one question only, whether the screen can follow the phone
 * (`useSkyScreen`). What the option does depends on where it is tapped. **On
 * wide** it is a view like the other two: chosen, it is saved (`chartView:
 * 'window'`) and the window is laid out in the frame's box under the hand
 * camera. **On compact with a sensor** it is still the mode it was: the tap
 * asks and opens the screen, nothing is written. **On compact without one** —
 * a phone-sized desk window, every headless capture at 390 px, or a phone
 * that has lost the sensor this session — there is no screen to open and
 * nothing to ask, so the window is laid out in the box here too; that choice
 * is page state (`handWindow`) and never written, so a reload opens on the
 * saved view. The hand camera is one slot (`HandSlot`), filled by the window
 * in its own chunk and kept across a view change and back, so the facing
 * survives a look at the dome. Both are `useChartHand`'s: the live page holds
 * them (`chartHand`) because it remounts its chart on a rotation and drops it
 * for the sky screen; elsewhere the chart holds its own.
 */
const SkyDome = lazy(() => import('./dome/SkyDome').then((module) => ({ default: module.SkyDome })));
const SkyWindow = lazy(() => import('./window/SkyWindow').then((module) => ({ default: module.SkyWindow })));

function DomeView(props: SkyChartProps) {
  const t = useT();
  return (
    <Suspense
      fallback={
        <ChartFrame
          controls={props.controls}
          status={<p className={styles.loading}>{t.chart.loadingDome}</p>}
          legend={props.legend}
          aside={props.aside}
          stripe={props.stripe}
          {...(props.boxAspect === undefined ? {} : { boxAspect: props.boxAspect })}
          {...(props.stacked === undefined ? {} : { stacked: props.stacked })}
          {...(props.legendOpen === undefined ? {} : { legendOpen: props.legendOpen })}
          fill={props.fill ?? false}
        >
          <div className={styles.loadingBox} data-testid="dome-loading" />
        </ChartFrame>
      }
    >
      <SkyDome {...props} />
    </Suspense>
  );
}

const DOME_VIEW: SkyChartView = { Component: DomeView, id: 'dome' };

/**
 * D-789: whether the window will be laid out in the page's box under the hand — `SkyWindow`'s own `inBox`, read
 * before its chunk arrives, so the fallback's box is already the window's shape and does not jump when it lands.
 */
function inBox(props: SkyChartProps): boolean {
  return props.hand !== undefined && props.screen !== true && (props.camera === undefined || props.camera.source === 'hand');
}

function WindowView(props: SkyChartProps) {
  return (
    <Suspense
      fallback={
        // R64 (FR-FSC-1, D-321): the screen's chunk loads with the screen's frame, so the follow screen's `×` — the
        // page's `overlay`, and the one way out of the layer — is in the document from the first frame and not only
        // once the window has arrived. Off a screen this is R47's fallback unchanged.
        <ChartFrame
          controls={props.controls}
          legend={props.legend}
          aside={props.aside}
          stripe={props.stripe}
          {...(props.boxAspect === undefined ? {} : { boxAspect: props.boxAspect })}
          {...(props.stacked === undefined ? {} : { stacked: props.stacked })}
          {...(props.legendOpen === undefined ? {} : { legendOpen: props.legendOpen })}
          {...(props.screen === undefined ? {} : { screen: props.screen })}
          {...(props.overlay === undefined ? {} : { overlay: props.overlay })}
          handWindow={inBox(props)}
          fill={props.fill ?? false}
        >
          <div className={styles.loadingBox} data-testid="window-loading" />
        </ChartFrame>
      }
    >
      <SkyWindow {...props} />
    </Suspense>
  );
}

// R121 (FR-WIN-4 as amended v2.5, D-789): offered on every page and every device; `SkyChartView`'s `available()` is gone with it.
const WINDOW_VIEW: SkyChartView = { Component: WindowView, id: 'window' };

export const SKY_CHART_VIEWS: readonly SkyChartView[] = [POLAR_VIEW, DOME_VIEW, WINDOW_VIEW];

/**
 * The view for a preference: itself, else the dome (the default), else the first one registered. R121 (FR-WIN-4 as
 * amended v2.5): every page offers all three views to every reader — no `available()` filters them any more, and a
 * phone with no north loses the sensor, not the view, which it gets in the box under the hand.
 */
function viewFor(id: SkyChartView['id']): SkyChartView {
  const view = SKY_CHART_VIEWS.find((candidate) => candidate.id === id) ?? SKY_CHART_VIEWS.find((candidate) => candidate.id === DEFAULT_CHART_VIEW) ?? SKY_CHART_VIEWS[0];
  if (!view) throw new Error('SkyChart: no views registered');
  return view;
}

/**
 * R32 (FR-LIVE-1, FR-LIVE-10): with `fill` the chart is the live page's whole
 * drawing. There is no single pass to caption — the page's status strip is
 * the text alternative (FR-GUIDE-7) — so the figure carries a name instead of
 * a caption, and it fills the box it is given rather than the guide's square.
 *
 * R62 (FR-FSC-1, FR-FSC-3; D-322): `screen` is the sky screen — the window,
 * filling the host, with no caption, no toggle, no controls row and no rails,
 * its readout and its legend overlaid on the drawing by the frame. It is the
 * only way the window is ever mounted since R66 (D-351): the pages render
 * `SkyScreen`, `SkyScreen` renders this chart with `screen`, and the chart a
 * page lays out is always the dome or the polar chart.
 */
export function SkyChart(props: SkyChartProps) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  const chartView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const dropWindowView = useAppStore((s) => s.dropWindowView);
  const setWindowNote = useAppStore((s) => s.setWindowNote);
  // FR-FOL-2: the one line the last answer left.
  const note = useAppStore((s) => s.windowNote);
  // D-350: the tap that chooses the window on a compact phone — the permission inside the gesture, then the reading that decides.
  const entry = useSkyScreen();
  /*
   * D-789 (R121): the window in the box. On wide it is the saved view; on compact without a sensor it is an
   * unsaved choice, which a reload forgets (FR-SKY-2). That choice and the hand camera's slot are the page's where
   * it gives them (`chartHand`, the live page), else this chart's own: the dome and back keeps the facing, and on
   * the live page so do a rotation and a trip to the screen. The window fills the slot in its own chunk.
   */
  const ownHand = useChartHand();
  const { slot: hand, window: handWindow, setWindow: setHandWindow } = props.chartHand ?? ownHand;
  /*
   * FR-FSC-2 (D-351): the screen's `×` gives focus back to the option that opened it. The page's chart is
   * unmounted while the layer is up and is a new element when it returns, so what says "the screen just
   * closed" is the store's one-shot flag and not a ref of this component's. The option is queried inside the
   * figure — wherever the frame has put the control, its own row or the frame's slot — because it is one of
   * three the toggle builds from a list (`data-option`); where the phone has just lost the window (FR-WIN-4)
   * the first option takes it instead, so focus never falls to the body.
   */
  const refocus = useAppStore((s) => s.refocusWindow);
  const windowRefocused = useAppStore((s) => s.windowRefocused);
  const figureRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (props.screen === true || !refocus) return;
    const group = figureRef.current;
    (group?.querySelector<HTMLElement>('[data-option="window"]') ?? group?.querySelector<HTMLElement>('[data-option]'))?.focus();
    windowRefocused();
  }, [refocus, props.screen, windowRefocused]);
  // FR-FSC-1 / D-322 (R62): asked for a screen the chart is the window and nothing else — `viewFor` is not consulted,
  // so the saved preference is neither read for the view nor written on the way (FR-WIN-5 as amended).
  const screen = props.screen ?? false;
  const moonPhase = props.moonPhase ?? false;
  // D-789: on compact the saved view is never the window (the store's guard reads a stored one as the dome at load;
  // a window saved on wide and then narrowed draws as the dome too) — the window there is this chart's own choice.
  const pageView: ChartView = compact ? (handWindow ? 'window' : compactChartView(chartView)) : chartView;
  const view = screen ? WINDOW_VIEW : viewFor(pageView);
  const choose = useCallback(
    (id: ChartView) => {
      if (id === 'window') {
        // FR-WIN-5 as amended v2.5: on wide the window is a view like the other two, and the preference may hold it.
        if (!compact) {
          setChartView('window');
          return;
        }
        // D-350: with a sensor the window is a mode — its option opens the screen and writes nothing; the tap is where iOS is asked.
        if (entry.available) {
          entry.open();
          return;
        }
        // FR-SKY-2: a compact reader without a sensor has no screen to open and nothing to ask: the box, unsaved.
        setWindowNote(null);
        setHandWindow(true);
        return;
      }
      setHandWindow(false);
      viewFor(id).choose?.();
      setChartView(id);
    },
    [compact, setChartView, setWindowNote, entry, setHandWindow],
  );
  // R58 review (D-277) → R66 (D-352): a window that cannot run here closes the screen and leaves the note beside
  // this control; nothing is written, because the reader chose neither the failure nor a view to fall back to.
  const unavailable = useCallback(
    (reason: 'denied' | 'relative') => {
      dropWindowView(reason);
    },
    [dropWindowView],
  );
  // D-322: a screen fills what it is given by construction — the page hands the chart the whole viewport.
  const { passes, observer, className, now, hidden, colorBy, onSelectPass } = props;
  const fill = screen || (props.fill ?? false);
  // FR-DOME-6: one evaluation for whichever view is mounted, so the toggle
  // never changes where the Sun and the Moon are (R22).
  const bodies = useSkyBodies(props);

  // FR-LEG-4: the row (or arc) the reader activated, remembered against the caller's own highlight so a new pass drops it.
  // R54 (D-271, F-53): two memories, not one. `pinned` is the highlight and follows a click, a tap or keyboard focus;
  // `promoted` is the row at the top of the legend and follows a click or a tap only, so the list holds still while Tab
  // walks it — focus moves the highlight along the rows and leaves the order alone.
  interface Pin {
    id: string;
    over: string | null;
  }
  const [pinned, setPinned] = useState<Pin | null>(null);
  const [promoted, setPromoted] = useState<Pin | null>(null);
  const valid = (pin: Pin | null): string | null => (pin !== null && pin.over === props.highlightedPassId && (passes.some((pass) => pass.id === pin.id) || hidden?.some((marker) => marker.id === pin.id)) ? pin.id : null);
  const pinnedId = valid(pinned);
  const promotedId = valid(promoted);
  const highlightedPassId = pinnedId ?? props.highlightedPassId;
  const select = useCallback(
    (passId: string) => {
      setPinned({ id: passId, over: props.highlightedPassId });
      setPromoted({ id: passId, over: props.highlightedPassId });
      onSelectPass?.(passId);
    },
    [props.highlightedPassId, onSelectPass],
  );
  const focusRow = useCallback(
    (passId: string) => {
      setPinned({ id: passId, over: props.highlightedPassId });
    },
    [props.highlightedPassId],
  );

  // FR-LEG-1, FR-LEG-2: the rows and the keys from the caller's props; the pinned row moves first but keeps its key.
  const baseRows = useMemo(() => legendRows({ passes, highlightedPassId: props.highlightedPassId, now, hidden, colorBy }), [passes, props.highlightedPassId, now, hidden, colorBy]);
  // The row reads as its arc does (FR-LEG-4): the highlight follows `highlightedPassId`, whichever row is at the top.
  const rows = useMemo(
    () => promoteRow(baseRows, promotedId).map((row) => (row.state === 'hidden-object' ? row : { ...row, highlighted: highlightedPassId === null || row.passId === highlightedPassId })),
    [baseRows, promotedId, highlightedPassId],
  );
  const keys = useMemo(() => legendKeys(baseRows), [baseRows]);
  const lines = bodyLines({ sun: bodies.sun, moon: bodies.moon }, { sun: bodies.sun ? sunVisible(bodies.sun) : false, moon: bodies.moon ? moonVisible(bodies.moon) : false });

  const captioned = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  // FR-LEG-3 (R51): on the pass detail the numeric table is the legend's first block, in place of the explained
  // pass's row. It is the *caller's* highlighted pass, not the pinned one: pinning a dim row moves that row to the
  // top of the list, but the table is what the guide is about and stays at its head.
  const leadRow = props.legendLead === undefined ? undefined : rows.find((row) => row.passId === props.highlightedPassId);
  const lead = props.legendLead !== undefined && leadRow !== undefined ? { passId: leadRow.passId, node: props.legendLead(leadRow) } : undefined;
  // FR-STAR-5: the stars inventory has no pass, so no legend at all.
  const legend = props.inventory === 'stars' ? null : <Legend rows={rows} bodies={lines} timeZone={observer.timeZone} highlightedPassId={highlightedPassId} onActivate={select} onFocusRow={focusRow} lead={lead} screen={screen} moonPhase={moonPhase} />;
  // R54 (FR-LIVE-7 as amended v1.1.1, D-269): the view toggle and its note. On the guide they head the figure; on the live
  // page (`fill`) they go to the view for the frame's controls slot, so the row above the drawing is one row.
  // D-322: a screen has no controls at all — not in the figure, not in the frame's row — so there is nothing to build.
  const { viewAction } = useContext(ChartFrameSlots);
  const viewControl = <ToggleGroup name={t.chart.viewGroup} {...(compact ? { gap: 'none' as const, inline: true } : { prefix: t.chart.viewPrefix })} options={SKY_CHART_VIEWS.map((candidate) => ({ value: candidate.id, label: t.chart.view[candidate.id] }))} value={view.id} onChange={choose} />;
  const chartControls = screen ? null : (
    <>
      {/*
       * R66 (FR-COMP-4, US-5 AC2; V13-6, D-358): no visible `View:` on compact. With the window back in
       * the control (V13-6) the three options plus the prefix are 38 cells at 390 px — the row wrapped to
       * two, which is what V13-4 had taken away and what the owner did not want back — and the prefix is
       * the one part of it that carries nothing: it is `aria-hidden`, and the group is named `Chart view`
       * for anything that reads the page. Dropping it leaves 33 cells, one row, with the same meaning.
       *
       * R121 (FR-FSC-6 as amended v2.5, V25-17, D-834): on compact the options have no gap between them (each
       * option's own trailing cell is the whole gap, D-172's device) and are `inline`, their 48 px box padding
       * and a matching negative margin, so on a column too narrow for the three — the landscape phone's 740 ×
       * 360 — the control wraps to two text rows inside its one tap row, and the row above the box does not grow.
       */}
      {viewAction === undefined || viewAction === null ? (
        viewControl
      ) : (
        // R123 (FR-SKY-3, D-791): the page's `[ stars ]` after the control, on its row, where the page hands one (the pass detail on wide).
        <div className={styles.viewRow} data-testid="chart-view-row">
          {viewControl}
          {viewAction}
        </div>
      )}
      {note !== null && (
        <p className={styles.note} role="status" data-testid="chart-view-note">
          {t.window[note]}
        </p>
      )}
    </>
  );
  // D-322: on a screen the rails are not the chart's to place — there is no stripe row and no side column to
  // stand one in — so they are dropped here rather than left for the frame to ignore.
  const { aside, stripe, chartHand: _chartHand, ...bare } = props;
  const forwarded = screen ? { ...bare, fill: true } : { ...bare, aside, stripe };
  return (
    <figure
      ref={figureRef}
      className={[styles.figure, fill ? styles.fill : undefined, className].filter(Boolean).join(' ')}
      data-testid="sky-chart"
      data-view={view.id}
      data-screen={screen}
      {...(fill ? { 'aria-label': t.chart.liveLabel } : {})}
    >
      {!fill && <figcaption className={styles.caption}>{captioned ? <GuideText pass={captioned} timeZone={observer.timeZone} /> : <p className={styles.empty}>{t.chart.noPass}</p>}</figcaption>}
      {!fill && chartControls}
      {/* D-789: the hand camera's slot goes to the page's view and not to a screen, whose window is the sensor's. */}
      <view.Component {...forwarded} highlightedPassId={highlightedPassId} onSelectPass={select} sun={bodies.sun} moon={bodies.moon} legendKeys={keys} legend={legend} onUnavailable={unavailable} {...(fill && !screen ? { controls: chartControls } : {})} {...(screen ? {} : { hand })} />
    </figure>
  );
}
