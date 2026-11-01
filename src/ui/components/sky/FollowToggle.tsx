import { useT } from '../../../i18n/useT';
import { Line } from '../primitives/Line';
import { OptionToggle } from '../primitives/OptionToggle';
import styles from './FollowToggle.module.css';
import type { Follow } from './useFollow';

export interface FollowToggleProps {
  /** The page's `useFollow()`: the state it shows and the presses it makes, shared with the overlay's `FollowControl`. */
  follow: Follow;
  /** `OptionToggle`'s `inline`, for a compact row whose height the toggle must not change. */
  inline?: boolean;
  /** Placement only. */
  className?: string | undefined;
}

/**
 * R151 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-3; US-44 AC1, AC2; PLAN D-943): `[ ] follow the phone` /
 * `[ ] seguir el teléfono` — one `OptionToggle` standing alone that lets the page's own window follow the phone.
 *
 * It is drawn only where FR-WIN-4's presence test passes (`follow.sensor`: the constructor and a touch screen);
 * elsewhere it renders nothing and nothing else changes. R159 (FR-PHONE-1, FR-PHONE-2, D-962): the state is the page's
 * `useFollow()` — on at mount where nothing has to be asked, armed by a saved grant — and the presses are its
 * `turnOn` (asks inside the click, D-175, D-240; follows on a grant, saving it where a request exists) and `turnOff`
 * (asks nothing), the same two the overlay's `[ follow ]` makes. A refusal — or a request that throws, which
 * `orientationAccess` reads as a refusal — leaves it off and one `role="status"` line under it says how to allow it,
 * until the next press of either control; the line is the hook's `refused`, so a refusal from the control or from
 * the first touch on the sky stands here too.
 */
export function FollowToggle({ follow, inline = false, className }: FollowToggleProps) {
  const t = useT();
  if (!follow.sensor) return null;
  return (
    <div className={[styles.follow, className].filter(Boolean).join(' ')} data-testid="follow">
      <OptionToggle label={t.window.followToggle} pressed={follow.on} alone inline={inline} onPress={follow.on ? follow.turnOff : follow.turnOn} data-testid="follow-toggle" />
      {follow.refused && (
        <Line role="status" size="small" className={styles.refused} data-testid="follow-refused">
          {t.window.followRefused}
        </Line>
      )}
    </div>
  );
}
