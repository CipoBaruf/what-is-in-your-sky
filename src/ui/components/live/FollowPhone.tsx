import { useT } from '../../../i18n/useT';
import styles from './FollowPhone.module.css';
import type { FollowPhoneHandle } from './useFollowPhone';

/**
 * R34 (FR-LIVE-8, US-10): the `[ ] Follow phone` control, a pressed text
 * toggle like the hidden-objects one (FR-X-5: the state is in the characters),
 * and beside it the one-line note for a relative-only device or a refused
 * permission. Pure display: `useFollowPhone` owns the sensor and the state,
 * and the page passes the handle down. Nothing at all where there is no phone
 * to follow — a desktop gets no disabled control (PLAN §8.8).
 */
export function FollowPhone({ follow }: { follow: FollowPhoneHandle }) {
  const t = useT();
  if (!follow.available) return null;
  const pressed = follow.state === 'on' || follow.state === 'relative';
  const note = follow.state === 'relative' ? t.live.followRelative : follow.state === 'denied' ? t.live.followDenied : null;
  return (
    <div className={styles.follow} data-testid="follow-phone" data-state={follow.state}>
      <button type="button" className={styles.toggle} aria-pressed={pressed} onClick={follow.toggle} data-testid="follow-toggle">
        {t.live.follow}
      </button>
      {note !== null && (
        <span role="status" className={styles.note} data-testid="follow-note">
          {note}
        </span>
      )}
    </div>
  );
}
