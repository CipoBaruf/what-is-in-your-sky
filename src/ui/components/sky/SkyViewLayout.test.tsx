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
import { SkyViewChartSlot, SkyViewLayout, SLOT_ORDER, SLOT_RHYTHM, useChartSlot, type ChartSlotName } from './SkyViewLayout';

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

const all = (locale: Locale = 'en', wide?: 'rail' | 'panel') =>
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
});
