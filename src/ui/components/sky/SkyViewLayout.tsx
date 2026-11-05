import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { HIT_RADIUS_PX } from '../guide/skychart/window/starGlyphs';
import { useT } from '../../../i18n/useT';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useShortcuts } from '../../hooks/useShortcuts';
import { enterFullscreen, exitFullscreen, fullscreenElement, fullscreenSupported } from '../../../lib/fullscreen';
import { skyShortcuts, type SkyKeyActions } from '../../../lib/shortcuts';
import type { EpochMs } from '../../../model';
import { TimeReadout } from '../live/TimeReadout';
import { TextButton } from '../primitives/TextButton';
import { SectionHeading } from '../primitives/SectionHeading';
import styles from './SkyViewLayout.module.css';

/**
 * R132 (FR-FLOW-4, FR-FLOW-6, FR-FLOW-7; D-842, D-851): one layout for every
 * sky view. The live page, the stars page and the pass detail fill named slots
 * and lay out none of their sky parts themselves; this component renders the
 * slots in FR-FLOW-4's order and owns the gap between them.
 *
 * **Wide** (R186, FR-WIDE-1, FR-WIDE-5; D-1098) is the box at the left and the
 * rail at the right on all three pages: the box is the room the grid leaves
 * beside the rail, with its four corners over it (`CORNERS`: the readout
 * top-left, full screen top-right, the hint bottom-left, the zoom
 * bottom-right); the rail is `SLOT_ORDER` — the head, `View`, `Time`, the
 * page group, the list — and scrolls as one where a short window leaves the
 * list fewer than its minimum rows. The guide's panel (D-849) is gone.
 *
 * **Compact** is the `full` form on all three pages, upright and turned (R148,
 * R163, R164): the drawing in a wrapper fixed to the viewport, the `overlay` and
 * `sheet` slots over it. R165 (FR-CLEAN-7, FR-CLEAN-8; D-1000) removed the
 * compact column and the landscape phone's compact rail that came before it,
 * with the corner readout that opened the picker under the drawing, the bowl's
 * cut and the measurements that served them.
 *
 * An empty slot renders nothing (D-885): a slot given nothing has no wrapper, and a slot given only a
 * `SkyViewChartSlot` the chart leaves empty keeps its wrapper, the chart's portal target. Every rendered slot carries
 * `data-slot` and `data-rhythm="row" | "group" | "section"` (D-851), and its
 * gap from the slot above is the rhythm's token — `--space-1`, `--space-3`,
 * `--space-5` — so a page cannot add a gap of its own (FR-FLOW-10).
 *
 * **The chart's parts.** The view control, the facing readout, the facing
 * picker and the legend are drawn by `SkyChart` and its views, which know
 * nothing of the page. A page puts `<SkyViewChartSlot name="…" />` where it
 * wants each (in `viewRow`, `readout`, `picker`, `list`), and the chart, which
 * reads this layout's context (`useChartSlot`), portals the part there and
 * draws nothing in its frame's own row. The frame's emptied rows are hidden by
 * `SkyViewLayout.module.css` (`ChartFrame.tsx` itself is unchanged, R132).
 *
 * **R144 (FR-TONIGHT-6; D-904).** `timeline` is a slot between the hint and
 * the action, a group away from each, for the time track and the taps; a page
 * that passes nothing renders no row.
 */
/** R186 (D-1098): the wide rail's rows, in `SLOT_ORDER`. */
export type SkyViewRailSlot = 'answer' | 'viewRow' | 'timeline' | 'action' | 'layers' | 'list';

/** R186 (FR-WIDE-5, D-1098): the box's four corners on wide — the readout top-left, full screen top-right, the hint bottom-left, the zoom bottom-right. */
export type SkyViewCorner = 'readout' | 'fullscreen' | 'hint' | 'zoom';

export type SkyViewSlotName = SkyViewRailSlot | SkyViewCorner | 'drawing' | 'overlay' | 'sheet';

