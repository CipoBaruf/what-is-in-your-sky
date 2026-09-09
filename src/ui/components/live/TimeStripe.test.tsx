/**
 * R33 (FR-LIVE-4, US-15 AC3): the stripe in jsdom, at its default width of
 * 600 px (nothing has a layout here): the hour ticks, the night bands, the
 * pass segments in their series and the cursor with its clock; a pointer
 * press, a drag and the arrow keys each name an instant, clamped to the span.
 */
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { chunkFor, CHUNK_MS, HOUR_MS, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { DEFAULT_WIDTH, STRIPE_HEIGHT, TimeStripe } from './TimeStripe';

/**
 * R39 (F-38): the geometry calls are counted, so a rerender at a new instant —
 * a frame of playback — can be held to recomputing none of them.
 */
const calls = vi.hoisted(() => ({ hourTicks: 0, nightBands: 0, passSegments: 0 }));
vi.mock('../../../lib/timeStripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/timeStripe')>();
  return {
    ...actual,
    hourTicks: (...args: Parameters<typeof actual.hourTicks>) => {
      calls.hourTicks++;
      return actual.hourTicks(...args);
    },
    nightBands: (...args: Parameters<typeof actual.nightBands>) => {
      calls.nightBands++;
      return actual.nightBands(...args);
    },
    passSegments: (...args: Parameters<typeof actual.passSegments>) => {
      calls.passSegments++;
      return actual.passSegments(...args);
    },
  };
});

const pass = goldenPassFixture();
const START = Date.UTC(2026, 8, 11, 9, 30, 0);
const span: Span = { start: START, end: START + 24 * HOUR_MS };
const at = (id: string, fromMs: number, durationMs: number): Pass => ({
  ...pass,
  id,
  start: { ...pass.start, t: START + fromMs },
  peak: { ...pass.peak, t: START + fromMs + durationMs / 2 },
  end: { ...pass.end, t: START + fromMs + durationMs },
});
const passes = [at('a', HOUR_MS, 10 * 60_000), at('b', 6 * HOUR_MS, 10 * 60_000)];
const bands: SkyBand[] = [
  { from: START, to: START + 8 * HOUR_MS, sky: 'day' },
  { from: START + 8 * HOUR_MS, to: START + 9 * HOUR_MS, sky: 'bright-twilight' },
  { from: START + 9 * HOUR_MS, to: START + 19 * HOUR_MS, sky: 'dark' },
  { from: START + 19 * HOUR_MS, to: span.end, sky: 'day' },
];

/** R70 (FR-SPAN-1): the chunk the tests below are drawn in — 12:00–16:00 on the Neuquén clock, which holds 12:35. */
const chunk = chunkFor(START + 6 * HOUR_MS + 5 * 60_000, span, 'America/Argentina/Salta');

