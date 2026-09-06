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
 *
 * R47 (FR-WIN-1, FR-WIN-4, FR-GUIDE-2b as amended): the window is the third
 * view. It is offered only on a phone (D-175's presence test), so its cases
 * run with the constructor and a touch screen stubbed; with neither, the
 * toggle has two options and a saved `'window'` falls back to the dome. Its
 * compass names and keys are in the DOM whether or not they are in the field
 * (hidden by `visibility`), which is what lets the same anchor assertions
 * hold for a view that shows a sixth of the sky.
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

/** D-175: a phone to point — the constructor and a touch screen — for the window's cases. */
function withPhone(): void {
  vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
    return undefined;
  });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

function withoutPhone(): void {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
}

describe.each(SKY_CHART_VIEWS)('<SkyChart> contract: $id view', (view) => {
  beforeAll(async () => {
    if (view.id === 'window') withPhone();
    appStore.getState().setChartView(view.id);
    const { container, unmount } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing]')).not.toBeNull();
    });
    unmount();
    withoutPhone();
  });
  beforeEach(() => {
    if (view.id === 'window') withPhone();
    appStore.getState().setChartView(view.id);
  });
  afterEach(() => {
    withoutPhone();
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

  /**
   * FR-LEG-4 / US-23 AC4: a row activated by pointer highlights its arc and moves first, keeping its key. R54 (D-271,
   * F-53): keyboard focus highlights the row's arc too but leaves the order alone, so Tab can walk the list — the row at
   * the top is the last one clicked or tapped, and the highlight follows the focus.
   */
  it('highlights the pass whose legend row is clicked and lists it first; focus highlights without reordering', () => {
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
    // Focus moves the highlight, not the row: `other` stays first, `pass` is the one pressed and the one at full weight.
    fireEvent.focus(row(pass.id) as Element);
    expect(legendEntries(container).map(([, id]) => id)).toEqual(['other', pass.id]);
    expect(row(pass.id)).toHaveAttribute('aria-pressed', 'true');
    expect(row(pass.id)).toHaveAttribute('data-highlighted', 'true');
    expect(row('other')).toHaveAttribute('aria-pressed', 'false');
    expect(row('other')).toHaveAttribute('data-highlighted', 'false');
    expect(onSelectPass).toHaveBeenCalledTimes(1);
    // A click on the focused row then promotes it, as before.
    fireEvent.click(row(pass.id) as Element);
    expect(legendEntries(container).map(([, id]) => id)).toEqual([pass.id, 'other']);
    expect(onSelectPass).toHaveBeenCalledWith(pass.id);
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

/** FR-LEG-2 / FR-COMP-5 / D-232: the frame's placement rules, read from the stylesheet (jsdom lays nothing out). */
describe('<ChartFrame> placement (FR-LEG-2, FR-COMP-5)', () => {
  const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/ChartFrame.module.css'), 'utf8');

  it('puts the legend beside the drawing only on wide and only where the frame has 62 cells: 36 for the drawing, a 2-cell gap and the 24-cell column', () => {
    // The container is the frame's shell, not the frame: a container query never answers for the container itself.
    expect(css).toMatch(/\.shell \{\s+container-type: inline-size;/);
    const beside = /@container \(min-width: 62ch\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(beside).toContain(".frame[data-compact='false'][data-legend='true'] {");
    expect(beside).toContain('grid-template-columns: minmax(0, 1fr) calc(24 * var(--cell));');
    expect(beside).toContain("'drawing legend'");
    // Outside the query the legend is the fourth row, under the status line, for every shell.
    expect(css).toMatch(/\.frame \{[^}]*'status'\n\s+'legend';/);
  });

  it('floors the live drawing at the frame width in portrait only, behind the page switch, and bounds the legend under a live drawing to four rows', () => {
    expect(css).toMatch(/@media \(orientation: portrait\) \{\s+\.fill\[data-compact='true'\] \.drawing \{\s+min-height: calc\(var\(--chart-floor, 0px\) \* var\(--chart-floor-on, 1\)\);/);
    // D-233: the live page held the switch off until R48 re-cut its rows (D-244); now nothing on the page turns it off.
    const live = readFileSync(join(process.cwd(), 'src/ui/screens/Live.module.css'), 'utf8');
    expect(live).not.toContain('--chart-floor-on');
    expect(css).toMatch(/\.fill \.legend \{\s+max-height: calc\(4 \* var\(--row\)\);\s+overflow-y: auto;/);
  });
});

describe('<SkyChart> contract across views', () => {
  /** FR-LEG-2 / FR-GUIDE-2b as amended: "the same in all three views" — every registered view agrees on what the legend lists and in which order. */
  it('lists the same passes in the same order in every registered view', () => {
    expect(SKY_CHART_VIEWS.map((view) => view.id).sort()).toEqual(['dome', 'polar', 'window']);
    expect([...legendOrders.keys()].sort()).toEqual(SKY_CHART_VIEWS.map((view) => view.id).sort());
    const orders = [...legendOrders.values()];
    for (const order of orders) expect(order).toEqual(orders[0]);
  });
});

describe('<SkyChart> view choice (US-6 AC5, FR-WIN-4)', () => {
  afterEach(() => {
    withoutPhone();
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

  /** FR-WIN-4 / US-21 AC4: a desktop never sees the option, and a saved window there is the dome. */
  it('offers the window only where there is a phone to point, and falls a saved window back to the dome elsewhere', async () => {
    appStore.getState().setChartView('window');
    const { unmount } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    const toggle = screen.getByRole('group', { name: 'Chart view' });
    expect(within(toggle).getAllByRole('button').map((button) => button.textContent)).toEqual(['Polar', 'Dome']);
    expect(appStore.getState().chartView).toBe('window'); // the preference is kept for the phone it was saved on
    unmount();

    withPhone();
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'window');
    expect(within(screen.getByRole('group', { name: 'Chart view' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['Polar', 'Dome', 'Window']);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
  });
});
