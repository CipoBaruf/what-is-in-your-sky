import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../tests/support/fixtures';
import { MOON_FIXTURE } from '../../../tests/support/moonFixtures';
import { stubMatchMedia } from '../../../tests/support/matchMedia';
import type { Observer } from '../../model';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { I18nProvider } from '../../i18n/useT';
import { formatDateZone } from '../../lib/format';
import type { Locale } from '../../model';
import { appStore, type ElementsState } from '../../state';
import { resetOrientationAccess } from '../components/guide/skychart/window/orientationAccess';
import { IDLE_PASSES } from '../../state/slices/passes';
import { App } from '../App';
import { PassDetail, TICK_MS } from './PassDetail';

const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as { en: { asComputed: string } };
const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const clearHash = (): void => {
  window.history.replaceState(null, '', window.location.pathname);
};

/** R157 (FR-PHONE-6): a Screen Wake Lock whose requests and releases the test can count. */
function stubWakeLock(): { request: ReturnType<typeof vi.fn>; released: () => number } {
  let released = 0;
  const request = vi.fn(() =>
    Promise.resolve({
      release: () => {
        released += 1;
        return Promise.resolve();
      },
      addEventListener: () => undefined,
    }),
  );
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return { request, released: () => released };
}

describe('<PassDetail> (US-6, FR-X-5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(pass.start.t - 754_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    // R136: the saved view decides what a test opens on (D-876), so no test inherits the last one's.
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  // R23 (D-117): the compact sheet is portaled to the body, so the axe runs here take the document and not RTL's container — which no longer holds the sheet at all.
  it('is a labelled dialog carrying the guide sentence (once, as the chart caption), the numbers, the twilight label and the sky chart', async () => {
    // R136 (D-876): a phone with nothing saved opens on the window (the [ stars ] test below); this one reads the dome.
    appStore.getState().setChartView('dome');
    render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'ISS (Zarya)' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByTestId('guide-sentence').textContent).toBe(golden.en.asComputed);
    expect(within(dialog).getByRole('table')).toBeInTheDocument();
    expect(within(dialog).getByText('sky still bright', { selector: 'p span' })).toBeInTheDocument();
    // R13: the chart is a figure described by the sentence; the drawing is hidden from AT (FR-GUIDE-7) and is DOM, never canvas (FR-GUIDE-5).
    // R21 (FR-DOME-7): the dome is the default again and the polar view is one toggle away; the contract test covers both views themselves.
    // R132 (FR-FLOW-7, D-849): the sentence is the `list` slot's first line, after the drawing, and the figure points at it.
    // With no caption in the layout the figure is named by the pass's heading (D-864).
    const figure = within(dialog).getByRole('figure', { name: 'ISS (Zarya)' });
    const sentence = within(dialog).getByTestId('guide-sentence');
    expect(figure).toHaveAttribute('aria-describedby', sentence.id);
    // R164 (FR-CLEAN-5): the prose is the sheet's last group.
    expect(sentence.closest('[data-testid="pass-prose"]')?.closest('[data-slot]')).toHaveAttribute('data-slot', 'sheet');
    expect(figure.closest('[data-slot]')).toHaveAttribute('data-slot', 'drawing');
    expect(figure).toHaveAttribute('data-view', 'dome');
    // PLAN §11: the dome is the chart chunk, behind `React.lazy`, so the drawing arrives a tick after the sheet.
    await within(figure).findByRole('group', { name: 'Sky dome' });
    expect(figure.querySelector('[data-drawing="dome"]')).toHaveAttribute('aria-hidden', 'true');
    expect(dialog.querySelector('canvas')).toBeNull();
    // The orientation toggle is the polar view's (FR-GUIDE-4); the dome is turned by dragging it instead.
    expect(within(dialog).queryByRole('group', { name: 'Chart orientation' })).toBeNull();
    // R164 (FR-CLEAN-5): the view control is the sheet's view row, not the figure's.
    expect(within(dialog).getByRole('group', { name: 'Chart view' }).closest('[data-testid="pass-view-row"]')).not.toBeNull();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  /**
   * FR-LEG-3 / US-23 AC3 (R51): the table is the legend. It is inside the
   * chart's legend slot, directly under the drawing, with the key the drawing
   * puts at the arc's peak and a swatch in the arc's colour — and it is there
   * once, not once as the legend and once as a block further down the sheet.
   */
  it('shows the numeric table as the chart legend, under the drawing, keyed and swatched', () => {
    render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'ISS (Zarya)' });
    const table = within(dialog).getByRole('table');
    const lead = dialog.querySelector('[data-testid="legend-lead"]');
    expect(lead).toContainElement(table);
    const slot = dialog.querySelector('[data-testid="chart-legend-slot"]');
    expect(slot).toContainElement(lead as HTMLElement);
    // R164 (FR-CLEAN-5): in the sheet's last group — the prose first, then the table.
    const list = screen.getByTestId('pass-prose');
    expect(list).toContainElement(slot as HTMLElement);
    expect([...list.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid')).filter((id) => id === 'guide-sentence' || id === 'chart-legend-slot')).toEqual(['guide-sentence', 'chart-legend-slot']);
    const caption = table.querySelector('caption');
    expect(caption?.textContent).toContain('A');
    expect(caption?.querySelector('[data-color]')).toHaveAttribute('data-color', 'pass');
    // The table is not repeated below the Moon lines, and the figure carries no caption of its own any more.
    expect(within(dialog).getAllByRole('table')).toHaveLength(1);
    expect(within(dialog).getByRole('figure').querySelector('figcaption')).toBeNull();
    // R164 (FR-CLEAN-5): the times row is the sheet's, after the name block.
    expect(within(dialog).getByTestId('pass-times').closest('[data-testid="pass-times-row"]')).not.toBeNull();
  });

  it('locks the page scroll while open and restores it on close (one scrollbar, the sheet\'s)', () => {
    document.documentElement.style.overflow = 'auto';
    const { unmount } = render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });

  /**
   * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-6; US-44 AC1, AC2, AC4; D-943..D-945): `[ follow the phone ]` in the
   * layout's action slot, where `[ hold up to the sky ]` stood (FR-FLOW-8's primary action), on a phone; nothing
   * without the sensor. Its tap asks inside the gesture and, granted, the guide's chart shows the window following
   * the phone with the saved view untouched; off, the window stays. R66's sky screen over the sheet is gone.
   */
  describe('[ follow the phone ] (FR-GYRO-1, FR-GYRO-2, FR-GYRO-6; US-44 AC1, AC2, AC4)', () => {
    /** D-175's presence test: a phone to point. */
    const withPhone = (requestPermission?: () => Promise<'granted' | 'denied'>): void => {
      vi.stubGlobal(
        'DeviceOrientationEvent',
        Object.assign(
          function DeviceOrientationEvent() {
            return undefined;
          },
          requestPermission ? { requestPermission } : {},
        ),
      );
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    };
    const flush = async (): Promise<void> => {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    beforeEach(() => {
      resetOrientationAccess();
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
      resetOrientationAccess();
    });
    const detail = () => render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    const windowRoot = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-look-az]');
    /** The phone's back toward `azDeg`, `altDeg` up, as the W3C event the window listens for. */
    const reading = (azDeg: number, altDeg: number): void => {
      act(() => {
        window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: (360 - azDeg) % 360, beta: 90 + altDeg, gamma: 0, absolute: true }));
      });
    };
    /** A hand-driven `requestAnimationFrame`, so the sensor's smoothing runs on the test's frames. */
    const scriptedFrames = (): ((wall: number) => void) => {
      let next = 1;
      const pending = new Map<number, FrameRequestCallback>();
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
        pending.set(next, callback);
        return next++;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
        pending.delete(id);
      });
      return (wall) => {
        const callbacks = [...pending.values()];
        pending.clear();
        act(() => {
          for (const callback of callbacks) callback(wall);
        });
      };
    };

    /**
     * R159 (FR-PHONE-1, FR-FLOW-14; US-45 AC1; D-962): where nothing has to be asked the guide opens following, on the
     * window whatever view is saved, and the opening facing (the peak, FR-SKY-7) is replaced by the pose at the first
     * reading; a drag hands the sky to the finger.
     */
    it('opens following where nothing is asked, the peak facing replaced by the first reading, and a drag ends it (FR-PHONE-1, FR-GYRO-4)', async () => {
      withPhone();
      const frame = scriptedFrames();
      appStore.getState().setChartView('dome');
      detail();
      const figure = screen.getByRole('figure', { name: 'ISS (Zarya)' });
      // D-986: following starts at the first reading with a north; until it the guide is on its saved view.
      expect(figure).toHaveAttribute('data-view', 'dome');
      reading(180, 30);
      expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(figure).toHaveAttribute('data-view', 'window');
      expect(figure).toHaveAttribute('data-follow', 'true');
      expect(appStore.getState().chartView).toBe('dome');
      // R160: the window's chunk lands late under a loaded run — five seconds, not `waitFor`'s one.
      await waitFor(
        () => {
          expect(figure.querySelector('[data-follow="true"] [data-drawing="window"]')).not.toBeNull();
        },
        { timeout: 5_000 },
      );
      /*
       * R164 (the intermittent `idle` here): the window's `deviceorientation` listener is added in its passive effect
       * (`useDeviceOrientation`), which React's scheduler runs in a `setImmediate` task after the lazy chunk's commit.
       * `waitFor` passes on the commit's DOM mutation, before that task (one listener in the window then, the page's),
       * and what let the reading below arrive was RTL's own `setTimeout(0)` drain after it — which Node does not order
       * against a `setImmediate`, so now and then the reading went first, reached no listener, and the window stayed
       * `idle`. A `setImmediate` of the test's own, queued after React's, runs after it: the listener is in place.
       */
      await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
      });
      // The window, mounted on the window's first frame of following, takes the phone's next reading as its pose.
      reading(180, 30);
      for (let i = 1; i <= 40; i += 1) frame(16 * i);
      expect(windowRoot()).toHaveAttribute('data-state', 'on');
      // The phone's pose, to the degree the declination at the observer moves a compass heading.
      expect(Math.abs(Number(windowRoot()?.getAttribute('data-look-az')) - 180)).toBeLessThanOrEqual(2);
      expect(windowRoot()).toHaveAttribute('data-look-alt', '30');
      const box = figure.querySelector('[data-follow="true"] [tabindex="0"]') as HTMLElement;
      box.setPointerCapture = vi.fn();
      box.releasePointerCapture = vi.fn();
      fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
      fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
      expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
      fireEvent.pointerUp(box, { pointerId: 1, clientX: 140, clientY: 100 });
      expect(figure).not.toHaveAttribute('data-follow');
      expect(windowRoot()).toHaveAttribute('data-state', 'hand');
    });

    /** R159 (FR-PHONE-2; US-45 AC2; D-963, D-986): a saved grant arms the guide; the first touch on the sky asks, once. */
    it('with a saved grant asks once inside the first touch on the sky and follows; a refusal clears the grant and shows the line', async () => {
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      appStore.getState().setFollowGranted(true);
      const { unmount } = detail();
      expect(requestPermission).not.toHaveBeenCalled();
      const sky = (): HTMLElement => screen.getByTestId('pass-layout').querySelector('[data-slot="drawing"]') as HTMLElement;
      fireEvent.pointerDown(sky(), { pointerId: 1, pointerType: 'touch' });
      fireEvent.pointerUp(sky(), { pointerId: 1, pointerType: 'touch' });
      expect(requestPermission).toHaveBeenCalledTimes(1);
      await flush();
      expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
      fireEvent.pointerDown(sky(), { pointerId: 2, pointerType: 'touch' });
      fireEvent.pointerUp(sky(), { pointerId: 2, pointerType: 'touch' });
      expect(requestPermission).toHaveBeenCalledTimes(1);
      unmount();

      resetOrientationAccess();
      requestPermission.mockResolvedValue('denied');
      detail();
      fireEvent.pointerDown(sky(), { pointerId: 1, pointerType: 'touch' });
      fireEvent.pointerUp(sky(), { pointerId: 1, pointerType: 'touch' });
      await flush();
      expect(requestPermission).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('follow-refused')).toHaveAttribute('role', 'status');
      expect(appStore.getState().followGranted).toBe(false);
    });

    it('stands in the sheet after the view row and [ follow ] in the bottom row on a phone, and is absent without the sensor; no sky screen, no hold-up (FR-CLEAN-3)', () => {
      appStore.getState().setChartView('dome');
      const { unmount } = render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
      expect(screen.queryByTestId('pass-follow')).toBeNull();
      expect(screen.queryByTestId('follow-toggle')).toBeNull();
      expect(screen.queryByTestId('live-follow-control')).toBeNull();
      expect(screen.queryByTestId('window-hold-up')).toBeNull();
      unmount();

      // An iPhone's first visit: off until asked (FR-PHONE-2).
      withPhone(() => Promise.resolve('granted'));
      render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
      const row = screen.getByTestId('pass-follow');
      expect(within(row).getByTestId('follow-toggle')).toHaveTextContent(en.window.followToggle);
      expect(within(row).getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(row.previousElementSibling).toHaveAttribute('data-testid', 'pass-view-row');
      expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('pass-layout').querySelector('[data-slot="action"]')).toBeNull();
      expect(screen.queryByTestId('window-hold-up')).toBeNull();
      expect(screen.queryByTestId('sky-screen')).toBeNull();
    });

    it('asks inside the tap and shows the window following, the saved view untouched; off, the window stays (FR-GYRO-2)', async () => {
      const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
      withPhone(requestPermission);
      appStore.getState().setChartView('dome');
      render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
      const figure = screen.getByRole('figure', { name: 'ISS (Zarya)' });
      expect(figure).toHaveAttribute('data-view', 'dome');
      fireEvent.click(screen.getByTestId('follow-toggle'));
      expect(requestPermission).toHaveBeenCalledTimes(1);
      await flush();
      expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(figure).toHaveAttribute('data-view', 'window');
      expect(figure).toHaveAttribute('data-follow', 'true');
      expect(appStore.getState().chartView).toBe('dome');
      await waitFor(() => {
        expect(figure.querySelector('[data-follow="true"] [data-drawing="window"]')).not.toBeNull();
      });
      // FR-GYRO-5: nothing over the drawing — no readout while following.
      expect(screen.queryByTestId('window-readout')).toBeNull();
      fireEvent.click(screen.getByTestId('follow-toggle'));
      expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(figure).toHaveAttribute('data-view', 'window');
      expect(figure).not.toHaveAttribute('data-follow');
      expect(appStore.getState().chartView).toBe('dome');
      expect(JSON.parse(window.localStorage.getItem('wiys:prefs:v1') ?? '{}')).toMatchObject({ chartView: 'dome' });
    });

    it('holds the screen awake while following and lets it go when following ends (FR-PHONE-6, D-967)', async () => {
      const lock = stubWakeLock();
      withPhone(() => Promise.resolve('granted'));
      appStore.getState().setChartView('dome');
      render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
      await flush();
      expect(lock.request).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('follow-toggle'));
      await flush();
      expect(lock.request).toHaveBeenCalledTimes(1);
      expect(lock.request).toHaveBeenCalledWith('screen');
      fireEvent.click(screen.getByTestId('follow-toggle'));
      await flush();
      expect(lock.released()).toBe(1);
      expect(lock.request).toHaveBeenCalledTimes(1);
      Reflect.deleteProperty(navigator, 'wakeLock');
    });
  });

  it('adds the Moon warning under the chart when the pass has glare, and nothing when it has not (FR-MOON-2)', () => {
    const { rerender } = render(
      <PassDetail pass={{ ...pass, moonAtPeak: MOON_FIXTURE, moonGlare: { glare: true, separationDeg: 8.2 } }} observer={observer} onClose={() => undefined} onShowList={() => undefined} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('The Moon is bright and close to the track.')).toHaveAccessibleDescription(/at least 50 % lit and closer than 30°/);
    rerender(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('The Moon is bright');
  });

  // R49 (F-14), US-18 AC1: the guide says which Moon is up at the peak even
  // when the worker found no glare in it.
  it('names the Moon at the peak whenever it is up, glare or not', () => {
    const upNoGlare = { ...pass, moonAtPeak: MOON_FIXTURE, moonGlare: { glare: false, separationDeg: 120 } };
    const { rerender } = render(<PassDetail pass={upNoGlare} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('moon-at-peak')).toHaveTextContent('Moon at the peak: waning gibbous, 72 % lit');
    expect(dialog).not.toHaveTextContent('The Moon is bright');

    // With the Moon below the horizon there is nothing to say about it here.
    rerender(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    expect(within(screen.getByRole('dialog')).queryByTestId('moon-at-peak')).toBeNull();
  });

  /**
   * R123 (FR-SKY-3, FR-COMP-4, US-40 AC1; D-791, D-814): `[ stars ]`, on by default and the same saved toggle as the
   * live page's — on the view row after the view control, `inline` on compact so it takes the row's second line.
   */
  it('offers [ stars ] on the view row on compact and on wide, and a press is the saved toggle', () => {
    const { unmount } = render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    // R132 (FR-FLOW-4, D-846): the view row is the layout's slot — the view control in the picker's idiom, `[x] stars` at the row's end.
    const toggle = screen.getByTestId('stars-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // R164 (FR-CLEAN-5): on compact the row is the sheet's.
    const row = toggle.closest('[data-testid="pass-view-row"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.lastElementChild).toBe(toggle);
    const control = within(row).getByRole('group', { name: en.chart.viewGroup });
    expect(within(control).getAllByRole('button').map((b) => b.textContent)).toEqual(['Window', 'Polar', 'Dome']);
    // R136 (FR-FLOW-14, D-876): nothing saved, so the phone opens on the window.
    expect(within(control).getByRole('button', { name: 'Window' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(appStore.getState().starsLayer).toBe(false);
    unmount();
    const media = stubMatchMedia(1280, 800);
    try {
      render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
      const wideRow = screen.getByTestId('pass-layout').querySelector('[data-slot="viewRow"]') as HTMLElement;
      expect(within(wideRow).getByRole('group', { name: en.chart.viewGroup })).toBeInTheDocument();
      // R136 (D-876): still nothing saved, and a desk opens on the dome.
      expect(within(within(wideRow).getByRole('group', { name: en.chart.viewGroup })).getByRole('button', { name: 'Dome' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(wideRow).getByTestId('stars-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByTestId('stars-toggle')).toHaveLength(1);
      // FR-FLOW-7 on wide: the panel's head is one band — the name, the countdown, the times — and the layout is the panel.
      const head = screen.getByTestId('guide-head');
      expect(within(head).getByRole('heading', { level: 2, name: 'ISS (Zarya)' })).toBeInTheDocument();
      expect(within(head).getByRole('timer')).toBeInTheDocument();
      expect(within(head).getByTestId('pass-times')).toBeInTheDocument();
      expect(screen.getByTestId('pass-layout')).toHaveAttribute('data-shape', 'panel');
      expect(within(screen.getByTestId('pass-layout')).getByRole('figure', { name: 'ISS (Zarya)' })).toBeInTheDocument();
    } finally {
      media.restore();
      appStore.setState(initial, true);
      window.localStorage.clear();
    }
  });

  it('omits the twilight label when the pass is not a twilight one', () => {
    render(<PassDetail pass={{ ...pass, twilight: false }} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('sky still bright');
  });

  it('counts down every second without remounting', () => {
    render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('Appears in 12:34');
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(screen.getByRole('timer')).toBe(timer);
    expect(timer).toHaveTextContent('Appears in 12:33');
    act(() => {
      vi.setSystemTime(pass.peak.t + 1000);
      vi.advanceTimersByTime(TICK_MS);
    });
    // R164 (FR-CLEAN-2, D-1012): the head's phase words, without the reason.
    expect(timer).toHaveTextContent('Ends in 0:22');
  });

  // R35 (D-73): Escape is no longer this component's; it is the `close` row of
  // the shortcut table, asserted end to end in `App.shortcuts.test.tsx`.
  it('moves focus to its heading on open and back to the opener on close; the close control closes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<PassDetail pass={pass} observer={observer} onClose={onClose} onShowList={() => undefined} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'ISS (Zarya)' }));

    await user.click(screen.getByRole('button', { name: en.header.backName }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

/**
 * R164 (FR-CLEAN-1..3, FR-CLEAN-5, FR-CLEAN-6; US-49 AC1..AC5; D-998, D-999, D-1012..D-1014): on compact the pass
 * detail is the layout's `full` form — the box is the screen, the head, the corner readout, the bottom row and the
 * hint over it, everything else in the sheet in FR-CLEAN-5's order; `Esc` closes the sheet, then the guide.
 */
describe('<PassDetail> in the full form (FR-CLEAN-1..3, FR-CLEAN-5, FR-CLEAN-6)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(pass.start.t - 754_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    appStore.setState(initial, true);
    window.localStorage.clear();
  });
  const detail = (locale: Locale = 'en') =>
    render(
      <I18nProvider locale={locale}>
        <PassDetail pass={pass} observer={observer} onClose={() => undefined} onShowList={() => undefined} />
      </I18nProvider>,
    );
  const openSheet = (): void => {
    fireEvent.click(screen.getByTestId('live-controls'));
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
  };

  it('with the sheet closed renders the box, the head, the corner readout, the bottom row and the hint, and nothing else over the sky; the h1 is hidden', async () => {
    detail();
    const layout = screen.getByTestId('pass-layout');
    expect(layout).toHaveAttribute('data-shape', 'full');
    // FR-CLEAN-1: no row outside the box, the overlay and the sheet.
    expect([...layout.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot'))).toEqual(['drawing', 'overlay', 'readout', 'sheet']);
    // FR-CLEAN-2: `[ ← ]`, the countdown in the head's words and the pass's name as its chip.
    const head = screen.getByTestId('live-head');
    expect(within(head).getByTestId('live-back')).toBeInTheDocument();
    expect(within(head).getByRole('timer')).toHaveTextContent('Appears in 12:34');
    expect(within(head).getByTestId('pass-head-chip')).toHaveTextContent('ISS (Zarya)');
    const h1 = screen.getByRole('heading', { level: 1, name: 'ISS (Zarya)' });
    expect(h1).toHaveAttribute('data-visually-hidden', '');
    // The readout in the corner, the landmark line under it once the stars' source is in hand (FR-SKY-11).
    const corner = screen.getByTestId('sky-corner-readout');
    expect(corner).toHaveAttribute('data-lines', '2');
    await waitFor(() => {
      expect(within(corner).getByTestId('window-readout')).toBeInTheDocument();
    });
    // FR-CLEAN-3: `[ controls ]` alone at the bottom without the sensor, and the hint until the first gesture.
    expect([...screen.getByTestId('live-bottom-row').children].map((el) => el.getAttribute('data-testid'))).toEqual(['live-controls']);
    expect(screen.getByTestId('sky-hint')).toBeInTheDocument();
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    // FR-CLEAN-5: no countdown in the sheet (one timer on the page), and the column's head is gone.
    expect(screen.getAllByRole('timer')).toHaveLength(1);
    expect(screen.queryByTestId('header')).toBeNull();
  });

  it.each(['en', 'es'] as const)('holds the sheet in FR-CLEAN-5’s order in %s: the name line, the times, the view row, follow, facing, Share, the prose and the table', (locale) => {
    const t = locale === 'en' ? en : es;
    withSensor();
    detail(locale);
    openSheet();
    const body = screen.getByTestId('sheet-body');
    expect([...body.children].map((el) => el.getAttribute('data-testid'))).toEqual(['pass-head', 'pass-times-row', 'pass-view-row', 'pass-follow', 'pass-facing', 'pass-share', 'pass-prose']);
    expect(screen.getByTestId('pass-name-line')).toHaveTextContent(`ISS (Zarya) · ${formatDateZone(pass.start.t, null, locale)}`);
    expect(within(screen.getByTestId('pass-view-row')).getAllByRole('button').map((b) => b.textContent)).toEqual([...(locale === 'en' ? ['Window', 'Polar', 'Dome'] : ['Ventana', 'Polar', 'Domo']), t.live.starsToggle]);
    expect(within(screen.getByTestId('pass-share')).getByRole('button')).toBeInTheDocument();
    const prose = screen.getByTestId('pass-prose');
    expect(within(prose).getByTestId('guide-sentence')).toBeInTheDocument();
    expect(within(prose).getByRole('table')).toBeInTheDocument();
    // The readout left the corner for the facing row; with the sheet open it is the row's.
    expect(screen.queryByTestId('sky-corner-readout')).toBeNull();
    // The window's picker offers `peak` first (FR-SKY-7).
    fireEvent.click(screen.getByTestId('sky-readout-toggle'));
    expect(screen.getByTestId('pass-facing-picker')).toBeInTheDocument();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });

  it('opens on the window facing the peak (FR-SKY-7, FR-CLEAN-5)', async () => {
    detail();
    await waitFor(
      () => {
        expect(document.querySelector('[data-look-az]')).not.toBeNull();
      },
      { timeout: 5_000 },
    );
    const look = Number(document.querySelector('[data-look-az]')?.getAttribute('data-look-az'));
    expect(Math.abs(look - Math.round(pass.peak.azDeg))).toBeLessThanOrEqual(1);
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'window');
  });

  it('takes Esc in two steps: the sheet closes and focus returns to [ controls ], then the key is left to the app to close the guide (D-999)', () => {
    detail();
    const app = vi.fn();
    document.addEventListener('keydown', app);
    try {
      openSheet();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
      expect(document.activeElement).toBe(screen.getByTestId('live-controls'));
      expect(app).not.toHaveBeenCalled();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(app).toHaveBeenCalledTimes(1);
      expect((app.mock.calls[0]?.[0] as KeyboardEvent).defaultPrevented).toBe(false);
    } finally {
      document.removeEventListener('keydown', app);
    }
  });
});

/** D-175's presence test: a phone to point, with nothing to ask. */
function withSensor(): void {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(function DeviceOrientationEvent() {
      return undefined;
    }, {}),
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

describe('<App> with the detail sheet (D-13)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    clearHash();
  });

  const withPasses = (): void => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true } });
    });
  };

  it('opening a card sets the hash, the sheet shows the same pass, and closing returns to the list', async () => {
    withPasses();
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Open guide/ }));
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
    const dialog = screen.getByRole('dialog', { name: 'ISS (Zarya)' });
    expect(dialog).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.getByRole('main')).toHaveAttribute('inert');

    await userEvent.click(within(dialog).getByRole('button', { name: en.header.backName }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(screen.getByRole('article', { name: 'ISS (Zarya)' })).toBeInTheDocument();
  });

  it('reopens the same pass when loaded with #pass=<id>, once the pass is in the store', () => {
    window.location.hash = `#pass=${pass.id}`;
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull(); // nothing computed yet
    withPasses();
    expect(screen.getByRole('dialog', { name: 'ISS (Zarya)' })).toHaveAttribute('data-pass-id', pass.id);
  });

  it('has no axe violations with the sheet open', async () => {
    window.location.hash = `#pass=${pass.id}`;
    withPasses();
    render(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
