/**
 * TASKS R13 (FR-GUIDE-2b, FR-GUIDE-4): the rise / peak / end markers sit at
 * `toPolar` of the pass points in both conventions; the toggle flips east
 * between left and right, changes the convention label and persists the
 * choice in `wiys:prefs:v1`; shadow boundaries and the current position get
 * their own markers; the other passes are drawn dim.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../../../tests/support/moonFixtures';
import { toPolar } from '../../../../../lib/skyGeometry';
import type { ChartOrientation, Observer, PassPoint } from '../../../../../model';
import { appStore } from '../../../../../state';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, MOON_PHASE_GLYPH } from '../bodies';
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

  it('moves the live marker and grows the flown arc as the instant advances (FR-DOME-5)', () => {
    const early = pass.start.t + 20_000;
    const later = early + 10_000;
    const { container, rerender } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={early} />);
    const first = markerAt(container, 'now');
    const flownAt = (): string => container.querySelector('[data-marker="flown"]')?.getAttribute('d') ?? '';
    const shortArc = flownAt();
    expect(shortArc).not.toBe('');

    rerender(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={later} />);
    const second = markerAt(container, 'now');
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(0);
    // The flown path is the arc up to the marker, so it lengthens with it…
    expect(flownAt().length).toBeGreaterThan(shortArc.length);
    expect(flownAt().startsWith(shortArc.slice(0, 12))).toBe(true);

    // …and there is none of it before the pass starts.
    rerender(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={pass.start.t - 1000} />);
    expect(container.querySelector('[data-marker="flown"]')).toBeNull();
  });

  it('draws the Sun on the horizon and the Moon where it is, neither captioned (FR-DOME-6 as amended), and neither when there is nothing to draw', () => {
    const sun = { t: MOON_FIXTURE.t, azDeg: 285, altDeg: -8 };
    const props = { passes: [pass], observer, highlightedPassId: pass.id };
    const { container, rerender } = render(<SkyPolar {...props} sun={sun} moon={MOON_FIXTURE} />);

    // The glow sits at the Sun's azimuth, near the horizon: its band's midpoint
    // is further from the zenith than the 60° ring is.
    const glow = container.querySelector('[data-body="sun"] path');
    const start = /M(-?[\d.]+) (-?[\d.]+)/.exec(glow?.getAttribute('d') ?? '');
    if (!start) throw new Error('no glow path');
    expect(Math.hypot(Number(start[1]), Number(start[2]))).toBeGreaterThan(HORIZON_R / 2);
    // R45: the names and the phase glyph are legend lines; the drawing carries the glow and the disc only.
    expect(container.querySelector('[data-anchor="sun"]')).toBeNull();
    expect(container.querySelector('[data-anchor="moon"]')).toBeNull();
    expect(container.querySelector('svg')?.textContent).not.toMatch(/Sun|Moon/);
    expect(container.querySelector('svg')?.textContent).not.toContain(MOON_PHASE_GLYPH.waningGibbous);

    expectAt(markerAt(container, 'moon'), expected({ ...MOON_FIXTURE, rangeKm: 0 }, 'looking-up'));

    rerender(<SkyPolar {...props} sun={{ ...sun, altDeg: -30 }} moon={MOON_DOWN} />);
    expect(container.querySelector('[data-body="sun"]')).toBeNull();
    expect(container.querySelector('[data-body="moon"]')).toBeNull();

    rerender(<SkyPolar {...props} />);
    expect(container.querySelector('[data-body="sun"]')).toBeNull();
    expect(container.querySelector('[data-body="moon"]')).toBeNull();
  });

  it('keeps the glow a surface under the grid (F-3)', () => {
    const sun = { t: MOON_FIXTURE.t, azDeg: 285, altDeg: -8 };
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} />);
    const horizon = container.querySelector('circle');
    const glow = container.querySelector('[data-body="sun"] path');
    if (!horizon || !glow) throw new Error('no horizon ring or glow');
    expect(horizon.compareDocumentPosition(glow) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  /** FR-LEG-1 (R45): the key at the peak is the arc's one label and the one element carrying the pass id is its group. */
  it('draws the legend key once at the peak and no name or time; without keys, no label at all', () => {
    const { container, unmount } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} legendKeys={{ [pass.id]: 'A' }} />);
    const key = container.querySelector('[data-anchor="key"]');
    expect(key?.textContent).toBe('A');
    expect(key).toHaveAttribute('data-key', 'A');
    expect(key?.closest('[data-pass-id]')).toHaveAttribute('data-pass-id', pass.id);
    expect(container.querySelectorAll('[data-anchor="key"]')).toHaveLength(1);
    expect(container.querySelector('[data-anchor="pass"]')).toBeNull();
    expect(container.querySelector('[data-anchor="peak"]')).toBeNull();
    expect(container.querySelector('svg')?.textContent).not.toContain('ISS');
    // The key sits beside the peak marker: within a label gap of it.
    const x = Number(key?.getAttribute('x'));
    const y = Number(key?.getAttribute('y'));
    const peak = markerAt(container, 'peak');
    expect(Math.hypot(x - peak.x, y - peak.y)).toBeLessThan(20);
    unmount();
    const bare = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(bare.container.querySelector('[data-anchor="key"]')).toBeNull();
  });

  /** FR-TRAJ-1 / D-189 (R45): the same pass in its other states. */
  it('draws a pass in its arc state: live as the cut track with the marker and no arrow, ahead dotted with the rise marked, linger thin with nothing marked, hidden not at all', () => {
    const keys = { [pass.id]: 'A' };
    const props = { observer, highlightedPassId: null, legendKeys: keys };
    const { container, rerender } = render(<SkyPolar {...props} passes={[{ ...pass, arc: 'live' }]} now={pass.start.t + 20_000} />);
    const group = () => container.querySelector(`[data-pass-id="${pass.id}"]`);
    expect(group()).toHaveAttribute('data-arc', 'live');
    expect(group()?.querySelector('[data-marker="live"]')).not.toBeNull();
    expect(group()?.querySelector('[data-marker="now"]')).not.toBeNull();
    expect(group()?.querySelector('[data-marker="rise"]')).not.toBeNull();
    expect(group()?.querySelector('[data-marker="peak"]')).toBeNull(); // not reached yet
    expect(group()?.querySelector('[data-marker="arrow"]')).toBeNull();
    expect(group()?.querySelector('[data-marker="flown"]')).toBeNull();
    expect(group()?.querySelector('[data-anchor="key"]')?.textContent).toBe('A');
    const shortCut = group()?.querySelector('[data-marker="live"]')?.getAttribute('d') ?? '';

    rerender(<SkyPolar {...props} passes={[{ ...pass, arc: 'live' }]} now={pass.peak.t + 1000} />);
    expect(group()?.querySelector('[data-marker="peak"]')).not.toBeNull();
    expect((group()?.querySelector('[data-marker="live"]')?.getAttribute('d') ?? '').length).toBeGreaterThan(shortCut.length);

    rerender(<SkyPolar {...props} passes={[{ ...pass, arc: 'ahead' }]} now={pass.start.t - 60_000} />);
    expect(group()).toHaveAttribute('data-arc', 'ahead');
    expect(group()?.querySelector('[data-marker="ahead"]')).not.toBeNull();
    expect(group()?.querySelector('[data-marker="rise"]')).not.toBeNull();
    expect(group()?.querySelector('[data-marker="now"]')).toBeNull();
    expect(group()?.querySelector('[data-marker="peak"]')).toBeNull();
    expect(group()?.querySelector('[data-anchor="key"]')?.textContent).toBe('A');

    rerender(<SkyPolar {...props} passes={[{ ...pass, arc: 'linger' }]} now={pass.end.t + 60_000} />);
    expect(group()).toHaveAttribute('data-arc', 'linger');
    expect(group()?.querySelector('[data-marker="linger"]')).not.toBeNull();
    expect(group()?.querySelectorAll('[data-marker]')).toHaveLength(1);

    rerender(<SkyPolar {...props} passes={[{ ...pass, arc: 'hidden' }]} now={pass.end.t + 3_600_000} />);
    expect(group()).toBeNull();
    expect(container.querySelector('[data-anchor="key"]')).toBeNull();

    // The stylesheet gives the two faint states their weight and pattern, without opacity (FR-X-5).
    const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/polar/SkyPolar.module.css'), 'utf8');
    expect(css).toMatch(/\.ahead \.track \{[^}]*stroke-dasharray/);
    expect(css).toMatch(/\.linger \.track \{[^}]*stroke-width: 1;/);
    expect(css).not.toMatch(/opacity: 0\.[0-9]+;\n\}\n\n\.(ahead|linger)/);
  });

  // -3 and -5 are altitudes where `d += step` used to drift past halfWidth and drop the last sample.
  it.each([-8, -3, -5])('samples the glow all the way to ±halfWidth around the Sun, not short by up to half a fixed step (F-4), at %d°', (altDeg) => {
    const sun = { t: MOON_FIXTURE.t, azDeg: 200, altDeg };
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} />);
    const glow = container.querySelector('[data-body="sun"] path');
    const d = glow?.getAttribute('d') ?? '';
    const points = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
    if (points.length < 2) throw new Error('no glow points');
    const strength = glowStrength(sun.altDeg);
    const halfWidth = glowHalfWidthDeg(strength);
    const height = glowHeightDeg(strength);
    const left = expected({ t: sun.t, azDeg: sun.azDeg - halfWidth, elDeg: height / 2, rangeKm: 0 }, 'looking-up');
    const right = expected({ t: sun.t, azDeg: sun.azDeg + halfWidth, elDeg: height / 2, rangeKm: 0 }, 'looking-up');
    expectAt(points[0] ?? { x: NaN, y: NaN }, left);
    expectAt(points[points.length - 1] ?? { x: NaN, y: NaN }, right);
  });

  it('draws the hidden objects dimmed where they are, each with its legend key and not its words, and none by default (FR-LIVE-6 as amended)', () => {
    const hidden = [
      { id: 'hidden-1', azDeg: 40, elDeg: 20, label: 'Cosmos 2369 · in shadow' },
      { id: 'hidden-2', azDeg: 200, elDeg: 5, label: 'Envisat · too faint' },
    ];
    const props = { passes: [pass], observer, highlightedPassId: null, legendKeys: { [pass.id]: 'A', 'hidden-1': 'B', 'hidden-2': 'C' } };
    const { container, rerender } = render(<SkyPolar {...props} hidden={hidden} />);
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(2);
    const first = container.querySelector('[data-hidden-id="hidden-1"]');
    expect(first?.querySelector('[data-anchor="key"]')?.textContent).toBe('B');
    expect(first?.textContent).not.toContain('Cosmos');
    expect(first?.querySelector('circle')?.getAttribute('class')).toMatch(/hidden/);
    expectAt(markerAt(container, 'hidden'), expected({ azDeg: 40, elDeg: 20, rangeKm: 0, t: 0 }, 'looking-up'));
    rerender(<SkyPolar {...props} />);
    expect(container.querySelectorAll('[data-marker="hidden"]')).toHaveLength(0);
  });

  it('draws the same story as the dome at the same instant, as the committed SVG', async () => {
    // The polar counterpart of the dome's raster snapshots (PLAN §9.1): the
    // golden pass halfway through, the Sun eight degrees under the horizon and
    // the Moon up, reviewed in the PR and regenerated deliberately. Class
    // names are dropped — they are the stylesheet's business, and this
    // snapshot is about the geometry.
    const now = Math.round((pass.start.t + pass.end.t) / 2);
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} now={now} sun={{ t: now, azDeg: 285, altDeg: -8 }} moon={MOON_FIXTURE} legendKeys={{ [pass.id]: 'A' }} />);
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('no drawing');
    const markup = svg.outerHTML.replace(/ class="[^"]*"/g, '').replace(/></g, '>\n<');
    await expect(markup).toMatchFileSnapshot('./__snapshots__/SkyPolar.live.svg');
  });

  /** FR-LIVE-2 (R32, D-158): the live page's colouring, one series per pass in pass order. */
  it('numbers every arc by its place in the passes with colorBy="pass", cycling after six, with no dim arc and one key each', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...pass, id: `p${String(i)}`, start: { ...pass.start, t: pass.start.t + i * 600_000 } }));
    const keys = Object.fromEntries(many.map((p, i) => [p.id, String.fromCharCode(65 + i)]));
    const { container, rerender } = render(<SkyPolar passes={many} observer={observer} highlightedPassId={null} colorBy="pass" legendKeys={keys} />);
    const series = [...container.querySelectorAll('[data-pass-id]')].map((el) => el.getAttribute('data-series'));
    expect(series).toEqual(['1', '2', '3', '4', '5', '6', '1']);
    expect(container.querySelectorAll('[data-dim]')).toHaveLength(0);
    expect([...container.querySelectorAll('[data-anchor="key"]')].map((el) => el.textContent)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    // FR-LEG-4: a highlight in series mode dims the others by weight, keeping every series colour.
    rerender(<SkyPolar passes={many} observer={observer} highlightedPassId="p2" colorBy="pass" legendKeys={keys} />);
    expect(container.querySelectorAll('[data-dim="true"]')).toHaveLength(6);
    expect(container.querySelector('[data-pass-id="p2"]')).not.toHaveAttribute('data-dim');
    expect(container.querySelector('[data-pass-id="p2"]')).toHaveAttribute('data-series', '3');
    // The stylesheet maps each number to its own token and nothing else.
    const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/polar/SkyPolar.module.css'), 'utf8');
    for (let n = 1; n <= 6; n++) expect(css).toContain(`.series[data-series='${String(n)}'] {\n  --series: var(--chart-series-${String(n)});`);
    expect(css).toMatch(/\.series\[data-dim='true'\] \.track/);
  });

  it('draws no series attribute in the guide reading, where the highlighted pass and the dim ones carry the colour', () => {
    const { container } = render(<SkyPolar passes={[pass]} observer={observer} highlightedPassId={pass.id} legendKeys={{ [pass.id]: 'A' }} />);
    expect(container.querySelector('[data-series]')).toBeNull();
    expect(container.querySelector('[data-anchor="key"]')).not.toBeNull();
  });

  it('takes every colour from the FR-DOME-2 chart tokens, so the night theme is a token swap (FR-THEME-3)', () => {
    // The stylesheet is a CSS module, so what the test can hold is the file:
    // no chart element may reach for a general foreground or accent colour.
    const css = readFileSync(join(process.cwd(), 'src/ui/components/guide/skychart/polar/SkyPolar.module.css'), 'utf8');
    const drawing = css.slice(css.indexOf('.horizon'), css.indexOf('.label {'));
    expect(drawing).not.toMatch(/var\(--(accent|warn|fg|fg-dim)\)/);
    for (const token of ['--chart-horizon', '--chart-rings', '--chart-compass', '--chart-pass', '--chart-pass-dim', '--chart-pass-flown', '--chart-peak', '--chart-shadow', '--chart-now', '--chart-sun', '--chart-moon']) {
      expect(drawing, token).toContain(`var(${token})`);
    }
  });
});
