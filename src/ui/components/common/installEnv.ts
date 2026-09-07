import { useState, useSyncExternalStore } from 'react';
import { installOfferState, subscribeToInstallOffer, type BeforeInstallPromptEvent } from './installOffer';

/**
 * R52 (D-260): what this browser can install *right now*, separated from what
 * the reader has answered.
 *
 * `InstallHint` used to hold both, and the settings row needs only this half:
 * whether there is anything to offer and which of the two shapes it takes
 * (FR-OFF-6 as amended v1.1.2, V11-16). The answer — the latch and the snooze
 * of D-272 — stays with the hint, which is what lets the settings row survive
 * the third "Not now".
 *
 * Two browsers, two mechanisms. Chromium fires `beforeinstallprompt`, which
 * `installOffer.ts` cancels and holds from the moment the app's modules load
 * (R49, F-31), and its button opens the browser's real dialog through that
 * event. iOS fires it never — the only route is the share sheet — so there is
 * nothing to hold and nothing to click, and the offer there is a note naming
 * the two taps. What tells them apart is `navigator.standalone`, which only
 * Safari defines: defined and false is an installable iOS tab, defined and true
 * is the app already installed and there is nothing to say at all.
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

export interface InstallOffer {
  /** The held `beforeinstallprompt`, or `null` — on iOS, and before Chromium has decided the page is installable. */
  event: BeforeInstallPromptEvent | null;
  /** `true` once the browser has reported the app installed, by any route. */
  installed: boolean;
  /** Whether there is anything to offer: a held event, or an iOS tab that is not already the app. */
  available: boolean;
}

/**
 * The environment is a prop so a test can be either browser; the app reads the
 * real `navigator`, once at mount — `navigator.standalone` does not change
 * under a page.
 */
export function useInstallOffer(env?: InstallEnv): InstallOffer {
  const { event, installed } = useSyncExternalStore(subscribeToInstallOffer, installOfferState);
  const [standalone] = useState(() => (env ?? browserInstallEnv()).standalone);
  return { event, installed, available: !installed && (event !== null || standalone === false) };
}
