/**
 * R74 (FR-MARK-5, FR-MARK-8 c): what the mark does over time.
 *
 * Four things, all of them about the bead: it advances a frame a second while
 * it is running, it stands still when the thing it was reporting on is done, it
 * stands still for a reader who asked for less motion, and the body's text is
 * written at mount and never again — which is what makes a step one small text
 * update instead of a re-rasterised drawing (D-439).
 *
 * Fake timers with `act`, not `user-event`: nothing here is driven by input,
 * and `user-event` never resolves under `vi.useFakeTimers()`.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { Mark } from './Mark';
import { MARK_FRAME_MS, MARK_HEADER_PX, MARK_ORBIT_FRAMES } from './tiers';

let media: MatchMediaStub;

const beadLayer = (): HTMLElement => screen.getByTestId('mark').querySelector<HTMLElement>('[data-mark-layer="bead"]') as HTMLElement;
const bodyLayer = (): HTMLElement => screen.getByTestId('mark').querySelector<HTMLElement>('[data-mark-layer="body"]') as HTMLElement;
const frame = (): string => beadLayer().dataset['markFrame'] ?? '';

/** One second of the orbit, inside `act` so React commits the state the interval set. */
const tick = (seconds: number): void => {
  act(() => {
    vi.advanceTimersByTime(seconds * MARK_FRAME_MS);
  });
};

beforeEach(() => {
  media = stubMatchMedia(COMPACT_PX);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  media.restore();
});

describe('<Mark>', () => {
  it('advances the bead a frame a second while it runs, and wraps at the end of the orbit', () => {
    render(<Mark tier="header32" sizePx={MARK_HEADER_PX} running />);
    expect(frame()).toBe('0');
    const first = beadLayer().textContent;

    tick(1);
    expect(frame()).toBe('1');

    // A quarter of the orbit later the bead is drawn somewhere else. Not after
    // one step: a step is six degrees, and on a six-cell grid the bead spends
    // several of them in the cell it is already in — which is why the frame
    // index, not the text, is what a step is measured by.
    tick(MARK_ORBIT_FRAMES / 4 - 1);
    expect(frame()).toBe(String(MARK_ORBIT_FRAMES / 4));
    expect(beadLayer().textContent).not.toBe(first);

    tick(MARK_ORBIT_FRAMES - MARK_ORBIT_FRAMES / 4);
    expect(frame()).toBe('0');
    expect(beadLayer().textContent).toBe(first);
  });

  it('stands still when there is nothing left to wait for (FR-MARK-5 a: the passes slice is done)', () => {
    const { rerender } = render(<Mark tier="header32" sizePx={MARK_HEADER_PX} running />);
    tick(3);
    expect(frame()).toBe('3');

    rerender(<Mark tier="header32" sizePx={MARK_HEADER_PX} running={false} />);
    tick(10);
    expect(frame()).toBe('3');
  });

  it('does not move the bead for a reader who asked for less motion', () => {
    media.setReducedMotion(true);
    render(<Mark tier="hero" sizePx={120} running />);
    const still = beadLayer().textContent;
    tick(30);
    expect(frame()).toBe('0');
    expect(beadLayer().textContent).toBe(still);
  });

  it('writes the body once and never again', () => {
    render(<Mark tier="hero" sizePx={120} running />);
    const body = bodyLayer();
    const text = body.firstChild;
    const drawing = body.textContent;
    expect(drawing).not.toBe('');

    tick(5);
    // The same text node object, not merely the same string: a body that were
    // re-rendered each step would replace it.
    expect(bodyLayer().firstChild).toBe(text);
    expect(bodyLayer().textContent).toBe(drawing);
  });

  it('is a square box at the size it is given, and out of the accessibility tree', () => {
    render(<Mark tier="header32" sizePx={MARK_HEADER_PX} />);
    const mark = screen.getByTestId('mark');
    expect(mark.style.width).toBe('24px');
    expect(mark.style.height).toBe('24px');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    // FR-MARK-3: the body is dim and the bead is the bright one; the two are
    // separate layers so only one of them ever changes.
    expect(bodyLayer().className).not.toBe(beadLayer().className);
  });

  it('holds the bead in the held tone without moving it (FR-MARK-5 c)', () => {
    render(<Mark tier="header32" sizePx={MARK_HEADER_PX} tone="warn" />);
    const held = beadLayer().textContent;
    tick(5);
    expect(beadLayer().textContent).toBe(held);
    expect(beadLayer().className).toMatch(/warn/);
  });
});
