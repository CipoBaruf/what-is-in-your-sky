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
import { stubResizeObserver } from '../../../../../tests/support/resizeObserver';
import { formatClock } from '../../../../lib/timeFormat';
import type { Observer } from '../../../../model';
import { appStore } from '../../../../state';
import { en } from '../../../../i18n/en';
import { MOON_FIXTURE } from '../../../../../tests/support/moonFixtures';
import { stubMatchMedia, WIDE_PX } from '../../../../../tests/support/matchMedia';
import { resetOrientationAccess } from './window/orientationAccess';
import { facePeak } from './window/camera';
import { WINDOW_FOV } from './window/projection';
import { offeredViews, SKY_CHART_VIEWS, SkyChart } from './SkyChart';
import { PEAK_FACING_OPTIONS } from './SkyChart.types';

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

describe('the views the control offers (FR-FSC-6 as amended v1.3.1, D-350; R121: FR-WIN-4 and FR-SKY-2 as amended v2.5, D-789)', () => {
  it('keeps the registered order, on every device, with nothing lost for the session', () => {
    expect(offeredViews().map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
    withPhone();
    expect(offeredViews().map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
    // FR-WIN-4 as amended v2.5: a relative-only phone loses the sensor, never the view.
    appStore.getState().dropWindowView('relative');
    expect(offeredViews().map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
  });

  /** V13-6: the live page's two-option control is gone — every page offers all three where the phone has them. */
  it('offers all three on a phone, on any page', () => {
    withPhone();
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(options()).toEqual(['Polar', 'Dome', 'Window']);
    expect(SKY_CHART_VIEWS.map((view) => view.id)).toEqual(['polar', 'dome', 'window']);
  });

  /**
   * R121 (FR-SKY-2, US-41 AC1): a desk reader is offered the window too. On compact without a sensor — a
   * phone-sized desk window, jsdom here — choosing it lays the window out in the box under the hand camera,
   * and the choice is the chart's own: nothing is written, so a reload opens on the saved view.
   */
  it('offers the window where the device has no orientation, lays it out in the box by hand on compact, and writes nothing', async () => {
    appStore.getState().setChartView('dome');
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(options()).toEqual(['Polar', 'Dome', 'Window']);
    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'window');
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    const w = container.querySelector('[data-look-az]');
    expect(w).toHaveAttribute('data-state', 'hand');
    expect(w).toHaveAttribute('data-in-box', 'true');
    // The hand's controls: the box takes the keys, the picker stands in the controls row (no rail here), the hint in the box.
    expect(rtl.getByTestId('window-facing')).toBeInTheDocument();
    expect(rtl.getByTestId('window-hand-hint')).toHaveTextContent(en.window.handHint);
    expect(rtl.queryByTestId('window-hold-up')).toBeNull();
    expect(appStore.getState().skyScreen).toBe(false);
    expect(appStore.getState().chartView).toBe('dome');
    expect(savedChartView()).toBe('dome');
    // On compact the frame is not window-shaped: the box the dome has, the readout in its row (D-789).
    expect(rtl.getByTestId('chart-frame')).toHaveAttribute('data-hand-window', 'true');
    expect(rtl.getByTestId('chart-frame')).toHaveAttribute('data-compact', 'true');
    // Back to the dome, and the window again: the facing is where it was left (the slot the chart keeps).
    const box = container.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(w).toHaveAttribute('data-look-az', '195');
    fireEvent.click(rtl.getByRole('button', { name: 'Dome' }));
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    expect(appStore.getState().chartView).toBe('dome');
    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    await waitFor(() => {
      expect(container.querySelector('[data-look-az]')).toHaveAttribute('data-look-az', '195');
    });
  });

  /** FR-WIN-5 as amended v2.5 (D-789): on wide the window is a view like the other two — saved, in the box, cut to the window's shape. */
  it('on wide saves the window as the view and lays it out in the window-shaped box, the picker in the controls row where there is no rail', async () => {
    const media = stubMatchMedia(WIDE_PX);
    try {
      appStore.getState().setChartView('dome');
      const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
      expect(appStore.getState().chartView).toBe('window');
      expect(savedChartView()).toBe('window');
      await waitFor(() => {
        expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
      });
      const frame = rtl.getByTestId('chart-frame');
      expect(frame).toHaveAttribute('data-hand-window', 'true');
      expect(frame).toHaveAttribute('data-compact', 'false');
      // The guide's square takes the browser window's shape as a ratio (jsdom's viewport is 1024 × 768).
      expect(frame.style.getPropertyValue('--chart-box-aspect')).toBe((1024 / 768).toFixed(4));
      // The readout in the box's corner, not in the status row under it.
      expect(within(rtl.getByTestId('chart-box')).getByTestId('window-readout')).toBeInTheDocument();
      expect(within(rtl.getByTestId('window-facing')).getByRole('group', { name: 'Facing' })).toBeInTheDocument();
      // No sensor here, so no way to the screen is offered.
      expect(rtl.queryByTestId('window-hold-up')).toBeNull();
      // The saved view opens the window straight away on a wide reload.
      fireEvent.click(rtl.getByRole('button', { name: 'Polar' }));
      expect(savedChartView()).toBe('polar');
    } finally {
      media.restore();
    }
  });

  /** FR-SKY-2: a tablet — wide, with a sensor — gets the box and, in its controls, `[ hold up to the sky ]`, which is `useSkyScreen.open()`. */
  it('on a wide device with a sensor offers [ hold up to the sky ] beside the picker, which opens the screen on the first reading', async () => {
    const media = stubMatchMedia(WIDE_PX);
    try {
      withPhone();
      appStore.getState().setChartView('window');
      const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
      await waitFor(() => {
        expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
      });
      expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'window');
      fireEvent.click(rtl.getByTestId('window-hold-up'));
      expect(appStore.getState().skyScreen).toBe(false);
      reading({ alpha: 30, absolute: true });
      expect(appStore.getState().skyScreen).toBe(true);
      expect(appStore.getState().chartView).toBe('window');
    } finally {
      media.restore();
    }
  });

  /** FR-SKY-7 (D-790): the pass detail's window opens on the peak and its picker offers `peak` first, pressed. */
  it('with the pass detail’s options opens facing the peak, offers peak first, and peak brings the hand back after up', async () => {
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} facingOptions={PEAK_FACING_OPTIONS} />);
    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    const w = container.querySelector('[data-look-az]');
    const aim = facePeak(pass.peak, WINDOW_FOV);
    expect(w).toHaveAttribute('data-look-az', String(Math.round(aim.azDeg)));
    expect(w).toHaveAttribute('data-look-alt', String(Math.round(aim.altDeg)));
    const picker = rtl.getByRole('group', { name: 'Facing' });
    expect(within(picker).getAllByRole('button').map((button) => button.textContent)).toEqual(['peak', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
    expect(within(picker).getByRole('button', { name: 'peak' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(picker).getByRole('button', { name: 'up' }));
    expect(w).toHaveAttribute('data-look-alt', '90');
    expect(within(picker).getByRole('button', { name: 'peak' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(picker).getByRole('button', { name: 'peak' }));
    expect(w).toHaveAttribute('data-look-alt', String(Math.round(aim.altDeg)));
    expect(within(picker).getByRole('button', { name: 'peak' })).toHaveAttribute('aria-pressed', 'true');
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

  /**
   * FR-FOL-2: a phone whose readings carry no north opens nothing and says so beside the control. R121 (FR-WIN-4
   * as amended v2.5): it keeps the option — the presence test governs the sensor alone — and the next tap, with no
   * sensor left to ask, lays the window out in the box under the hand (FR-SKY-2).
   */
  it('shows the note and keeps the option where the readings carry no north; the next tap is the box by hand', async () => {
    withPhone();
    appStore.getState().setChartView('dome');
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);

    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    reading({ alpha: 30, absolute: false });
    expect(appStore.getState().skyScreen).toBe(false);
    expect(rtl.getByTestId('chart-view-note')).toHaveTextContent('This device is not reporting which way it faces.');
    expect(options()).toEqual(['Polar', 'Dome', 'Window']);
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'dome');

    fireEvent.click(rtl.getByRole('button', { name: 'Window' }));
    expect(rtl.queryByTestId('chart-view-note')).toBeNull();
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'window');
    await waitFor(() => {
      expect(container.querySelector('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    });
    expect(appStore.getState().skyScreen).toBe(false);
    expect(savedChartView()).toBe('dome');
  });

  /** FR-WIN-5 as amended v1.3.1 and v2.5: on compact nothing a page saves can be the window — a stored one is the dome. */
  it('draws a saved window as the dome on compact, with or without the screen up', () => {
    withPhone();
    appStore.setState({ chartView: 'window' });
    const { unmount } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    expect(rtl.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    unmount();
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
  it('gives the legend the short rows its two rows can hold', async () => {
    // R79 (FR-GUT-7, FR-LEG-2 as amended v2.0): sideways the screen's bottom edge is the gutter and there is no
    // legend; upright it is two rows under the band. So the screen's measured box is a phone held upright.
    stubResizeObserver(390, 844);
    const { container } = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} screen />);
    await waitFor(() => {
      expect(container.querySelector('[data-drawing="window"]')).not.toBeNull();
    });
    vi.unstubAllGlobals();
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

  /**
   * R77 (FR-WATCH-3, FR-MOON-3 as amended v2.0): the phase and the illumination are the *compact* live page's,
   * which is the only caller of `moonPhase`. FR-MOON-3 leaves the Now panel and the wide live page unchanged,
   * and the sky screen's own legend with them, so the plain line is what every other legend draws.
   */
  it('carries the Moon phase only where the page asks for it', () => {
    const sun = { t: MOON_FIXTURE.t, azDeg: 285, altDeg: -8 };
    const lit = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} moon={MOON_FIXTURE} moonPhase />);
    const litLine = within(lit.container).getByTestId('chart-legend').querySelector('[data-body="moon"]');
    expect(litLine).toHaveTextContent(`Moon ${en.moon.phase.waningGibbous}, 72 %`);

    const plain = render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} sun={sun} moon={MOON_FIXTURE} />);
    const plainLine = within(plain.container).getByTestId('chart-legend').querySelector('[data-body="moon"]');
    expect(plainLine).not.toHaveTextContent('72 %');
    expect(plainLine).not.toHaveTextContent(en.moon.phase.waningGibbous);
    expect(plainLine?.textContent).toMatch(/Moon · az /);
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
