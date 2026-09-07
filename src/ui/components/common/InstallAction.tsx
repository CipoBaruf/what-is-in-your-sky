import type { ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import styles from './InstallAction.module.css';
import { useInstallOffer, type InstallEnv } from './installEnv';

/**
 * R52 (FR-OFF-6 as amended v1.1.2 / V11-16, D-260): the install offer itself —
 * the sentence and, where the browser gives one, the button — with no decline
 * beside it.
 *
 * `InstallHint` used to decide three things at once: is there anything to
 * install, has the reader answered, and which browser is this. The settings row
 * wants the first and the third and not the second, so the pair is split rather
 * than copied. This is the offer; the hint wraps it in a banner, adds the
 * snooze (D-272) and passes its "Not now" in as `trailing`. The copy therefore
 * exists once, and the settings row never asks `installOfferVisibility` at all —
 * which is exactly what makes it survive the third decline.
 *
 * It renders nothing when the browser has nothing to offer, which is also what
 * "already installed" looks like from here. Taking it writes the same latch the
 * hint's own action writes (`dismissInstallHint`), for the same reason:
 * `beforeinstallprompt` cannot be replayed, so a banner offered afterwards
 * would carry a button that no longer works.
 *
 * Phrasing content only — no block elements — because the hint renders it
 * inside `Banner`'s `<p>`.
 */
export interface InstallActionProps {
  /** The browser, as a prop so a test can be either one; the app reads the real `navigator`. */
  env?: InstallEnv;
  /** Rendered beside the action: the hint's "Not now", and nothing on the settings page (V11-16). */
  trailing?: ReactNode;
}

export function InstallAction({ env, trailing }: InstallActionProps) {
  const t = useT();
  const dismiss = useAppStore((s) => s.dismissInstallHint);
  const { event: offer, available } = useInstallOffer(env);

  if (!available) return null;

  const install = (): void => {
    /*
     * Whatever the reader then answers the browser, the offer has been taken:
     * the page is never told, and the event is spent.
     *
     * R49 (F-32): Chromium rejects `prompt()` when it decides the call is not
     * eligible after all, and an uncaught rejection is a console error — and,
     * behind a reporter, a logged incident — for a reader simply not installing
     * the app. There is nothing to say and nothing to undo.
     */
    void offer?.prompt?.()?.catch(() => undefined);
    dismiss();
  };

  return (
    <>
      {offer === null ? t.install.ios : t.install.offer}
      {/* The answers sit on a row of their own, each a tap target tall: side by
          side on one wrapped line their 48 px boxes would overlap, and
          "install" and "not now" are not a pair to be vague about. On the
          settings page there is only one of them, and it keeps the same row. */}
      <span className={styles.actions}>
        {/* iOS has no button to give — the only route is the share sheet, and a
            button that cannot install would be a lie (D-153) — so there the
            note above is the whole of the offer. */}
        {offer !== null && (
          <button type="button" onClick={install} className={styles.action} data-testid="install-action">
            {t.install.action}
          </button>
        )}
        {trailing}
      </span>
    </>
  );
}
