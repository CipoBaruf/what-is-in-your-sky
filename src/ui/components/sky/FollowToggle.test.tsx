// @vitest-environment jsdom
/**
 * R151 (FR-GYRO-1, FR-GYRO-3, FR-GYRO-9; US-44 AC1, AC2; PLAN D-943, §9.11): `[ follow the phone ]` — absent without
 * the constructor or without touch points; a grant asks inside the click and turns it on; a refusal (or a throwing
 * request) leaves it off with the one `role="status"` line, which goes on the next click; turning it off asks
 * nothing; and the two lines in both languages. R159 (D-962): the state is the page's `useFollow()`, so the toggle is
 * tested in a page that holds one, with the overlay's control beside it where they must agree.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import { appStore } from '../../../state';
import { undoPhone, withPhone as phone, type PhoneAnswer as Answer } from '../../../../tests/support/phone';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { FollowControl } from '../live/FollowControl';
import { FollowToggle } from './FollowToggle';
import { useFollow } from './useFollow';

/** A phone that, unless `on` asks otherwise, opens with following off: the first visit's rule where a request exists. */
function withPhone(requestPermission: () => Promise<Answer> = () => Promise.resolve('granted'), touchPoints = 5): void {
  phone(requestPermission, touchPoints);
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** R159 (D-962): the page's one `useFollow()`, its state reported to `onChange` and handed to the toggle (and, with `both`, the overlay's control). */
function Page({ onChange, both }: { onChange: (on: boolean) => void; both: boolean }) {
  const follow = useFollow();
  onChange(follow.on);
  return (
    <>
      <FollowToggle follow={follow} />
      {both && <FollowControl follow={follow} />}
    </>
  );
}

/**
 * The toggle in a page whose state starts at `on`: off is the first visit with a request; on is a phone with no
 * request (FR-PHONE-1), so tests that start on run where nothing is asked. `onChange` hears each state change.
 */
function toggle(on: boolean, onChange: (on: boolean) => void, locale: Locale = 'en', both = false) {
  if (on) phone(undefined);
  let last: boolean | null = null;
  const report = (next: boolean): void => {
    if (last !== null && next !== last) onChange(next);
    last = next;
  };
  return render(
    <I18nProvider locale={locale}>
      <Page onChange={report} both={both} />
    </I18nProvider>,
  );
}

describe('<FollowToggle> (FR-GYRO-1, FR-GYRO-3)', () => {
  beforeEach(() => {
    resetOrientationAccess();
    appStore.setState({ followGranted: false });
  });
  afterEach(() => {
    cleanup();
    undoPhone();
    resetOrientationAccess();
    localStorage.clear();
    appStore.setState({ followGranted: false });
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

  it('is on at mount where no request exists (Android, FR-PHONE-1), and off and on again asks nothing', async () => {
    const onChange = vi.fn();
    toggle(true, onChange);
    const button = screen.getByTestId('follow-toggle');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(button);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
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

  it('turns off without asking', async () => {
    const requestPermission = vi.fn<() => Promise<Answer>>().mockResolvedValue('granted');
    withPhone(requestPermission);
    const onChange = vi.fn();
    toggle(false, onChange);
    const button = screen.getByTestId('follow-toggle');
    fireEvent.click(button);
    await flush();
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  /** R159 (FR-PHONE-3, D-962, D-987): the toggle and the overlay's control are one state, one press logic and one refusal line. */
  it('agrees with the overlay’s [ follow ] both ways, and both draw the one refusal until either is pressed again', async () => {
    const requestPermission = vi.fn<() => Promise<Answer>>().mockResolvedValue('denied');
    withPhone(requestPermission);
    toggle(false, vi.fn(), 'en', true);
    const sheet = screen.getByTestId('follow-toggle');
    const overlay = screen.getByTestId('live-follow-control');
    fireEvent.click(overlay);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(screen.getByTestId('follow-refused')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('live-follow-refused')).toHaveAttribute('role', 'status');
    expect(sheet).toHaveAttribute('aria-pressed', 'false');
    expect(overlay).toHaveAttribute('aria-pressed', 'false');
    requestPermission.mockResolvedValueOnce('granted');
    fireEvent.click(sheet);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    await flush();
    expect(sheet).toHaveAttribute('aria-pressed', 'true');
    expect(overlay).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(overlay);
    expect(sheet).toHaveAttribute('aria-pressed', 'false');
    expect(requestPermission).toHaveBeenCalledTimes(2);
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
