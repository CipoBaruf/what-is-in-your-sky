import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { LANDSCAPE_DRAWING_MIN_SHARE } from '../../../lib/layout';
import { useT } from '../../../i18n/useT';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { usePageShape } from '../live/usePageShape';
import { SectionHeading } from '../primitives/SectionHeading';
import styles from './SkyViewLayout.module.css';

/**
 * R132 (FR-FLOW-4, FR-FLOW-6, FR-FLOW-7; D-842, D-851): one layout for every
 * sky view. The live page, the stars page and the pass detail fill named slots
 * and lay out none of their sky parts themselves; this component renders the
 * slots in FR-FLOW-4's order and owns the gap between them.
 *
 * **Compact** (`column`) is one column, top to bottom: `answer`, `viewRow`,
 * `readout`, `drawing`, `picker`, `hint`, `action`, `layers`, `list`, `foot`.
 * **Wide** is the box at the left and the rail at the right (`rail`): the
 * readout stands in the box's top-left corner (V25-17) and the hint under the
 * box at the box's width; the rail holds `answer`, the `View` row, the
 * `Facing` row, `layers`, `list`, and at its foot `action` and `foot`. The
 * landscape phone (`usePageShape`; R136, FR-FLOW-15, D-877) takes the rail
 * form too, with the compact tokens, on all three pages: the drawing at the
 * left at `LANDSCAPE_DRAWING_MIN_SHARE` of the viewport's width, the layout
 * one viewport high under the top row (given by the page with `fill`, else
 * measured here), the rail scrolling inside it and the page not at all. The
 * turn changes the CSS only: the slots, the chart and its state stay mounted. The pass
 * detail's wide shell asks for `panel` (D-849): one column
 * where the view row and the picker share a line and the drawing takes the
 * panel's remaining height (`--sky-drawing-h`, measured here).
 *
 * An empty slot renders nothing (D-885): a slot given nothing has no wrapper, and a slot given only a
 * `SkyViewChartSlot` the chart leaves empty (the dome's picker) keeps its wrapper, the chart's portal target, but
 * takes no gap in the column (`SkyViewLayout.module.css`). Every rendered slot carries
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
 * **R144 (FR-TONIGHT-6, FR-TONIGHT-9; D-904).** Three things for the compact
 * live page, which alone asks for them. `timeline` is a slot between the hint
 * and the action, a group away from each, for the time track and the three
 * taps (FR-TONIGHT-6's rows 7 and 8); the other pages pass nothing and render
 * no row. `readoutIn: 'corner'` draws the readout inside the drawing slot's
 * wrapper, in the box's top-left corner at `--small` on the screen's overlay
 * surface, as a button (`aria-expanded`) that opens the picker slot under the
 * drawing; the slot is rendered only while open, a pick or a second tap
 * closes it, and the column's rows above the drawing lose the readout's row.
 * In the rail form the readout already stands on the box's corner and the
 * picker in the rail, so the prop changes nothing there. And a column that
 * fills its page (`fill`) measures the room its rows leave the drawing —
 * `--sky-drawing-room` on the layout — so the box is what the rows leave, up
 * to its own rule (the bowl's cut, or the square), and the page does not
 * scroll at any compact size (FR-TONIGHT-9, FR-COMP-5's "the gaps give, then
 * the box").
 */
export type SkyViewSlotName = 'answer' | 'viewRow' | 'readout' | 'drawing' | 'picker' | 'hint' | 'timeline' | 'action' | 'layers' | 'list' | 'foot';

/** D-851: how far a slot stands from the one above it — a row (`--space-1`), a group (`--space-3`) or a section (`--space-5`). */
export type SkyViewRhythm = 'row' | 'group' | 'section';

export const SLOT_RHYTHM: Readonly<Record<SkyViewSlotName, SkyViewRhythm>> = {
  answer: 'section',
  viewRow: 'group',
  readout: 'row',
  drawing: 'row',
  picker: 'row',
  hint: 'row',
  timeline: 'group',
  action: 'group',
  layers: 'group',
  list: 'section',
  foot: 'section',
};

/** FR-FLOW-4's order (FR-TONIGHT-6's for `timeline`), which is also the DOM order the slots are rendered in. */
export const SLOT_ORDER: readonly SkyViewSlotName[] = ['answer', 'viewRow', 'readout', 'drawing', 'picker', 'hint', 'timeline', 'action', 'layers', 'list', 'foot'];

/** R144 (D-904): where the readout stands — its own row above the drawing (the default), or the box's top-left corner as the picker's toggle. */
export type SkyViewReadoutPlace = 'row' | 'corner';

/** The parts a chart hands the layout past the page (`SkyViewChartSlot`, `useChartSlot`). */
export type ChartSlotName = 'control' | 'readout' | 'picker' | 'list';

