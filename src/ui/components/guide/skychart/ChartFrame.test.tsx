/**
 * R62 (FR-FSC-1, FR-FSC-3, FR-LEG-2 as amended v1.3; D-322): the frame as a
 * screen. Everything the frame usually does is layout — rows above and below a
 * box, a column beside it, a square on the guide, an aspect-cut rectangle on
 * the wide live page — and a screen is the one shape that has none of it: the
 * drawing is the host, and the readout and the legend are drawn over it.
 *
 * jsdom lays nothing out, so "the box is the host's whole size" is asserted the
 * way the R61 frame tests assert the aspect-cut box: the host's rect is mocked,
 * and the two halves of the claim are checked apart. The DOM half — the frame
 * measures nothing and writes no size of its own, at 844 x 390 as at 390 x 844,
 * so nothing but its host can be deciding the box. The stylesheet half — the
 * frame fills its shell and the drawing is `inset: 0` inside it. The pixel
 * measurement in a real browser is R64's `follow-screen.spec.ts`, which holds
 * the layer's box to `innerWidth x innerHeight`.
 *
 * The frame without `screen` is `SkyChart.contract.test.tsx`'s `<ChartFrame>
 * placement` block, untouched by R62: the screen frame carries a class of its
 * own and no rule there can reach it.
 */
import { render, screen as rtl, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChartFrame } from './ChartFrame';

const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/ChartFrame.module.css'), 'utf8');
const rect = (width: number, height: number): DOMRect => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) });
const realGetRect = HTMLElement.prototype.getBoundingClientRect;

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = realGetRect;
  vi.unstubAllGlobals();
});

function screenFrame() {
  return render(
    <ChartFrame screen fill status={<p>Looking N (1°) · up 20°</p>} legend={<p>legend</p>} overlay={<button type="button">×</button>} aside={<p>rail</p>} stripe={<p>stripe</p>} boxAspect={2.4 / 2} stacked>
      <div data-drawing="window" />
    </ChartFrame>,
  );
}

describe('<ChartFrame> as a screen (FR-FSC-1, D-322)', () => {
  /**
   * Both orientations, because both are real: the follow screen is drawn
   * sideways (844 x 390) and R63's portrait state is drawn upright (390 x 844)
   * in the same frame. Neither writes a size, and no observer is even created —
   * the aspect fit and the compact floor are the two things that measure, and
   * `screen` turns both off, so the host is the only thing left to size the box.
   */
  it.each([
    ['sideways', 844, 390],
    ['upright', 390, 844],
  ])('measures nothing and writes no size of its own, %s at %i x %i', (_name, width, height) => {
    const observed: string[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          observed.push('constructed');
        }
        observe() {
          /* nothing to record beyond the construction */
        }
        disconnect() {
          /* nothing to detach */
        }
      },
    );
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return this.dataset['testid'] === 'chart-frame' ? rect(width, height) : realGetRect.call(this);
    };
    screenFrame();

    const frame = rtl.getByTestId('chart-frame');
    const box = rtl.getByTestId('chart-box');
    expect(frame).toHaveAttribute('data-screen', 'true');
    expect(observed).toEqual([]);
    for (const property of ['--chart-box-w', '--chart-box-h', '--chart-floor']) {
      expect(frame.style.getPropertyValue(property), property).toBe('');
    }
    expect(frame.getAttribute('style')).toBeNull();
    expect(box.getAttribute('style')).toBeNull();
    // The host is what it was mocked as, and the box has nothing of its own between it and that.
    expect(frame.getBoundingClientRect().width).toBe(width);
    expect(frame.getBoundingClientRect().height).toBe(height);
  });

  it('gives the box the host and nothing else in the stylesheet', () => {
    const block = /\.screen \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(block).toContain('position: relative;');
    expect(block).toContain('width: 100%;');
    expect(block).toContain('height: 100%;');
    const drawing = /\.screen \.drawing \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(drawing).toContain('position: absolute;');
    expect(drawing).toContain('inset: 0;');
    // The three the framed chart puts on the box and a screen must not inherit: the guide's square,
    // the 44-cell cap and the compact full-bleed margin (FR-COMP-5).
    expect(drawing).toContain('aspect-ratio: auto;');
    expect(drawing).toContain('max-width: none;');
    expect(drawing).toContain('margin: 0;');
  });

  /** FR-FSC-1: the box, then the readout, then the strip, then the page's own — and no rails at all. */
  it('holds the drawing, the status, the legend and the overlay in that order, and no aside or stripe', () => {
    screenFrame();
    const frame = rtl.getByTestId('chart-frame');
    expect([...frame.children].map((el) => el.getAttribute('data-testid'))).toEqual(['chart-box', 'chart-status', 'chart-legend-slot', 'chart-overlay']);
    expect(within(rtl.getByTestId('chart-overlay')).getByRole('button', { name: '×' })).toBeInTheDocument();
    expect(rtl.queryByTestId('chart-aside')).toBeNull();
    expect(rtl.queryByTestId('chart-stripe')).toBeNull();
    expect(rtl.queryByText('rail')).toBeNull();
    expect(rtl.queryByText('stripe')).toBeNull();
    // FR-FSC-1: a screen has no controls row. The slot is not rendered, so it cannot take a pixel from the drawing.
    expect(frame.querySelector('[class*="controls"]')).toBeNull();
  });

  /**
   * FR-FSC-3's second half: neither overlay is drawn where there is nothing in
   * it. R63's portrait state hands the frame `status={null}` and `legend={null}`
   * exactly so the "turn the phone" note is all there is over the box — an
   * empty slot would still carry the overlay surface.
   */
  it('draws no empty overlay', () => {
    render(
      <ChartFrame screen status={null} legend={null}>
        <div data-drawing="window" />
      </ChartFrame>,
    );
    expect([...rtl.getByTestId('chart-frame').children].map((el) => el.getAttribute('data-testid'))).toEqual(['chart-box']);
  });

  /** FR-FSC-3, FR-LEG-2 as amended: the readout in the top-left corner, the legend two rows along the bottom edge, both on the overlay surface. */
  it('places the two overlays on the follow surface, the strip capped at two legend rows and scrolling inside', () => {
    const frame = /\.screen \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(frame).toContain('--screen-overlay: color-mix(in srgb, var(--bg-raised) var(--screen-overlay-alpha), transparent);');
    expect(frame).toContain('--legend-row: var(--tap);');
    const status = /\.screen \.status \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(status).toContain('position: absolute;');
    expect(status).toContain('top: 0;');
    expect(status).toContain('left: 0;');
    expect(status).toContain('background: var(--screen-overlay);');
    const legend = /\.screen \.legend \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(legend).toContain('bottom: 0;');
    expect(legend).toContain('max-height: calc(2 * var(--legend-row));');
    expect(legend).toContain('overflow-y: auto;');
    expect(legend).toContain('background: var(--screen-overlay);');
    // The layer over both is not itself a target, or the strip under it would stop taking taps (FR-LEG-4).
    expect(/\.screen \.overlay \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '').toContain('pointer-events: none;');
    expect(css).toContain('.screen .overlay > * {\n  pointer-events: auto;\n}');
  });
});
