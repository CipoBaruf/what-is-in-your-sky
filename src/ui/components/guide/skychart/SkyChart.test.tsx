/**
 * R62 (FR-FSC-3, FR-FSC-6, FR-WIN-4 and FR-WIN-5 as amended v1.3; D-322,
 * D-324): the two things a page may now say to the chart.
 *
 * R66 (FR-FSC-6, FR-WIN-4/FR-WIN-5 as amended v1.3.1; V13-6, V13-8, D-350,
 * D-352) rewrites the first half: `views` is gone. Every page offers all three
 * views where the phone has them, and "Window" is a *mode* — the tap asks for
 * the permission, waits for one reading and opens the sky screen, while the
 * chart under it stays on the view the reader picked and nothing is written.
 *
 * `screen` is the sky screen. The chart is the window whatever `chartView`
 * says, with no caption, no toggle and no controls: the frame it mounts is the
 * screen frame, whose overlays `ChartFrame.test.tsx` covers.
 *
 * The three views' shared contract — the same geometry, the same legend, the
 * same anchors — is `SkyChart.contract.test.tsx`, which R62 leaves alone.
 */
import { act, fireEvent, render, screen as rtl, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../../tests/support/catalogFixtures';
import { stubMatchMedia } from '../../../../../tests/support/matchMedia';
import { formatClock } from '../../../../lib/timeFormat';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { resetOrientationAccess } from './window/orientationAccess';
import { offeredViews, SKY_CHART_VIEWS, SkyChart } from './SkyChart';

/** A reading on the window, on the event `useSkyScreen` listens to (the old follow control's helper). */
function reading(fields: { alpha?: number | null; absolute?: boolean }): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: null, absolute: false, ...fields }));
  });
}

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
  resetOrientationAccess();
  withoutPhone();
  appStore.setState(initial, true);
  window.localStorage.clear();
});

describe('the views the control offers (FR-FSC-6 as amended v1.3.1, D-350)', () => {
  it('keeps the registered order and drops only what this device has lost', () => {
    withPhone();
    expect(offeredViews().map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
    // FR-WIN-4's relative-only phone: the option goes for the session, and it is the only thing that removes one.
    expect(offeredViews(new Set(['window'])).map((view) => view.id)).toEqual(['polar', 'dome']);
    expect(offeredViews(new Set(['polar'])).map((view) => view.id)).toEqual(['dome', 'window']);
  });

  /** V13-6: the live page's two-option control is gone — every page offers all three where the phone has them. */
  it('offers all three on a phone, on any page', () => {
    withPhone();
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(options()).toEqual(['Polar', 'Dome', 'Window']);
    expect(SKY_CHART_VIEWS.map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
  });

  it('offers no window at all where the device has no orientation (a desktop)', () => {
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(options()).toEqual(['Polar', 'Dome']);
  });

  /**
   * FR-FSC-6, FR-WIN-5 as amended v1.3.1 (V13-6, V13-8, D-350, D-352): the
   * window's option is a mode, not a view. The tap opens the screen — through
   * the permission and the one reading `useSkyScreen` waits for — and the chart
   * stays on the view the reader picked, which is what the `×` comes back to.
   */
  it('opens the sky screen from the window option and writes nothing', () => {
    withPhone();
    appStore.getState().setChartView('polar');
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);

    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    // Armed, not open: the reading is what decides (F-42).
    expect(appStore.getState().skyScreen).toBe(false);
    reading({ alpha: 30, absolute: true });
    expect(appStore.getState().skyScreen).toBe(true);
    expect(appStore.getState().chartView).toBe('polar');
    expect(savedChartView()).toBe('polar');
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'polar');
  });

  /** FR-FOL-2: a phone whose readings carry no north opens nothing, says so beside the control, and loses the option. */
  it('shows the note and drops the option where the readings carry no north', () => {
    withPhone();
    appStore.getState().setChartView('dome');
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);

    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    reading({ alpha: 30, absolute: false });
    expect(appStore.getState().skyScreen).toBe(false);
    expect(rtl.getByTestId('chart-view-note')).toHaveTextContent('This phone gives no compass heading');
    expect(options()).toEqual(['Polar', 'Dome']);
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'dome');
  });

  /** FR-WIN-5 as amended v1.3.1: nothing on a page can be left showing the window — it is only ever the screen's. */
  it('never draws the window as a page view', () => {
    withPhone();
    appStore.getState().openSkyScreen();
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'dome');
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
    expect(appStore.getState().chartView).toBe('polar');
    expect(savedChartView()).toBe('polar');
  });

  /**
   * FR-FSC-3, FR-LEG-2 as amended v1.3: the strip's rows are FR-LEG-3's short
   * form, so a row is one line and the two rows the strip is allowed are two
   * lines of text. The peak is what goes — on a screen the picture is the peak.
   */
  it('gives the legend the short rows a two-row strip can hold', async () => {
    // R63 (FR-FSC-4, D-323): on a screen the window hands the frame no legend while the phone is upright,
    // so the strip is asked for on a landscape phone — jsdom's default query answers portrait.
    const media = stubMatchMedia(844, 390);
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} screen />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    media.restore();
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
