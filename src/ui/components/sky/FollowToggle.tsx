import { useState } from 'react';
import { useT } from '../../../i18n/useT';
import { requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { orientationApiPresent } from '../live/compassHeading';
import { Line } from '../primitives/Line';
import { OptionToggle } from '../primitives/OptionToggle';
import styles from './FollowToggle.module.css';

export interface FollowToggleProps {
  /** Whether the page's window follows the phone now. */
  on: boolean;
  /** The page's state setter: `true` after a grant, `false` when turned off. */
  onChange: (on: boolean) => void;
  /** `OptionToggle`'s `inline`, for a compact row whose height the toggle must not change. */
  inline?: boolean;
  /** Placement only. */
  className?: string | undefined;
}

/**
 * R151 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-3; US-44 AC1, AC2; PLAN D-943): `[ ] follow the phone` /
 * `[ ] seguir el teléfono` — one `OptionToggle` standing alone that lets the page's own window follow the phone.
 *
 * It is drawn only where FR-WIN-4's presence test passes (`orientationApiPresent`: the constructor and a touch
 * screen); elsewhere it renders nothing and nothing else changes. The page owns the state (`useState(false)`, never
 * in the prefs: off on every visit) and hands it in as `on`.
 *
 * Turning it on asks for the sensor inside the click (`requestOrientationAccess`, D-175, D-240: iOS grants motion
 * only from a gesture, and nothing else may ask): granted, `onChange(true)`; refused — or a request that throws,
 * which `orientationAccess` reads as a refusal — it stays off and one `role="status"` line under it says how to allow
 * it, until the next click. Turning it off asks nothing: `onChange(false)`.
 */
export function FollowToggle({ on, onChange, inline = false, className }: FollowToggleProps) {
  const t = useT();
  const [refused, setRefused] = useState(false);
  if (!orientationApiPresent()) return null;
  const press = (): void => {
    // FR-GYRO-3: the refusal's line goes on the next tap, whatever that tap does.
    setRefused(false);
    if (on) {
      onChange(false);
      return;
    }
    // Inside the click, before any await: the request is the gesture's (D-175).
    void requestOrientationAccess().then((answer) => {
      if (answer === 'granted') onChange(true);
      else setRefused(true);
    });
  };
  return (
    <div className={[styles.follow, className].filter(Boolean).join(' ')} data-testid="follow">
      <OptionToggle label={t.window.followToggle} pressed={on} alone inline={inline} onPress={press} data-testid="follow-toggle" />
      {refused && (
        <Line role="status" size="small" className={styles.refused} data-testid="follow-refused">
          {t.window.followRefused}
        </Line>
      )}
    </div>
  );
}
