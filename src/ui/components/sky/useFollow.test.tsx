// @vitest-environment jsdom
/**
 * R159 (FR-PHONE-1, FR-PHONE-2, FR-GYRO-1..3 as amended; US-45 AC1, AC2; PLAN D-962, §9.12): `useFollow` — on at
 * mount where nothing has to be asked; armed with a saved grant where a request exists; off otherwise and without the
 * sensor; a press asks exactly once inside the gesture, follows on a grant and saves it where a request exists;
 * a refusal leaves it off with `refused`, clears the saved grant and never writes one.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY } from '../../../data/localPrefs';
import { appStore } from '../../../state';
import { northReading, nullReading, undoPhone, withPhone, type PhoneAnswer } from '../../../../tests/support/phone';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { FOLLOW_DEFAULT, useFollow } from './useFollow';

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const saved = (): unknown => (JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { followGranted?: unknown }).followGranted;

describe('useFollow (FR-PHONE-1, FR-PHONE-2; D-962)', () => {
  beforeEach(() => {
    resetOrientationAccess();
    localStorage.clear();
    appStore.setState({ followGranted: false });
  });
  afterEach(() => {
    undoPhone();
    resetOrientationAccess();
    localStorage.clear();
    appStore.setState({ followGranted: false });
  });

  it('declares FOLLOW_DEFAULT on, the spec’s constant', () => {
    expect(FOLLOW_DEFAULT).toBe(true);
  });

  it('follows from the first reading with a north where the sensor is and nothing has to be asked (FR-PHONE-1), and asks nothing', () => {
    withPhone();
    const { result } = renderHook(() => useFollow());
    expect(result.current).toMatchObject({ sensor: true, on: false, armed: false, refused: false });
    // D-986: a desk Chromium's reading, every angle null, has no north and starts nothing.
    nullReading();
    expect(result.current.on).toBe(false);
    northReading(90);
    expect(result.current).toMatchObject({ sensor: true, on: true, armed: false, refused: false });
    expect(saved()).toBeUndefined();
  });

  it('a press before the first reading wins: off stays off when the reading comes', () => {
    withPhone();
    const { result } = renderHook(() => useFollow());
    act(() => {
      result.current.turnOff();
    });
    northReading(90);
    expect(result.current.on).toBe(false);
  });

  it('is off and unarmed without the sensor — no constructor, or no touch points — whatever is saved', () => {
    appStore.getState().setFollowGranted(true);
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    expect(renderHook(() => useFollow()).result.current).toMatchObject({ sensor: false, on: false, armed: false });
    withPhone(undefined, 0);
    expect(renderHook(() => useFollow()).result.current).toMatchObject({ sensor: false, on: false, armed: false });
  });

  it('is off and unarmed on a first visit where a request exists, and asks nothing at load (FR-WIN-4)', () => {
    const request = vi.fn<() => Promise<PhoneAnswer>>().mockResolvedValue('granted');
    withPhone(request);
    const { result } = renderHook(() => useFollow());
    expect(result.current).toMatchObject({ sensor: true, on: false, armed: false });
    expect(request).not.toHaveBeenCalled();
  });

  it('is armed, not on, with a saved grant where a request exists, and asks nothing at load (FR-PHONE-2)', () => {
    const request = vi.fn<() => Promise<PhoneAnswer>>().mockResolvedValue('granted');
    withPhone(request);
    appStore.getState().setFollowGranted(true);
    const { result } = renderHook(() => useFollow());
    expect(result.current).toMatchObject({ on: false, armed: true });
    expect(request).not.toHaveBeenCalled();
  });

  it('asks once inside the press, follows on a grant and saves it; the first visit’s grant arms the next visit', async () => {
    const request = vi.fn<() => Promise<PhoneAnswer>>().mockResolvedValue('granted');
    withPhone(request);
    const { result, unmount } = renderHook(() => useFollow());
    act(() => {
      result.current.turnOn();
    });
    // Inside the press, before anything is awaited (D-175).
    expect(request).toHaveBeenCalledTimes(1);
    await flush();
    expect(result.current).toMatchObject({ on: true, armed: false, refused: false });
    expect(appStore.getState().followGranted).toBe(true);
    expect(saved()).toBe(true);
    unmount();
    resetOrientationAccess();
    const next = renderHook(() => useFollow());
    expect(next.result.current).toMatchObject({ on: false, armed: true });
  });

  it('the armed visit’s press asks exactly once and disarms, whatever comes after', async () => {
    const request = vi.fn<() => Promise<PhoneAnswer>>().mockResolvedValue('granted');
    withPhone(request);
    appStore.getState().setFollowGranted(true);
    const { result } = renderHook(() => useFollow());
    act(() => {
      result.current.turnOn();
    });
    expect(result.current.armed).toBe(false);
    await flush();
    expect(result.current.on).toBe(true);
    // A drag takes the sky back; nothing is asked again and the saved grant stands.
    act(() => {
      result.current.onFollowEnd();
    });
    expect(result.current).toMatchObject({ on: false, armed: false });
    expect(request).toHaveBeenCalledTimes(1);
    expect(saved()).toBe(true);
  });

  it('a refusal leaves it off with `refused`, clears the saved grant, and the next press takes the line away', async () => {
    const request = vi.fn<() => Promise<PhoneAnswer>>().mockResolvedValue('denied');
    withPhone(request);
    appStore.getState().setFollowGranted(true);
    const { result } = renderHook(() => useFollow());
    act(() => {
      result.current.turnOn();
    });
    await flush();
    expect(result.current).toMatchObject({ on: false, armed: false, refused: true });
    expect(appStore.getState().followGranted).toBe(false);
    expect(saved()).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    request.mockResolvedValueOnce('granted');
    act(() => {
      result.current.turnOn();
    });
    expect(result.current.refused).toBe(false);
    await flush();
    expect(result.current.on).toBe(true);
  });

  it('a refusal on a first visit writes nothing; a throwing request is a refusal', async () => {
    withPhone(vi.fn<() => Promise<PhoneAnswer>>().mockRejectedValue(new Error('insecure')));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useFollow());
    act(() => {
      result.current.turnOn();
    });
    await flush();
    expect(result.current.refused).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
    setItem.mockRestore();
  });

  it('leaves it off when the grant answers after the reader turned it off or a drag took the sky (the last word stands)', async () => {
    let answer: (value: PhoneAnswer) => void = () => undefined;
    withPhone(() => new Promise<PhoneAnswer>((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useFollow());
    act(() => {
      result.current.turnOn();
    });
    act(() => {
      result.current.onFollowEnd();
    });
    answer('granted');
    await flush();
    expect(result.current.on).toBe(false);
    // The grant is the reader's all the same: saved, and the next press follows.
    expect(saved()).toBe(true);
  });

  it('starts on, asking nothing, where this page session has already been granted and the grant is saved (iOS answers from memory)', async () => {
    const request = vi.fn<() => Promise<PhoneAnswer>>().mockResolvedValue('granted');
    withPhone(request);
    const first = renderHook(() => useFollow());
    act(() => {
      first.result.current.turnOn();
    });
    await flush();
    first.unmount();
    const next = renderHook(() => useFollow());
    expect(next.result.current).toMatchObject({ on: true, armed: false });
    expect(next.result.current.firstTouch).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('hands SkyViewLayout its first touch only while armed', () => {
    withPhone(() => Promise.resolve('granted'));
    appStore.getState().setFollowGranted(true);
    const { result } = renderHook(() => useFollow());
    expect(result.current.firstTouch).toBe(result.current.turnOn);
    act(() => {
      result.current.turnOn();
    });
    expect(result.current.firstTouch).toBeUndefined();
  });

  it('turns off without asking, and a grant where no request exists saves nothing (Android needs no grant)', async () => {
    withPhone();
    const { result } = renderHook(() => useFollow());
    northReading();
    act(() => {
      result.current.turnOff();
    });
    expect(result.current.on).toBe(false);
    act(() => {
      result.current.turnOn();
    });
    await flush();
    expect(result.current.on).toBe(true);
    expect(saved()).toBeUndefined();
  });
});
