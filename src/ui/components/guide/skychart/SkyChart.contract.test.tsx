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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../../../tests/support/fixtures';
import { stubMatchMedia } from '../../../../../tests/support/matchMedia';
import { MOON_FIXTURE } from '../../../../../tests/support/moonFixtures';
import { formatClock } from '../../../../lib/timeFormat';
import { PassNumbers } from '../PassNumbers';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { ChartFrame } from './ChartFrame';
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
  /*
   * R66 (FR-FSC-1, FR-WIN-5 as amended v1.3.1; V13-6, V13-8, D-352): the window
   * is never a page's view any more — it is the sky screen's, and the only way
   * to mount it is `screen`. So the contract is asserted on the window as the
   * screen renders it, and on the other two as a page does; what the three
   * still share — one geometry, one legend, the same anchors — is what this
   * file is about, and none of it moves with the frame around it.
   */
  const asScreen = view.id === 'window';
  /*
   * FR-FSC-4 (D-323): a screen upright is the note and nothing else, and jsdom's
   * viewport is portrait by default, so the window's cases stub a landscape
   * phone — 844 x 390, the size the captures use — for as long as they run.
   */
  let media: { restore: () => void } | null = null;
  beforeAll(async () => {
    if (asScreen) withPhone();
    else if (view.id !== 'window') appStore.getState().setChartView(view.id);
    const { container, unmount } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} {...(asScreen ? { screen: true } : {})} />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing]')).not.toBeNull();
    });
    unmount();
    withoutPhone();
  });
  beforeEach(() => {
    if (asScreen) {
      withPhone();
      media = stubMatchMedia(844, 390);
    } else if (view.id !== 'window') appStore.getState().setChartView(view.id);
  });
  afterEach(() => {
    media?.restore();
    media = null;
    withoutPhone();
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  const props = (extra: Partial<SkyChartProps> = {}): SkyChartProps => ({ passes: [pass], observer, highlightedPassId: pass.id, ...(asScreen ? { screen: true } : {}), ...extra });

  it('mounts the chosen view in a figure whose caption is the guide sentence', () => {
    render(<SkyChart {...props()} />);
    const figure = screen.getByRole('figure');
    expect(figure).toHaveAttribute('data-view', view.id);
    // D-322: a screen has no caption — the readout and the legend are its only words (FR-FSC-1).
    if (asScreen) {
      expect(figure.querySelector('figcaption')).toBeNull();
      expect(screen.queryByTestId('guide-sentence')).toBeNull();
      return;
    }
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
    if (asScreen) {
      // The screen has no caption to carry either sentence; what it draws with no pass is an empty sky.
      expect(screen.queryByTestId('guide-sentence')).toBeNull();
      return;
    }
    expect(screen.getByTestId('guide-sentence').textContent).toBe(golden.en.asComputed);
    rerender(<SkyChart {...props({ passes: [], highlightedPassId: null })} />);
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
    // R51 (D-259): a legend that is the detail's numeric table takes that back, as an override at the end of the
    // block and not as an exception on the rule above — the extra specificity step of a `:not(:has(…))` there put
    // this grid over the wide live page's and cost the live legend its scroll (CI on #80). So the live rule keeps
    // the weight it had, and the one rule that outweighs it is the one no live frame can match.
    const lead = beside.indexOf(".frame[data-compact='false'][data-legend='true']:has([data-lead='true']) {");
    expect(lead).toBeGreaterThan(beside.indexOf(".fill[data-compact='false'][data-legend='true'] {"));
    expect(beside.slice(lead)).toContain('grid-template-columns: minmax(0, 1fr);');
    // Outside the query the legend is the fourth row, under the status line, for every shell.
    expect(css).toMatch(/\.frame \{[^}]*'status'\n\s+'legend';/);
  });

  /**
   * R61 (FR-LIVE-7 as amended v1.2, D-312, F-59): with an `aside` the column
   * is the page's rail and not a legend's width. The placement is the frame's
   * — the page hands it a node and never learns where it went — so both halves
   * are asserted: the DOM the frame builds, and the width the stylesheet gives
   * the column it builds it in.
   */
  it('widens the column to the page rail where it is given an aside, and puts the aside under the legend inside it', () => {
    render(
      <ChartFrame fill legend={<p>legend</p>} aside={<p>rail</p>}>
        <div />
      </ChartFrame>,
    );
    const slot = screen.getByTestId('chart-legend-slot');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'true');
    expect([...slot.children].map((el) => el.getAttribute('data-testid'))).toEqual(['chart-legend-scroll', 'chart-aside']);
    expect(within(screen.getByTestId('chart-aside')).getByText('rail')).toBeInTheDocument();
    // The legend keeps a box of its own inside the column, because that box is what scrolls: the rail must not.
    expect(slot.firstElementChild).toContainElement(screen.getByText('legend'));
    const beside = /@container \(min-width: 62ch\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(beside).toContain("grid-template-columns: auto minmax(0, 1fr) clamp(calc(44 * var(--cell)), 26%, calc(60 * var(--cell)));");
    expect(beside).toMatch(/\[data-aside='true'\] \.legendScroll \{\n\s+flex: 0 1 auto;\n\s+min-height: 0;\n\s+overflow-y: auto;/);
  });

  /**
   * R61 (FR-LIVE-7 as amended v1.2.1, D-314, D-315): with `boxAspect` the frame cuts the drawing box to the
   * largest rectangle of that shape it leaves, measured on a `ResizeObserver` and written as two custom
   * properties — no px may be written in the wide block — and a `stripe` is a row of the frame's own under
   * the drawing. jsdom lays nothing out, so the measurement is stubbed — the rects, the gaps and the
   * observer — and the arithmetic is asserted both ways round, height-bound and width-bound.
   */
  it('cuts the drawing to the given aspect from what it measures, and gives a stripe its own row under the drawing', () => {
    const heights = new Map<string, DOMRect>();
    const rect = (width: number, height: number): DOMRect => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) });
    const realGetRect = HTMLElement.prototype.getBoundingClientRect;
    const realGetComputedStyle = window.getComputedStyle;
    // Wide: the box is cut only on the wide fill frame with an aside (compact and the guide keep their own boxes).
    const media = stubMatchMedia(1920);
    const instances: { trigger: () => void }[] = [];
    const resizeObservers = () => instances;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: () => void) {
          instances.push(this);
        }
        observe() {
          /* the test triggers by hand */
        }
        disconnect() {
          /* nothing to detach */
        }
        trigger() {
          this.callback();
        }
      },
    );
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return heights.get(this.dataset['testid'] ?? this.className) ?? realGetRect.call(this);
    };
    window.getComputedStyle = ((el: Element) => ({ ...realGetComputedStyle(el), rowGap: '12px', columnGap: '29px' })) as typeof window.getComputedStyle;
    try {
      const { unmount } = render(
        <ChartFrame fill legend={<p>legend</p>} aside={<p>rail</p>} stripe={<p>stripe</p>} boxAspect={2.4 / 1.7}>
          <div />
        </ChartFrame>,
      );
      const frame = screen.getByTestId('chart-frame');
      // Before any measurement the properties are what the effect wrote from jsdom's zero rects: a 0 × 0 box.
      expect(frame).toHaveAttribute('data-box', 'true');
      expect(frame).toHaveAttribute('data-stripe', 'true');
      expect([...frame.children].map((el) => el.getAttribute('data-testid'))).toEqual([null, null, 'chart-box', null, 'chart-stripe', 'chart-legend-slot']);
      expect(within(screen.getByTestId('chart-stripe')).getByText('stripe')).toBeInTheDocument();
      // Now the sizes: the frame 1700 × 1000; controls 48 tall; stripe 108 tall; the rail probe 422 wide.
      heights.set('chart-frame', rect(1700, 1000));
      heights.set('chart-stripe', rect(1103, 108));
      heights.set(frame.children[0]?.className ?? '', rect(422, 0));
      heights.set(frame.children[1]?.className ?? '', rect(1103, 48));
      // Height-bound: 1000 − (48 + 12) − (108 + 12) = 820 tall, 1157 wide at 2.4 : 1.7; the width beside the rail (1700 − 451 = 1249) allows it.
      // The observer is triggered by hand: every instance shares the class above, so the last constructed one is the frame's.
      act(() => {
        for (const instance of resizeObservers()) instance.trigger();
      });
      expect(frame.style.getPropertyValue('--chart-box-h')).toBe('820px');
      expect(frame.style.getPropertyValue('--chart-box-w')).toBe(`${String(Math.floor((820 * 2.4) / 1.7))}px`);
      // Width-bound: a frame 900 wide leaves 449 beside the rail, so the box is 449 × 318.
      heights.set('chart-frame', rect(900, 1000));
      act(() => {
        for (const instance of resizeObservers()) instance.trigger();
      });
      expect(frame.style.getPropertyValue('--chart-box-w')).toBe('449px');
      expect(frame.style.getPropertyValue('--chart-box-h')).toBe(`${String(Math.floor(449 / (2.4 / 1.7)))}px`);
      unmount();
      expect(frame.style.getPropertyValue('--chart-box-w')).toBe('');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = realGetRect;
      window.getComputedStyle = realGetComputedStyle;
      vi.unstubAllGlobals();
      media.restore();
    }
    const beside = /@container \(min-width: 62ch\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    // The two columns the drawing spans are the drawing's own width, the rail takes what is left up to its cap, and nothing stretches.
    expect(beside).toMatch(/\[data-box='true'\] \{\n\s+grid-template-columns: auto auto minmax\(calc\(44 \* var\(--cell\)\), calc\(60 \* var\(--cell\)\)\);\n\s+grid-template-rows: auto auto;\n\s+justify-content: start;\n\s+align-content: start;/);
    expect(beside).toMatch(/\[data-box='true'\] \.drawing \{\n\s+width: var\(--chart-box-w\);\n\s+height: var\(--chart-box-h\);/);
    // …and the stripe row is the box's width by rule, so a stripe that measured a wider window cannot hold the track open.
    expect(beside).toMatch(/\[data-aside='true'\]\[data-box='true'\] \.stripe \{\n\s+width: max\(var\(--chart-box-w\), calc\(44 \* var\(--cell\)\)\);/);
    expect(beside).toMatch(/\[data-stripe='true'\] \{\n\s+grid-template-rows: auto auto auto;\n\s+grid-template-areas:\n\s+'controls status legend'\n\s+'drawing drawing legend'\n\s+'stripe stripe legend';/);
    expect(css).toMatch(/\.stripe \{\n\s+grid-area: stripe;/);
  });

  /**
   * R61 (FR-LIVE-7 as amended v1.2.1, D-319, D-320): `stacked` is the one-column wide live page — no rail, the
   * drawing, the stripe and the legend under one another, the drawing centred at the box's width and the stripe
   * and the legend the frame's whole width (V12-15), and the legend's height counted in the box's as the
   * stripe's is. An aside wins over it: the rail is what the rail is for.
   */
  it('stacks the drawing, the stripe and the legend where it is stacked — the drawing centred at the box width, the stripe and the legend full width — and lets an aside win', () => {
    const media = stubMatchMedia(1280);
    try {
      const { unmount } = render(
        <ChartFrame fill legend={<p>legend</p>} stripe={<p>stripe</p>} boxAspect={1.2} stacked>
          <div />
        </ChartFrame>,
      );
      const frame = screen.getByTestId('chart-frame');
      expect(frame).toHaveAttribute('data-stacked', 'true');
      expect(frame).toHaveAttribute('data-box', 'true');
      expect(frame).toHaveAttribute('data-aside', 'false');
      // No rail probe: the box is cut from the frame's whole width.
      expect([...frame.children].map((el) => el.getAttribute('data-testid'))).toEqual([null, 'chart-box', null, 'chart-stripe', 'chart-legend-slot']);
      unmount();
      render(
        <ChartFrame fill legend={<p>legend</p>} aside={<p>rail</p>} stripe={<p>stripe</p>} boxAspect={1.2} stacked>
          <div />
        </ChartFrame>,
      );
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stacked', 'false');
      expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'true');
    } finally {
      media.restore();
    }
    const beside = /@container \(min-width: 62ch\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(beside).toMatch(/\[data-stacked='true'\] \{\n\s+grid-template-columns: auto minmax\(0, 1fr\);\n\s+grid-template-rows: auto auto auto auto;\n\s+grid-template-areas:\n\s+'controls status'\n\s+'drawing drawing'\n\s+'stripe stripe'\n\s+'legend legend';/);
    expect(beside).toMatch(/\[data-stacked='true'\]\[data-box='true'\] \.drawing \{\n\s+width: var\(--chart-box-w\);\n\s+height: var\(--chart-box-h\);\n\s+margin: 0 auto;/);
    // D-320 (V12-15): the stripe and the legend both span the frame — the page's whole width — under a centred drawing.
    expect(beside).toMatch(/\[data-stacked='true'\]\[data-box='true'\] \.stripe \{\n\s+width: 100%;\n\s+\}/);
    expect(beside).toMatch(/\[data-stacked='true'\] \.legend \{\n\s+width: 100%;\n\s+align-self: start;\n\s+max-height: calc\(4 \* var\(--row\)\);/);
  });

  it('leaves the frame and its column alone with no aside', () => {
    render(
      <ChartFrame fill legend={<p>legend</p>}>
        <div />
      </ChartFrame>,
    );
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'false');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-box', 'false');
    expect(screen.getByTestId('chart-frame')).toHaveAttribute('data-stripe', 'false');
    expect(screen.getByTestId('chart-frame').style.getPropertyValue('--chart-box-w')).toBe('');
    expect(screen.getByTestId('chart-frame').children).toHaveLength(4);
    expect(screen.queryByTestId('chart-aside')).toBeNull();
    expect(screen.queryByTestId('chart-stripe')).toBeNull();
    expect(screen.getByTestId('chart-legend-slot').firstElementChild).toBe(screen.getByText('legend'));
  });

  it('floors the live drawing at the frame width in portrait only, behind the page switch, and bounds the legend under a live drawing to four rows', () => {
    expect(css).toMatch(/@media \(orientation: portrait\) \{\s+\.fill\[data-compact='true'\] \.drawing \{\s+min-height: calc\(var\(--chart-floor, 0px\) \* var\(--chart-floor-on, 1\)\);/);
    /*
     * D-233: the live page held the switch off until R48 re-cut its rows
     * (D-244), and R59 (D-300, F-55) turns it off again — a phone's frame
     * spends some 190 px on the view control's two rows and the legend's four
     * before the page's own rows are counted, so the floor could only be met
     * by overflowing the frame onto them. The property is read here rather
     * than assumed absent: the switch is the contract, and a page that leans
     * on it says so in this file's own terms.
     */
    const live = readFileSync(join(process.cwd(), 'src/ui/screens/Live.module.css'), 'utf8');
    // The declaration is the contract, not its neighbours: the compact page states its variables in
    // one block (R59 review), so this matches `--chart-floor-on: 0` anywhere inside that block
    // rather than pinning the block to exactly one property.
    const compactBlock = /\.page\[data-compact='true'\] \{([^}]*)\}/.exec(live);
    expect(compactBlock, 'a .page[data-compact=\'true\'] block in Live.module.css').not.toBeNull();
    expect(compactBlock?.[1]).toMatch(/--chart-floor-on:\s*0;/);
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

  /**
   * FR-WIN-4 / US-21 AC4, as amended v1.3.1 (V13-6, V13-8): a desktop never sees
   * the option; a phone sees all three, on every page. The option is a mode, so
   * the view under it stays what the reader picked and the window is only ever
   * drawn on the screen.
   */
  it('offers the window only where there is a phone to point, and draws it only as the screen', async () => {
    appStore.getState().setChartView('dome');
    const { unmount } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    const toggle = screen.getByRole('group', { name: 'Chart view' });
    expect(within(toggle).getAllByRole('button').map((button) => button.textContent)).toEqual(['Polar', 'Dome']);
    unmount();

    withPhone();
    const { unmount: unmountPage } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    expect(within(screen.getByRole('group', { name: 'Chart view' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['Polar', 'Dome', 'Window']);
    unmountPage();

    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} screen />);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'window');
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
  });
});

/**
 * FR-LEG-3 / US-23 AC3 (R51): the pass detail's reading of the legend. The
 * FR-GUIDE-1 numeric table stands in for the explained pass's row at the head
 * of the list, carrying the key the drawing puts at that arc's peak and a
 * swatch in the arc's colour; every other drawn pass keeps a row of its own,
 * and the Sun and the Moon keep their line each. This is `SkyChart`'s
 * contract, not the screen's: the screen hands in the table and the boundary
 * decides where it goes and what it stands for (D-256).
 */
describe("<SkyChart> with the detail's numeric table as the legend (FR-LEG-3, US-23 AC3)", () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  const sun = { t: pass.peak.t, azDeg: 291.2, altDeg: -9.4 };
  const detail = (extra: Partial<SkyChartProps> = {}) => (
    <SkyChart
      passes={[pass]}
      observer={observer}
      highlightedPassId={pass.id}
      sun={sun}
      moon={MOON_FIXTURE}
      legendLead={(row) => <PassNumbers pass={pass} timeZone={null} legendKey={row.key} colorToken={row.colorToken} />}
      {...extra}
    />
  );

  it('opens the legend with the table, keyed and swatched, and lists no second row for the pass it explains', () => {
    const { container } = render(detail());
    const legend = container.querySelector('[data-testid="chart-legend"]');
    const lead = container.querySelector('[data-testid="legend-lead"]');
    expect(lead).not.toBeNull();
    expect(legend?.firstElementChild).toBe(lead);
    expect(lead).toHaveAttribute('data-pass-id', pass.id);
    // The table is inside it, and its caption carries the drawing's key and the arc's colour (FR-LEG-5).
    const caption = within(lead as HTMLElement).getByRole('table').querySelector('caption');
    expect(caption?.textContent).toContain('A');
    expect(caption?.querySelector('[data-color]')).toHaveAttribute('data-color', 'pass');
    expect(container.querySelector(`[data-testid="chart-legend"] button[data-pass-id="${pass.id}"]`)).toBeNull();
    // …and it is the key the drawing draws at that arc's peak (FR-LEG-1).
    expect(container.querySelector('[data-anchor="key"]')?.textContent).toBe('A');
  });

  it('follows the table with one row per pass drawn dim, rise and end only', () => {
    const { container } = render(detail({ passes: [pass, other] }));
    expect(legendEntries(container)).toEqual([['B', 'other']]);
    const row = container.querySelector('[data-testid="chart-legend"] button[data-pass-id="other"]');
    expect(row?.querySelector('[data-color]')).toHaveAttribute('data-color', 'pass-dim');
    expect(row?.textContent).toContain(other.name);
    // The dim row times the arc's ends; the explained pass's peak is a line of the table.
    const times = row?.textContent ?? '';
    expect(times).toContain(formatClock(other.start.t, null, 'en'));
    expect(times).toContain(formatClock(other.end.t, null, 'en'));
    expect(times).not.toContain(formatClock(other.peak.t, null, 'en'));
  });

  it('keeps the Sun and the Moon to one line each under the rows (FR-DOME-6 as amended)', () => {
    const { container } = render(detail());
    const bodies = [...container.querySelectorAll('[data-testid="chart-legend"] [data-body]')];
    expect(bodies.map((line) => line.getAttribute('data-body'))).toEqual(['sun', 'moon']);
    expect(bodies[0]?.textContent).toContain('Sun');
    expect(bodies[1]?.textContent).toContain('Moon');
  });

  it("names a boundary crossed in Earth's shadow in the table rather than repeating it (D-257)", () => {
    const shadowed = { ...pass, endReason: 'shadow' as const };
    const { container } = render(
      <SkyChart
        passes={[shadowed]}
        observer={observer}
        highlightedPassId={shadowed.id}
        legendLead={(row) => <PassNumbers pass={shadowed} timeZone={null} legendKey={row.key} colorToken={row.colorToken} />}
      />,
    );
    const rows = [...container.querySelectorAll('[data-testid="legend-lead"] tbody tr')];
    expect(rows.map((row) => row.getAttribute('data-point'))).toEqual(['start', 'peak', 'shadow']);
    expect(rows[2]?.querySelector('th')?.textContent).toBe('Enters shadow');
    expect(rows.filter((row) => row.querySelector('th')?.textContent === 'End')).toHaveLength(0);
  });
});
