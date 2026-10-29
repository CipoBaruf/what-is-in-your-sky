/**
 * R142 (FR-TONIGHT-3, D-900, PLAN §9.9): the time track in jsdom, at its
 * default width of 390 px (nothing has a layout here). Against a fixed run —
 * a day, an hour of bright twilight, ten hours of dark, the day again, and
 * three passes — the bands, the ticks and the thumb; a drag, a tick tap (the
 * nearest of two close ticks) and the keys, each asserting the instant asked
 * for; the slider's ARIA values; the label row in both languages.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { I18nProvider } from '../../../i18n/useT';
import { TRACK_HEIGHT_PX } from '../../../lib/layout';
import { HOUR_MS, MINUTE_MS, timeAt, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { DEFAULT_WIDTH, TAP_SLOP_PX, TICK_MIN_PX, TICK_ZONE_PX, tickAt, TimeTrack, trackKeyStep, trackLabels, trackTicks } from './TimeTrack';

const pass = goldenPassFixture();
// 06:30 in Salta (GMT−3, no DST), so the span's hours are local hours plus a half.
const START = Date.UTC(2026, 8, 11, 9, 30, 0);
const span: Span = { start: START, end: START + 24 * HOUR_MS };
const ZONE = 'America/Argentina/Salta';
const at = (id: string, fromMs: number, durationMs: number): Pass => ({
  ...pass,
  id,
  start: { ...pass.start, t: START + fromMs },
  peak: { ...pass.peak, t: START + fromMs + durationMs / 2 },
  end: { ...pass.end, t: START + fromMs + durationMs },
});
// `a` and `b` are ten-minute passes; `c` is a two-minute one a quarter hour after `b`, so the two ticks' zones overlap.
const passes = [at('a', HOUR_MS, 10 * MINUTE_MS), at('b', 6 * HOUR_MS, 10 * MINUTE_MS), at('c', 6 * HOUR_MS + 15 * MINUTE_MS, 2 * MINUTE_MS)];
const bands: SkyBand[] = [
  { from: START, to: START + 8 * HOUR_MS, sky: 'day' },
  { from: START + 8 * HOUR_MS, to: START + 9 * HOUR_MS, sky: 'bright-twilight' },
  { from: START + 9 * HOUR_MS, to: START + 19 * HOUR_MS, sky: 'dark' },
  { from: START + 19 * HOUR_MS, to: span.end, sky: 'day' },
];
const px = (ms: number): number => (ms / (24 * HOUR_MS)) * DEFAULT_WIDTH;

const mount = (t: number, onSeek = vi.fn()) => {
  const utils = render(<TimeTrack span={span} bands={bands} passes={passes} t={t} onSeek={onSeek} timeZone={ZONE} valueText="12:30 · in 6 h" />);
  return { ...utils, onSeek, bar: screen.getByTestId('time-track-bar') };
};

describe('<TimeTrack>', () => {
  it('draws the sky states, a tick per pass in its arc colour and the thumb at the instant, against a fixed run', async () => {
    const t = START + 6 * HOUR_MS;
    const { container, bar } = mount(t);
    expect(bar).toHaveAttribute('height', String(TRACK_HEIGHT_PX));
    expect(bar).toHaveAttribute('viewBox', `0 0 ${String(DEFAULT_WIDTH)} ${String(TRACK_HEIGHT_PX)}`);
    // Day is the bar's own fill; the twilight and the dark are drawn over it, at the span's share of the width.
    const sky = [...container.querySelectorAll('[data-sky]')];
    expect(sky.map((el) => el.getAttribute('data-sky'))).toEqual(['bright-twilight', 'dark']);
    expect(Number(sky[0]?.getAttribute('x'))).toBeCloseTo(px(8 * HOUR_MS), 1);
    expect(Number(sky[1]?.getAttribute('width'))).toBeCloseTo(px(10 * HOUR_MS), 1);
    expect(sky.every((el) => el.getAttribute('height') === `${String(TRACK_HEIGHT_PX)}.0`)).toBe(true);
    // One tick per pass, in the series its arc carries, and never under `TICK_MIN_PX` however short the pass.
    const ticks = [...container.querySelectorAll('[data-pass-tick]')];
    expect(ticks.map((el) => [el.getAttribute('data-pass-tick'), el.getAttribute('data-series')])).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);
    expect(Number(ticks[0]?.getAttribute('x'))).toBeCloseTo(px(HOUR_MS), 0);
    expect(px(10 * MINUTE_MS)).toBeLessThan(TICK_MIN_PX);
    expect(ticks.map((el) => Number(el.getAttribute('width')))).toEqual([TICK_MIN_PX, TICK_MIN_PX, TICK_MIN_PX]);
    // The thumb is a full-height bar centred on the instant: 6 h of 24 in 390 px is 97.5.
    const thumb = screen.getByTestId('time-track-thumb');
    expect(Number(thumb.getAttribute('x')) + Number(thumb.getAttribute('width')) / 2).toBeCloseTo(97.5, 1);
    expect(thumb).toHaveAttribute('height', `${String(TRACK_HEIGHT_PX)}.0`);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the thumb inside the bar at both ends of the span', () => {
    const { rerender } = mount(START);
    expect(Number(screen.getByTestId('time-track-thumb').getAttribute('x'))).toBe(0);
    rerender(<TimeTrack span={span} bands={bands} passes={passes} t={span.end} onSeek={vi.fn()} timeZone={ZONE} valueText="" />);
    const thumb = screen.getByTestId('time-track-thumb');
    expect(Number(thumb.getAttribute('x')) + Number(thumb.getAttribute('width'))).toBeCloseTo(DEFAULT_WIDTH, 1);
  });

  it('is a slider whose value is the instant in epoch ms and whose text is the page’s headline string', () => {
    const t = START + 6 * HOUR_MS;
    const { bar } = mount(t);
    expect(screen.getByRole('slider', { name: 'Time track' })).toBe(bar);
    expect(bar).toHaveAttribute('aria-valuemin', String(span.start));
    expect(bar).toHaveAttribute('aria-valuemax', String(span.end));
    expect(bar).toHaveAttribute('aria-valuenow', String(t));
    expect(bar).toHaveAttribute('aria-valuetext', '12:30 · in 6 h');
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('moves the instant under the finger on a press off the ticks and through a drag, and stops on release', () => {
    const { bar, onSeek } = mount(START);
    // 195 px is halfway: 12 h in, nowhere near a tick.
    fireEvent.pointerDown(bar, { button: 0, clientX: 195, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(START + 12 * HOUR_MS, { lead: false });
    expect(bar).toHaveAttribute('data-dragging', 'true');
    // The press takes focus, so the keys go to the track (F-39).
    expect(document.activeElement).toBe(bar);
    fireEvent.pointerMove(bar, { clientX: 292.5, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(START + 18 * HOUR_MS, { lead: false });
    // A drag over a tick is still a drag: it names the instant under the finger, not the pass.
    fireEvent.pointerMove(bar, { clientX: 98, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(timeAt(98, span, DEFAULT_WIDTH), { lead: false });
    // Past either edge the instant is the edge's.
    fireEvent.pointerMove(bar, { clientX: 900, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(span.end, { lead: false });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    expect(bar).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerMove(bar, { clientX: 30, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(4);
    // Not the primary button: nothing.
    fireEvent.pointerDown(bar, { button: 2, clientX: 195, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(4);
  });

  it('asks for a tapped pass’s lead instant, the nearest of two close ticks winning (FR-TONIGHT-3)', () => {
    const b = passes[1] as Pass;
    const c = passes[2] as Pass;
    const { bar, onSeek } = mount(START);
    const centreB = px(6 * HOUR_MS) + TICK_MIN_PX / 2;
    const centreC = px(6 * HOUR_MS + 15 * MINUTE_MS) + TICK_MIN_PX / 2;
    // The two zones overlap: a point between the centres, nearer `c`, is `c`'s; nearer `b`, `b`'s.
    expect(centreC - centreB).toBeLessThan(TICK_ZONE_PX);
    fireEvent.pointerDown(bar, { button: 0, clientX: centreC - 1, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(c.start.t, { lead: true });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    fireEvent.pointerDown(bar, { button: 0, clientX: centreB + 1, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(b.start.t, { lead: true });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    // The zone reaches half of `TICK_ZONE_PX` either side of the centre, and no further.
    fireEvent.pointerDown(bar, { button: 0, clientX: centreB - TICK_ZONE_PX / 2 + 1, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(b.start.t, { lead: true });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    const outside = centreB - TICK_ZONE_PX / 2 - 1;
    fireEvent.pointerDown(bar, { button: 0, clientX: outside, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(timeAt(outside, span, DEFAULT_WIDTH), { lead: false });
    fireEvent.pointerUp(bar, { pointerId: 1 });
  });

  it('holds a tick tap through a finger’s jitter and turns it into a drag past the slop', () => {
    const c = passes[2] as Pass;
    const { bar, onSeek } = mount(START);
    const centreC = px(6 * HOUR_MS + 15 * MINUTE_MS) + TICK_MIN_PX / 2;
    fireEvent.pointerDown(bar, { button: 0, clientX: centreC, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: centreC + TAP_SLOP_PX - 1, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenLastCalledWith(c.start.t, { lead: true });
    fireEvent.pointerMove(bar, { clientX: centreC + 40, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(timeAt(centreC + 40, span, DEFAULT_WIDTH), { lead: false });
    // Once a drag, back inside the slop is still a drag.
    fireEvent.pointerMove(bar, { clientX: centreC, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(timeAt(centreC, span, DEFAULT_WIDTH), { lead: false });
    fireEvent.pointerUp(bar, { pointerId: 1 });
  });

  it('steps a quarter hour on the arrows and an hour on the page keys, clamped to the span', () => {
    const t = START + 6 * HOUR_MS;
    const { bar, onSeek } = mount(t);
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(t + 15 * MINUTE_MS, { lead: false });
    fireEvent.keyDown(bar, { key: 'ArrowUp' });
    expect(onSeek).toHaveBeenLastCalledWith(t + 15 * MINUTE_MS, { lead: false });
    fireEvent.keyDown(bar, { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenLastCalledWith(t - 15 * MINUTE_MS, { lead: false });
    fireEvent.keyDown(bar, { key: 'ArrowDown' });
    expect(onSeek).toHaveBeenLastCalledWith(t - 15 * MINUTE_MS, { lead: false });
    fireEvent.keyDown(bar, { key: 'PageUp' });
    expect(onSeek).toHaveBeenLastCalledWith(t + HOUR_MS, { lead: false });
    fireEvent.keyDown(bar, { key: 'PageDown' });
    expect(onSeek).toHaveBeenLastCalledWith(t - HOUR_MS, { lead: false });
    fireEvent.keyDown(bar, { key: 'Escape' });
    expect(onSeek).toHaveBeenCalledTimes(6);
    expect(trackKeyStep(START, 'ArrowLeft', span)).toBe(START);
    expect(trackKeyStep(span.end - MINUTE_MS, 'PageUp', span)).toBe(span.end);
  });

  it('labels the ends and every third local hour from midnight, dropping an hour that would meet an end', () => {
    mount(START);
    const row = screen.getByTestId('time-track-labels');
    expect(row.firstElementChild).toHaveTextContent('now');
    expect(row.lastElementChild).toHaveTextContent('+24 h');
    // 06:30 to 06:30: 09 sits 2.5 h in, 41 px, into `now`'s room, and 03 into `+24 h`'s; 06 is past it.
    expect([...row.querySelectorAll('[data-label]')].map((el) => el.textContent)).toEqual(['12', '15', '18', '21', '00']);
    const noon = row.querySelector('[data-label="12"]') as HTMLElement;
    expect(noon.style.left).toBe(`${((5.5 / 24) * 100).toFixed(1)}%`);
    // Wider, the two edge hours come back.
    expect(trackLabels(span, 1280, ZONE, { now: 'now', end: '+24 h' }).map((label) => label.text)).toEqual(['09', '12', '15', '18', '21', '00', '03']);
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <TimeTrack span={span} bands={bands} passes={passes} t={START} onSeek={vi.fn()} timeZone={ZONE} valueText="06:30 ahora" />
      </I18nProvider>,
    );
    expect(screen.getByRole('slider', { name: 'Línea de tiempo' })).toHaveAttribute('aria-valuetext', '06:30 ahora');
    const row = screen.getByTestId('time-track-labels');
    expect(row.firstElementChild).toHaveTextContent('ahora');
    expect(row.lastElementChild).toHaveTextContent('+24 h');
  });
});

describe('tickAt', () => {
  const ticks = trackTicks(passes, span, DEFAULT_WIDTH);
  it('finds the nearest tick centre within its zone, and nothing outside every zone', () => {
    const centre = (i: number): number => (ticks[i]?.x ?? 0) + TICK_MIN_PX / 2;
    expect(tickAt(centre(0), ticks)?.passId).toBe('a');
    expect(tickAt(centre(0) + TICK_ZONE_PX / 2 - 0.5, ticks)?.passId).toBe('a');
    expect(tickAt(centre(0) + TICK_ZONE_PX / 2 + 0.5, ticks)).toBeNull();
    const between = (centre(1) + centre(2)) / 2;
    expect(tickAt(between - 0.5, ticks)?.passId).toBe('b');
    expect(tickAt(between + 0.5, ticks)?.passId).toBe('c');
    expect(tickAt(DEFAULT_WIDTH - 5, ticks)).toBeNull();
  });
});
