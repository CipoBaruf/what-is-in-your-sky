import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/useT';
import { installOfferVisibility } from '../../../lib/installSnooze';
import { useAppStore } from '../../../state';
import { Banner } from './Banner';
import { InstallAction } from './InstallAction';
import styles from './InstallAction.module.css';
import { useInstallOffer, type InstallEnv } from './installEnv';

/**
 * FR-OFF-6, US-16 AC4: the app can be installed, and the hint that says so is
 * shown once — or, since v1.1.2, answered once and declined three times.
 *
 * R55 (D-272): the answer is a latch for the ways of saying yes and a snooze
 * for the way of saying not yet. Installing the app — the offer's own action,
 * or any other route, which is what `appinstalled` reports — ends it for good,
 * and so does *pressing* that action whatever the browser's own dialog then
 * returns, because `beforeinstallprompt` cannot be replayed and a hint that
 * survived that would come back offering a button that no longer works. "Not
 * now" writes a decline instead: the hint is away for `INSTALL_SNOOZE_DAYS[n]`
 * and then may return, until the decline past the last of them, which ends it
 * after all. Three refusals, by default, and no more — an install offer that
 * returns forever is an install offer that nags.
 *
 * R52 (D-260): what the offer *is* — the sentence, the button, the two
 * browsers — is `InstallAction`, which the settings page renders on its own
 * with no decline beside it (V11-16). This is the banner around it: where it
 * appears, when it may appear, and the "Not now" that is the only thing the
 * settings row does not have. So the copy exists once and the two places cannot
 * drift, while the snooze stays here, where the answer is.
 *
 * The clock is read once, at mount: this is a banner on the home screen, and a
 * snooze that runs out while the reader is looking at the page can wait for the
 * next load. What the browser is offering still gates the Chromium shape, so a
 * returning hint only appears where `beforeinstallprompt` has fired on this
 * load — which is exactly when its button works.
 *
 * The environment is a prop so a test can be either browser; the app reads the
 * real `navigator`.
 */
export type { InstallEnv };

export interface InstallHintProps {
  env?: InstallEnv;
  /** R49 (F-30): out of reach while a pass guide is open, at either width — the offer above it is under the same rule (D-154). */
  inert?: boolean;
}

export function InstallHint({ env, inert = false }: InstallHintProps) {
  const t = useT();
  const answer = useAppStore((s) => s.installAnswer);
  const dismiss = useAppStore((s) => s.dismissInstallHint);
  const declineOffer = useAppStore((s) => s.declineInstallHint);
  const { installed, available } = useInstallOffer(env);
  // The snooze is not ticked (D-272): read once, at mount.
  const [now] = useState(() => Date.now());
  const visibility = installOfferVisibility(answer, now);

  // An install by any route answers the hint for good. The latch is written
  // when it is not yet set — `dismissInstallHint` rewrites the prefs blob on
  // every call — and the render below reads `installed` itself, so the banner
  // is never painted for the frame before this runs.
  useEffect(() => {
    if (installed && answer.dismissed !== true) dismiss();
  }, [installed, answer.dismissed, dismiss]);

  if (visibility !== 'shown' || !available) return null;

  return (
    <Banner variant="info" testId="install-hint" inert={inert}>
      <InstallAction
        {...(env ? { env } : {})}
        trailing={
          <button type="button" onClick={declineOffer} className={styles.action}>
            {t.install.dismiss}
          </button>
        }
      />
    </Banner>
  );
}
