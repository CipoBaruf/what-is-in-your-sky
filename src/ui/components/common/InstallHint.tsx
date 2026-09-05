import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { Banner } from './Banner';
import styles from './InstallHint.module.css';

/**
 * FR-OFF-6, US-16 AC4: the app can be installed, and the hint that says so is
 * shown once.
 *
 * Two browsers, two shapes. Chromium fires `beforeinstallprompt` when it has
 * decided the page is installable, which we cancel to keep its own bar out of
 * the way and re-offer here, so the offer sits with the rest of the app's
 * language instead of in a mini-infobar; the button then opens the browser's
 * real dialog through the event we kept. iOS fires that event *never* — the
 * only route is the share sheet — so there is nothing to hold and nothing to
 * click, and the hint is a note naming the two taps. What tells the two apart
 * is `navigator.standalone`, which only Safari defines: defined and false is an
 * iOS browser tab, defined and true is the app already installed and nothing is
 * said at all (D-153).
 *
 * "Once" is a latch in the prefs, not a counter: anything the reader does with
 * the hint — install it, decline the browser's dialog, wave it away — answers
 * it for good, and so does an install that happened by some other route
 * (`appinstalled`). Nothing brings it back but clearing the browser's storage,
 * which is the point of the requirement: an install offer that returns is an
 * install offer that nags.
 *
 * The environment is a prop so a test can be either browser; the app reads the
 * real `navigator`.
 */
export interface InstallEnv {
  /** Safari's own flag, undefined everywhere else: `false` means an iOS tab that could be installed. */
  standalone: boolean | undefined;
}

export function browserInstallEnv(): InstallEnv {
  // Safari's own property, which no DOM library declares, so it is named here.
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { standalone?: boolean });
  return { standalone: nav?.standalone };
}

/**
 * The event Chromium fires and no TypeScript DOM library declares. `prompt` is
 * the browser's own dialog; it can only be called once, and only from the
 * gesture that our button is.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt?: () => Promise<unknown>;
}

export const BEFORE_INSTALL_PROMPT = 'beforeinstallprompt';
export const APP_INSTALLED = 'appinstalled';

export interface InstallHintProps {
  env?: InstallEnv;
}

export function InstallHint({ env }: InstallHintProps) {
  const t = useT();
  const dismissed = useAppStore((s) => s.installHintDismissed);
  const dismiss = useAppStore((s) => s.dismissInstallHint);
  const [offer, setOffer] = useState<BeforeInstallPromptEvent | null>(null);
  // Read once, at mount: `navigator.standalone` does not change under a page.
  const [standalone] = useState(() => (env ?? browserInstallEnv()).standalone);

  useEffect(() => {
    const held = (event: Event): void => {
      // Keep the browser's own mini-infobar out of the way; the offer is ours now.
      event.preventDefault();
      setOffer(event);
    };
    const installed = (): void => {
      dismiss();
    };
    window.addEventListener(BEFORE_INSTALL_PROMPT, held);
    window.addEventListener(APP_INSTALLED, installed);
    return () => {
      window.removeEventListener(BEFORE_INSTALL_PROMPT, held);
      window.removeEventListener(APP_INSTALLED, installed);
    };
  }, [dismiss]);

  const ios = standalone === false;
  if (dismissed || (offer === null && !ios)) return null;

  const install = (): void => {
    // Whatever the reader answers the browser, the hint has been offered and
    // answered: `beforeinstallprompt` cannot be replayed and a second bar for
    // the same decision is what "once" forbids.
    void offer?.prompt?.();
    dismiss();
  };

  return (
    <Banner variant="info" testId="install-hint">
      {offer === null ? t.install.ios : t.install.offer}{' '}
      {offer !== null && (
        <>
          <button type="button" onClick={install} className={`inline-control ${styles.action}`}>
            {t.install.action}
          </button>{' '}
        </>
      )}
      <button type="button" onClick={dismiss} className={`inline-control ${styles.action}`}>
        {t.install.dismiss}
      </button>
    </Banner>
  );
}
