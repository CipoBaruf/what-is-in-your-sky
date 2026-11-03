// @vitest-environment jsdom
/**
 * R132 (FR-FLOW-4, D-842, D-851): one layout for every sky view — the slots in
 * FR-FLOW-4's order, each marked for the rhythm, an empty slot rendering
 * nothing, the full form on compact in both shapes (R165, D-1000: the column and
 * the compact rail are gone), the box and the rail on wide, the panel where the
 * pass detail asks for it, the rail's
 * `View` and `Facing` labels, and the chart's parts landing in the page's
 * slots through `useChartSlot`. What jsdom cannot see — the bounding boxes —
 * is `tests/e2e/sky-layout.spec.ts`.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { stubResizeObserver } from '../../../../tests/support/resizeObserver';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { fireEvent } from '@testing-library/react';
import { SkyViewChartSlot, SkyViewLayout, SLOT_ORDER, SLOT_RHYTHM, useChartSlot, type ChartSlotName, type SkyViewLayoutProps } from './SkyViewLayout';

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

const all = (locale: Locale = 'en', wide?: 'rail' | 'panel', extra: Partial<SkyViewLayoutProps> = {}) =>
  render(
    <I18nProvider locale={locale}>
      <SkyViewLayout
        {...(wide === undefined ? {} : { wide })}
        data-testid="layout"
        answer={<h1>answer</h1>}
        viewRow={
          <>
            <SkyViewChartSlot name="control" />
            <button type="button">stars</button>
          </>
        }
        readout={<SkyViewChartSlot name="readout" />}
        drawing={
          <div data-testid="chart">
            <Part name="control" text="Polar Dome [Window]" />
            <Part name="readout" text="Facing N" />
            <Part name="picker" text="N NE E" />
            <Part name="list" text="legend" />
          </div>
        }
        picker={<SkyViewChartSlot name="picker" />}
        hint={<p>hint</p>}
        timeline={<p>timeline</p>}
        action={<button type="button">act</button>}
        layers={<p>layers</p>}
        list={<SkyViewChartSlot name="list" />}
        foot={<p>foot</p>}
        {...extra}
      />
    </I18nProvider>,
  );

const slots = (): string[] => Array.from(screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-slot]')).map((el) => el.dataset['slot'] ?? '');

describe('<SkyViewLayout> (FR-FLOW-4, D-842)', () => {
  it('renders every given slot in FR-FLOW-4’s order, each marked for the rhythm (D-851), and nothing for an empty one', () => {
    media = stubMatchMedia(WIDE_PX);
    all();
    expect(slots()).toEqual([...SLOT_ORDER]);
    for (const slot of screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-slot]')) {
      expect(slot.dataset['rhythm']).toBe(SLOT_RHYTHM[slot.dataset['slot'] as keyof typeof SLOT_RHYTHM]);
    }
    cleanup();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} list={<p>list</p>} />);
    expect(slots()).toEqual(['drawing', 'list']);
    expect(screen.getByTestId('layout').querySelector('[data-slot="answer"]')).toBeNull();
    // A page that has no hint to show (seen, or the polar chart) hands the slot `false`, and no wrapper or gap is left.
    cleanup();
    render(<SkyViewLayout data-testid="layout" drawing={<div>box</div>} hint={false} list={<p>list</p>} />);
    expect(slots()).toEqual(['drawing', 'list']);
    // `fill` (the wide live page, FR-LIVE-7): the layout says it fills the height its page gives it, so the stylesheet
    // can cut the rail's box to it (D-869); a page that grows with its rows says nothing.
    expect(screen.getByTestId('layout')).not.toHaveAttribute('data-fill');
    cleanup();
    render(<SkyViewLayout data-testid="layout" fill drawing={<div>box</div>} />);
    expect(screen.getByTestId('layout')).toHaveAttribute('data-fill', '');
  });

  it('is the full form on compact in both shapes, the box and the rail on wide, and the panel where asked (D-1000)', () => {
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
    cleanup();
    all('en', 'panel');
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'panel');
  });

  it('labels the rail’s view row and facing row `View` and `Facing` (`Vista`, `Hacia`) on wide and not on compact (D-846)', () => {
    media = stubMatchMedia(WIDE_PX);
    all();
    expect(screen.getByRole('heading', { level: 2, name: en.skyView.view }).closest('[data-slot]')).toHaveAttribute('data-slot', 'viewRow');
    expect(screen.getByRole('heading', { level: 2, name: en.skyView.facing }).closest('[data-slot]')).toHaveAttribute('data-slot', 'picker');
    cleanup();
    all('es');
    expect(screen.getByRole('heading', { level: 2, name: es.skyView.view })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: es.skyView.facing })).toBeInTheDocument();
    cleanup();
    all('en', 'panel');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
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
    for (const name of ['control', 'readout', 'picker', 'list'] as const) {
      const placed = layout.querySelector(`[data-placed="${name}"]`);
      expect(placed, name).not.toBeNull();
      expect(placed?.closest('[data-slot]')).toHaveAttribute('data-slot', { control: 'viewRow', readout: 'readout', picker: 'picker', list: 'list' }[name]);
      expect(screen.getByTestId('chart').querySelector(`[data-placed="${name}"]`), name).toBeNull();
      expect(layout.querySelector(`[data-inline="${name}"]`), name).toBeNull();
    }
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
    all('en', undefined, { readoutIn: 'sheet', overlay: <p>over</p>, readout: undefined, sheet: <SkyViewChartSlot name="readout" /> });
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
    all('en', undefined, { overlay: <p>over</p>, readout: undefined });
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'full');
    expect(slots()).toEqual(['drawing', 'overlay']);
    cleanup();
    media.restore();
    media = stubMatchMedia(WIDE_PX);
    all('en', undefined, { overlay: <p>over</p>, sheet: <p>sheet</p> });
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'rail');
    expect(slots()).toEqual([...SLOT_ORDER]);
    expect(screen.queryByText('over')).toBeNull();
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
