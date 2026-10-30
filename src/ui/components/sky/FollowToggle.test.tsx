// @vitest-environment jsdom
/**
 * R151 (FR-GYRO-1, FR-GYRO-3, FR-GYRO-9; US-44 AC1, AC2; PLAN D-943, §9.11): `[ follow the phone ]` — absent without
 * the constructor or without touch points; a grant asks inside the click and calls `onChange(true)`; a refusal (or a
 * throwing request) leaves it off with the one `role="status"` line, which goes on the next click; turning it off
 * asks nothing; and the two lines in both languages.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { FollowToggle } from './FollowToggle';

type Answer = 'granted' | 'denied';

/** A touch screen with `DeviceOrientationEvent`, and iOS's request where one is given. */
function withPhone(requestPermission?: () => Promise<Answer>, touchPoints = 5): void {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(
      function DeviceOrientationEvent() {
        return undefined;
      },
      requestPermission ? { requestPermission } : {},
    ),
  );
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touchPoints });
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

function toggle(on: boolean, onChange: (on: boolean) => void, locale: Locale = 'en') {
  return render(
    <I18nProvider locale={locale}>
      <FollowToggle on={on} onChange={onChange} />
    </I18nProvider>,
  );
}

describe('<FollowToggle> (FR-GYRO-1, FR-GYRO-3)', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
  });

  it('is absent without the constructor, and without touch points (FR-GYRO-1)', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    const { container, unmount } = toggle(false, vi.fn());
    expect(container).toBeEmptyDOMElement();
    unmount();
    withPhone(undefined, 0);
    const desk = toggle(false, vi.fn());
    expect(desk.container).toBeEmptyDOMElement();
  });

  it('stands as one `[ ] follow the phone` toggle, off, where the sensor is', () => {
    withPhone();
    toggle(false, vi.fn());
    const button = screen.getByTestId('follow-toggle');
    expect(button).toHaveTextContent('follow the phone');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('asks inside the click and turns on when granted (FR-GYRO-2)', async () => {
    const requestPermission = vi.fn<() => Promise<Answer>>().mockResolvedValue('granted');
    withPhone(requestPermission);
    const onChange = vi.fn();
    toggle(false, onChange);
    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('follow-toggle'));
    // The request is made in the click itself, before anything is awaited: iOS grants motion only from a gesture.
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    await flush();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('turns on at once where no request exists (Android)', async () => {
    withPhone();
    const onChange = vi.fn();
    toggle(false, onChange);
    fireEvent.click(screen.getByTestId('follow-toggle'));
    await flush();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('stays off with one status line when refused, and the line goes on the next click (FR-GYRO-3)', async () => {
    const requestPermission = vi.fn<() => Promise<Answer>>().mockResolvedValue('denied');
    withPhone(requestPermission);
    const onChange = vi.fn();
    toggle(false, onChange);
    fireEvent.click(screen.getByTestId('follow-toggle'));
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    const line = screen.getByRole('status');
    expect(line).toHaveTextContent("Motion access is off. Allow it in the browser's settings, then tap again.");
    expect(line).toBe(screen.getByTestId('follow-refused'));
    // The next click asks again — the line goes at once, and comes back only on another refusal.
    requestPermission.mockResolvedValueOnce('granted');
    fireEvent.click(screen.getByTestId('follow-toggle'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    await flush();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reads a throwing request as a refusal (FR-GYRO-3)', async () => {
    withPhone(vi.fn<() => Promise<Answer>>().mockRejectedValue(new Error('insecure')));
    const onChange = vi.fn();
    toggle(false, onChange);
    fireEvent.click(screen.getByTestId('follow-toggle'));
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('turns off without asking', () => {
    const requestPermission = vi.fn<() => Promise<Answer>>().mockResolvedValue('granted');
    withPhone(requestPermission);
    const onChange = vi.fn();
    toggle(true, onChange);
    const button = screen.getByTestId('follow-toggle');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('says both lines in Spanish (FR-GYRO-9)', async () => {
    withPhone(vi.fn<() => Promise<Answer>>().mockResolvedValue('denied'));
    toggle(false, vi.fn(), 'es');
    expect(screen.getByTestId('follow-toggle')).toHaveTextContent('seguir el teléfono');
    fireEvent.click(screen.getByTestId('follow-toggle'));
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent('El acceso al movimiento está desactivado. Permitilo en los ajustes del navegador y volvé a tocar.');
  });
});
