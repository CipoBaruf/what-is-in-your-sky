import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
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
 * An empty slot renders nothing. Every rendered slot carries
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
 */
export type SkyViewSlotName = 'answer' | 'viewRow' | 'readout' | 'drawing' | 'picker' | 'hint' | 'action' | 'layers' | 'list' | 'foot';

/** D-851: how far a slot stands from the one above it — a row (`--space-1`), a group (`--space-3`) or a section (`--space-5`). */
export type SkyViewRhythm = 'row' | 'group' | 'section';

export const SLOT_RHYTHM: Readonly<Record<SkyViewSlotName, SkyViewRhythm>> = {
  answer: 'section',
  viewRow: 'group',
  readout: 'row',
  drawing: 'row',
  picker: 'row',
  hint: 'row',
  action: 'group',
  layers: 'group',
  list: 'section',
  foot: 'section',
};

/** FR-FLOW-4's order, which is also the DOM order the slots are rendered in. */
export const SLOT_ORDER: readonly SkyViewSlotName[] = ['answer', 'viewRow', 'readout', 'drawing', 'picker', 'hint', 'action', 'layers', 'list', 'foot'];

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

export function SkyViewLayout({ wide = 'rail', describedBy, labelledBy, fill = false, className, ref, 'data-testid': testId, ...slots }: SkyViewLayoutProps) {
  const t = useT();
  const mode = useLayoutMode();
  const pageShape = usePageShape();
  // FR-FLOW-4: compact is the column, except the landscape phone, whose box stands beside its rail (FR-WATCH-5).
  const shape: SkyViewShape = mode === 'wide' ? wide : pageShape === 'landscape-phone' ? 'rail' : 'column';
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
    // A top row that wraps or a notice that comes and goes moves the layout's top: the parent's size says so.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (root.parentElement) observer?.observe(root.parentElement);
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
   * `--sky-hint-h`, unset (one row) while there is no hint.
   */
  const hasHint = slots.hint !== undefined && slots.hint !== null && slots.hint !== false;
  const sticky = landscape;
  useEffect(() => {
    const root = rootRef.current;
    const hint = root?.querySelector<HTMLElement>('[data-slot="hint"]');
    if (!root || !hint || !sticky || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = `${String(Math.ceil(hint.getBoundingClientRect().height))}px`;
      if (root.style.getPropertyValue('--sky-hint-h') !== next) root.style.setProperty('--sky-hint-h', next);
    });
    observer.observe(hint);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--sky-hint-h');
    };
  }, [sticky, hasHint]);

  const labelled = shape === 'rail';
  const slot = (name: SkyViewSlotName): ReactNode => {
    const node = slots[name];
    if (node === undefined || node === null || node === false) return null;
    // D-846: on wide the rail labels the view row and the facing row; the drawing's corner and the column do not.
    const label = labelled && name === 'viewRow' ? { id: viewId, text: t.skyView.view } : labelled && name === 'picker' ? { id: facingId, text: t.skyView.facing } : null;
    // The label is a heading over the row and not the row's group name: the control inside already names itself (`Chart view`, `Facing`).
    // The rail's list scrolls inside itself (FR-DESK-2), so it is a keyboard stop too (axe `scrollable-region-focusable`, FR-A11Y-7).
    const scrolls = name === 'list' && shape === 'rail' && mode === 'wide';
    return (
      <div key={name} className={[styles.slot, styles[name]].join(' ')} data-slot={name} data-rhythm={SLOT_RHYTHM[name]} {...(scrolls ? { tabIndex: 0 } : {})}>
        {label && <SectionHeading id={label.id}>{label.text}</SectionHeading>}
        {node}
      </div>
    );
  };

  return (
    <SkyViewContext.Provider value={context}>
      <div ref={setRoot} className={[styles.layout, className].filter(Boolean).join(' ')} data-shape={shape} data-mode={mode} data-sky-layout="" {...(fill ? { 'data-fill': '' } : {})} {...(testId === undefined ? {} : { 'data-testid': testId })}>
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
