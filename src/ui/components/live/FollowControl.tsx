import { useT } from '../../../i18n/useT';
import { Line } from '../primitives/Line';
import { TextButton } from '../primitives/TextButton';
import type { Follow } from '../sky/useFollow';
import styles from './FollowControl.module.css';

export interface FollowControlProps {
  /** The page's `useFollow()` — the same state and presses the sheet's `FollowToggle` has. */
  follow: Follow;
}

/**
 * R157 (FR-PHONE-3, US-45 AC3; PLAN D-964): `[ follow ]` / `[ seguir ]` on the compact live page's overlay, before
 * `[ controls ]` on its bottom row — a `TextButton` with `pressed`: bracketed in the accent while following, bare and
 * dim while not, with `aria-pressed`, at least 44 × 44 px (`.target`).
 *
 * Drawn only where FR-WIN-4's presence test passes (`follow.sensor`), as the sheet's `[ ] follow the phone` is;
 * elsewhere it renders nothing. R159 (D-962, D-987): it reads the page's `useFollow()` and presses its `turnOn` /
 * `turnOff`, the toggle's own two, so the two never disagree and share one press logic. A refusal (FR-GYRO-3) — from
 * this control, the toggle or the first touch on the sky — draws the hook's one `role="status"` line here as the
 * toggle draws it under itself: the row stands on the box's bottom edge, so the line stands on the row above it, at
 * the box's right margin, and goes on the next press of either control. While it stands the page draws no hint, whose
 * row it takes.
 */
export function FollowControl({ follow }: FollowControlProps) {
  const t = useT();
  if (!follow.sensor) return null;
  return (
    <>
      <TextButton label={t.sheet.follow} pressed={follow.on} onClick={follow.on ? follow.turnOff : follow.turnOn} className="target" data-testid="live-follow-control" />
      {follow.refused && (
        <Line role="status" size="small" className={styles.refused} data-testid="live-follow-refused">
          <span className={styles.rows}>{t.window.followRefused}</span>
        </Line>
      )}
    </>
  );
}
