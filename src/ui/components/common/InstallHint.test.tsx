import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { appStore, type AppState } from '../../../state';
import { InstallHint, type InstallEnv } from './InstallHint';
import { APP_INSTALLED, BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from './installOffer';

/**
 * TASKS R28 (FR-OFF-6, US-16 AC4): the hint is shown in either of the two
 * shapes the browsers give it, and remembered when it is answered. R55
 * (FR-OFF-6 as amended v1.1.2, D-272): installing answers it for good and
 * "Not now" only snoozes it, so these cases separate the two answers. The
 * clock is read at mount, so a case that moves past a snooze mounts again.
 *
 * `beforeinstallprompt` is faked as the browser fires it: a plain event with a
 * `prompt` method on it. The two branches are told apart by the environment
 * prop, which is `navigator.standalone` in the app — undefined on Chromium,
 * false in an iOS tab, true in an installed one.
 */
const CHROMIUM: InstallEnv = { standalone: undefined };
const IOS_TAB: InstallEnv = { standalone: false };
const IOS_INSTALLED: InstallEnv = { standalone: true };

const initial = appStore.getInitialState();

/** The event Chromium fires, with the dialog it carries. */
function installable(): { event: BeforeInstallPromptEvent; prompt: ReturnType<typeof vi.fn> } {
  const prompt = vi.fn(() => Promise.resolve({ outcome: 'accepted' }));
  const event = Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt }) as BeforeInstallPromptEvent;
  return { event, prompt };
}

const fire = (event: Event): void => {
  act(() => {
    window.dispatchEvent(event);
  });
};

const show = (env: InstallEnv, locale: 'en' | 'es' = 'en') =>
  render(
    <I18nProvider locale={locale}>
      <InstallHint env={env} />
    </I18nProvider>,
  );

const state = (): AppState => appStore.getState();

afterEach(() => {
  appStore.setState(initial, true);
  // The store writes the latch through to `localStorage`; jsdom's is shared by the whole file.
  localStorage.clear();
  // R49 (F-31): so is the held offer, which now outlives any one render.
  forgetInstallOffer();
});

