// @vitest-environment jsdom
/**
 * R132 (FR-FLOW-4, D-842, D-851): one layout for every sky view — the slots in
 * FR-FLOW-4's order, each marked for the rhythm, an empty slot rendering
 * nothing, the column on compact, the box and the rail on wide and on the
 * landscape phone, the panel where the pass detail asks for it, the rail's
 * `View` and `Facing` labels, and the chart's parts landing in the page's
 * slots through `useChartSlot`. What jsdom cannot see — the bounding boxes —
 * is `tests/e2e/sky-layout.spec.ts`.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
        {...extra}
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
      />
    </I18nProvider>,
  );

const slots = (): string[] => Array.from(screen.getByTestId('layout').querySelectorAll<HTMLElement>('[data-slot]')).map((el) => el.dataset['slot'] ?? '');

describe('<SkyViewLayout> (FR-FLOW-4, D-842)', () => {
  it('renders every given slot in FR-FLOW-4’s order, each marked for the rhythm (D-851), and nothing for an empty one', () => {
    media = stubMatchMedia(COMPACT_PX);
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
    // `fill` (the live page, FR-LIVE-7): the layout says it fills the height its page gives it, so the stylesheet can
    // scroll the landscape rail inside it and pin the box; a page that grows with its rows says nothing.
    expect(screen.getByTestId('layout')).not.toHaveAttribute('data-fill');
    cleanup();
    render(<SkyViewLayout data-testid="layout" fill drawing={<div>box</div>} />);
    expect(screen.getByTestId('layout')).toHaveAttribute('data-fill', '');
  });

  it('is the column on compact, the box and the rail on wide and on the landscape phone, and the panel where asked', () => {
    media = stubMatchMedia(COMPACT_PX);
    all();
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'column');
    cleanup();
    media.restore();
    media = stubMatchMedia(WIDE_PX);
    all();
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'rail');
    cleanup();
    all('en', 'panel');
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'panel');
    cleanup();
    media.restore();
    media = stubMatchMedia(844, 390);
    all();
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'rail');
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
    media = stubMatchMedia(COMPACT_PX);
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
  it('with readoutIn corner puts the readout inside the drawing slot as a button, renders the picker slot only while open, and closes it on a pick or a second tap', () => {
    media = stubMatchMedia(COMPACT_PX);
    all('en', undefined, { readoutIn: 'corner' });
    const layout = screen.getByTestId('layout');
    expect(layout).toHaveAttribute('data-readout', 'corner');
    // No readout row above the drawing and no picker row under it: the readout is inside the drawing's slot.
    expect(slots()).toEqual(['answer', 'viewRow', 'drawing', 'readout', 'hint', 'timeline', 'action', 'layers', 'list', 'foot']);
    const toggle = screen.getByTestId('sky-readout-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.closest('[data-slot="drawing"]')).not.toBeNull();
    expect(toggle).toHaveAttribute('data-slot', 'readout');
    expect(toggle).not.toHaveAttribute('data-rhythm');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The chart's readout lands inside the button; its picker lands nowhere while the slot is not on the page.
    expect(toggle.querySelector('[data-placed="readout"]')).toHaveTextContent('Facing N');
    expect(layout.querySelector('[data-placed="picker"]')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const picker = layout.querySelector<HTMLElement>('[data-slot="picker"]');
    expect(picker).not.toBeNull();
    expect(picker).toHaveAttribute('data-rhythm', 'row');
    expect(toggle.getAttribute('aria-controls')).toBe(picker?.id);
    expect(picker?.querySelector('[data-placed="picker"]')).toHaveTextContent('N NE E');
    // A second tap closes it…
    fireEvent.click(toggle);
    expect(layout.querySelector('[data-slot="picker"]')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // …and so does a pick: a control inside the open row.
    fireEvent.click(toggle);
    cleanup();
    media.restore();
    media = stubMatchMedia(COMPACT_PX);
    render(
      <I18nProvider locale="en">
        <SkyViewLayout data-testid="layout" readoutIn="corner" readout={<p>Facing N</p>} drawing={<div>box</div>} picker={<button type="button">NE</button>} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByTestId('sky-readout-toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'NE' }));
    expect(screen.getByTestId('layout').querySelector('[data-slot="picker"]')).toBeNull();
    expect(screen.getByTestId('sky-readout-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('with readoutIn corner the rail form keeps its own corner and picker row, and the default row form is unchanged', () => {
    media = stubMatchMedia(844, 390);
    all('en', undefined, { readoutIn: 'corner' });
    expect(screen.getByTestId('layout')).toHaveAttribute('data-shape', 'rail');
    expect(screen.getByTestId('layout')).not.toHaveAttribute('data-readout');
    expect(screen.queryByTestId('sky-readout-toggle')).toBeNull();
    expect(slots()).toEqual([...SLOT_ORDER]);
    cleanup();
    media.restore();
    media = stubMatchMedia(COMPACT_PX);
    all();
    expect(screen.queryByTestId('sky-readout-toggle')).toBeNull();
    expect(slots()).toEqual([...SLOT_ORDER]);
  });

  /** R144 (FR-TONIGHT-9): a filling column writes the room its rows leave the drawing; a column that grows with its rows writes nothing. */
  it('measures --sky-drawing-room on a fill column from its height less the other slots, and not elsewhere', () => {
    media = stubMatchMedia(COMPACT_PX);
    const realClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    const realRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 700 });
    // Every slot but the drawing is 50 px tall; margins are 0 in jsdom (no stylesheet), so the room is 700 − 50 × 7.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const rect = realRect.call(this);
      return this.dataset['slot'] !== undefined && this.dataset['slot'] !== 'drawing' ? { ...rect, height: 50, bottom: 50, toJSON: () => ({}) } : rect;
    };
    try {
      all('en', undefined, { fill: true });
      expect(screen.getByTestId('layout').style.getPropertyValue('--sky-drawing-room')).toBe(`${String(700 - 50 * (SLOT_ORDER.length - 1))}px`);
      cleanup();
      all();
      expect(screen.getByTestId('layout').style.getPropertyValue('--sky-drawing-room')).toBe('');
    } finally {
      if (realClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', realClientHeight);
      HTMLElement.prototype.getBoundingClientRect = realRect;
    }
  });
});
