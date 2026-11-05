// @vitest-environment jsdom
/**
 * R132 (FR-FLOW-4, D-842, D-851): one layout for every sky view — the slots in
 * FR-FLOW-4's order, each marked for the rhythm, an empty slot rendering
 * nothing, the full form on compact in both shapes (R165, D-1000: the column and
 * the compact rail are gone), the box with its corners and the rail on wide
 * (R186, D-1098; the panel is gone), the rail's `View` label, and the chart's parts landing in the page's
 * slots through `useChartSlot`. What jsdom cannot see — the bounding boxes —
 * is `tests/e2e/sky-layout.spec.ts`.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { stubResizeObserver } from '../../../../tests/support/resizeObserver';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { fireEvent } from '@testing-library/react';
import { CORNERS, LIST_FIRST_ORDER, LIST_FIRST_RHYTHM, SkyViewChartSlot, SkyViewLayout, SLOT_ORDER, SLOT_RHYTHM, useChartSlot, type ChartSlotName, type SkyViewLayoutProps } from './SkyViewLayout';

let media: MatchMediaStub | null = null;
stubResizeObserver(390, 390);

afterEach(() => {
  cleanup();
  media?.restore();
  media = null;
});

/** A stand-in for a chart view: puts one part where the layout's slot is, or draws it in place outside a layout. */
function Part({ name, text }: { name: ChartSlotName; text: string }) {
  const slot = useChartSlot(name);
  return (
    <>
      {slot.inLayout ? null : <p data-inline={name}>{text}</p>}
      {slot.place(<p data-placed={name}>{text}</p>)}
    </>
  );
}

const all = (locale: Locale = 'en', extra: Partial<SkyViewLayoutProps> = {}) =>
  render(
    <I18nProvider locale={locale}>
      <SkyViewLayout
        data-testid="layout"
        answer={<h1>answer</h1>}
        viewRow={
          <>
            <SkyViewChartSlot name="control" />
            <button type="button">stars</button>
          </>
        }
        drawing={
          <div data-testid="chart">
            <Part name="control" text="Globe Window Dome" />
            <Part name="readout" text="Facing N" />
            <Part name="zoom" text="+ -" />
            <Part name="picker" text="N NE E" />
            <Part name="list" text="legend" />
          </div>
        }
        hint={<p>hint</p>}
        timeline={<p>timeline</p>}
        action={
          <div>
            <SkyViewChartSlot name="picker" />
            <button type="button">act</button>
          </div>
        }
        layers={<p>layers</p>}
        list={<SkyViewChartSlot name="list" />}
        {...extra}
      />
    </I18nProvider>,
  );

const slots = (): string[] => Array.from(screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-slot]')).map((el) => el.dataset['slot'] ?? '');
const railSlots = (): string[] => Array.from(screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-rail] > [data-slot]')).map((el) => el.dataset['slot'] ?? '');
const corners = (): string[] => Array.from(screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-slot="drawing"] > [data-corner]')).map((el) => el.dataset['corner'] ?? '');

/**
 * R189 (FR-WIDE-10, D-1103): the Fullscreen API as a headless browser would grant it — `requestFullscreen` takes the
 * element, `exitFullscreen` gives it back, each with its `fullscreenchange`. `refuse` rejects the request instead.
 */
function stubFullscreen({ refuse = false } = {}) {
  let element: Element | null = null;
  const change = (next: Element | null): void => {
    element = next;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => true });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: () => {
      change(null);
      return Promise.resolve();
    },
  });
  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true,
    value(this: Element) {
      if (refuse) return Promise.reject(new TypeError('denied'));
      change(this);
      return Promise.resolve();
    },
  });
  return {
    restore: () => {
      for (const name of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen'] as const) Reflect.deleteProperty(document, name);
      Reflect.deleteProperty(Element.prototype, 'requestFullscreen');
    },
  };
}

