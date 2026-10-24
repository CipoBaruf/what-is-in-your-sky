/**
 * R117 (FR-STAR-5; FR-FSC-1 as amended v2.4, FR-FSC-2, FR-WIN-4, FR-FOL-2;
 * US-38 AC1, AC2; D-756, D-757): the sky screen's **stars inventory**, in the
 * page that opens it.
 *
 * `[ hold up to the sky ]` on `#stars` is FR-WIN-4's tap — offered where the
 * presence test passes, asking inside the tap and never on load, opening on
 * the first reading with a north in it — and what it opens is the same layer
 * the live page opens, holding the page's scene and no pass. A denial or a
 * phone with no north leaves the page as it was with FR-LIVE-8's note beside
 * the control; the `×` and `Esc` give the page back with its camera as it was.
 *
 * jsdom, with the synthetic orientation events and scripted frames of
 * `SkyScreen.test.tsx`. `SkyChart` is wrapped, not replaced, so what the
 * screen hands the window — no passes, the page's scene — is checked at the
 * prop. What only a browser can answer (the layer is the viewport, the turn,
 * the ground notes) is `tests/e2e/stars-screen.spec.ts`.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import { STARS_PAGE_CATALOGS } from '../../../i18n/starsPageT';
import { I18nProvider } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { appStore } from '../../../state';
import { StarsPage } from '../../screens/Stars';
import type { SkyChartProps } from '../guide/skychart/SkyChart.types';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';

/** The props every `SkyChart` was rendered with: the screen's is the only one on this page. */
const recorded = vi.hoisted(() => ({ props: [] as SkyChartProps[] }));
vi.mock('../guide/skychart/SkyChart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guide/skychart/SkyChart')>();
  return {
    ...actual,
    SkyChart: function SkyChartSpy(props: SkyChartProps) {
      recorded.props.push(props);
      return actual.SkyChart(props);
    },
  };
});

const SOUTH: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Cipolletti', source: 'coords', timeZone: null };
const T = Date.UTC(2026, 9, 24, 3, 0, 0);
const p = STARS_PAGE_CATALOGS.en;
const initial = appStore.getInitialState();

declare global {
  interface Window {
    __asks?: number;
  }
}

function withPhone(answer?: 'granted' | 'denied'): void {
  window.__asks = 0;
  const requestPermission = (): Promise<'granted' | 'denied'> => {
    window.__asks = (window.__asks ?? 0) + 1;
    return Promise.resolve(answer ?? 'granted');
  };
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(
      function DeviceOrientationEvent() {
        return undefined;
      },
      answer === undefined ? {} : { requestPermission },
    ),
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
}

/** A hand-driven `requestAnimationFrame`: the window eases toward each reading a frame at a time. */
function scriptedFrames(): () => void {
  let next = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const id = next++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    pending.delete(id);
  });
  return (): void => {
    for (let i = 0; i < 40; i += 1) {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(16);
      });
    }
  };
}

/** A reading: with a north in it by default, where the phone's back points `azDeg` round and `altDeg` up. */
function reading(azDeg = 270, altDeg = 20, absolute = true): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: absolute ? (360 - azDeg) % 360 : null, beta: 90 + altDeg, gamma: 0, absolute }));
  });
}

