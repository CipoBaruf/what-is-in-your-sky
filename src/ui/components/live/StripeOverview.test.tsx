/**
 * R70 (FR-SPAN-2, US-24 AC2, D-383): the overview row in jsdom, at its default
 * width of 600 px (nothing has a layout here). The whole span in one row — the
 * night, one mark per pass in its arc's colour, the cursor and the bracket
 * around the chunk the stripe draws — and its own slider: a click or a drag
 * sets the instant to what is under the pointer, the arrow keys step a quarter
 * hour and the page keys a chunk.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { I18nProvider } from '../../../i18n/useT';
import { chunkFor, CHUNK_MS, HOUR_MS, xAt, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { Pass } from '../../../model';
import { DEFAULT_WIDTH, StripeOverview } from './StripeOverview';

const pass = goldenPassFixture();
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
const passes = [at('a', HOUR_MS, 10 * 60_000), at('b', 6 * HOUR_MS, 10 * 60_000)];
const bands: SkyBand[] = [
  { from: START, to: START + 8 * HOUR_MS, sky: 'day' },
  { from: START + 8 * HOUR_MS, to: START + 9 * HOUR_MS, sky: 'bright-twilight' },
  { from: START + 9 * HOUR_MS, to: START + 19 * HOUR_MS, sky: 'dark' },
  { from: START + 19 * HOUR_MS, to: span.end, sky: 'day' },
];

const mount = (t: number, onScrub = vi.fn()) => {
  const utils = render(<StripeOverview span={span} passes={passes} bands={bands} t={t} timeZone={ZONE} onScrub={onScrub} />);
  return { ...utils, onScrub, overview: screen.getByTestId('stripe-overview') };
};

describe('<StripeOverview>', () => {
  it('carries the whole span in one row: the night, a mark per pass in its arc colour, and the cursor at the instant', async () => {
    const t = START + 6 * HOUR_MS;
    const { container, overview } = mount(t);
    expect(overview).toHaveAttribute('role', 'slider');
    expect(overview).toHaveAttribute('aria-label', 'Night overview');
    expect(overview).toHaveAttribute('aria-valuemin', String(span.start));
    expect(overview).toHaveAttribute('aria-valuemax', String(span.end));
    expect(overview).toHaveAttribute('aria-valuenow', String(t));
    // FR-SPAN-2: the value text is the clock time under the cursor, in the observer's zone.
    expect(overview).toHaveAttribute('aria-valuetext', '12:30:00 GMT-3');
    expect([...container.querySelectorAll('[data-sky]')].map((el) => el.getAttribute('data-sky'))).toEqual(['bright-twilight', 'dark']);
    expect(container.querySelector('[data-sky="dark"]')).toHaveAttribute('width', String((10 / 24) * DEFAULT_WIDTH) + '.0');
    // One mark per pass — both of them, unlike the stripe, which only draws the chunk — in the series its arc carries.
    expect([...container.querySelectorAll('[data-pass-mark]')].map((el) => [el.getAttribute('data-pass-mark'), el.getAttribute('data-series')])).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
    expect(Number(screen.getByTestId('overview-cursor').getAttribute('data-x'))).toBeCloseTo((6 / 24) * DEFAULT_WIDTH, 0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('brackets exactly the chunk the stripe draws, and moves the bracket with the instant (FR-SPAN-2)', () => {
    const t = START + 6 * HOUR_MS;
    const { overview, rerender } = mount(t);
    const chunk = chunkFor(t, span, ZONE);
    expect([overview.getAttribute('data-chunk-start'), overview.getAttribute('data-chunk-end')]).toEqual([String(chunk.start), String(chunk.end)]);
    const bracket = screen.getByTestId('overview-bracket');
    expect(Number(bracket.getAttribute('data-x'))).toBeCloseTo(xAt(chunk.start, span, DEFAULT_WIDTH), 1);
    expect(Number(bracket.getAttribute('data-width'))).toBeCloseTo(xAt(chunk.end, span, DEFAULT_WIDTH) - xAt(chunk.start, span, DEFAULT_WIDTH), 1);
    // A chunk on: the bracket is a chunk further along, and it is still `chunkFor`'s answer and not a stored one.
    rerender(<StripeOverview span={span} passes={passes} bands={bands} t={t + CHUNK_MS} timeZone={ZONE} onScrub={vi.fn()} />);
    const moved = chunkFor(t + CHUNK_MS, span, ZONE);
    expect(moved.start).toBe(chunk.end);
    expect(Number(screen.getByTestId('overview-bracket').getAttribute('data-x'))).toBeCloseTo(xAt(moved.start, span, DEFAULT_WIDTH), 1);
    // The first chunk is clipped to the span's start, and the bracket with it.
    rerender(<StripeOverview span={span} passes={passes} bands={bands} t={START} timeZone={ZONE} onScrub={vi.fn()} />);
    expect(Number(screen.getByTestId('overview-bracket').getAttribute('data-x'))).toBe(0);
  });

  it('covers the whole row where the stripe draws the whole span, and gives the bracket back on pausing (FR-SPAN-6)', () => {
    const t = START + 6 * HOUR_MS;
    const { overview, rerender } = mount(t);
    const chunk = chunkFor(t, span, ZONE);
    // 60× keeps the chunk: a chunk lasts four minutes of wall time there, well over `CHUNK_MIN_WALL_S`.
    rerender(<StripeOverview span={span} passes={passes} bands={bands} t={t} timeZone={ZONE} speed={60} onScrub={vi.fn()} />);
    expect(overview.getAttribute('data-chunk-start')).toBe(String(chunk.start));
    // 3600×, where the stripe draws the whole 24 h: the bracket covers all of it rather than four hours of it.
    rerender(<StripeOverview span={span} passes={passes} bands={bands} t={t} timeZone={ZONE} speed={3600} onScrub={vi.fn()} />);
    expect([overview.getAttribute('data-chunk-start'), overview.getAttribute('data-chunk-end')]).toEqual([String(span.start), String(span.end)]);
    const wide = screen.getByTestId('overview-bracket');
    expect(Number(wide.getAttribute('data-x'))).toBe(0);
    expect(Number(wide.getAttribute('data-width'))).toBeCloseTo(DEFAULT_WIDTH, 1);
    // Pausing is `speed = null`, and the chunk comes back — nothing here was stored (D-385).
    rerender(<StripeOverview span={span} passes={passes} bands={bands} t={t} timeZone={ZONE} speed={null} onScrub={vi.fn()} />);
    expect(overview.getAttribute('data-chunk-start')).toBe(String(chunk.start));
  });

  it('sets the instant to what is under the pointer on a click and follows a drag (US-24 AC2)', () => {
    const { overview, onScrub } = mount(START);
    fireEvent.pointerDown(overview, { button: 0, clientX: 150, pointerId: 1 });
    // A quarter of the way across 24 h: two minutes a pixel, which is what an overview is for.
    expect(onScrub).toHaveBeenLastCalledWith(START + 6 * HOUR_MS);
    expect(overview).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerMove(overview, { clientX: 300, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(START + 12 * HOUR_MS);
    fireEvent.pointerMove(overview, { clientX: 900, pointerId: 1 });
    expect(onScrub).toHaveBeenLastCalledWith(span.end);
    fireEvent.pointerUp(overview, { pointerId: 1 });
    expect(overview).toHaveAttribute('data-dragging', 'false');
    fireEvent.pointerMove(overview, { clientX: 30, pointerId: 1 });
    expect(onScrub).toHaveBeenCalledTimes(3);
    fireEvent.pointerDown(overview, { button: 2, clientX: 300, pointerId: 1 });
    expect(onScrub).toHaveBeenCalledTimes(3);
    // The press takes focus, so the keys below go to the row and not the page (F-39).
    fireEvent.pointerDown(overview, { button: 0, clientX: 150, pointerId: 1 });
    expect(document.activeElement).toBe(overview);
  });

  it('steps a quarter hour on the arrows and one chunk on the page keys, clamped (FR-SPAN-2)', () => {
    const t = START + 6 * HOUR_MS;
    const { overview, onScrub } = mount(t);
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(onScrub).toHaveBeenLastCalledWith(t + 15 * 60_000);
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(onScrub).toHaveBeenLastCalledWith(t - 15 * 60_000);
    fireEvent.keyDown(overview, { key: 'PageUp' });
    expect(onScrub).toHaveBeenLastCalledWith(t + CHUNK_MS);
    fireEvent.keyDown(overview, { key: 'PageDown' });
    expect(onScrub).toHaveBeenLastCalledWith(t - CHUNK_MS);
    fireEvent.keyDown(overview, { key: 'Escape' });
    expect(onScrub).toHaveBeenCalledTimes(4);
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <StripeOverview span={span} passes={passes} bands={bands} t={START} timeZone={ZONE} onScrub={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('slider', { name: 'Vista de la noche' })).toBeInTheDocument();
  });
});