type SkyViewShape = 'column' | 'rail' | 'panel';

export interface SkyViewLayoutProps extends Partial<Record<SkyViewSlotName, ReactNode>> {
  drawing: ReactNode;
  /** The wide form: the box and the rail (the default), or the guide panel's one column (D-849). Compact is always the column. */
  wide?: 'rail' | 'panel';
  /** The id of the drawing's text alternative on the page — the pass detail's prose — for the chart's figure (`aria-describedby`). */
  describedBy?: string | undefined;
  /** The id of the heading that names the drawing on the page — the pass's name — for the chart's figure (`aria-labelledby`). */
  labelledBy?: string | undefined;
  /**
   * The page gives the layout a height and the layout fills it (the live page: one viewport high wherever there is
   * a rail, FR-LIVE-7). On the landscape phone the rail then scrolls inside the layout and the box keeps the
   * layout's height, never the rail's (FR-WATCH-7); without it the layout grows with its rows and the page scrolls.
   */
  fill?: boolean | undefined;
  /** R144 (FR-TONIGHT-6, D-904): the readout in the box's corner as the picker's toggle — the compact live page alone passes `'corner'`. */
  readoutIn?: SkyViewReadoutPlace | undefined;
  /**
   * R144 (FR-TONIGHT-9): a value that changes when a slot's content changes height on the reader's tap — the live
   * page's list opening — so a `fill` column re-measures the drawing's room in that commit, before the paint, and
   * not a frame later from the resize observer (the page would scroll for that frame, or keep the open list's room).
   */
  roomKey?: string | undefined;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  'data-testid'?: string | undefined;
}

interface SkyViewContextValue {
  shape: SkyViewShape;
  targets: Partial<Record<ChartSlotName, HTMLElement>>;
  register: (name: ChartSlotName, element: HTMLElement | null) => void;
  describedBy: string | undefined;
  labelledBy: string | undefined;
}

const SkyViewContext = createContext<SkyViewContextValue | null>(null);

