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
import { HOUR_MS, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { DEFAULT_WIDTH, TimeStripe } from './TimeStripe';

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
    expect(stripe).toHaveAttribute('aria-label', 'Time stripe: the coming 24 hours');
    // 24 whole hours of the Neuquén clock from 07:00; at 600 px every second is labelled (25 px per hour).
    expect(container.querySelectorAll('[data-tick]')).toHaveLength(24);
    expect(container.querySelector('[data-tick="7"] text')).toBeNull();
    expect(container.querySelector('[data-tick="8"] text')?.textContent).toBe('08');
    expect(container.querySelector('[data-tick="0"] text')?.textContent).toBe('00');
    // Two night bands; the day is the stripe's own background.
    expect([...container.querySelectorAll('[data-sky]')].map((el) => el.getAttribute('data-sky'))).toEqual(['bright-twilight', 'dark']);
    expect(container.querySelector('[data-sky="dark"]')).toHaveAttribute('width', String((10 / 24) * DEFAULT_WIDTH) + '.0');
    // One segment per pass in its series; the second contains the instant.
    const segments = [...container.querySelectorAll('[data-pass-segment]')];
    expect(segments.map((el) => [el.getAttribute('data-pass-segment'), el.getAttribute('data-series'), el.getAttribute('data-current')])).toEqual([
      ['a', '1', 'false'],
      ['b', '2', 'true'],
    ]);
    // The cursor at a quarter of the width, its clock in the zone.
    const cursor = screen.getByTestId('stripe-cursor');
    expect(Number(cursor.getAttribute('data-x'))).toBeCloseTo((6.0833 / 24) * DEFAULT_WIDTH, 0);
    expect(cursor.querySelector('text')?.textContent).toBe('12:35');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a press names the instant under the pointer, a drag follows it, and both clamp to the span (FR-LIVE-4)', () => {
    const { stripe, onScrub } = mount(START);
    fireEvent.pointerDown(stripe, { button: 0, clientX: 150, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(START + 6 * HOUR_MS);
    expect(stripe).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerMove(stripe, { clientX: 300, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(START + 12 * HOUR_MS);
    fireEvent.pointerMove(stripe, { clientX: 900, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(span.end);
    fireEvent.pointerUp(stripe, { pointerId: 1 });
    expect(stripe).toHaveAttribute('data-dragging', 'false');
    // Not dragging: a move names nothing.
    fireEvent.pointerMove(stripe, { clientX: 30, pointerId: 1 });
    expect(onScrub).toHaveBeenCalledTimes(3);
    fireEvent.pointerDown(stripe, { button: 0, clientX: -20, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(span.start);
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

  // R39 (F-38): at 3600× the instant moves on every frame; the ticks, the bands and the lanes do not.
  it('recomputes no geometry when only the shown instant moves (F-38)', () => {
    const onScrub = vi.fn();
    const view = render(<TimeStripe span={span} passes={passes} bands={bands} t={START} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    const after = { ...calls };
    for (const step of [1, 2, 3]) {
      view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + step * 60_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    }
    expect(calls).toEqual(after);
    // The instant still moves what follows it: the cursor and the current segment.
    view.rerender(<TimeStripe span={span} passes={passes} bands={bands} t={START + 6 * HOUR_MS + 60_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    expect(screen.getByTestId('time-stripe').querySelector('[data-pass-segment="b"]')).toHaveAttribute('data-current', 'true');
    // A new span — the 10 s tick, or a resize — is what recomputes them.
    const moved: Span = { start: START + 10_000, end: span.end + 10_000 };
    view.rerender(<TimeStripe span={moved} passes={passes} bands={bands} t={START + 10_000} timeZone="America/Argentina/Salta" onScrub={onScrub} />);
    expect(calls.hourTicks).toBe(after.hourTicks + 1);
    expect(calls.nightBands).toBe(after.nightBands + 1);
    expect(calls.passSegments).toBe(after.passSegments + 1);
  });

  it('the arrow keys move one minute, ten with Shift, clamped; other keys are left to the page', () => {
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
    fireEvent.keyDown(stripe, { key: 'Escape' });
    expect(onScrub).toHaveBeenCalledTimes(4);
  });
});