const mount = (t: number, onScrub = vi.fn()) => {
  const utils = render(<TimeStripe span={span} passes={passes} bands={bands} t={t} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
  return { ...utils, onScrub, stripe: screen.getByTestId('time-stripe') };
};

describe('<TimeStripe>', () => {
  it('is a slider over the span whose value text is the clock, with the ticks, the bands, the segments and the cursor drawn', async () => {
    const t = START + 6 * HOUR_MS + 5 * 60_000;
    const { container, stripe } = mount(t);
    expect(stripe).toHaveAttribute('role', 'slider');
    expect(stripe).toHaveAttribute('aria-valuemin', String(span.start));
    expect(stripe).toHaveAttribute('aria-valuemax', String(span.end));
    expect(stripe).toHaveAttribute('aria-valuenow', String(t));
    expect(stripe).toHaveAttribute('aria-valuetext', '12:35:00 GMT-3');
    expect(stripe).toHaveAttribute('aria-label', 'Time stripe: four hours of the coming 24');
    // R48 (FR-TRAJ-4): three rows — the labels, the band with its ticks, the segments — and the cursor across all of them.
    expect(stripe).toHaveAttribute('data-rows', '3');
    expect(['labels', 'band', 'segments'].map((row) => container.querySelector(`[data-row="${row}"]`) !== null)).toEqual([true, true, true]);
    /*
     * R70 (FR-SPAN-1): the window drawn is the four hours of the Neuquén clock that hold the instant — 12:35
     * local is the 12:00–16:00 chunk — and not the 24 h span. At `DEFAULT_WIDTH` (62 cells, over the 32 a
     * chunk's half hours want) the cadence is every 30 min, so there are nine ticks and every one is labelled.
     */
    expect([stripe.getAttribute('data-drawn-start'), stripe.getAttribute('data-drawn-end')]).toEqual([String(chunk.start), String(chunk.end)]);
    expect(chunk.end - chunk.start).toBe(CHUNK_MS);
    expect(container.querySelectorAll('[data-row="band"] [data-tick]')).toHaveLength(9);
    expect([...container.querySelectorAll('[data-row="band"] [data-tick]')].every((el) => el.getAttribute('data-labelled') === 'true')).toBe(true);
    // The hour on the hour and the minutes at the half hour; the two at the edges spill past them and are dropped (`keepLabels`).
    expect([...container.querySelectorAll('[data-row="labels"] text')].map((el) => el.textContent)).toEqual(['30', '13', '30', '14', '30', '15', '30']);
    // The night bands clipped to the chunk: the twilight's last hour and the first half hour of the dark, an eighth of the window.
    expect([...container.querySelectorAll('[data-sky]')].map((el) => el.getAttribute('data-sky'))).toEqual(['bright-twilight', 'dark']);
    expect(container.querySelector('[data-sky="dark"]')).toHaveAttribute('width', String((0.5 / 4) * DEFAULT_WIDTH) + '.0');
    expect(container.querySelector('[data-sky="dark"]')).toHaveAttribute('height', '24.0');
    // The pass inside the chunk is drawn and the one outside it is not; the series is still its arc's.
    const segments = [...container.querySelectorAll('[data-pass-segment]')];
    expect(segments.map((el) => [el.getAttribute('data-pass-segment'), el.getAttribute('data-series'), el.getAttribute('data-current')])).toEqual([['b', '2', 'true']]);
    // The cursor is where the instant falls in the chunk — 12:35 is 35 minutes into a four-hour window — the full height of the three rows.
    const cursor = screen.getByTestId('stripe-cursor');
    expect(Number(cursor.getAttribute('data-x'))).toBeCloseTo((35 / 240) * DEFAULT_WIDTH, 0);
    expect(cursor.querySelector('line')).toHaveAttribute('y2', String(STRIPE_HEIGHT) + '.0');
    expect(cursor.querySelector('text')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * R70 (FR-SPAN-1, US-24 AC1): the drawn window follows the shown instant and nothing else — no prop, no
   * state, no memory — and at a phone's 360 px it is 40 s per pixel, which is the whole point of the chunk.
   */
  it('draws the chunk that holds the instant, moving with it and with nothing else (FR-SPAN-1)', () => {
    const onScrub = vi.fn();
    const view = render(<TimeStripe span={span} passes={passes} bands={bands} t={START} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    const drawn = (): Span => {
      const el = screen.getByTestId('time-stripe');
      return { start: Number(el.getAttribute('data-drawn-start')), end: Number(el.getAttribute('data-drawn-end')) };
    };
    // The first chunk is clipped to the span: 06:30 local is inside 04:00–08:00, and the span starts at 06:30.
    expect(drawn()).toEqual({ start: START, end: Date.UTC(2026, 8, 11, 11, 0, 0) });
    // An instant a chunk later is drawn in the next chunk, cut on the observer's whole clock hours.
    view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 4 * HOUR_MS} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    expect(drawn()).toEqual({ start: Date.UTC(2026, 8, 11, 11, 0, 0), end: Date.UTC(2026, 8, 11, 15, 0, 0) });
    // The same instant in another zone is another chunk: the cut is the observer's clock and not UTC's.
    view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 4 * HOUR_MS} timeZone="Asia/Kolkata" onScrub={onScrub} />);
    expect(drawn()).toEqual({ start: Date.UTC(2026, 8, 11, 10, 30, 0), end: Date.UTC(2026, 8, 11, 14, 30, 0) });
    // FR-SPAN-6: at 600× and 3600× the whole span is drawn again, and pausing gives the chunk back.
    view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 4 * HOUR_MS} timeZone="America/Argentina/Salta" speed={600} onScrub={onScrub} />);
    expect(drawn()).toEqual(span);
    view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 4 * HOUR_MS} timeZone="America/Argentina/Salta" speed={60} onScrub={onScrub} />);
    expect(drawn()).toEqual({ start: Date.UTC(2026, 8, 11, 11, 0, 0), end: Date.UTC(2026, 8, 11, 15, 0, 0) });
  });

  it('is 40 s per pixel on a phone: a press names the instant under the pointer in the chunk, and a drag follows it (US-24 AC1)', () => {
    const t = START + 6 * HOUR_MS + 5 * 60_000;
    const { stripe, onScrub } = mount(t);
    // `DEFAULT_WIDTH` is the measured width in jsdom; the chunk over it is 24 s a pixel, and 40 s at a phone's 360.
    expect((chunk.end - chunk.start) / 1000 / 360).toBe(40);
    fireEvent.pointerDown(stripe, { button: 0, clientX: 150, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(chunk.start + HOUR_MS);
    expect(stripe).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerMove(stripe, { clientX: 300, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(chunk.start + 2 * HOUR_MS);
    // Past the stripe's edge is the chunk's edge, which is where the next chunk begins (FR-LIVE-4's clamp).
    fireEvent.pointerMove(stripe, { clientX: 900, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(chunk.end);
    fireEvent.pointerUp(stripe, { pointerId: 1 });
    expect(stripe).toHaveAttribute('data-dragging', 'false');
    // Not dragging: a move names nothing.
    fireEvent.pointerMove(stripe, { clientX: 30, pointerId: 1 });
    expect(onScrub).toHaveBeenCalledTimes(3);
    fireEvent.pointerDown(stripe, { button: 0, clientX: -20, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(chunk.start);
    // A secondary button is not a scrub.
    fireEvent.pointerDown(stripe, { button: 2, clientX: 300, pointerId: 1 });
    expect(onScrub).toHaveBeenCalledTimes(4);
  });

  // R39 (F-39): `preventDefault()` on pointer-down suppressed the focus the press gives the stripe,
  // so after clicking or dragging it the arrow keys went to the page and the instant stood still.
  it('takes focus on a press and leaves the event alone, so the arrow keys step right after a drag (F-39)', () => {
    const { stripe, onScrub } = mount(START + HOUR_MS);
    const press = createEvent.pointerDown(stripe, { button: 0, clientX: 150, pointerId: 1 });
    fireEvent(stripe, press);
    expect(press.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(stripe);
    fireEvent.pointerUp(stripe, { pointerId: 1 });
    expect(document.activeElement).toBe(stripe);
    // The keys the focused stripe now receives are its own.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowRight' });
    expect(onScrub).toHaveBeenLastCalledWith(START + HOUR_MS + 60_000);
  });

  /*
   * R39 (F-38): at 3600× the instant moves on every frame; the ticks, the bands and the lanes do not.
   * R70 (FR-SPAN-5): the rule holds across a chunk boundary — the geometry is recomputed once when the
   * window changes, and not per frame on either side of it.
   */
  it('recomputes no geometry when only the shown instant moves, and once when it crosses a boundary (F-38, FR-SPAN-5)', () => {
    const onScrub = vi.fn();
    const inside = Date.UTC(2026, 8, 11, 14, 55, 0); // 11:55 local: the last five minutes of the 08:00–12:00 chunk.
    const view = render(<TimeStripe span={span} passes={passes} bands={bands} t={inside} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    const after = { ...calls };
    for (const step of [1, 2, 3]) {
      view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={inside + step * 60_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    }
    expect(calls).toEqual(after);
    // The instant still moves what follows it: the cursor and the current segment.
    view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 6 * HOUR_MS + 60_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    expect(screen.getByTestId('time-stripe').querySelector('[data-pass-segment="b"]')).toHaveAttribute('data-current', 'true');
    // Crossing 12:00 local draws the next chunk: one recompute each, whatever the frames it took to get there.
    const crossed = { hourTicks: calls.hourTicks, nightBands: calls.nightBands, passSegments: calls.passSegments };
    expect(crossed).toEqual({ hourTicks: after.hourTicks + 1, nightBands: after.nightBands + 1, passSegments: after.passSegments + 1 });
    for (const step of [1, 2, 3]) {
      view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 6 * HOUR_MS + (60 + step) * 60_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    }
    expect(calls).toEqual(crossed);
    // A new span — the 10 s tick, or a resize — is what else recomputes them, through the chunk it clips.
    const moved: Span = { start: START + 10_000, end: span.end + 10_000 };
    view.rerender(<TimeStripe span={moved} passes={passes} bands={bands} t={START + 10_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    expect(calls.hourTicks).toBe(crossed.hourTicks + 1);
    expect(calls.nightBands).toBe(crossed.nightBands + 1);
    expect(calls.passSegments).toBe(crossed.passSegments + 1);
  });

  it('the arrow keys move one minute, ten with Shift, a chunk on the page keys, clamped to the span; other keys are left to the page', () => {
    const t = START + 30_000;
    const { stripe, onScrub } = mount(t);
    fireEvent.keyDown(stripe, { key: 'ArrowRight' });
    expect(onScrub).toHaveBeenLastCalledWith(t + 60_000);
    fireEvent.keyDown(stripe, { key: 'ArrowRight', shiftKey: true });
    expect(onScrub).toHaveBeenLastCalledWith(t + 600_000);
    fireEvent.keyDown(stripe, { key: 'ArrowLeft', shiftKey: true });
    expect(onScrub).toHaveBeenLastCalledWith(START);
    fireEvent.keyDown(stripe, { key: 'ArrowLeft' });
    expect(onScrub).toHaveBeenLastCalledWith(START);
    // R70 (FR-LIVE-4 as amended v1.4): a page key is a chunk of shown time, which takes the drawing with it.
    fireEvent.keyDown(stripe, { key: 'PageUp' });
    expect(onScrub).toHaveBeenLastCalledWith(t + CHUNK_MS);
    fireEvent.keyDown(stripe, { key: 'PageDown' });
    expect(onScrub).toHaveBeenLastCalledWith(START);
    fireEvent.keyDown(stripe, { key: 'Escape' });
    expect(onScrub).toHaveBeenCalledTimes(6);
  });
});
