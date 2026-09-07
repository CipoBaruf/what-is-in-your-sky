/**
 * R52 (FR-COMP-2, US-20 AC2/AC4, V11-16, D-184, D-260): the settings page.
 *
 * The controls are the home screen's own, so what is tested here is what the
 * screen adds: that it renders them in FR-COMP-2's order, that each one still
 * writes the store field it wrote on the home screen with no save action in
 * between, that the install row is the offer and not the answer, and that the
 * three ways out lead back to the home screen. The route and the header are
 * covered from `App` (`App.settings.test.tsx`), which is where they meet.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../i18n/en';
import { I18nProvider } from '../../i18n/useT';
import { INSTALL_SNOOZE_DAYS } from '../../lib/installSnooze';
import type { Observer } from '../../model';
import { appStore } from '../../state';
import type { InstallEnv } from '../components/common/installEnv';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from '../components/common/installOffer';
import { SettingsPage } from './Settings';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();
const CHROMIUM: InstallEnv = { standalone: undefined };
const NOTHING_TO_OFFER = CHROMIUM;

const offerAnInstall = (): void => {
  const event = Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt: vi.fn(() => Promise.resolve({ outcome: 'accepted' })) }) as BeforeInstallPromptEvent;
  act(() => {
    window.dispatchEvent(event);
  });
};

const show = (onLeave = vi.fn(), env: InstallEnv = NOTHING_TO_OFFER, locale: 'en' | 'es' = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <SettingsPage onLeave={onLeave} installEnv={env} />
    </I18nProvider>,
  );

afterEach(() => {
  act(() => {
    appStore.setState(initial, true);
  });
  localStorage.clear();
  forgetInstallOffer();
});

describe('<SettingsPage> (FR-COMP-2)', () => {
  it('renders the sections in FR-COMP-2 order, with no save action and no axe violations', async () => {
    act(() => {
      appStore.setState({ observer });
    });
    offerAnInstall();
    const { container } = show(vi.fn(), CHROMIUM);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([en.app.language, en.app.theme, en.location.heading, en.install.action]);
    /*
     * FR-COMP-2's order, read off the page rather than off the headings: the
     * saved places are titled by a paragraph rather than a heading (R28's own
     * choice) and the clear action has no title at all, so the six rows are
     * compared by where their text falls in the rendered order.
     */
    const text = screen.getByRole('main').textContent ?? '';
    const at = (needle: string): number => {
      const index = text.indexOf(needle);
      expect(index, `"${needle}" is on the page`).toBeGreaterThanOrEqual(0);
      return index;
    };
    const order = [en.app.language, en.app.theme, en.location.heading, en.favourites.heading, en.install.action, en.location.clearSaved].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(screen.queryByRole('button', { name: /save settings/i })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('writes the same store fields the home screen wrote, at once (US-20 AC2)', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(appStore.getState().locale).toBe('es');
    await userEvent.click(screen.getByRole('button', { name: en.app.themes.night }));
    expect(appStore.getState().theme).toBe('night');
  });

  it('takes focus to the way out, which is the control the reader arrived on the page needing', () => {
    show();
    expect(screen.getByTestId('settings-back')).toHaveFocus();
  });

  it('leaves through its own back control (US-20 AC4)', async () => {
    const onLeave = vi.fn();
    show(onLeave);
    await userEvent.click(screen.getByTestId('settings-back'));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('clears the saved location from the control at the end of the page', async () => {
    act(() => {
      appStore.setState({ observer });
    });
    show();
    await userEvent.click(screen.getByTestId('clear-saved-location'));
    expect(appStore.getState().observer).toBeNull();
    // The control goes with the location it cleared: there is nothing left to clear.
    expect(screen.queryByTestId('clear-saved-location')).toBeNull();
  });
});

describe('<SettingsPage> install row (V11-16, D-260)', () => {
  it('is absent when the browser has nothing to offer', () => {
    show();
    expect(screen.queryByTestId('settings-install')).toBeNull();
  });

  it('is present, with no decline beside it, when the browser offers an install', () => {
    offerAnInstall();
    show(vi.fn(), CHROMIUM);
    const row = screen.getByTestId('settings-install');
    expect(within(row).getByTestId('install-action')).toHaveTextContent(en.install.action);
    expect(within(row).queryByRole('button', { name: en.install.dismiss })).toBeNull();
  });

  it('is still present after the last decline and while a snooze is running', () => {
    offerAnInstall();
    act(() => {
      for (let i = 0; i <= INSTALL_SNOOZE_DAYS.length; i += 1) appStore.getState().declineInstallHint();
    });
    show(vi.fn(), CHROMIUM);
    expect(screen.getByTestId('settings-install')).toBeInTheDocument();
  });

  it('takes the iOS shape where that is the browser: the note and no button', () => {
    show(vi.fn(), { standalone: false });
    const row = screen.getByTestId('settings-install');
    expect(row).toHaveTextContent(en.install.ios);
    expect(within(row).queryByTestId('install-action')).toBeNull();
  });

  it('installs and ends the hint when it is taken', async () => {
    offerAnInstall();
    show(vi.fn(), CHROMIUM);
    await userEvent.click(screen.getByTestId('install-action'));
    expect(appStore.getState().installAnswer.dismissed).toBe(true);
  });
});