describe('<SkyViewLayout> (FR-FLOW-4, D-842; FR-WIDE-1, FR-WIDE-5, D-1098)', () => {
  it('FR-WIDE-1: renders the rail in SLOT_ORDER, each row marked for the rhythm (D-851), and nothing for an empty one', () => {
    media = stubMatchMedia(WIDE_PX);
    all();
    expect(SLOT_ORDER).toEqual(['answer', 'viewRow', 'timeline', 'action', 'layers', 'list']);
    expect(railSlots()).toEqual([...SLOT_ORDER]);
    for (const slot of screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-rail] > [data-slot]')) {
      expect(slot.dataset['rhythm']).toBe(SLOT_RHYTHM[slot.dataset['slot'] as keyof typeof SLOT_RHYTHM]);
    }
    cleanup();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} list={<p>list</p>} />);
    expect(railSlots()).toEqual(['list']);
    expect(screen.getByTestId('layout').querySelector('[data-slot="answer"]')).toBeNull();
    // A page that has no hint to show (seen, or the polar chart) hands the slot `false`, and no corner is left.
    cleanup();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} hint={false} list={<p>list</p>} />);
    expect(corners()).toEqual(['readout', 'zoom']);
    expect(screen.getByTestId('layout')).not.toHaveAttribute('data-fill');
    cleanup();
    render(<SkyViewLayout data-testid="layout" fill drawing={<div>box</div>} />);
    expect(screen.getByTestId('layout')).toHaveAttribute('data-fill', '');
  });

  it('FR-WIDE-5: on wide the box carries its corners — the readout, full screen, the hint, the zoom — in that order', () => {
    media = stubMatchMedia(WIDE_PX);
    // R189 (FR-WIDE-10): the full screen corner is the layout's own control, where the API is there.
    const support = stubFullscreen();
    all('en');
    expect(CORNERS).toEqual(['readout', 'fullscreen', 'hint', 'zoom']);
    expect(corners()).toEqual([...CORNERS]);
    const layout = screen.getByTestId('layout');
    expect(layout.querySelector('[data-corner="readout"] [data-placed="readout"]')).toHaveTextContent('Facing N');
    expect(layout.querySelector('[data-corner="zoom"] [data-placed="zoom"]')).toHaveTextContent('+ -');
    expect(layout.querySelector('[data-corner="hint"]')).toHaveTextContent('hint');
    expect(layout.querySelector('[data-corner="fullscreen"]')).toHaveTextContent('full screen');
    // Without a page's own, the readout's corner is the chart's slot; without the API, full screen is absent.
    cleanup();
    support.restore();
    all('en', { readout: undefined });
    expect(corners()).toEqual(['readout', 'hint', 'zoom']);
    expect(screen.getByTestId('layout').querySelector('[data-corner="readout"] [data-placed="readout"]')).toHaveTextContent('Facing N');
  });

  it('is the full form on compact in both shapes and the box and the rail on wide (D-1000, D-1098)', () => {
    media = stubMatchMedia(COMPACT_PX);
    all();
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'full');
    cleanup();
    media.restore();
    media = stubMatchMedia(844, 390);
    all();
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'full');
    cleanup();
    media.restore();
    media = stubMatchMedia(WIDE_PX);
    all();
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'rail');
  });

  it('labels the rail’s view row `View` (`Vista`) on wide and not on compact (D-846)', () => {
    media = stubMatchMedia(WIDE_PX);
    all();
    expect(screen.getByRole('heading', { level: 2, name: en.skyView.view }).closest('[data-slot]')).toHaveAttribute('data-slot', 'viewRow');
    cleanup();
    all('es');
    expect(screen.getByRole('heading', { level: 2, name: es.skyView.view })).toBeInTheDocument();
    cleanup();
    media.restore();
    media = stubMatchMedia(COMPACT_PX);
    all();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('puts the chart’s parts in the page’s slots and draws none of them in the drawing (useChartSlot)', () => {
    media = stubMatchMedia(WIDE_PX);
    all();
    const layout = screen.getByTestId('layout');
    for (const name of ['control', 'readout', 'picker', 'list', 'zoom'] as const) {
      const placed = layout.querySelector(`[data-placed="${name}"]`);
      expect(placed, name).not.toBeNull();
      expect(screen.getByTestId('chart').querySelector(`[data-placed="${name}"]`), name).toBeNull();
      expect(layout.querySelector(`[data-inline="${name}"]`), name).toBeNull();
    }
    expect(layout.querySelector('[data-placed="control"]')?.closest('[data-slot]')).toHaveAttribute('data-slot', 'viewRow');
    expect(layout.querySelector('[data-placed="picker"]')?.closest('[data-slot]')).toHaveAttribute('data-slot', 'action');
    expect(layout.querySelector('[data-placed="list"]')?.closest('[data-slot]')).toHaveAttribute('data-slot', 'list');
    // The view row: the chart's control first, the page's `[x] stars` last.
    const viewRow = layout.querySelector('[data-slot="viewRow"]');
    expect(viewRow?.lastElementChild).toHaveTextContent('stars');
  });

  it('outside a layout a part is drawn where it always was', () => {
    render(<Part name="readout" text="Facing N" />);
    expect(screen.getByText('Facing N')).toHaveAttribute('data-inline', 'readout');
  });

  /** R144 (FR-TONIGHT-6, D-904): the readout in the box's corner as the picker's toggle, on the column alone. */
  /**
   * R148 (FR-FULL-1, FR-FULL-6; D-919): the full form, on compact in both shapes — the drawing in its fixed wrapper, the
   * overlay and the sheet slots over it, no rhythm marks, no other slot rendered, the chart's parts landing wherever
   * the page puts their slots (the sheet); on wide the page is the rail.
   */
  it('on compact renders the drawing, the overlay and the sheet and nothing else, in both compact shapes, and the rail on wide', () => {
    media = stubMatchMedia(COMPACT_PX);
    all('en', { readoutIn: 'sheet', overlay: <p>over</p>, readout: undefined, sheet: <SkyViewChartSlot name="readout" /> });
    const layout = screen.getByTestId('layout');
    expect(layout).toHaveAttribute('data-shape', 'full');
    expect(layout).toHaveAttribute('data-readout', 'sheet');
    expect(slots()).toEqual(['drawing', 'overlay', 'sheet']);
    for (const slot of layout.querySelectorAll('[data-slot]')) expect(slot).not.toHaveAttribute('data-rhythm');
    const wrap = layout.querySelector('[data-sky-full]');
    expect(wrap).not.toBeNull();
    expect(wrap?.querySelector('[data-slot="drawing"]')).toContainElement(screen.getByTestId('chart'));
    expect(wrap?.querySelector('[data-slot="overlay"]')).toHaveTextContent('over');
    // No corner readout, no picker slot: the page's sheet is where the readout lands.
    expect(screen.queryByTestId('sky-readout-toggle')).toBeNull();
    expect(layout.querySelector('[data-slot="sheet"] [data-placed="readout"]')).toHaveTextContent('Facing N');
    expect(layout.querySelector('[data-placed="picker"]')).toBeNull();
    cleanup();
    media.restore();
    media = stubMatchMedia(844, 390);
    all('en', { overlay: <p>over</p>, readout: undefined });
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'full');
    expect(slots()).toEqual(['drawing', 'overlay']);
    cleanup();
    media.restore();
    media = stubMatchMedia(WIDE_PX);
    all('en', { overlay: <p>over</p>, sheet: <p>sheet</p> });
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'rail');
    expect(railSlots()).toEqual([...SLOT_ORDER]);
    expect(screen.queryByText('over')).toBeNull();
  });

  it('V214-33 (D-1135): listFirst puts the list right under the head, before View and Time, scrolling inside itself (V214-37)', () => {
    media = stubMatchMedia(WIDE_PX);
    all('en', { listFirst: true });
    expect(LIST_FIRST_ORDER).toEqual(['answer', 'list', 'viewRow', 'timeline', 'action', 'layers']);
    expect(railSlots()).toEqual([...LIST_FIRST_ORDER]);
    const rail = screen.getByTestId('layout').querySelector('[data-rail]');
    expect(rail).toHaveAttribute('data-list-first');
    // V214-37: capped at about three cards, the list scrolls inside itself, so it is a keyboard stop (FR-A11Y-7).
    expect(rail?.querySelector('[data-slot="list"]')).toHaveAttribute('tabindex', '0');
    // V214-38: the rail closes up round the list — the count line and `View` a row's step from what is above them.
    expect(LIST_FIRST_RHYTHM).toEqual({ ...SLOT_RHYTHM, list: 'row', viewRow: 'row' });
    for (const el of rail?.querySelectorAll<HTMLElement>(':scope > [data-slot]') ?? []) {
      expect(el.dataset['rhythm']).toBe(LIST_FIRST_RHYTHM[el.dataset['slot'] as keyof typeof LIST_FIRST_RHYTHM]);
    }
    cleanup();
    all('en');
    expect(screen.getByTestId('layout').querySelector('[data-rail]')).not.toHaveAttribute('data-list-first');
    expect(screen.getByTestId('layout').querySelector('[data-slot="list"]')).toHaveAttribute('tabindex', '0');
    media.restore();
  });

  /**
   * R157 (FR-PHONE-4, D-965): the full form's `readout` slot stands in the overlay, after what the page put there, and
   * the chart's readout lands in it; the page takes it away (following, or the sheet open) and hands the readout to
   * the sheet's facing row, and the readout follows — whichever order the two places' refs are detached and attached.
   */
  it('in the full form puts the readout slot in the overlay, and the chart’s readout follows it to the sheet and back', () => {
    media = stubMatchMedia(COMPACT_PX);
    const view = (corner: boolean) => (
      <I18nProvider locale="en">
        <SkyViewLayout
          data-testid="layout"
          readoutIn="sheet"
          drawing={<Part name="readout" text="Facing N" />}
          overlay={<p>over</p>}
          {...(corner ? { readout: <SkyViewChartSlot name="readout" /> } : {})}
          sheet={<div data-testid="facing-row">{!corner && <SkyViewChartSlot name="readout" />}</div>}
        />
      </I18nProvider>
    );
    const { rerender } = render(view(true));
    expect(slots()).toEqual(['drawing', 'overlay', 'readout', 'sheet']);
    const corner = screen.getByTestId('sky-corner-readout');
    expect(corner.parentElement).toHaveAttribute('data-slot', 'overlay');
    expect(corner).toHaveTextContent('Facing N');
    expect(corner).not.toHaveAttribute('data-rhythm');
    expect(screen.getByTestId('facing-row')).toBeEmptyDOMElement();
    rerender(view(false));
    expect(screen.queryByTestId('sky-corner-readout')).toBeNull();
    expect(screen.getByTestId('facing-row')).toHaveTextContent('Facing N');
    rerender(view(true));
    expect(screen.getByTestId('sky-corner-readout')).toHaveTextContent('Facing N');
    expect(screen.getByTestId('facing-row')).toBeEmptyDOMElement();
  });

  /**
   * R150 (FR-GYRO-8, D-948): D-922's capture-phase listener is withdrawn. The full form listens to nothing: a tap on
   * the drawing reaches it — its `pointerup` and its `click` both — whatever is in the sheet slot.
   */
  it('in the full form lets a tap on the drawing through, its pointerup and its click, with the sheet slot filled', () => {
    media = stubMatchMedia(COMPACT_PX);
    render(<SkyViewLayout data-testid="layout" drawing={<div data-testid="box">box</div>} overlay={<button type="button" data-testid="over" />} sheet={<div data-testid="sheet">sheet</div>} />);
    const box = screen.getByTestId('box');
    const ups = vi.fn();
    const clicks = vi.fn();
    box.addEventListener('pointerup', ups);
    box.addEventListener('click', clicks);
    for (let id = 1; id <= 3; id += 1) {
      fireEvent.pointerDown(box, { pointerId: id, isPrimary: true, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(box, { pointerId: id, isPrimary: true, clientX: 10, clientY: 10 });
      fireEvent.click(box);
    }
    expect(ups).toHaveBeenCalledTimes(3);
    expect(clicks).toHaveBeenCalledTimes(3);
  });

  /**
   * R159 (FR-PHONE-2, D-963, D-986): while the page passes `onFirstTouch`, the first touch on the drawing calls it once,
   * on the lift, before the sky's own handler and without stopping it; nothing outside the drawing counts; the
   * listener goes with its use and with the prop, and stands in the drawing slot of whichever form is drawn.
   */
  it('asks nothing for a drag or a pinch, and stays armed for the tap after them (D-986)', () => {
    media = stubMatchMedia(COMPACT_PX);
    const first = vi.fn();
    render(<SkyViewLayout data-testid="layout" onFirstTouch={first} drawing={<div data-testid="box">box</div>} />);
    const box = screen.getByTestId('box');
    // A drag: past the tap's slop, lifted where it ended.
    fireEvent.pointerDown(box, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 140, clientY: 100 });
    // A drag that comes back to where it started is still a drag.
    fireEvent.pointerDown(box, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 2, clientX: 160, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 2, clientX: 100, clientY: 100 });
    // A pinch: two fingers, still, lifted one after the other.
    fireEvent.pointerDown(box, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(box, { pointerId: 4, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(box, { pointerId: 4, clientX: 200, clientY: 100 });
    // A cancelled touch.
    fireEvent.pointerDown(box, { pointerId: 5, clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(box, { pointerId: 5 });
    expect(first).not.toHaveBeenCalled();
    // A tap, a few pixels of wobble inside the slop.
    fireEvent.pointerDown(box, { pointerId: 6, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 6, clientX: 104, clientY: 103 });
    fireEvent.pointerUp(box, { pointerId: 6, clientX: 104, clientY: 103 });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('calls onFirstTouch once, inside the first touch’s lift on the drawing, letting the touch through, in the full form and the rail', () => {
    for (const width of [COMPACT_PX, WIDE_PX]) {
      media = stubMatchMedia(width);
      const full = width === COMPACT_PX;
      const first = vi.fn();
      const order: string[] = [];
      const { rerender, unmount } = render(
        <SkyViewLayout data-testid="layout" onFirstTouch={() => (first(), order.push('first'))} drawing={<div data-testid="box">box</div>} overlay={<button type="button" data-testid="over" />} />,
      );
      const box = screen.getByTestId('box');
      box.addEventListener('pointerup', () => order.push('sky'));
      if (full) {
        fireEvent.pointerUp(screen.getByTestId('over'), { pointerId: 1 });
        expect(first).not.toHaveBeenCalled();
      }
      fireEvent.pointerDown(box, { pointerId: 2 });
      expect(first).not.toHaveBeenCalled();
      fireEvent.pointerUp(box, { pointerId: 2 });
      expect(first).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['first', 'sky']);
      fireEvent.pointerDown(box, { pointerId: 3 });
      fireEvent.pointerUp(box, { pointerId: 3 });
      expect(first).toHaveBeenCalledTimes(1);
      // Without the prop there is no listener at all.
      rerender(<SkyViewLayout data-testid="layout" drawing={<div data-testid="box">box</div>} overlay={<button type="button" data-testid="over" />} />);
      fireEvent.pointerUp(screen.getByTestId('box'), { pointerId: 4 });
      expect(first).toHaveBeenCalledTimes(1);
      unmount();
      media.restore();
      media = null;
    }
  });
});

describe('<SkyViewLayout> keys and the full sky (R189: FR-WIDE-9, FR-WIDE-10; D-1102, D-1103)', () => {
  let support: ReturnType<typeof stubFullscreen> | null = null;
  afterEach(() => {
    support?.restore();
    support = null;
  });
  const keys = () => ({ setView: vi.fn(() => true), stepHour: vi.fn(() => true), toNow: vi.fn(() => true), togglePlay: vi.fn(() => true) });
  const press = (key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(event);
    });
    return event;
  };

  it('FR-WIDE-9: runs the page actions for g w d , . t Space on wide, and nothing on compact', () => {
    media = stubMatchMedia(WIDE_PX);
    const actions = keys();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} keys={actions} />);
    for (const key of ['g', 'w', 'd', ',', '.', 't', ' ']) expect(press(key).defaultPrevented).toBe(true);
    expect(actions.setView.mock.calls).toEqual([['globe'], ['window'], ['dome']]);
    expect(actions.stepHour.mock.calls).toEqual([[-1], [1]]);
    expect(actions.toNow).toHaveBeenCalledOnce();
    expect(actions.togglePlay).toHaveBeenCalledOnce();
    cleanup();
    media.restore();
    media = stubMatchMedia(COMPACT_PX);
    const compact = keys();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} keys={compact} />);
    press('g');
    expect(compact.setView).not.toHaveBeenCalled();
  });

  it('runs no key while the page is inert behind the shortcuts overlay', () => {
    media = stubMatchMedia(WIDE_PX);
    const actions = keys();
    render(
      <div inert>
        <SkyViewLayout data-testid="layout" drawing={<div>box</div>} keys={actions} />
      </div>,
    );
    expect(press('g').defaultPrevented).toBe(false);
    expect(actions.setView).not.toHaveBeenCalled();
  });

  it('FR-WIDE-10: f and the control put the box in full screen and back, with the readout and [ × ] over it', async () => {
    media = stubMatchMedia(WIDE_PX);
    support = stubFullscreen();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} clock={{ t: 0, now: 0, timeZone: 'UTC' }} />);
    const layout = screen.getByTestId('layout');
    const box = layout.querySelector('[data-slot="drawing"]');
    expect(layout).not.toHaveAttribute('data-full');
    expect(screen.queryByTestId('time-readout')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('sky-fullscreen'));
      await Promise.resolve();
    });
    expect(document.fullscreenElement).toBe(box);
    expect(layout).toHaveAttribute('data-full', '');
    expect(screen.getByTestId('time-readout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.skyView.exitFullscreen })).toHaveFocus();
    press('f');
    expect(layout).not.toHaveAttribute('data-full');
    expect(screen.getByTestId('sky-fullscreen')).toHaveFocus();
    press('f');
    expect(layout).toHaveAttribute('data-full', '');
    // `Esc` leaves, and no page listener after it reads the key.
    const after = vi.fn();
    document.addEventListener('keydown', after);
    press('Escape');
    document.removeEventListener('keydown', after);
    expect(layout).not.toHaveAttribute('data-full');
    expect(after).not.toHaveBeenCalled();
  });

  it('a refused request changes nothing; without the API the control is absent and f does nothing', async () => {
    media = stubMatchMedia(WIDE_PX);
    support = stubFullscreen({ refuse: true });
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('sky-fullscreen'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('layout')).not.toHaveAttribute('data-full');
    cleanup();
    support.restore();
    support = null;
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} />);
    expect(screen.queryByTestId('sky-fullscreen')).toBeNull();
    expect(press('f').defaultPrevented).toBe(false);
  });
});
