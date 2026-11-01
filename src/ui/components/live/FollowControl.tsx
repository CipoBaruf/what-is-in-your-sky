import { useT } from '../../../i18n/useT';
import { requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { TextButton } from '../primitives/TextButton';
import { orientationApiPresent } from './compassHeading';

export interface FollowControlProps {
  /** Whether the page's window follows the phone now — the same state the sheet's `FollowToggle` shows. */
  on: boolean;
  /** The page's state setter, the one `FollowToggle` calls: `true` after a grant, `false` when turned off. */
  onChange: (on: boolean) => void;
  /** Placement only (D-704). */
  className?: string | undefined;
}

/**
 * R157 (FR-PHONE-3, US-45 AC3; PLAN D-964): `[ follow ]` / `[ seguir ]` on the compact live page's overlay, before
 * `[ controls ]` on its bottom row — a `TextButton` with `pressed`: bracketed in the accent while following, bare and
 * dim while not, with `aria-pressed`, at least 44 × 44 px (`.target`).
 *
 * Drawn only where FR-WIN-4's presence test passes (`orientationApiPresent`), as the sheet's `[ ] follow the phone`
 * is; elsewhere it renders nothing. It drives the page's own follow state, the one the sheet's toggle drives, so the
 * two never disagree: turning it on asks for the sensor inside the click (`requestOrientationAccess`, D-175, D-240)
 * and calls `onChange(true)` on a grant; a refusal leaves it off, and the sheet's toggle carries the line that says
 * how to allow it (FR-GYRO-3) — nothing is drawn over the sky for it (FR-GYRO-5). Turning it off asks nothing.
 * R159 moves the state into `useFollow`; this control's props are what it hands on.
 */
export function FollowControl({ on, onChange, className }: FollowControlProps) {
  const t = useT();
  if (!orientationApiPresent()) return null;
  const press = (): void => {
    if (on) {
      onChange(false);
      return;
    }
    // Inside the click, before any await: the request is the gesture's (D-175).
    void requestOrientationAccess().then((answer) => {
      if (answer === 'granted') onChange(true);
    });
  };
  return <TextButton label={t.sheet.follow} pressed={on} onClick={press} className={['target', className].filter(Boolean).join(' ')} data-testid="live-follow-control" />;
}
