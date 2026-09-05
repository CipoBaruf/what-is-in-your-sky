import { useT } from '../../../i18n/useT';
import { isSpeed, SPEEDS, type Speed } from '../../../lib/playback';
import { OptionToggle } from '../common/OptionToggle';
import styles from './PlaybackControls.module.css';

/**
 * R33 (FR-LIVE-5, FR-LIVE-6, US-15 AC4, AC6): the row of controls under the
 * stripe. Play or pause, the four speeds, `Now` — back to real time, disabled
 * while the page already shows it — and the hidden-objects toggle, a pressed
 * button that reads `[x]` like the other text toggles (FR-X-5). Pure display:
 * the page owns the state.
 */
export interface PlaybackControlsProps {
  playing: boolean;
  speed: Speed;
  /** True while the shown instant is real time: `Now` has nothing to do. */
  realTime: boolean;
  hidden: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (speed: Speed) => void;
  onNow: () => void;
  onToggleHidden: () => void;
}

export function PlaybackControls({ playing, speed, realTime, hidden, onPlay, onPause, onSpeed, onNow, onToggleHidden }: PlaybackControlsProps) {
  const t = useT();
  return (
    <div className={styles.controls} role="group" aria-label={t.live.playback} data-testid="playback-controls">
      {/* D-172: play, now and the toggle first (35 cells, one line at 390 px), the four speeds as a line of their own. */}
      <button type="button" className={styles.action} data-testid="live-play" data-playing={playing} onClick={playing ? onPause : onPlay}>
        {playing ? t.live.pause : t.live.play}
      </button>
      <button type="button" className={styles.action} data-testid="live-now" onClick={onNow} disabled={realTime}>
        {t.live.now}
      </button>
      <button type="button" className={styles.toggle} data-testid="live-hidden-toggle" aria-pressed={hidden} onClick={onToggleHidden}>
        {t.live.hiddenToggle}
      </button>
      <OptionToggle
        name={t.live.speedGroup}
        className={styles.speeds}
        options={SPEEDS.map((value) => ({ value: String(value), label: t.live.speed(value) }))}
        value={String(speed)}
        onChange={(value) => {
          const next = Number(value);
          if (isSpeed(next)) onSpeed(next);
        }}
      />
    </div>
  );
}
