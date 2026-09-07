/**
 * R34 (FR-LIVE-8, US-10), rewritten by R59 (FR-FOL-1, FR-FOL-2, D-276, D-277):
 * the follow control with the orientation API stubbed. Following is the sky
 * window being shown, so what is asserted here is the *view*: nothing rendered
 * where there is no phone to follow; the press asks (iOS inside the click) and
 * then waits for one reading; a reading with a heading opens the window over
 * whatever view was showing and the second press gives that view back; a
 * relative-only device and a refusal show their note and leave the view alone,
 * with the control unpressed; and the saved preference is never what following
 * opened — `savedChartView`, and the key on the device, stay the reader's.
 *
 * The states are the store's, not the hook's alone: `viewOverride` is what
 * following *is* (D-277), so a view picked by hand while following ends it.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import type { ChartView } from '../../../model';
import { appStore } from '../../../state';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { FollowPhone } from './FollowPhone';
import { useFollowPhone } from './useFollowPhone';

const initial = appStore.getInitialState();
const PREFS_KEY = 'wiys:prefs:v1';

/** The hook and the control together. Following ends through the control or on unmount — R59 left
 *  the page no way to end it, since the dome no longer turns while following. */
function Harness() {
  const follow = useFollowPhone();
  return <FollowPhone follow={follow} />;
}

interface Reading {
  alpha?: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
}

/** A reading on the window, on the event the hook listens to. */
function reading(fields: Reading, name = 'deviceorientation'): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event(name), { alpha: null, absolute: false, ...fields }));
  });
}

function withPhone(requestPermission?: () => Promise<'granted' | 'denied'>): void {
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
}

/** The view the reader chose, saved as the view control saves it. */
function chose(view: ChartView): void {
  act(() => {
    appStore.getState().setChartView(view);
  });
}

const views = () => {
  const { chartView, savedChartView, viewOverride } = appStore.getState();
  return { chartView, savedChartView, viewOverride };
};

const saved = (): unknown => (JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}') as { chartView?: unknown }).chartView;

describe('<FollowPhone> with useFollowPhone (FR-FOL-1, FR-FOL-2)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'ondeviceorientationabsolute');
    appStore.setState(initial, true);
    window.localStorage.clear();
  });

  it('renders nothing where there is no phone to follow (D-175): no constructor, or no touch screen', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByTestId('follow-phone')).toBeNull();
    unmount();
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {
      return undefined;
    });
    render(<Harness />);
    expect(screen.queryByTestId('follow-phone')).toBeNull();
  });

  it.each(['dome', 'polar'] as const)('opens the window over the %s and gives that view back on the second press (FR-FOL-1)', async (from) => {
    withPhone();
    chose(from);
    const { container } = render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Not listening yet: a reading opens nothing.
    reading({ alpha: 270, absolute: true });
    expect(views()).toMatchObject({ chartView: from, viewOverride: null });

    fireEvent.click(toggle);
    // The press arms; the reading is what says this phone has a north to point at (F-42's lesson).
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(views()).toMatchObject({ chartView: from, viewOverride: null });
    reading({ alpha: 270, absolute: true });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    // FR-WIN-5 as amended: the window is the view, and the reader's own preference is untouched.
    expect(views()).toEqual({ chartView: 'window', savedChartView: from, viewOverride: 'window' });
    expect(saved()).toBe(from);
    expect(await axe(container)).toHaveNoViolations();

    // The second press gives back the view it came from, and nothing was written on the way.
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(views()).toEqual({ chartView: from, savedChartView: from, viewOverride: null });
    expect(saved()).toBe(from);
  });

  it('leaving the live page gives the view back too (FR-FOL-1)', () => {
    withPhone();
    chose('dome');
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: en.live.follow }));
    reading({ alpha: 270, absolute: true });
    expect(views()).toMatchObject({ chartView: 'window', viewOverride: 'window' });
    unmount();
    expect(views()).toEqual({ chartView: 'dome', savedChartView: 'dome', viewOverride: null });
  });

  it('shows the note for a relative-only phone and leaves the view alone, unpressed (FR-FOL-2)', () => {
    withPhone();
    chose('dome');
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    reading({ alpha: 30, absolute: false });
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'relative');
    expect(screen.getByTestId('follow-note')).toHaveTextContent(en.live.followRelative);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(views()).toEqual({ chartView: 'dome', savedChartView: 'dome', viewOverride: null });
    // A phone that finds its north on a later press opens the window after all.
    fireEvent.click(toggle);
    expect(screen.queryByTestId('follow-note')).toBeNull();
    reading({ alpha: 30, absolute: true });
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    expect(views()).toMatchObject({ chartView: 'window', savedChartView: 'dome' });
  });

  it("prefers Chrome's absolute event where the window has it", () => {
    withPhone();
    (window as Window & { ondeviceorientationabsolute?: unknown }).ondeviceorientationabsolute = null;
    chose('dome');
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: en.live.follow }));
    reading({ alpha: 90, absolute: true }); // the plain event: not listened to here
    expect(views()).toMatchObject({ viewOverride: null });
    reading({ alpha: 90, absolute: true }, 'deviceorientationabsolute');
    expect(views()).toMatchObject({ viewOverride: 'window' });
  });

  it('asks iOS inside the press: a refusal is the note and the view is left alone; the next press asks again (FR-FOL-2, FR-WIN-4)', async () => {
    const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValueOnce('denied').mockResolvedValueOnce('granted');
    withPhone(requestPermission);
    chose('polar');
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'denied');
    expect(screen.getByTestId('follow-note')).toHaveTextContent(en.live.followDenied);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(views()).toEqual({ chartView: 'polar', savedChartView: 'polar', viewOverride: null });
    // Nothing is listened to while denied.
    reading({ alpha: 0, absolute: true });
    expect(views()).toMatchObject({ viewOverride: null });

    fireEvent.click(toggle);
    expect(requestPermission).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('follow-note')).toBeNull();
    reading({ alpha: 0, absolute: true });
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    expect(views()).toMatchObject({ chartView: 'window', savedChartView: 'polar' });
  });

  it('treats a request that throws (an insecure context) as denied', async () => {
    withPhone(() => Promise.reject(new Error('insecure')));
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: en.live.follow }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'denied');
    expect(views()).toMatchObject({ viewOverride: null });
  });

  /** D-277: picking a view by hand while following is the reader taking the chart back — the override goes, and so does following. */
  it('stops following when the reader picks a view themselves, and that view is what is saved', () => {
    withPhone();
    chose('dome');
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    reading({ alpha: 270, absolute: true });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    chose('polar');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    expect(views()).toEqual({ chartView: 'polar', savedChartView: 'polar', viewOverride: null });
    expect(saved()).toBe('polar');
  });

  /**
   * FR-WIN-5 as amended: a window that reports it cannot run here — the
   * permission refused after the fact, a phone that loses its heading — ends
   * through `dropChartView`, which writes nothing. Following ends with it.
   */
  it('stops following when the window reports it cannot run here, and writes nothing', () => {
    withPhone();
    chose('dome');
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    reading({ alpha: 270, absolute: true });
    act(() => {
      appStore.getState().dropChartView('window');
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(views()).toEqual({ chartView: 'dome', savedChartView: 'dome', viewOverride: null });
    expect(saved()).toBe('dome');
  });

  /** The press that is waiting for its first reading is still a press: the next one calls it off and the view never moves. */
  it('a second press before any reading disarms the sensor', () => {
    withPhone();
    chose('dome');
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    reading({ alpha: 270, absolute: true });
    expect(views()).toEqual({ chartView: 'dome', savedChartView: 'dome', viewOverride: null });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
