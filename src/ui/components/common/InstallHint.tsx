import { useEffect, useState, useSyncExternalStore } from 'react';
import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { Banner } from './Banner';
import { installOfferState, subscribeToInstallOffer } from './installOffer';
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
 * What the browser has said is not this component's state (R49, F-31): the two
 * events are held by `installOffer.ts`, which listens from the moment the app's
 * modules load, so an event fired while the reader was on `#live` — or before
 * this hint had ever been mounted — is still there to be read. This reads it.
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

export interface InstallHintProps {
  env?: InstallEnv;
  /** R49 (F-30): out of reach while a pass guide is open, at either width — the offer above it is under the same rule (D-154). */
  inert?: boolean;
}

export function InstallHint({ env, inert = false }: InstallHintProps) {
  const t = useT();
  const dismissed = useAppStore((s) => s.installHintDismissed);
  const dismiss = useAppStore((s) => s.dismissInstallHint);
  const { event: offer, installed } = useSyncExternalStore(subscribeToInstallOffer, installOfferState);
  // Read once, at mount: `navigator.standalone` does not change under a page.
  const [standalone] = useState(() => (env ?? browserInstallEnv()).standalone);

  // An install by any route answers the hint for good (FR-OFF-6: once). The
  // latch is written when it is not yet set — `dismissInstallHint` rewrites
  // the prefs blob on every call — and the render below reads `installed`
  // itself, so the banner is never painted for the frame before this runs.
  useEffect(() => {
    if (installed && !dismissed) dismiss();
  }, [installed, dismissed, dismiss]);

  const ios = standalone === false;
  if (dismissed || installed || (offer === null && !ios)) return null;

  const install = (): void => {
    // Whatever the reader answers the browser, the hint has been offered and
    // answered: `beforeinstallprompt` cannot be replayed and a second bar for
    // the same decision is what "once" forbids.
    //
    // R49 (F-32): including an answer the browser gives as a rejection. Chromium
    // rejects `prompt()` when it decides the call is not eligible after all —
    // a second call, a gesture it did not like — and an uncaught rejection is a
    // console error and, behind a reporter, a logged incident, for a reader
    // simply not installing the app. There is nothing to say and nothing to
    // undo: the hint is answered either way.
    void offer?.prompt?.()?.catch(() => undefined);
    dismiss();
  };

  return (
    <Banner variant="info" testId="install-hint" inert={inert}>
      {offer === null ? t.install.ios : t.install.offer}
      {/* The two answers sit on a row of their own, each a tap target tall: side
          by side on one wrapped line their 48 px boxes would overlap, and
          "install" and "not now" are not a pair to be vague about. */}
      <span className={styles.actions}>
        {offer !== null && (
          <button type="button" onClick={install} className={styles.action}>
            {t.install.action}
          </button>
        )}
        <button type="button" onClick={dismiss} className={styles.action}>
          {t.install.dismiss}
        </button>
      </span>
    </Banner>
  );
}
