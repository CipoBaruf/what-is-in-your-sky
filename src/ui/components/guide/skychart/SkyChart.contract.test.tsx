/**
 * PLAN §8.1, §9.1 "Sky chart contract" (R13): every registered view,
 * mounted through `SkyChart` with the same `SkyChartProps` fixture, exposes
 * the same caption (the FR-GUIDE-1 sentence), the same labelled anchors (N,
 * E, S, W, the pass name, the peak), fires `onSelectPass` with the pass id,
 * hides its drawing from assistive technology (FR-GUIDE-7) and draws no
 * canvas (FR-GUIDE-5). R15 adds the dome to `SKY_CHART_VIEWS` and this
 * file covers it with one addition: the dome is code-split behind
 * `React.lazy`, so each view is mounted once up front and awaited, after
 * which every render below is synchronous, as the assertions assume.
 *
 * R45 (FR-LEG-1, FR-LEG-2, US-23 AC1, AC2): the pass name and the peak
 * caption are gone from every drawing. What a view may write is the compass
 * names, the ring and tick degrees and one key per drawn pass at its peak;
 * the legend beside the drawing carries the words, lists the same passes
 * in the same order whichever view is mounted, and its keys are the ones
 * the drawing shows.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../../../tests/support/fixtures';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { SKY_CHART_VIEWS, SkyChart } from './SkyChart';
import type { SkyChartProps } from './SkyChart.types';

const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as { en: { asComputed: string } };
const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

const ANCHORS = ['N', 'E', 'S', 'W'];
/** FR-LEG-1: what a drawing may write — a compass name, a degree figure (ring or tick) or a legend key. */
const ALLOWED_TEXT = /^(N|NE|E|SE|S|SW|W|NW|\d+°|[A-Z]\d?)$/;
/** Every element a view writes text into: the polar's `<text>`, the dome's label spans (each carries `data-side`). */
const TEXT_ELEMENTS = '[data-drawing] text, [data-drawing] span[data-side]';

const other = { ...pass, id: 'other', name: 'Tiangong', start: { ...pass.start, t: pass.start.t + 3_600_000 } };
/** The legend order each view showed for `[other, pass]`, compared across views once both have run (FR-LEG-2). */
const legendOrders = new Map<string, string[]>();

/** The legend's rows in order: `[key, passId]` pairs. */
function legendEntries(container: HTMLElement): [string, string][] {
  return [...container.querySelectorAll('[data-testid="chart-legend"] button[data-pass-id]')].map((row) => [row.getAttribute('data-key') ?? '', row.getAttribute('data-pass-id') ?? '']);
}