/** Real turns of the event loop: the permission's promise, and the window's lazy chunk the first time a file mounts it. */
async function turns(until: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !until(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const page = () => render(<I18nProvider locale="en">{<StarsPage />}</I18nProvider>);
const holdUp = () => screen.queryByRole('button', { name: p.holdUp });
const layer = () => screen.queryByTestId('sky-screen');

describe('the sky screen’s stars inventory (FR-STAR-5)', () => {
  let media: MatchMediaStub | null = null;
  let settle: () => void = () => undefined;

  beforeEach(() => {
    recorded.props.length = 0;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(T);
    media = stubMatchMedia(COMPACT_PX);
    settle = scriptedFrames();
    appStore.setState({ observer: SOUTH });
  });
  afterEach(() => {
    media?.restore();
    media = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetOrientationAccess();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  /** The tap, the permission's answer, the reading it waits for, the window's chunk, and the frames the smoothing needs. */
  const open = async (): Promise<HTMLElement> => {
    fireEvent.click(holdUp() as HTMLElement);
    // The permission answer is a promise: a few turns for it to arm the listener the reading lands in.
    await turns(() => (window.__asks ?? 0) > 0 || !("requestPermission" in DeviceOrientationEvent));
    await act(async () => {
      await Promise.resolve();
    });
    reading();
    await turns(() => layer()?.querySelector('[data-look-az]') != null);
    reading();
    settle();
    return screen.getByTestId('sky-screen');
  };

  it('offers no [ hold up to the sky ] where the presence test fails — a desk (FR-WIN-4)', () => {
    page();
    expect(screen.getByTestId('stars-page')).toBeInTheDocument();
    expect(holdUp()).toBeNull();
    expect(screen.queryByTestId('stars-hold-up-row')).toBeNull();
  });

  it('offers it on a phone, asks in the tap and never on load, and opens the screen on the first reading with a north (US-38 AC1)', async () => {
    withPhone('granted');
    page();
    expect(holdUp()).toBeInTheDocument();
    expect(window.__asks).toBe(0);
    // A reading before the tap opens nothing: the page draws under the hand until the reader asks.
    reading();
    expect(layer()).toBeNull();
    const shown = await open();
    expect(window.__asks).toBe(1);
    expect(shown).toHaveAttribute('data-inventory', 'stars');
    expect(appStore.getState().skyScreen).toBe(true);
  });

  it('holds the drawing, the ×, the readout with its true-north line and the gutter, the page’s scene and no pass (FR-FSC-1 as amended, D-757)', async () => {
    withPhone();
    page();
    const shown = await open();
    // The four things: the window's drawing with the star field in it, the `×`, the readout, the gutter.
    expect(within(shown).getByTestId('sky-chart')).toHaveAttribute('data-screen', 'true');
    expect(shown.querySelector('[data-drawing="window"]')).not.toBeNull();
    expect(shown.querySelector('[data-drawing="window"] [data-layer="stars"]')).not.toBeNull();
    expect(within(shown).getByRole('button', { name: en.chart.screenClose })).toHaveTextContent('×');
    expect(within(shown).getByTestId('window-readout')).toHaveTextContent(/^Looking [NESW]{1,3} \(\d+°\) · up \d+°/);
    // D-757: the sensor drives it, so the readout names the correction — the hand's had no second line.
    expect(within(shown).getByTestId('window-heading')).toHaveTextContent(/^true north, declination [+−]\d+\.\d°$/);
    expect(within(shown).getByTestId('compass-gutter')).toBeInTheDocument();
    // No pass: no arc, no tick in the gutter, and the window was handed none.
    expect(shown.querySelector('[data-pass-id]')).toBeNull();
    expect(shown.querySelector('[data-gutter-mark]')).toBeNull();
    expect(within(shown).getByTestId('gutter-bracket')).toBeInTheDocument();
    const screens = recorded.props.filter((props) => props.screen === true);
    expect(screens.length).toBeGreaterThan(0);
    for (const props of screens) {
      expect(props.passes).toEqual([]);
      expect(props.highlightedPassId).toBeNull();
      expect(props.scene?.stars?.layers).toEqual({ stars: true, figures: true, planets: true, names: true });
      expect(props.camera).toBeUndefined();
    }
    // It is the modal dialog the passes inventory is, portaled over the page.
    expect(shown).toHaveAttribute('role', 'dialog');
    expect(shown).toHaveAttribute('aria-modal', 'true');
    expect(shown.parentElement).toBe(document.body);
    expect(await axe(shown)).toHaveNoViolations();
  });

  it('carries the layers as the page’s toggles had them (FR-STAR-5)', async () => {
    withPhone();
    page();
    fireEvent.click(within(screen.getByTestId('stars-layers')).getByRole('button', { name: p.layers.figures }));
    fireEvent.click(within(screen.getByTestId('stars-layers')).getByRole('button', { name: p.layers.names }));
    await open();
    const last = recorded.props.filter((props) => props.screen === true).at(-1);
    expect(last?.scene?.stars?.layers).toEqual({ stars: true, figures: false, planets: true, names: false });
  });

  it('closes on the × and on Esc, gives the page back with its camera where it was, and focus to the control (FR-FSC-2)', async () => {
    withPhone();
    page();
    const picker = screen.getByRole('group', { name: p.facing });
    fireEvent.click(within(picker).getByRole('button', { name: 'NE' }));
    const look = { az: screen.getByTestId('stars-page').dataset.lookAz, alt: screen.getByTestId('stars-page').dataset.lookAlt };

    const shown = await open();
    fireEvent.click(within(shown).getByRole('button', { name: en.chart.screenClose }));
    expect(layer()).toBeNull();
    expect(appStore.getState().skyScreen).toBe(false);
    expect(holdUp()).toHaveFocus();
    expect(screen.getByTestId('stars-page').dataset).toMatchObject({ lookAz: look.az, lookAlt: look.alt });
    expect(within(picker).getByRole('button', { name: 'NE' })).toHaveAttribute('aria-pressed', 'true');

    await open();
    // `Esc` closes the screen and stops there: the press does not reach the app's listener that leaves the page.
    const reached = vi.fn();
    document.addEventListener('keydown', reached);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    document.removeEventListener('keydown', reached);
    expect(layer()).toBeNull();
    expect(reached).not.toHaveBeenCalled();
    expect(holdUp()).toHaveFocus();
    expect(screen.getByTestId('stars-page')).toBeInTheDocument();
  });

  it('closes when the page goes (FR-FSC-2: leaving by any route)', async () => {
    withPhone();
    const { unmount } = page();
    await open();
    unmount();
    expect(appStore.getState().skyScreen).toBe(false);
  });

  it('leaves the page as it was with FR-LIVE-8’s note after a denial, and asks again on the next tap (FR-FOL-2)', async () => {
    withPhone('denied');
    page();
    fireEvent.click(holdUp() as HTMLElement);
    await turns(() => screen.queryByTestId('stars-hold-up-note') !== null);
    expect(layer()).toBeNull();
    expect(screen.getByTestId('stars-hold-up-note')).toHaveTextContent(en.window.denied);
    expect(screen.getByTestId('stars-hold-up-note')).toHaveAttribute('role', 'status');
    // The control stays: a denial is not a phone without a compass.
    expect(holdUp()).toBeInTheDocument();
    fireEvent.click(holdUp() as HTMLElement);
    await turns(() => window.__asks === 2);
    expect(window.__asks).toBe(2);
  });

  it('leaves the page as it was with the relative note on a phone with no north, and the control goes (FR-WIN-4)', async () => {
    withPhone();
    page();
    fireEvent.click(holdUp() as HTMLElement);
    reading(270, 20, false);
    expect(layer()).toBeNull();
    expect(screen.getByTestId('stars-hold-up-note')).toHaveTextContent(en.window.relative);
    expect(holdUp()).toBeNull();
  });
});
