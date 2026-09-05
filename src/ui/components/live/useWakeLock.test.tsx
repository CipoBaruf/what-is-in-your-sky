/**
 * R34 (FR-LIVE-7, US-15 AC7): the wake lock with the API stubbed — requested
 * on mount while visible, released when the document hides, requested again
 * when it shows, released on unmount; a refusal is reported and asked again
 * on the next visibility change; and with no API at all, `absent` and no
 * listener.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock';

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
  fire: () => void;
}

function fakeWakeLock() {
  const sentinels: FakeSentinel[] = [];
  let refuse = false;
  const request = vi.fn((_type: 'screen') => {
    if (refuse) return Promise.reject(new DOMException('no', 'NotAllowedError'));
    const listeners: (() => void)[] = [];
    const sentinel: FakeSentinel = {
      released: false,
      release: () => {
        sentinel.released = true;
        return Promise.resolve();
      },
      addEventListener: (_type, listener) => {
        listeners.push(listener);
      },
      fire: () => {
        sentinel.released = true;
        for (const listener of listeners) listener();
      },
    };
    sentinels.push(sentinel);
    return Promise.resolve(sentinel);
  });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return {
    request,
    sentinels,
    setRefuse: (value: boolean) => {
      refuse = value;
    },
  };
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function Probe({ enabled = true }: { enabled?: boolean }) {
  return <output data-testid="wake">{useWakeLock(enabled)}</output>;
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

describe('useWakeLock (FR-LIVE-7)', () => {
  afterEach(() => {
    // Restore jsdom's navigator, which has no wake lock at all.
    delete (navigator as unknown as Record<string, unknown>)['wakeLock'];
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('is absent, and asks nothing, without the API', () => {
    render(<Probe />);
    expect(screen.getByTestId('wake')).toHaveTextContent('absent');
    setVisibility('hidden');
    setVisibility('visible');
    expect(screen.getByTestId('wake')).toHaveTextContent('absent');
  });

  it('requests on mount while visible, releases on hidden, requests again on visible, and releases on unmount', async () => {
    const api = fakeWakeLock();
    const { unmount } = render(<Probe />);
    expect(api.request).toHaveBeenCalledWith('screen');
    await flush();
    expect(screen.getByTestId('wake')).toHaveTextContent('held');

    setVisibility('hidden');
    expect(api.sentinels[0]?.released).toBe(true);
    expect(screen.getByTestId('wake')).toHaveTextContent('released');

    setVisibility('visible');
    expect(api.request).toHaveBeenCalledTimes(2);
    await flush();
    expect(screen.getByTestId('wake')).toHaveTextContent('held');
    // A visible → visible change does not stack a second lock on the one held.
    setVisibility('visible');
    expect(api.request).toHaveBeenCalledTimes(2);

    unmount();
    expect(api.sentinels[1]?.released).toBe(true);
  });

  it('follows a release the browser makes on its own, and reports a refusal', async () => {
    const api = fakeWakeLock();
    render(<Probe />);
    await flush();
    expect(screen.getByTestId('wake')).toHaveTextContent('held');
    act(() => {
      api.sentinels[0]?.fire();
    });
    expect(screen.getByTestId('wake')).toHaveTextContent('released');

    api.setRefuse(true);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(screen.getByTestId('wake')).toHaveTextContent('refused');
    api.setRefuse(false);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(screen.getByTestId('wake')).toHaveTextContent('held');
  });

  it('asks nothing while disabled, and asks once enabled', async () => {
    const api = fakeWakeLock();
    const { rerender } = render(<Probe enabled={false} />);
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.getByTestId('wake')).toHaveTextContent('released');
    rerender(<Probe enabled />);
    expect(api.request).toHaveBeenCalledTimes(1);
    await flush();
    expect(screen.getByTestId('wake')).toHaveTextContent('held');
  });
});
