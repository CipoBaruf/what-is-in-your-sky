/**
 * R34 (FR-LIVE-8, US-10): the follow control with the orientation API
 * stubbed — nothing rendered where there is no phone to follow; the click
 * listens (or asks iOS first, inside the click); an absolute reading is a
 * facing, turned by the screen angle and rounded, one per frame; a relative
 * reading is the note; a refusal is the other note; `stop` ends listening.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { FollowPhone } from './FollowPhone';
import { useFollowPhone } from './useFollowPhone';

/** The hook and the control together, with the facing and a `stop` the dome's `onDrag` would call. */
function Harness() {
  const follow = useFollowPhone();
  return (
    <>
      <FollowPhone follow={follow} />
      <output data-testid="facing">{follow.facingAzDeg === null ? 'none' : String(follow.facingAzDeg)}</output>
      <button type="button" onClick={follow.stop}>
        drag
      </button>
    </>
  );
}

/** A hand-driven `requestAnimationFrame`: `frame()` runs every pending callback. */
function scriptedFrames() {
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
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => {
      for (const callback of callbacks) callback(16);
    });
  };
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

describe('<FollowPhone> with useFollowPhone (FR-LIVE-8)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'ondeviceorientationabsolute');
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

  it('listens on the click, turns an absolute reading into a whole-degree facing once per frame, and stops on a drag', async () => {
    const frame = scriptedFrames();
    withPhone();
    const { container } = render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    // Not listening yet: a reading changes nothing.
    reading({ alpha: 270, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('none');

    fireEvent.click(toggle);
    // R39 (F-42): the click arms the listener; the first reading is what says the dome is following.
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    expect(screen.queryByTestId('follow-note')).toBeNull();
    reading({ alpha: 270, absolute: true });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    expect(screen.getByTestId('facing')).toHaveTextContent('none'); // not before the frame
    reading({ alpha: 269.6, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('90'); // the last reading of the frame, rounded
    // iOS's heading wins over alpha, and the screen's rotation turns it.
    reading({ alpha: 5, absolute: false, webkitCompassHeading: 45.2 });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('45');
    Object.defineProperty(window.screen, 'orientation', { configurable: true, value: { angle: 90 } });
    reading({ alpha: 0, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('90');
    Reflect.deleteProperty(window.screen, 'orientation');
    expect(await axe(container)).toHaveNoViolations();

    // A drag: off, the facing forgotten, readings ignored.
    fireEvent.click(screen.getByRole('button', { name: 'drag' }));
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
    reading({ alpha: 180, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
    // The control turns it back on, and the second click turns it off.
    fireEvent.click(toggle);
    reading({ alpha: 180, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('180');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
  });

  it("prefers Chrome's absolute event where the window has it", () => {
    const frame = scriptedFrames();
    withPhone();
    (window as Window & { ondeviceorientationabsolute?: unknown }).ondeviceorientationabsolute = null;
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: en.live.follow }));
    reading({ alpha: 90, absolute: true }); // the plain event: not listened to here
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
    reading({ alpha: 90, absolute: true }, 'deviceorientationabsolute');
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('270');
  });

  it('shows the note for a relative-only phone, keeps the control pressed, and recovers when a heading arrives', () => {
    const frame = scriptedFrames();
    withPhone();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    reading({ alpha: 30, absolute: false });
    frame();
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'relative');
    expect(screen.getByTestId('follow-note')).toHaveTextContent(en.live.followRelative);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
    reading({ alpha: 30, absolute: true });
    frame();
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    expect(screen.queryByTestId('follow-note')).toBeNull();
    expect(screen.getByTestId('facing')).toHaveTextContent('330');
  });

  it('asks iOS inside the click: granted listens, denied shows the note and the next click asks again', async () => {
    const frame = scriptedFrames();
    const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValueOnce('denied').mockResolvedValueOnce('granted');
    withPhone(requestPermission);
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
    // Nothing is listened to while denied.
    reading({ alpha: 0, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('none');

    fireEvent.click(toggle);
    expect(requestPermission).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
    });
    // Granted, so listening — and off until the sensor says otherwise, like the permission-less path (F-42).
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    expect(screen.queryByTestId('follow-note')).toBeNull();
    reading({ alpha: 0, absolute: true });
    frame();
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    expect(screen.getByTestId('facing')).toHaveTextContent('0');
  });

  /**
   * R39 (F-42): where `requestPermission` is absent — Android, and any desktop
   * browser that still carries the constructor — the state went to `on` on the
   * click and stayed there with no sensor behind it: a control that said the
   * dome was following while the dome stood still.
   */
  it('stays off on the permission-less path until a reading arrives, and the click still disarms it (F-42)', () => {
    const frame = scriptedFrames();
    withPhone();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: en.live.follow });
    fireEvent.click(toggle);
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('follow-note')).toBeNull();
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
    // It is listening, though: the second click turns the listener off again, and readings are ignored.
    fireEvent.click(toggle);
    reading({ alpha: 90, absolute: true });
    frame();
    expect(screen.getByTestId('facing')).toHaveTextContent('none');
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    // Armed again, the first reading is what turns it on.
    fireEvent.click(toggle);
    reading({ alpha: 90, absolute: true });
    frame();
    expect(screen.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('facing')).toHaveTextContent('270');
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
  });
});