describe('InstallHint (R28: FR-OFF-6)', () => {
  it('says nothing on a browser that has not offered an install', () => {
    show(CHROMIUM);
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('offers the install when the browser does, and cancels the browser’s own bar', async () => {
    const user = userEvent.setup();
    const { event, prompt } = installable();
    const { container } = show(CHROMIUM);
    fire(event);
    // Cancelled: the offer is ours, in the app's own language, not a mini-infobar.
    expect(event.defaultPrevented).toBe(true);
    const hint = screen.getByTestId('install-hint');
    expect(hint).toHaveTextContent('Install this app to open it from your home screen');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    // Answered, whatever the browser's dialog goes on to say: the event cannot be replayed.
    expect(state().installAnswer).toEqual({ dismissed: true });
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('"Not now" snoozes rather than answers: a decline, an expiry, and nothing shown until it runs out', async () => {
    const user = userEvent.setup();
    const { unmount } = show(CHROMIUM);
    fire(installable().event);
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(state().installAnswer.dismissed).toBeUndefined();
    expect(state().installAnswer.declines).toBe(1);
    expect(screen.queryByTestId('install-hint')).toBeNull();
    unmount();

    // A fresh page inside the snooze: nothing is shown, on either browser.
    show(CHROMIUM);
    fire(installable().event);
    expect(screen.queryByTestId('install-hint')).toBeNull();
    show(IOS_TAB);
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  /** FR-OFF-6 as amended / US-16 AC4: the offer comes back when the snooze has run out and the browser is still offering. */
  it('shows the offer again once the snooze has expired, and answers it for good on the third decline', async () => {
    const user = userEvent.setup();
    const day = 86_400_000;
    const start = Date.UTC(2026, 8, 6, 21, 0);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(start);
      const first = show(CHROMIUM);
      fire(installable().event);
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      first.unmount();

      // A day short of the week: still away.
      vi.setSystemTime(start + 7 * day - 1);
      const early = show(CHROMIUM);
      fire(installable().event);
      expect(screen.queryByTestId('install-hint')).toBeNull();
      early.unmount();

      // The week is up and the browser is offering again: the hint is back, with a button that works.
      vi.setSystemTime(start + 7 * day);
      const back = show(CHROMIUM);
      fire(installable().event);
      expect(screen.getByTestId('install-hint')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      expect(state().installAnswer).toEqual({ declines: 2, snoozedUntil: start + 7 * day + 30 * day });
      back.unmount();

      // The third refusal is the last one: the offer is answered, and no expiry is left to run out.
      vi.setSystemTime(start + 37 * day);
      const last = show(CHROMIUM);
      fire(installable().event);
      expect(screen.getByTestId('install-hint')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      expect(state().installAnswer).toEqual({ dismissed: true, declines: 3 });
      last.unmount();

      vi.setSystemTime(start + 3650 * day);
      show(CHROMIUM);
      fire(installable().event);
      expect(screen.queryByTestId('install-hint')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('iOS, where the event never fires: the share-sheet note, with no install button', async () => {
    const user = userEvent.setup();
    const { container } = show(IOS_TAB);
    const hint = screen.getByTestId('install-hint');
    expect(hint).toHaveTextContent('tap Share, then “Add to Home Screen”');
    // There is no programmatic install on iOS, so a button that claimed one would lie.
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();

    // The rule is the same on iOS, where "Not now" is the only answer there is (FR-OFF-6 as amended).
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(state().installAnswer).toEqual({ declines: 1, snoozedUntil: expect.any(Number) });
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('says nothing in an already-installed iOS app', () => {
    show(IOS_INSTALLED);
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('an install by any other route answers the hint too', () => {
    show(IOS_TAB);
    expect(screen.getByTestId('install-hint')).toBeInTheDocument();
    fire(new Event(APP_INSTALLED));
    expect(state().installAnswer.dismissed).toBe(true);
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('shows an offer the browser made before the hint was ever mounted (R49, F-31)', () => {
    // The live page: the app is running, this component is not. Chromium fires
    // its one `beforeinstallprompt` here, and on the old code nothing was
    // listening — leaving the route showed no offer for the rest of the session.
    const { event } = installable();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    show(CHROMIUM);
    expect(screen.getByTestId('install-hint')).toHaveTextContent('Install this app');
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('an install reported while the hint was unmounted answers it too (R49, F-31)', () => {
    act(() => {
      window.dispatchEvent(new Event(APP_INSTALLED));
    });
    show(IOS_TAB);
    expect(state().installAnswer.dismissed).toBe(true);
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('writes the latch once: after the install, a later mount neither paints the hint nor rewrites the prefs', () => {
    act(() => {
      window.dispatchEvent(new Event(APP_INSTALLED));
    });
    show(IOS_TAB).unmount();
    expect(state().installAnswer.dismissed).toBe(true);
    const dismiss = vi.fn();
    act(() => {
      appStore.setState({ dismissInstallHint: dismiss });
    });
    show(IOS_TAB);
    expect(dismiss).not.toHaveBeenCalled();
    expect(screen.queryByTestId('install-hint')).toBeNull();
  });

  it('a rejected browser dialog is not an unhandled rejection (R49, F-32)', async () => {
    const user = userEvent.setup();
    const prompt = vi.fn(() => Promise.reject(new Error('prompt() was not eligible')));
    const event = Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt }) as BeforeInstallPromptEvent;
    const unhandled: unknown[] = [];
    const noted = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', noted);
    try {
      show(CHROMIUM);
      fire(event);
      await user.click(screen.getByRole('button', { name: 'Install' }));
      expect(prompt).toHaveBeenCalledTimes(1);
      // The rejection reaches the process on the tick after the microtasks drain.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', noted);
    }
    // The hint is answered whatever the browser said.
    expect(state().installAnswer.dismissed).toBe(true);
  });

  it('is out of reach while a pass is open (R49, F-30)', () => {
    render(
      <I18nProvider locale="en">
        <InstallHint env={IOS_TAB} inert />
      </I18nProvider>,
    );
    expect(screen.getByTestId('install-hint')).toHaveAttribute('inert');
  });

  it('reads in Spanish (FR-I18N-2)', () => {
    show(IOS_TAB, 'es');
    expect(screen.getByTestId('install-hint')).toHaveTextContent('Para instalarla: tocar Compartir');
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
  });
});
