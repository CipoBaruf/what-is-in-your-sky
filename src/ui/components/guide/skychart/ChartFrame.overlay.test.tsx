/**
 * R78 (FR-WATCH-6; D-448, D-449): the bar over the bottom of the drawing, and
 * the measurement the page places it by. The bar is a child of the box and not
 * a row of the frame — the frame's own children are what they were — so the box
 * cannot resize when it appears; the real pixels are `live-states.spec.ts`'s.
 */
import { act, render, screen as rtl, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia } from '../../../../../tests/support/matchMedia';
import { ChartFrame, ChartFrameSlots } from './ChartFrame';

const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/ChartFrame.module.css'), 'utf8');
const rect = (width: number, height: number): DOMRect => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) });
const realGetRect = HTMLElement.prototype.getBoundingClientRect;
const realGetComputedStyle = window.getComputedStyle;

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = realGetRect;
  window.getComputedStyle = realGetComputedStyle;
  vi.unstubAllGlobals();
});

const rows = (): (string | null)[] => [...rtl.getByTestId('chart-frame').children].map((el) => el.getAttribute('data-testid'));

describe('<ChartFrame> bottomOverlay and onBoxSpace (FR-WATCH-6, D-449)', () => {
  it('renders the bar inside the box, not as a row of the frame, from the prop or from the context of the page', () => {
    const bare = render(
      <ChartFrame fill legend={<p>legend</p>}>
        <div data-drawing="dome" />
      </ChartFrame>,
    );
    const without = rows();
    expect(rtl.getByTestId('chart-frame')).toHaveAttribute('data-bottom-overlay', 'false');
    expect(rtl.queryByTestId('chart-bottom-overlay')).toBeNull();
    bare.unmount();

    const withProp = render(
      <ChartFrame fill legend={<p>legend</p>} bottomOverlay={<p>bar</p>}>
        <div data-drawing="dome" />
      </ChartFrame>,
    );
    expect(rows()).toEqual(without);
    expect(rtl.getByTestId('chart-frame')).toHaveAttribute('data-bottom-overlay', 'true');
    expect(within(rtl.getByTestId('chart-box')).getByTestId('chart-bottom-overlay')).toHaveTextContent('bar');
    withProp.unmount();

    render(
      <ChartFrameSlots.Provider value={{ bottomOverlay: <p>from the page</p> }}>
        <ChartFrame fill legend={<p>legend</p>}>
          <div data-drawing="dome" />
        </ChartFrame>
      </ChartFrameSlots.Provider>,
    );
    expect(rows()).toEqual(without);
    expect(within(rtl.getByTestId('chart-box')).getByTestId('chart-bottom-overlay')).toHaveTextContent('from the page');
  });

  it('does not place a bar on a screen, whose bottom edge is the gutter', () => {
    render(
      <ChartFrame screen fill bottomOverlay={<p>bar</p>} gutter={<p>gutter</p>}>
        <div data-drawing="window" />
      </ChartFrame>,
    );
    expect(rtl.queryByTestId('chart-bottom-overlay')).toBeNull();
    expect(rtl.queryByText('bar')).toBeNull();
  });

  it('reports the height the box has with nothing under it — the frame less its controls row and the gap — once per change', () => {
    const rects = new Map<string, DOMRect>();
    const media = stubMatchMedia(1200, 450);
    const instances: { trigger: () => void }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: () => void) {
          instances.push(this);
        }
        observe() {
          /* triggered by hand */
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
      return rects.get(this.dataset['testid'] ?? this.className) ?? realGetRect.call(this);
    };
    const gaps = (rowGap: string): void => {
      window.getComputedStyle = ((el: Element) => ({ ...realGetComputedStyle(el), rowGap, columnGap: '29px' })) as typeof window.getComputedStyle;
    };
    gaps('6px');
    const spaces: number[] = [];
    try {
      render(
        <ChartFrame fill legend={<p>legend</p>} aside={<p>rail</p>} stripe={<p>block</p>} boxAspect={2.4 / 2} onBoxSpace={(px) => spaces.push(px)}>
          <div />
        </ChartFrame>,
      );
      const frame = rtl.getByTestId('chart-frame');
      const controlsClass = frame.children[1]?.className ?? '';
      rects.set('chart-frame', rect(1160, 384));
      rects.set('chart-stripe', rect(400, 210));
      rects.set(controlsClass, rect(400, 48));
      const trigger = (): void => {
        act(() => {
          for (const instance of instances) instance.trigger();
        });
      };
      trigger();
      // 384 − 48 − 6: the stripe row under the box is not counted, so the answer is the same in both states…
      expect(spaces.at(-1)).toBe(330);
      // …while the box itself is what the block leaves it (D-314).
      expect(frame.style.getPropertyValue('--chart-box-h')).toBe(`${String(330 - 216)}px`);
      const said = spaces.length;
      trigger();
      expect(spaces).toHaveLength(said);
      // Folded: the controls row is one text row and the gap the compact token.
      rects.set('chart-frame', rect(1160, 404));
      rects.set(controlsClass, rect(400, 24));
      gaps('4px');
      trigger();
      expect(spaces.at(-1)).toBe(376);
    } finally {
      media.restore();
    }
  });

  it('draws the bar over the bottom edge on the screen surface, out of the flow and at most half the box', () => {
    const bar = /\n\.bottomOverlay \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(bar).toContain('--screen-overlay: color-mix(in srgb, var(--bg-raised) var(--screen-overlay-alpha), transparent);');
    expect(bar).toContain('background: var(--screen-overlay);');
    expect(bar).toContain('position: absolute;');
    expect(bar).toContain('bottom: 0;');
    expect(bar).toContain('max-height: 50%;');
    expect(css).toContain(".frame[data-bottom-overlay='true'] .drawing {\n  position: relative;\n}");
  });
});
