// @vitest-environment jsdom
/**
 * R157 (FR-PHONE-3, US-45 AC3; PLAN D-964, §9.12): `[ follow ]` / `[ seguir ]` — absent without the constructor or
 * without touch points; a `TextButton` with `pressed`, `aria-pressed` and a target's floor; a tap while off asks for
 * the sensor inside the click and turns on after a grant; a tap while on asks nothing and turns off. R159 (D-962,
 * D-987): the state is the page's `useFollow()`, and a refusal draws the hook's one `role="status"` line beside the
 * control as the sheet's toggle draws it, until the next press.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { appStore } from '../../../state';
import { northReading, undoPhone, withPhone, type PhoneAnswer as Answer } from '../../../../tests/support/phone';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { useFollow } from '../sky/useFollow';
import { FollowControl } from './FollowControl';

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

function Page() {
  return <FollowControl follow={useFollow()} />;
}

function control(locale: Locale = 'en') {
  return render(
    <I18nProvider locale={locale}>
      <Page />
    </I18nProvider>,
  );
}

describe('<FollowControl> (FR-PHONE-3)', () => {
  beforeEach(() => {
    resetOrientationAccess();
    appStore.setState({ followGranted: false });
  });
  afterEach(() => {
    undoPhone();
    resetOrientationAccess();
    localStorage.clear();
    appStore.setState({ followGranted: false });
  });

  it('is absent without the constructor, and without touch points (FR-WIN-4’s presence test)', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    const { unmount } = control();
    expect(screen.queryByTestId('live-follow-control')).toBeNull();
    unmount();
    withPhone(undefined, 0);
    control();
    expect(screen.queryByTestId('live-follow-control')).toBeNull();
  });

  it('is a pressed TextButton: aria-pressed by the state, the target floor, `follow` / `seguir`', () => {
    withPhone(() => Promise.resolve('granted'));
    const { unmount } = control();
    const off = screen.getByRole('button', { name: 'follow' });
    expect(off).toHaveAttribute('aria-pressed', 'false');
    expect(off).toHaveClass('target');
    expect(off).toHaveAttribute('data-testid', 'live-follow-control');
    unmount();
    // FR-PHONE-1: where nothing has to be asked it is pressed from the first reading.
    withPhone();
    control('es');
    northReading();
    expect(screen.getByRole('button', { name: 'seguir' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks inside the tap and turns on after a grant (FR-GYRO-2)', async () => {
    const request = vi.fn(() => Promise.resolve<Answer>('granted'));
    withPhone(request);
    control();
    fireEvent.click(screen.getByTestId('live-follow-control'));
    // The request is made inside the click, before any await (D-175).
    expect(request).toHaveBeenCalledTimes(1);
    await flush();
    expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'true');
  });

  it('stays off after a refusal with the one status line beside it, which goes on the next tap (FR-GYRO-3, D-987)', async () => {
    const request = vi.fn(() => Promise.resolve<Answer>('denied'));
    withPhone(request);
    control('es');
    fireEvent.click(screen.getByTestId('live-follow-control'));
    await flush();
    expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'false');
    const line = screen.getByRole('status');
    expect(line).toBe(screen.getByTestId('live-follow-refused'));
    expect(line).toHaveTextContent('El acceso al movimiento está desactivado. Permitilo en los ajustes del navegador y volvé a tocar.');
    fireEvent.click(screen.getByTestId('live-follow-control'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('turns off without asking', () => {
    withPhone();
    control();
    northReading();
    const button = screen.getByTestId('live-follow-control');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