/** D-851: how far a slot stands from the one above it — a row (`--space-1`), a group (`--space-3`) or a section (`--space-5`). */
export type SkyViewRhythm = 'row' | 'group' | 'section';

export const SLOT_RHYTHM: Readonly<Record<SkyViewRailSlot, SkyViewRhythm>> = {
  answer: 'section',
  viewRow: 'group',
  timeline: 'group',
  action: 'group',
  layers: 'group',
  list: 'section',
};

/**
 * R186 (FR-WIDE-1, D-1098): the wide rail's order on every page — the head (`answer`), `View`, `Time` (`timeline`),
 * the page group (`action`, then `layers`) and the list — which is also the DOM order the rows are rendered in, so
 * the three pages cannot drift. The corners and the full form's `overlay` and `sheet` are not rows and are not in it.
 */
export const SLOT_ORDER: readonly SkyViewRailSlot[] = ['answer', 'viewRow', 'timeline', 'action', 'layers', 'list'];

/** R186 (FR-WIDE-5): the corners in the order they are rendered over the box. */
export const CORNERS: readonly SkyViewCorner[] = ['readout', 'fullscreen', 'hint', 'zoom'];

/**
 * Where the readout stands — in its slot (the default: on wide, the box's top-left corner), or, R148 (D-923),
 * `sheet`: the page places the readout and the picker itself, in the sheet's facing row, and the frame draws neither.
 */
type SkyViewReadoutPlace = 'row' | 'sheet';

/** The parts a chart hands the layout past the page (`SkyViewChartSlot`, `useChartSlot`). */
export type ChartSlotName = 'control' | 'readout' | 'picker' | 'list' | 'zoom';

/** R165 (D-1000): compact is always `full`; R186 (D-1098): wide is always the rail, the guide's panel gone. */
type SkyViewShape = 'rail' | 'full';

/** R148 (D-904, D-923): what counts as a pick in an opened facing picker — one of its options, not a control beside them. */
export const PICK_SELECTOR = '[role="group"] button, [role="radiogroup"] [role="radio"], [role="listbox"] [role="option"]';

export interface SkyViewLayoutProps extends Partial<Record<SkyViewSlotName, ReactNode>> {
  drawing: ReactNode;
  /** The id of the drawing's text alternative on the page — the pass detail's prose — for the chart's figure (`aria-describedby`). */
  describedBy?: string | undefined;
  /** The id of the heading that names the drawing on the page — the pass's name — for the chart's figure (`aria-labelledby`). */
  labelledBy?: string | undefined;
  /** The page gives the layout a height and the layout fills it; written as `data-fill`. R186: every wide layout fills its page. */
  fill?: boolean | undefined;
  /** R148 (D-923): `'sheet'` where the page places the readout and the picker in its sheet's facing row. */
  readoutIn?: SkyViewReadoutPlace | undefined;
  /**
   * R163 (FR-CLEAN-2, D-1010): how many lines the full form's corner readout draws — one, the live page's (D-965: the
   * second line is the sheet's), or two, the stars page's, where FR-STAR-7's second line (a tapped star's name)
   * stands under the facing. Written on the readout's slot as `data-lines`; the page's stylesheet shows the second.
   */
  readoutLines?: 1 | 2 | undefined;
  /**
   * R159 (FR-PHONE-2, D-963, D-986): while given, the lift of the reader's first tap on the sky calls it inside the
   * gesture — the page's `useFollow().firstTouch` while a saved grant has it armed. Capture-phase listeners on the
   * drawing slot, removed after their one use; a drag or a pinch leaves them armed, and the touch goes on to the sky.
   */
  onFirstTouch?: (() => void) | undefined;
  /**
   * R189 (FR-WIDE-9, D-1102): the page's sky actions, run on wide by this layout's one listener (`useShortcuts`) with
   * `f` for its own full screen. Not given, the keys do nothing here (compact never runs them).
   */
  keys?: SkyKeyActions | undefined;
  /** R189 (FR-WIDE-10): the instant the full screen's time readout (FR-TRAJ-4) shows over the box's top edge. */
  clock?: { t: EpochMs; now: EpochMs; timeZone: string | null } | undefined;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  'data-testid'?: string | undefined;
}

