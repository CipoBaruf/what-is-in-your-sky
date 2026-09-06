/**
 * R49 (F-31): what the browser says about installing this app, held outside
 * any component.
 *
 * `beforeinstallprompt` fires once, when Chromium decides the page is
 * installable, and it fires whenever it likes — typically within the first
 * seconds of the page. Holding it in `InstallHint`'s state meant holding it
 * only while the hint was mounted, and the hint is mounted only under the home
 * screen: a session that opened on `#live` (a shared live link, the hash the
 * browser restored) listened to nothing, the one event went past, and the
 * offer never came back for that page — the reader could not install the app
 * from a route that is otherwise the app. The listener now belongs to the
 * module, registered when this file is first imported, which is when the app's
 * first render is being prepared and before any route has been read; the hint
 * reads what has been held whenever it is mounted, however late that is.
 *
 * `appinstalled` is here for the same reason. It reports an install by some
 * other route (the browser's own menu, or the mini-infobar on a page we never
 * cancelled), and a reader who installs the app from the live page has
 * answered the offer just as finally as one who used our button (FR-OFF-6:
 * once).
 */

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

/** What the browser has said so far. One frozen value per change, so `useSyncExternalStore` can compare by identity. */
export interface InstallOfferState {
  /** The event we cancelled and kept, or `null` if the browser has not offered. */
  event: BeforeInstallPromptEvent | null;
  /** `true` once the browser has reported the app installed, by any route. */
  installed: boolean;
}

const NOTHING: InstallOfferState = { event: null, installed: false };

let current: InstallOfferState = NOTHING;
const watchers = new Set<() => void>();

function update(next: InstallOfferState): void {
  current = next;
  for (const watcher of watchers) watcher();
}

const holdOffer = (event: Event): void => {
  // Keep the browser's own mini-infobar out of the way; the offer is ours now.
  event.preventDefault();
  update({ ...current, event });
};

const noteInstalled = (): void => {
  update({ ...current, installed: true });
};

/** Listen on a window, and stop. The app calls this once, on import; a test can call it on its own window. */
export function listenForInstallOffer(target: Window): () => void {
  target.addEventListener(BEFORE_INSTALL_PROMPT, holdOffer);
  target.addEventListener(APP_INSTALLED, noteInstalled);
  return () => {
    target.removeEventListener(BEFORE_INSTALL_PROMPT, holdOffer);
    target.removeEventListener(APP_INSTALLED, noteInstalled);
  };
}

export function installOfferState(): InstallOfferState {
  return current;
}

export function subscribeToInstallOffer(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

/** Back to a page that has heard nothing. For tests, which share one module across a file. */
export function forgetInstallOffer(): void {
  update(NOTHING);
}

// The one registration, at import: `src/ui/App.tsx` imports the hint on every
// route, so this runs before the first render whichever page is being opened.
if (typeof window !== 'undefined') listenForInstallOffer(window);
