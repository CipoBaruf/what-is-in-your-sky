import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { INSTALL_SNOOZE_DAYS } from '../../../lib/installSnooze';
import { appStore } from '../../../state';
import { SettingsPage } from '../../screens/Settings';
import { InstallAction } from './InstallAction';
import type { InstallEnv } from './installEnv';
import { APP_INSTALLED, BEFORE_INSTALL_PROMPT, forgetInstallOffer, installOfferState, type BeforeInstallPromptEvent } from './installOffer';

/**
 * R52 (FR-OFF-6 as amended v1.1.2 / V11-16, D-260): the offer without the
 * banner. What matters here is the half of `InstallHint` it does *not* have: it
 * reads the browser and never the answer, so it survives every snooze and the
 * third decline, and it still writes the latch when it is taken.
 */
const CHROMIUM: InstallEnv = { standalone: undefined };
const IOS_TAB: InstallEnv = { standalone: false };
const IOS_INSTALLED: InstallEnv = { standalone: true };

const initial = appStore.getInitialState();

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
      <InstallAction env={env} />
    </I18nProvider>,
  );

afterEach(() => {
  appStore.setState(initial, true);
  localStorage.clear();
  forgetInstallOffer();
});

describe('<InstallAction> (V11-16, D-260)', () => {
  it('draws nothing where the browser has nothing to offer', () => {
    show(CHROMIUM);
    expect(screen.queryByTestId('install-action')).toBeNull();
    expect(document.body).not.toHaveTextContent(en.install.offer);
  });

  it('draws nothing in an installed iOS app, which is what "already installed" looks like from here', () => {
    show(IOS_INSTALLED);
    expect(document.body).not.toHaveTextContent(en.install.ios);
  });

  it('is the sentence and the button on Chromium, with no decline beside it', () => {
    const { event } = installable();
    fire(event);
    show(CHROMIUM);
    expect(document.body).toHaveTextContent(en.install.offer);
    expect(screen.getByTestId('install-action')).toHaveTextContent(en.install.action);
    expect(screen.queryByRole('button', { name: en.install.dismiss })).toBeNull();
  });

  it('is the two-tap note and no button on an iOS tab: there is no dialog to open (D-153)', () => {
    show(IOS_TAB);
    expect(document.body).toHaveTextContent(en.install.ios);
    expect(screen.queryByTestId('install-action')).toBeNull();
  });

  it('opens the browser dialog and ends the hint when it is taken', async () => {
    const { event, prompt } = installable();
    fire(event);
    show(CHROMIUM);
    await userEvent.click(screen.getByTestId('install-action'));
    expect(prompt).toHaveBeenCalledOnce();
    expect(appStore.getState().installAnswer.dismissed).toBe(true);
  });

  it('swallows a prompt() the browser rejects, which is a reader not installing the app and not an error (F-32)', async () => {
    const prompt = vi.fn(() => Promise.reject(new Error('not eligible')));
    const event = Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt }) as BeforeInstallPromptEvent;
    fire(event);
    show(CHROMIUM);
    await userEvent.click(screen.getByTestId('install-action'));
    expect(appStore.getState().installAnswer.dismissed).toBe(true);
  });

  /*
   * The whole point of the split (D-260): the settings row asks the browser, so
   * every state of the *answer* leaves it where it was.
   */
  it('is still offered while a snooze is running and after the last decline (V11-16)', () => {
    const { event } = installable();
    fire(event);
    act(() => {
      // One more decline than there are snoozes: the latch, by way of "Not now".
      for (let i = 0; i <= INSTALL_SNOOZE_DAYS.length; i += 1) appStore.getState().declineInstallHint();
    });
    expect(appStore.getState().installAnswer.dismissed).toBe(true);
    show(CHROMIUM);
    expect(screen.getByTestId('install-action')).toBeInTheDocument();
  });

  /*
   * R91 (FR-FAIL-8, D-550, F-95): one press used to spend the settings row — the latch written whatever the
   * answer and the used event held for good, so after a cancelled dialog the button stayed and did nothing.
   */
  describe('a cancelled dialog (R91)', () => {
    const dismissedPrompt = () => vi.fn(() => Promise.resolve({ outcome: 'dismissed' }));
    const offer = (prompt: ReturnType<typeof vi.fn>): BeforeInstallPromptEvent => Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt }) as BeforeInstallPromptEvent;
    const showBare = () =>
      render(
        <I18nProvider locale="en">
          <InstallAction env={CHROMIUM} bare />
        </I18nProvider>,
      );

    it('leaves the settings button working: no latch, the spent event let go, the next offer prompted', async () => {
      const first = dismissedPrompt();
      fire(offer(first));
      showBare();
      await userEvent.click(screen.getByTestId('install-action'));
      expect(first).toHaveBeenCalledOnce();
      expect(appStore.getState().installAnswer.dismissed).not.toBe(true);
      // Chromium offers again after a cancelled dialog; that event is held like the first and the button uses it.
      const second = dismissedPrompt();
      fire(offer(second));
      await userEvent.click(screen.getByTestId('install-action'));
      expect(second).toHaveBeenCalledOnce();
      expect(first).toHaveBeenCalledOnce(); // the spent event is never prompted twice
      expect(appStore.getState().installAnswer.dismissed).not.toBe(true);
      // With no offer held there is no dialog to open, so no button stands that would do nothing (F-95).
      expect(screen.queryByTestId('install-action')).toBeNull();
      fire(offer(dismissedPrompt()));
      expect(screen.getByTestId('install-action')).toBeEnabled();
    });

    it('lets the used event go once the prompt answers, and keeps one offered while the dialog was open', async () => {
      let answer: (value: unknown) => void = () => undefined;
      const used = offer(vi.fn(() => new Promise((resolve) => (answer = resolve))));
      fire(used);
      showBare();
      await userEvent.click(screen.getByTestId('install-action'));
      const fresh = offer(dismissedPrompt());
      fire(fresh);
      await act(async () => {
        answer({ outcome: 'dismissed' });
        await Promise.resolve();
      });
      expect(installOfferState().event).toBe(fresh);
    });

    it('lets the used event go when the dialog is cancelled', async () => {
      fire(offer(dismissedPrompt()));
      showBare();
      await userEvent.click(screen.getByTestId('install-action'));
      expect(installOfferState().event).toBeNull();
    });
  });

  // R91 (FR-SET-1 as amended v2.1, F-83): the settings row's label is `App`, so the action is not said twice.
  for (const locale of ['en', 'es'] as const) {
    it(`reads App [ ${(locale === 'en' ? en : es).install.action} ] on the settings page in ${locale}`, () => {
      fire(installable().event);
      render(
        <I18nProvider locale={locale}>
          <SettingsPage onLeave={vi.fn()} installEnv={CHROMIUM} />
        </I18nProvider>,
      );
      const row = screen.getByTestId('settings-install');
      expect(row.previousElementSibling).toHaveTextContent(/^App$/);
      expect(within(row).getByTestId('install-action')).toHaveTextContent(new RegExp(`^${(locale === 'en' ? en : es).install.action}$`));
      expect(`${row.previousElementSibling?.textContent ?? ''} [ ${row.textContent ?? ''} ]`).toBe(`App [ ${(locale === 'en' ? en : es).install.action} ]`);
    });
  }

  it('goes away once the browser reports the app installed, by any route', () => {
    const { event } = installable();
    fire(event);
    fire(new Event(APP_INSTALLED));
    show(CHROMIUM);
    expect(screen.queryByTestId('install-action')).toBeNull();
  });
});