interface SkyViewContextValue {
  shape: SkyViewShape;
  targets: Partial<Record<ChartSlotName, HTMLElement>>;
  /** `previous`, with `null`: the element going, so a slot that leaves after another took its name removes nothing (R157). */
  register: (name: ChartSlotName, element: HTMLElement | null, previous?: HTMLElement | null) => void;
  describedBy: string | undefined;
  labelledBy: string | undefined;
}

const SkyViewContext = createContext<SkyViewContextValue | null>(null);

export function SkyViewLayout({ describedBy, labelledBy, fill = false, readoutIn = 'row', readoutLines = 1, onFirstTouch, keys, clock, className, ref, 'data-testid': testId, ...slots }: SkyViewLayoutProps) {
  const t = useT();
  const mode = useLayoutMode();
  // R165 (D-1000): compact is the full form, in both shapes; R186 (D-1098): wide is the rail on every page.
  const shape: SkyViewShape = mode === 'wide' ? 'rail' : 'full';
  const [targets, setTargets] = useState<Partial<Record<ChartSlotName, HTMLElement>>>({});
  const register = useCallback((name: ChartSlotName, element: HTMLElement | null, previous: HTMLElement | null = null) => {
    setTargets((was) => {
      if ((was[name] ?? null) === element) return was;
      // R157 (D-965): the readout's place moves between the box's corner and the sheet's facing row; the one leaving
      // may be detached after the one arriving registered, and must not take the new target with it.
      if (element === null && previous !== null && was[name] !== previous) return was;
      const { [name]: _gone, ...rest } = was;
      return element === null ? rest : { ...rest, [name]: element };
    });
  }, []);
  const context = useMemo<SkyViewContextValue>(() => ({ shape, targets, register, describedBy, labelledBy }), [shape, targets, register, describedBy, labelledBy]);
  const viewId = useId();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );
  /*
   * R159 (FR-PHONE-2, D-963, D-986): the first touch asks. While the page passes `onFirstTouch` (a saved grant, nothing
   * asked yet this visit), capture-phase listeners on the drawing slot watch the touches on the sky and, at the lift
   * of the first one that is a tap — one pointer, never further than a tap's slop (`HIT_RADIUS_PX`, D-955) from where
   * it went down — call it inside that event and go. The touch itself goes on to the sky untouched, a tap naming a
   * star as it would. A drag or a pinch is the finger taking the sky, which FR-GYRO-4 would end following for anyway,
   * so it asks nothing and the page stays armed for the next tap. The lift and not the press, and a tap and not a
   * drag, because WebKit grants the motion request only inside user activation: for a touch that is the lift of a
   * tap, so a request made at the press, or at a drag's lift, could be refused by the browser and read as the
   * reader's refusal, clearing the very grant FR-PHONE-2 saves. The slot is the one the shape draws, so a turn of the
   * phone that swaps the form re-installs them there.
   */
  const firstTouch = useRef(onFirstTouch);
  useLayoutEffect(() => {
    firstTouch.current = onFirstTouch;
  });
  const armed = onFirstTouch !== undefined;
  useEffect(() => {
    const drawing = rootRef.current?.querySelector<HTMLElement>('[data-slot="drawing"]');
    if (!armed || !drawing) return;
    const down = new Map<number, { x: number; y: number }>();
    let spoiled = false;
    const strays = (event: PointerEvent): boolean => {
      const at = down.get(event.pointerId);
      return at === undefined || Math.hypot(event.clientX - at.x, event.clientY - at.y) > HIT_RADIUS_PX;
    };
    const onDown = (event: PointerEvent): void => {
      if (down.size > 0) spoiled = true;
      down.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onMove = (event: PointerEvent): void => {
      if (down.has(event.pointerId) && strays(event)) spoiled = true;
    };
    const onLift = (event: PointerEvent): void => {
      const tap = !spoiled && !strays(event);
      down.delete(event.pointerId);
      if (down.size > 0) return;
      spoiled = false;
      if (!tap) return;
      remove();
      firstTouch.current?.();
    };
    const onCancel = (event: PointerEvent): void => {
      down.delete(event.pointerId);
      spoiled = down.size > 0;
    };
    const listeners = [
      ['pointerdown', onDown],
      ['pointermove', onMove],
      ['pointerup', onLift],
      ['pointercancel', onCancel],
    ] as const;
    const remove = (): void => {
      for (const [name, listener] of listeners) drawing.removeEventListener(name, listener, true);
    };
    for (const [name, listener] of listeners) drawing.addEventListener(name, listener, true);
    return remove;
  }, [armed, shape]);

  /*
   * R189 (FR-WIDE-10, D-1103): the full sky. On wide the box — the drawing slot with its corners — goes in full screen
   * through `lib/fullscreen.ts`, and `full` is what the browser says (`fullscreenchange`), never what was asked: a
   * refused request changes nothing. Full, the slot is fixed over the viewport (the stylesheet, so a stubbed request
   * shows the same box), the frame inside refits on its own `ResizeObserver` with no rail beside it, and nothing is
   * remounted — the view, the camera, the zoom and the instant are the page's and stay. Where the API is missing the
   * control is absent and `f` does nothing; leaving wide or the page leaves full screen.
   */
  const drawingRef = useRef<HTMLDivElement | null>(null);
  const cornerRef = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);
  const canFull = shape === 'rail' && fullscreenSupported();
  useEffect(() => {
    const onChange = (): void => {
      setFull(drawingRef.current !== null && fullscreenElement() === drawingRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);
  useEffect(() => {
    const element = drawingRef.current;
    return () => {
      if (element !== null && fullscreenElement() === element) void exitFullscreen();
    };
  }, [shape]);
  const toggleFull = useCallback((): boolean => {
    const element = drawingRef.current;
    if (!canFull || element === null) return false;
    if (fullscreenElement() === element) void exitFullscreen();
    else void enterFullscreen(element);
    return true;
  }, [canFull]);
  // `Esc` leaves before any page listener reads it (the live page would leave, the pass detail close); a browser in
  // real full screen takes the key itself and only `fullscreenchange` arrives. Installed once, read through a ref.
  const fullRef = useRef(full);
  useLayoutEffect(() => {
    fullRef.current = full;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !fullRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void exitFullscreen();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);
  // The control the reader pressed is replaced by the other one: focus follows it rather than dropping to the body.
  const fullSeen = useRef(full);
  useEffect(() => {
    if (fullSeen.current === full) return;
    fullSeen.current = full;
    const active = document.activeElement;
    if (active === null || active === document.body) cornerRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [full]);
  /*
   * R189 (FR-WIDE-9, D-1102): the page's sky keys and `f`, one listener while the layout is the desk's. The shortcuts
   * overlay makes the page inert (D-73's "overlay first"), and then no key here is the page's.
   */
  const rows = keys === undefined ? { full: toggleFull } : skyShortcuts(keys, toggleFull, () => document.activeElement);
  const live = Object.fromEntries(Object.entries(rows).map(([id, run]) => [id, () => rootRef.current?.closest('[inert]') == null && run()])) as typeof rows;
  useShortcuts(live, shape === 'rail');

  const given =(name: SkyViewSlotName): boolean => {
    const node = slots[name];
    return node !== undefined && node !== null && node !== false;
  };
  const slot = (name: SkyViewRailSlot): ReactNode => {
    const node = slots[name];
    if (node === undefined || node === null || node === false) return null;
    // D-846: the rail labels the view row; the page group names its own groups (`Facing`, `Turn`, …).
    const label = name === 'viewRow' ? { id: viewId, text: t.skyView.view } : null;
    // The label is a heading over the row and not the row's group name: the control inside already names itself (`Chart view`).
    // The rail's list scrolls inside itself (FR-DESK-2), so it is a keyboard stop too (axe `scrollable-region-focusable`, FR-A11Y-7).
    const scrolls = name === 'list';
    return (
      <div key={name} className={[styles.slot, styles[name]].join(' ')} data-slot={name} data-rhythm={SLOT_RHYTHM[name]} {...(scrolls ? { tabIndex: 0 } : {})}>
        {label && <SectionHeading id={label.id}>{label.text}</SectionHeading>}
        {node}
      </div>
    );
  };
  /*
   * R186 (FR-WIDE-5, D-1098): the box's corners. The readout and the zoom are the chart's parts — a view portals them
   * here (`useChartSlot('readout' | 'zoom')`) unless the page gives a readout of its own; full screen is the layout's
   * own (R189: `[ full screen ]`, and while full the time readout and `[ × ]`); the hint is the page's. The readout
   * and the hint carry `data-slot` as their rows did.
   */
  const fullscreenNode = (): ReactNode => {
    if (!canFull) return null;
    if (!full) return <TextButton label={t.skyView.fullscreen} onClick={toggleFull} data-testid="sky-fullscreen" />;
    return (
      <>
        {clock !== undefined && <TimeReadout t={clock.t} now={clock.now} timeZone={clock.timeZone} />}
        <TextButton label="×" aria-label={t.skyView.exitFullscreen} onClick={toggleFull} data-testid="sky-fullscreen-exit" />
      </>
    );
  };
  const cornerNode = (name: SkyViewCorner): ReactNode => {
    if (name === 'readout') return given('readout') ? slots.readout : <SkyViewChartSlot name="readout" />;
    if (name === 'zoom') return <SkyViewChartSlot name="zoom" />;
    if (name === 'fullscreen') return fullscreenNode();
    return given(name) ? slots[name] : null;
  };
  const corner = (name: SkyViewCorner): ReactNode => {
    const node = cornerNode(name);
    if (node === null) return null;
    return (
      <div key={name} ref={name === 'fullscreen' ? cornerRef : undefined} className={[styles.corner, styles[`corner-${name}`]].join(' ')} data-corner={name} {...(name === 'readout' || name === 'hint' ? { 'data-slot': name } : {})}>
        {node}
      </div>
    );
  };

  /*
   * R148 (FR-FULL-1, FR-FULL-6; D-919): the full form. The drawing slot stands in a wrapper fixed to the viewport
   * (`inset: 0`, `100dvh`, padded by the safe-area insets), and over it the `overlay` slot at `--z-raised` and the
   * `sheet` slot at `--z-sheet`, both letting the pointer through to the sky where they hold nothing. No other slot
   * is rendered: the page passes their contents to its sheet. R157 (FR-PHONE-4, D-965): but `readout`, which stands
   * in the overlay at the box's top-right, one line at `--small` on `--screen-overlay`, cut with an ellipsis before
   * the head — the page writes the head's width as `--sky-head-w` on the layout's root — while the page fills it. The box's size depends on the wrapper alone, which
   * depends on the viewport alone, so nothing on the page can resize the sky.
   */
  if (shape === 'full') {
    return (
      <SkyViewContext.Provider value={context}>
        <div ref={setRoot} className={[styles.layout, className].filter(Boolean).join(' ')} data-shape="full" data-mode={mode} data-sky-layout="" {...(fill ? { 'data-fill': '' } : {})} {...(readoutIn === 'sheet' ? { 'data-readout': 'sheet' } : {})} {...(testId === undefined ? {} : { 'data-testid': testId })}>
          <div className={styles.fullWrap} data-sky-full="">
            <div className={[styles.slot, styles.drawing, styles.fullDrawing].join(' ')} data-slot="drawing">
              {slots.drawing}
            </div>
            {given('overlay') && (
              <div className={styles.overlay} data-slot="overlay">
                {slots.overlay}
                {given('readout') && (
                  <div className={styles.fullReadout} data-slot="readout" data-lines={readoutLines} data-testid="sky-corner-readout">
                    {slots.readout}
                  </div>
                )}
              </div>
            )}
            {given('sheet') && (
              <div className={styles.sheetSlot} data-slot="sheet">
                {slots.sheet}
              </div>
            )}
          </div>
        </div>
      </SkyViewContext.Provider>
    );
  }

  return (
    <SkyViewContext.Provider value={context}>
      <div ref={setRoot} className={[styles.layout, className].filter(Boolean).join(' ')} data-shape={shape} data-mode={mode} data-sky-layout="" {...(fill ? { 'data-fill': '' } : {})} {...(full ? { 'data-full': '' } : {})} {...(testId === undefined ? {} : { 'data-testid': testId })}>
        {/* R186 (FR-WIDE-1): the box at the left, cut from the room beside the rail by the grid, its extras on its corners. */}
        <div ref={drawingRef} className={[styles.slot, styles.drawing].join(' ')} data-slot="drawing">
          {slots.drawing}
          {CORNERS.map(corner)}
        </div>
        <div className={styles.rail} data-rail="">
          {SLOT_ORDER.map(slot)}
        </div>
      </div>
    </SkyViewContext.Provider>
  );
}

/**
 * The place in a slot where the chart's part lands. A page renders one per part it wants from the chart — the view
 * control in `viewRow`, the readout in `readout`, the facing picker (or the polar chart's orientation control) in
 * `picker`, the legend in `list` — and the chart portals the part into it (`useChartSlot`).
 */
export function SkyViewChartSlot({ name }: { name: ChartSlotName }) {
  const layout = useContext(SkyViewContext);
  if (layout === null) throw new Error('SkyViewChartSlot must be rendered inside SkyViewLayout');
  const { register } = layout;
  const placed = useRef<HTMLDivElement | null>(null);
  const setElement = useCallback(
    (element: HTMLDivElement | null) => {
      const previous = placed.current;
      placed.current = element;
      register(name, element, previous);
    },
    [register, name],
  );
  return <div ref={setElement} className={styles.chartSlot} data-chart-slot={name} />;
}

export interface ChartSlot {
  /** Whether the chart is inside a `SkyViewLayout` at all; outside one it draws the part where it always did. */
  inLayout: boolean;
  /** The layout's shape, for a view that words a part differently in the rail (`null` outside a layout). */
  shape: SkyViewShape | null;
  /** The drawing's text alternative on the page, for the figure's `aria-describedby`. */
  describedBy: string | undefined;
  /** The heading that names the drawing on the page, for the figure's `aria-labelledby`. */
  labelledBy: string | undefined;
  /** The slot's element on the page, where a part has been placed — for a query the chart used to run inside its figure. */
  target: HTMLElement | null;
  /** The part, portaled into the page's slot — or nothing, while the slot is not on the page. */
  place: (node: ReactNode) => ReactNode;
}

/** Read by `SkyChart` and its views: where the layout wants a part, and the portal that puts it there. */
export function useChartSlot(name: ChartSlotName): ChartSlot {
  const layout = useContext(SkyViewContext);
  const target = layout?.targets[name] ?? null;
  return useMemo<ChartSlot>(
    () => ({
      inLayout: layout !== null,
      shape: layout?.shape ?? null,
      describedBy: layout?.describedBy,
      labelledBy: layout?.labelledBy,
      target,
      place: (node) => (target === null || node === null || node === undefined ? null : createPortal(node, target)),
    }),
    [layout, target],
  );
}