export function SkyViewLayout({ wide = 'rail', describedBy, labelledBy, fill = false, readoutIn = 'row', roomKey, className, ref, 'data-testid': testId, ...slots }: SkyViewLayoutProps) {
  const t = useT();
  const mode = useLayoutMode();
  const pageShape = usePageShape();
  // FR-FLOW-4: compact is the column, except the landscape phone, whose box stands beside its rail (FR-WATCH-5).
  const shape: SkyViewShape = mode === 'wide' ? wide : pageShape === 'landscape-phone' ? 'rail' : 'column';
  // R144 (D-904): the corner readout is the column's device; the rail form has its own corner and its picker row.
  const corner = readoutIn === 'corner' && shape === 'column';
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();
  const [targets, setTargets] = useState<Partial<Record<ChartSlotName, HTMLElement>>>({});
  const register = useCallback((name: ChartSlotName, element: HTMLElement | null) => {
    setTargets((was) => {
      if ((was[name] ?? null) === element) return was;
      const { [name]: _gone, ...rest } = was;
      return element === null ? rest : { ...rest, [name]: element };
    });
  }, []);
  const context = useMemo<SkyViewContextValue>(() => ({ shape, targets, register, describedBy, labelledBy }), [shape, targets, register, describedBy, labelledBy]);
  const viewId = useId();
  const facingId = useId();

  /*
   * D-849 (FR-FLOW-7): on the panel the drawing takes the height the panel's scroll box leaves under the control
   * line, and the prose and the table follow under it. Measured, since the rows above the drawing are text in
   * either language and the box is whatever the panel's column leaves: the drawing slot's top in the layout, the
   * hint's row under it, and the scroll box's height, written once per change as `--sky-drawing-h`. The column
   * form measures nothing: its box is as tall as the layout is wide, in CSS (`SkyViewLayout.module.css`).
   */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    if (shape !== 'panel') return;
    const measure = (): void => {
      const drawing = root.querySelector<HTMLElement>('[data-slot="drawing"]');
      if (!drawing) return;
      const scrollBox = root.parentElement;
      if (!scrollBox) return;
      const hint = root.querySelector<HTMLElement>('[data-slot="hint"]');
      const hintPx = hint ? hint.getBoundingClientRect().height + (parseFloat(getComputedStyle(hint).marginTop) || 0) : 0;
      const top = drawing.getBoundingClientRect().top - root.getBoundingClientRect().top;
      const height = Math.max(0, Math.floor(scrollBox.clientHeight - top - hintPx));
      const next = `${String(height)}px`;
      if (root.style.getPropertyValue('--sky-drawing-h') !== next) root.style.setProperty('--sky-drawing-h', next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (root.parentElement) observer.observe(root.parentElement);
    measure();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--sky-drawing-h');
    };
  }, [shape]);

  /*
   * R136 (FR-FLOW-15, D-877): the landscape phone's layout is one viewport high under the page's top row, and the
   * page does not scroll. The live page gives it that height (`fill`); the stars page and the sheet grow with their
   * rows, so the height is measured here — the scroll box's height less the layout's top in it — and the page's
   * padding under the layout is taken back by a negative margin (`--sky-landscape-trail`), so the page is exactly
   * one scroll box high. The layout is first set to the scroll box's whole height, which makes the box overflow,
   * so its `scrollHeight` reads what stands under the layout and not the box's own height.
   */
  const landscape = shape === 'rail' && mode === 'compact';
  // The drawing's share of the viewport's width, from the one constant (CSSOM, not a style attribute: the CSP).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !landscape) return;
    root.style.setProperty('--sky-drawing-share', String(LANDSCAPE_DRAWING_MIN_SHARE));
    return () => {
      root.style.removeProperty('--sky-drawing-share');
    };
  }, [landscape]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !landscape || fill) return;
    const scroller = scrollBoxOf(root);
    const measure = (): void => {
      const height = scroller.clientHeight;
      root.style.setProperty('--sky-landscape-trail', '0px');
      root.style.setProperty('--sky-landscape-h', `${String(height)}px`);
      const top = root.getBoundingClientRect().top - (scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top) + scroller.scrollTop;
      const trail = Math.max(0, scroller.scrollHeight - top - root.offsetHeight);
      root.style.setProperty('--sky-landscape-trail', `${String(trail)}px`);
      root.style.setProperty('--sky-landscape-h', `${String(Math.max(0, Math.floor(height - top)))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    // A top row that wraps or a notice that comes and goes moves the layout's top: the size of an ancestor under the
    // scroll box says so, whichever one holds it.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    for (let at = root.parentElement; at !== null && at !== scroller; at = at.parentElement) observer?.observe(at);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
      root.style.removeProperty('--sky-landscape-h');
      root.style.removeProperty('--sky-landscape-trail');
    };
  }, [landscape, fill]);

  /*
   * FR-FLOW-6 on the landscape phone: the hint wraps under the box (the follow clause and the Spanish line are
   * longer than the box is wide), so the box keeps the layout's height less the hint's measured rows —
   * `--sky-hint-h`, unset (one row) while there is no hint. R133 (FR-FLOW-9, D-869): the wide `fill` rail cuts its
   * box to the hint line the same way, and the Spanish window hint is two lines at 1280 × 800.
   */
  const hasHint = slots.hint !== undefined && slots.hint !== null && slots.hint !== false;
  const measuresHint = landscape || (shape === 'rail' && fill);
  useEffect(() => {
    const root = rootRef.current;
    const hint = root?.querySelector<HTMLElement>('[data-slot="hint"]');
    if (!root || !hint || !measuresHint || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = `${String(Math.ceil(hint.getBoundingClientRect().height))}px`;
      if (root.style.getPropertyValue('--sky-hint-h') !== next) root.style.setProperty('--sky-hint-h', next);
    });
    observer.observe(hint);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--sky-hint-h');
    };
  }, [measuresHint, hasHint]);

  /*
   * R144 (FR-TONIGHT-9, FR-COMP-5): a column that fills its page gives the drawing what its rows leave. The room is
   * the layout's height less every other slot's height and gap and the drawing's own gap, written as
   * `--sky-drawing-room`; the stylesheet caps the drawing at it (the bowl's cut and the square both read it), so
   * the rows under the box stay inside the viewport and the page never scrolls. No answer feeds itself: the other
   * rows are text, a track and a panel of fixed height, none of which the drawing's height can change. Re-run as
   * slots come and go (the hint, the picker on tap) and re-measured as any of them resizes (the list's head). The
   * observer answers a frame after the change, which is a frame of scroll, so the commits that change a row's
   * height measure before the paint too: a slot coming or going, the picker's tap, the page's `roomKey`, and
   * `targets` — a slot the chart portals into is filled in the commit after it registers (the opened picker).
   */
  const roomMeasured = shape === 'column' && fill;
  const slotKey = SLOT_ORDER.filter((name) => slots[name] !== undefined && slots[name] !== null && slots[name] !== false).join(' ');
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !roomMeasured || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      let taken = 0;
      for (const slot of root.querySelectorAll<HTMLElement>(':scope > [data-slot]')) {
        const gap = parseFloat(getComputedStyle(slot).marginTop) || 0;
        taken += gap + (slot.dataset['slot'] === 'drawing' ? 0 : slot.getBoundingClientRect().height);
      }
      const next = `${String(Math.max(0, Math.floor(root.clientHeight - taken)))}px`;
      if (root.style.getPropertyValue('--sky-drawing-room') !== next) root.style.setProperty('--sky-drawing-room', next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const slot of root.querySelectorAll<HTMLElement>(':scope > [data-slot]:not([data-slot="drawing"])')) observer.observe(slot);
    measure();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--sky-drawing-room');
    };
  }, [roomMeasured, slotKey, pickerOpen, roomKey, targets]);

  const labelled = shape === 'rail';
  const given = (name: SkyViewSlotName): boolean => {
    const node = slots[name];
    return node !== undefined && node !== null && node !== false;
  };
  /*
   * R144 (FR-TONIGHT-6, D-904): the readout in the box's corner, a button that opens the picker slot under the
   * drawing. The chart still portals its readout into the page's `SkyViewChartSlot`, which stands inside the
   * button; the picker's slot is rendered only while open, so the chart places its facing row there on the tap and
   * nowhere before it (FR-WATCH-7: nothing but the reader's tap changes the rows). A pick — any control inside the
   * open row — closes it, as does a second tap on the readout.
   *
   * The chart portals both parts in, and React bubbles a portal's events through the tree that rendered it (the
   * chart, in the drawing slot), not through the DOM: a tap on the readout's text never reaches the button's own
   * handler, and a pick in the facing row never reaches the picker slot's. The drawing slot is the one element both
   * paths pass — the button is its child, the chart its other child — so the toggle and the close are its handler,
   * read off the DOM target. The picker slot keeps its own for a part a page puts there itself.
   */
  const closeOnPick = (event: MouseEvent<HTMLElement>): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-slot="picker"]') && target.closest('button, [role="radio"], [role="option"], a')) setPickerOpen(false);
  };
  const onDrawingClick = (event: MouseEvent<HTMLElement>): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button[data-readout="corner"]')) setPickerOpen((was) => !was);
    else closeOnPick(event);
  };
  const cornerReadout =
    corner && given('readout') ? (
      <button
        type="button"
        className={styles.cornerReadout}
        data-slot="readout"
        data-readout="corner"
        data-testid="sky-readout-toggle"
        aria-expanded={pickerOpen}
        {...(pickerOpen ? { 'aria-controls': pickerId } : {})}
      >
        <span className={styles.cornerLabel}>{slots.readout}</span>
      </button>
    ) : null;
  const slot = (name: SkyViewSlotName): ReactNode => {
    const node = slots[name];
    if (node === undefined || node === null || node === false) return null;
    if (corner && name === 'readout') return null;
    if (corner && name === 'picker' && !pickerOpen) return null;
    // D-846: on wide the rail labels the view row and the facing row; the drawing's corner and the column do not.
    const label = labelled && name === 'viewRow' ? { id: viewId, text: t.skyView.view } : labelled && name === 'picker' ? { id: facingId, text: t.skyView.facing } : null;
    // The label is a heading over the row and not the row's group name: the control inside already names itself (`Chart view`, `Facing`).
    // The rail's list scrolls inside itself (FR-DESK-2), so it is a keyboard stop too (axe `scrollable-region-focusable`, FR-A11Y-7).
    const scrolls = name === 'list' && shape === 'rail' && mode === 'wide';
    const picked = corner && name === 'picker';
    return (
      <div
        key={name}
        className={[styles.slot, styles[name]].join(' ')}
        data-slot={name}
        data-rhythm={SLOT_RHYTHM[name]}
        {...(scrolls ? { tabIndex: 0 } : {})}
        {...(picked ? { id: pickerId, onClick: closeOnPick } : {})}
        {...(corner && name === 'drawing' ? { onClick: onDrawingClick } : {})}
      >
        {label && <SectionHeading id={label.id}>{label.text}</SectionHeading>}
        {name === 'drawing' && cornerReadout}
        {node}
      </div>
    );
  };

  return (
    <SkyViewContext.Provider value={context}>
      <div ref={setRoot} className={[styles.layout, className].filter(Boolean).join(' ')} data-shape={shape} data-mode={mode} data-sky-layout="" {...(fill ? { 'data-fill': '' } : {})} {...(corner ? { 'data-readout': 'corner' } : {})} {...(testId === undefined ? {} : { 'data-testid': testId })}>
        {SLOT_ORDER.map(slot)}
      </div>
    </SkyViewContext.Provider>
  );
}

/** The box the page scrolls in: the nearest ancestor that scrolls (the pass detail's sheet), else the document. */
function scrollBoxOf(element: HTMLElement): HTMLElement {
  for (let at = element.parentElement; at; at = at.parentElement) {
    const overflow = getComputedStyle(at).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return at;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
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
  const setElement = useCallback(
    (element: HTMLDivElement | null) => {
      register(name, element);
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
