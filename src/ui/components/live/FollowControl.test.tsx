// @vitest-environment jsdom
/**
 * R157 (FR-PHONE-3, US-45 AC3; PLAN D-964, §9.12): `[ follow ]` / `[ seguir ]` — absent without the constructor or
 * without touch points; a `TextButton` with `pressed`, `aria-pressed` and a target's floor; a tap while off asks for
 * the sensor inside the click and calls `onChange(true)` on a grant and nothing on a refusal; a tap while on asks
 * nothing and calls `onChange(false)`.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { FollowControl } from './FollowControl';

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

function control(on: boolean, onChange: (on: boolean) => void, locale: Locale = 'en') {
  return render(
    <I18nProvider locale={locale}>
      <FollowControl on={on} onChange={onChange} />
    </I18nProvider>,
  );
}

describe('<FollowControl> (FR-PHONE-3)', () => {
  beforeEach(() => {
    resetOrientationAccess();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
  });

  it('is absent without the constructor, and without touch points (FR-WIN-4’s presence test)', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    control(false, () => undefined);
    expect(screen.queryByTestId('live-follow-control')).toBeNull();
    cleanup();
    withPhone(undefined, 0);
    control(false, () => undefined);
    expect(screen.queryByTestId('live-follow-control')).toBeNull();
  });

  it('is a pressed TextButton: aria-pressed by the state, the target floor, `follow` / `seguir`', () => {
    withPhone();
    control(false, () => undefined);
    const off = screen.getByRole('button', { name: 'follow' });
    expect(off).toHaveAttribute('aria-pressed', 'false');
    expect(off).toHaveClass('target');
    expect(off).toHaveAttribute('data-testid', 'live-follow-control');
    cleanup();
    control(true, () => undefined, 'es');
    expect(screen.getByRole('button', { name: 'seguir' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks inside the tap and turns on after a grant; where no request exists it turns on at once (FR-GYRO-2)', async () => {
    const request = vi.fn(() => Promise.resolve<Answer>('granted'));
    withPhone(request);
    const onChange = vi.fn();
    control(false, onChange);
    fireEvent.click(screen.getByTestId('live-follow-control'));
    // The request is made inside the click, before any await (D-175).
    expect(request).toHaveBeenCalledTimes(1);
    await flush();
    expect(onChange).toHaveBeenCalledWith(true);
    cleanup();
    resetOrientationAccess();
    withPhone();
    const onAndroid = vi.fn();
    control(false, onAndroid);
    fireEvent.click(screen.getByTestId('live-follow-control'));
    await flush();
    expect(onAndroid).toHaveBeenCalledWith(true);
  });

  it('stays off after a refusal and draws nothing over the sky (FR-GYRO-3, FR-GYRO-5)', async () => {
    withPhone(() => Promise.resolve<Answer>('denied'));
    const onChange = vi.fn();
    const { container } = control(false, onChange);
    fireEvent.click(screen.getByTestId('live-follow-control'));
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.children).toHaveLength(1);
  });

  it('turns off without asking', () => {
    const request = vi.fn(() => Promise.resolve<Answer>('granted'));
    withPhone(request);
    const onChange = vi.fn();
    control(true, onChange);
    fireEvent.click(screen.getByTestId('live-follow-control'));
    expect(request).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