describe.each(SKY_CHART_VIEWS)('<SkyChart> contract: $id view', (view) => {
  beforeAll(async () => {
    appStore.getState().setChartView(view.id);
    const { container, unmount } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing]')).not.toBeNull();
    });
    unmount();
  });
  beforeEach(() => {
    appStore.getState().setChartView(view.id);
  });
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  const props = (extra: Partial<SkyChartProps> = {}): SkyChartProps => ({ passes: [pass], observer, highlightedPassId: pass.id, ...extra });

  it('mounts the chosen view in a figure whose caption is the guide sentence', () => {
    render(<SkyChart {...props()} />);
    const figure = screen.getByRole('figure');
    expect(figure).toHaveAttribute('data-view', view.id);
    expect(within(figure).getByTestId('guide-sentence').textContent).toBe(golden.en.asComputed);
    expect(figure.querySelector('figcaption')).toContainElement(within(figure).getByTestId('guide-sentence'));
  });

  it('labels N, E, S, W and the pass by its key at the peak, nothing else in words; the drawing is aria-hidden and is not a canvas', async () => {
    const { container } = render(<SkyChart {...props()} />);
    const drawing = container.querySelector('[data-drawing]');
    expect(drawing).not.toBeNull();
    expect(drawing).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('canvas')).toBeNull();
    for (const label of ANCHORS) {
      const anchor = container.querySelector(`[data-anchor="${label}"]`);
      expect(anchor, label).not.toBeNull();
      expect(anchor?.textContent).toBe(label);
    }
    // FR-LEG-1 / US-23 AC1: the one key, on the element that selects the pass, and no name, time or caption anywhere in the drawing.
    const keys = container.querySelectorAll('[data-anchor="key"]');
    expect(keys).toHaveLength(1);
    expect(keys[0]?.textContent).toBe('A');
    expect(keys[0]?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', pass.id);
    expect(container.querySelector('[data-anchor="pass"]')).toBeNull();
    expect(container.querySelector('[data-anchor="peak"]')).toBeNull();
    const written = [...container.querySelectorAll(TEXT_ELEMENTS)].map((el) => el.textContent ?? '');
    expect(written.length).toBeGreaterThan(ANCHORS.length);
    expect(written.filter((text) => !ALLOWED_TEXT.test(text))).toEqual([]);
    expect(drawing?.textContent).not.toContain(pass.name);
    // FR-LEG-2 / US-23 AC2: the legend beside it carries the words — the same key, the name and the three times.
    const legend = container.querySelector('[data-testid="chart-legend"]');
    expect(legend).not.toBeNull();
    expect(legendEntries(container)).toEqual([['A', pass.id]]);
    expect(legend?.textContent).toContain(pass.name);
    expect(container.querySelector('[data-testid="chart-legend-slot"]')).toContainElement(legend as HTMLElement);
    expect(await axe(container)).toHaveNoViolations();
  });

  /** FR-LEG-2: the legend lists exactly the drawn passes, in one order, and the drawing carries the same keys. */
  it('lists every drawn pass in the legend in the drawing order of its keys, the explained pass first', () => {
    const { container } = render(<SkyChart {...props({ passes: [other, pass] })} />);
    const entries = legendEntries(container);
    expect(entries).toEqual([
      ['A', pass.id],
      ['B', 'other'],
    ]);
    const drawn = new Map([...container.querySelectorAll('[data-anchor="key"]')].map((el) => [el.closest('[data-pass-id]')?.getAttribute('data-pass-id') ?? '', el.textContent ?? '']));
    expect(drawn).toEqual(new Map(entries.map(([key, id]) => [id, key])));
    legendOrders.set(view.id, entries.map(([, id]) => id));
  });

  /** FR-LEG-4 / US-23 AC4: a row activated by pointer or keyboard highlights its arc and moves first, keeping its key. */
  it('highlights the pass whose legend row is clicked or focused and lists it first, until another row is activated', () => {
    const onSelectPass = vi.fn();
    const { container } = render(<SkyChart {...props({ passes: [other, pass], onSelectPass })} />);
    const row = (id: string) => container.querySelector(`[data-testid="chart-legend"] button[data-pass-id="${id}"]`);
    expect(row(pass.id)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(row('other') as Element);
    expect(onSelectPass).toHaveBeenCalledWith('other');
    expect(legendEntries(container)).toEqual([
      ['B', 'other'],
      ['A', pass.id],
    ]);
    expect(row('other')).toHaveAttribute('aria-pressed', 'true');
    expect(row(pass.id)).toHaveAttribute('aria-pressed', 'false');
    fireEvent.focus(row(pass.id) as Element);
    expect(legendEntries(container).map(([, id]) => id)).toEqual([pass.id, 'other']);
    expect(row(pass.id)).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports the pass id through onSelectPass', () => {
    const onSelectPass = vi.fn();
    const { container } = render(<SkyChart {...props({ onSelectPass })} />);
    const arc = container.querySelector(`[data-pass-id="${pass.id}"]`);
    if (!arc) throw new Error('no pass element');
    fireEvent.click(arc);
    expect(onSelectPass).toHaveBeenCalledWith(pass.id);
  });

  it('captions the highlighted pass among several, and says so when there is none to draw', () => {
    const { rerender } = render(<SkyChart {...props({ passes: [other, pass] })} />);
    expect(screen.getByTestId('guide-sentence').textContent).toBe(golden.en.asComputed);
    rerender(<SkyChart {...props({ passes: [] , highlightedPassId: null })} />);
    expect(screen.getByRole('figure')).toHaveTextContent('No pass to draw.');
  });

  /** FR-LIVE-1 / FR-LIVE-10 (R32): the live page's chart is the same component, named rather than captioned, filling its box. */
  it('with fill: no caption, a named figure, the frame in fill mode, and the same labelled anchors', async () => {
    const { container } = render(<SkyChart {...props({ fill: true, highlightedPassId: null, colorBy: 'pass' })} />);
    const figure = screen.getByRole('figure', { name: 'The whole sky at the shown instant' });
    expect(figure.querySelector('figcaption')).toBeNull();
    expect(screen.queryByTestId('guide-sentence')).toBeNull();
    expect(container.querySelector('[data-testid="chart-frame"]')).toHaveAttribute('data-fill', 'true');
    for (const label of ANCHORS) expect(container.querySelector(`[data-anchor="${label}"]`), label).not.toBeNull();
    expect(container.querySelectorAll('[data-anchor="key"]')).toHaveLength(1);
    expect(container.querySelector('[data-anchor="key"]')?.textContent).toBe('A');
    expect(container.querySelector('[data-drawing]')?.textContent).not.toContain(pass.name);
    expect(legendEntries(container)).toEqual([['A', pass.id]]);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('<SkyChart> contract across views', () => {
  /** FR-LEG-2: "the same in all three views" — the two registered ones agree on what the legend lists and in which order. */
  it('lists the same passes in the same order in every registered view', () => {
    expect([...legendOrders.keys()].sort()).toEqual(SKY_CHART_VIEWS.map((view) => view.id).sort());
    const orders = [...legendOrders.values()];
    for (const order of orders) expect(order).toEqual(orders[0]);
  });
});

describe('<SkyChart> view choice (US-6 AC5)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it('falls back to the first registered view for a preference no view claims, and shows the view toggle only with more than one view', () => {
    appStore.getState().setChartView('dome');
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const registered = SKY_CHART_VIEWS.map((view) => view.id);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', registered.includes('dome') ? 'dome' : registered[0]);
    if (SKY_CHART_VIEWS.length > 1) expect(screen.getByRole('group', { name: 'Chart view' })).toBeInTheDocument();
    else expect(screen.queryByRole('group', { name: 'Chart view' })).toBeNull();
  });
});
