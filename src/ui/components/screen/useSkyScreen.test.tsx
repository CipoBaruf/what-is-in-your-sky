/**
 * R90 (FR-FAIL-7, D-550; F-94): the sky screen's wait. The tap arms a listener
 * and a `SENSOR_WAIT_S` timer; a device that sends nothing within it gets
 * FR-FOL-5's relative note and loses the option, a reading before it is the
 * reading that decides, and an iOS denial's note says how to be asked again.
 * Driven through `SkyChart`, which is where the tap and the note live.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { appStore } from '../../../state';
import { SkyChart } from '../guide/skychart/SkyChart';
import { resetOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { SENSOR_WAIT_S } from './useSkyScreen';

const pass = goldenPassFixture();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

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

function reading(fields: { alpha: number | null; absolute: boolean }): void {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), fields));
  });
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

function tapWindow(label: string): void {
  const group = screen.getByRole('figure').querySelector('[role="group"]') as HTMLElement;
  fireEvent.click(within(group).getByRole('button', { name: label }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetOrientationAccess();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
  appStore.setState(initial, true);
  window.localStorage.clear();
});

describe('the sky screen’s wait (FR-FAIL-7)', () => {
  it('waits three seconds', () => {
    expect(SENSOR_WAIT_S).toBe(3);
  });

  it('shows the relative note and drops the option when no reading arrives within SENSOR_WAIT_S', () => {
    withPhone();
    appStore.getState().setChartView('dome');
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    tapWindow('Window');
    advance(SENSOR_WAIT_S * 1000 - 100);
    expect(screen.queryByTestId('chart-view-note')).toBeNull();
    advance(100);
    expect(appStore.getState().skyScreen).toBe(false);
    expect(appStore.getState().windowNote).toBe('relative');
    expect(screen.getByTestId('chart-view-note')).toHaveTextContent('This device is not reporting which way it faces.');
    expect(screen.getByRole('figure')).toHaveAttribute('data-view', 'dome');
    // A late reading changes nothing: the listener went with the timer.
    reading({ alpha: 30, absolute: true });
    expect(appStore.getState().skyScreen).toBe(false);
  });

  it('opens the screen on a reading at 2.9 s, and the timer does not fire after it', () => {
    withPhone();
    render(<SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />);
    tapWindow('Window');
    advance(2900);
    reading({ alpha: 30, absolute: true });
    expect(appStore.getState().skyScreen).toBe(true);
    advance(5000);
    expect(appStore.getState().skyScreen).toBe(true);
    expect(appStore.getState().windowNote).toBeNull();
    expect(appStore.getState().windowLost).toBe(false);
  });

  it.each([
    ['en', en, 'Window'],
    ['es', es, 'Ventana'],
  ] as const)('after an iOS denial the note says to reload (%s)', async (locale, messages, label) => {
    withPhone(() => Promise.resolve('denied'));
    render(
      <I18nProvider locale={locale}>
        <SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} />
      </I18nProvider>,
    );
    tapWindow(label);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const note = screen.getByTestId('chart-view-note');
    expect(note).toHaveTextContent(messages.window.denied);
    expect(note).toHaveTextContent(locale === 'en' ? 'reload the page' : 'recargá la página');
    expect(note).toHaveTextContent('Safari');
    // A denial is not the silent device: the wait never started, and the option stays.
    advance(SENSOR_WAIT_S * 1000);
    expect(appStore.getState().windowNote).toBe('denied');
    expect(appStore.getState().windowLost).toBe(false);
  });
});
