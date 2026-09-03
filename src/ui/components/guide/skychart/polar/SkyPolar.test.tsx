/**
 * TASKS R13 (FR-GUIDE-2b, FR-GUIDE-4): the rise / peak / end markers sit at
 * `toPolar` of the pass points in both conventions; the toggle flips east
 * between left and right, changes the convention label and persists the
 * choice in `wiys:prefs:v1`; shadow boundaries and the current position get
 * their own markers; the other passes are drawn dim.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { toPolar } from '../../../../../lib/skyGeometry';
import type { ChartOrientation, Observer, PassPoint } from '../../../../../model';
import { appStore } from '../../../../../state';
import { HORIZON_R, SkyPolar } from './SkyPolar';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

/** The (x, y) a marker's `translate(x y)` carries. */
function markerAt(container: HTMLElement, marker: string): { x: number; y: number } {
  const el = container.querySelector(`[data-marker="${marker}"]`);
  const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(el?.getAttribute('transform') ?? '');
  if (!m) throw new Error(`no ${marker} marker with a translate`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

const expected = (p: PassPoint, orientation: ChartOrientation): { x: number; y: number } => {
  const v = toPolar(p.azDeg, p.elDeg, orientation);
  return { x: v.x * HORIZON_R, y: v.y * HORIZON_R };
};

function expectAt(actual: { x: number; y: number }, wanted: { x: number; y: number }): void {
  expect(actual.x).toBeCloseTo(wanted.x, 1);
  expect(actual.y).toBeCloseTo(wanted.y, 1);
}

describe('<SkyPolar>', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it.each<ChartOrientation>(['looking-up', 'map'])('puts rise, peak and end at toPolar of the pass points (%s)', (orientation) => {
    appStore.getState().setChartOrientation(orientation);
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expectAt(markerAt(container, 'rise'), expected(pass.start, orientation));
    expectAt(markerAt(container, 'peak'), expected(pass.peak, orientation));
    expectAt(markerAt(container, 'end'), expected(pass.end, orientation));
    expect(container.querySelector('[data-marker="arrow"]')).not.toBeNull();
    expect(container.querySelector('[data-marker="now"]')).toBeNull();
    expect(container.querySelector('[data-ring="30"]')).toHaveAttribute('r', ((2 / 3) * HORIZON_R).toFixed(2));
    expect(container.querySelector('[data-ring="60"]')).toHaveAttribute('r', ((1 / 3) * HORIZON_R).toFixed(2));
  });

  it('defaults to looking up (east on the left); the toggle puts east on the right, relabels the convention and persists the choice', () => {
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const east = (): number => Number(container.querySelector('[data-anchor="E"]')?.getAttribute('x'));
    const west = (): number => Number(container.querySelector('[data-anchor="W"]')?.getAttribute('x'));
    const group = screen.getByRole('group', { name: 'Chart orientation' });
    expect(within(group).getByRole('button', { name: 'Looking up' })).toHaveAttribute('aria-pressed', 'true');
    expect(east()).toBeLessThan(0);
    expect(west()).toBeGreaterThan(0);
    expect(screen.getByTestId('chart-convention')).toHaveTextContent('Looking up: east on the left');
    expect(Number(container.querySelector('[data-anchor="N"]')?.getAttribute('y'))).toBeLessThan(0);

    fireEvent.click(within(group).getByRole('button', { name: 'Map' }));
    expect(within(group).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(east()).toBeGreaterThan(0);
    expect(west()).toBeLessThan(0);
    expect(screen.getByTestId('chart-convention')).toHaveTextContent('Map: east on the right');
    expectAt(markerAt(container, 'rise'), expected(pass.start, 'map'));
    expect(appStore.getState().chartOrientation).toBe('map');
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartOrientation: 'map' });

    fireEvent.click(within(group).getByRole('button', { name: 'Looking up' }));
    expect(east()).toBeLessThan(0);
    expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartOrientation: 'looking-up' });
  });

  it('marks a shadow boundary, the current position during the pass, and draws the other passes dim', () => {
    const shadowEnd = { ...pass, id: 'shadow', endReason: 'shadow' as const };
    const other = { ...pass, id: 'other', name: 'Tiangong' };
    const now = pass.start.t + 10_000;
    const { container } = render(<SkyPolar passes={[shadowEnd, other]} observer={observer} highlightedPassId="shadow" now={now} />);
    const shadow = container.querySelector('[data-pass-id="shadow"]');
    const dim = container.querySelector('[data-pass-id="other"]');
    expect(shadow?.querySelector('[data-marker="shadow"]')).not.toBeNull();
    expect(shadow?.querySelector('[data-marker="end"]')).toBeNull();
    expect(dim?.querySelector('[data-marker="end"]')).not.toBeNull();
    expect(dim?.getAttribute('class')).toMatch(/passDim/);
    expect(shadow?.getAttribute('class')).not.toMatch(/passDim/);
    const current = markerAt(container, 'now');
    const rise = expected(pass.start, 'looking-up');
    const peak = expected(pass.peak, 'looking-up');
    // Ten seconds in, the marker is between the rise and the peak.
    expect(Math.hypot(current.x - rise.x, current.y - rise.y)).toBeLessThan(Math.hypot(peak.x - rise.x, peak.y - rise.y));
    expect(Math.hypot(current.x - rise.x, current.y - rise.y)).toBeGreaterThan(0);
  });
});
