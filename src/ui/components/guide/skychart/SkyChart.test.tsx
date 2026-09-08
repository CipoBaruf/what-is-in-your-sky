/**
 * R62 (FR-FSC-3, FR-FSC-6, FR-WIN-4 and FR-WIN-5 as amended v1.3; D-322,
 * D-324): the two things a page may now say to the chart.
 *
 * `views` is the list of views the page offers. The live page offers the dome
 * and the polar chart, so "Window" is not in its control and the window is
 * reached there by the follow control alone (FR-FSC-6); the pass detail passes
 * nothing and is unchanged by construction. A `window` saved on that device is
 * *drawn* as the dome — `viewFor` already falls back for a view that is not
 * offered — and left where it is in the preference, which is the amendment's
 * one hard rule: nothing on the path calls `setChartView`, so the phone that
 * saved it still opens the pass detail on the window.
 *
 * `screen` is the follow screen. The chart is the window whatever `chartView`
 * says, with no caption, no toggle and no controls: the frame it mounts is the
 * screen frame, whose overlays `ChartFrame.test.tsx` covers.
 *
 * The three views' shared contract — the same geometry, the same legend, the
 * same anchors — is `SkyChart.contract.test.tsx`, which R62 leaves alone.
 */
import { render, screen as rtl, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { formatClock } from '../../../../lib/timeFormat';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { offeredViews, SKY_CHART_VIEWS, SkyChart } from './SkyChart';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

/** D-175: a phone to point — the constructor and a touch screen — so the presence test passes. */
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

const savedChartView = (): unknown => (JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}') as { chartView?: unknown }).chartView;

function options(): string[] {
  return within(rtl.getByRole('group', { name: 'Chart view' }))
    .getAllByRole('button')
    .map((button) => button.textContent ?? '');
}

afterEach(() => {
  withoutPhone();
  appStore.setState(initial, true);
  window.localStorage.clear();
});

describe('the views a page offers (FR-FSC-6, D-324)', () => {
  it('keeps the registered order and drops what the page does not list', () => {
    withPhone();
    expect(offeredViews().map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
    expect(offeredViews(new Set(), ['dome', 'polar']).map((view) => view.id)).toEqual(['polar', 'dome']);
    // The page lists ids, not an order: naming the dome first does not put it first in the control.
    expect(offeredViews(new Set(), ['window', 'dome', 'polar']).map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
    // A view lost for the session goes whether or not the page offers it (FR-WIN-4's relative-only phone).
    expect(offeredViews(new Set(['polar']), ['dome', 'polar']).map((view) => view.id)).toEqual(['dome']);
  });

  it('offers the live page two views on a phone, with no "Window" in the control', () => {
    withPhone();
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} views={['dome', 'polar']} />);
    expect(options()).toEqual(['Polar', 'Dome']);
  });

  /** FR-WIN-4, FR-WIN-5 as amended: drawn as the dome, kept as `window` — the pass detail on this phone still opens on it. */
  it('draws a saved window as the dome where the page does not offer it, and writes nothing', () => {
    withPhone();
    appStore.getState().setChartView('window');
    expect(savedChartView()).toBe('window');

    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} views={['dome', 'polar']} />);
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    expect(options()).toEqual(['Polar', 'Dome']);
    expect(appStore.getState().savedChartView).toBe('window');
    expect(appStore.getState().chartView).toBe('window');
    expect(savedChartView()).toBe('window');
  });

  /** The pass detail's case: no `views`, so all three where the presence test passes — R47's behaviour, unchanged. */
  it('offers every registered view to a page that names none', () => {
    withPhone();
    appStore.getState().setChartView('window');
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'window');
    expect(options()).toEqual(['Polar', 'Dome', 'Window']);
    expect(SKY_CHART_VIEWS.map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
  });
});

describe('the chart as a screen (FR-FSC-1, FR-FSC-3, D-322)', () => {
  /**
   * `viewFor` is not consulted, so neither the saved preference nor the
   * presence test decides anything: the page asked for the screen, and the
   * screen is the window. Nothing is written on the way either — the follow
   * screen is not a view the reader picked (FR-WIN-5 as amended v1.2).
   */
  it('is the window whatever the preference says, with no caption, no toggle and no controls', async () => {
    appStore.getState().setChartView('polar');
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} screen />);

    const figure = rtl.getByRole('figure');
    expect(figure).toHaveAttribute('data-view', 'window');
    expect(figure).toHaveAttribute('data-screen', 'true');
    expect(figure.querySelector('figcaption')).toBeNull();
    expect(rtl.queryByRole('group', { name: 'Chart view' })).toBeNull();
    expect(rtl.queryByTestId('guide-sentence')).toBeNull();
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    // Nor in the frame's controls row, where `fill` would otherwise have put the toggle (D-269).
    expect(rtl.queryByRole('group', { name: 'Chart view' })).toBeNull();
    expect(appStore.getState().savedChartView).toBe('polar');
    expect(savedChartView()).toBe('polar');
  });

  /**
   * FR-FSC-3, FR-LEG-2 as amended v1.3: the strip's rows are FR-LEG-3's short
   * form, so a row is one line and the two rows the strip is allowed are two
   * lines of text. The peak is what goes — on a screen the picture is the peak.
   */
  it('gives the legend the short rows a two-row strip can hold', async () => {
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} screen />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    const clock = (ms: number): string => formatClock(ms, observer.timeZone, 'en');
    const list = rtl.getByTestId('chart-legend');
    expect(list).toHaveAttribute('data-screen', 'true');
    const row = within(list).getByRole('button', { name: /./ });
    expect(row.textContent).toContain(clock(pass.start.t));
    expect(row.textContent).toContain(clock(pass.end.t));
    expect(row.textContent).not.toContain(clock(pass.peak.t));

    // The same chart off a screen keeps the three times FR-LEG-3 asks for elsewhere.
    const plain = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    const plainList = within(plain.container).getByTestId('chart-legend');
    expect(plainList).toHaveAttribute('data-screen', 'false');
    expect(within(plainList).getByRole('button', { name: /./ }).textContent).toContain(clock(pass.peak.t));
  });

  /** The rails belong to the live page's box, and a screen has no box to hang them off (D-322). */
  it('drops an aside and a stripe the page hands it anyway', async () => {
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} screen aside={<p>rail</p>} stripe={<p>stripe</p>} />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    expect(rtl.queryByTestId('chart-stripe')).toBeNull();
    expect(rtl.queryByTestId('chart-aside')).toBeNull();
    expect(rtl.queryByText('rail')).toBeNull();
    expect(rtl.queryByText('stripe')).toBeNull();
  });
});
