import { useT } from '../../../i18n/useT';
import { TextButton } from '../primitives/TextButton';
import styles from './TimeTaps.module.css';

/**
 * R144 (FR-TONIGHT-4, D-901) → R213 (FR-STRIP-6, D-1269): the compact live page's two rows under the time
 * track — the one play button, `▶ play` / `❚❚ pause`, then `tonight`, `next` and `now`. The button has a row of
 * its own so that its two faces never move the jumps, whose one row holds in both languages at 360 px. Each is a
 * `.target` (FR-FLOW-11) hung off its text row (`inline`, D-246's device).
 * Pure display: the page owns the instant and decides what each
 * tap lands on (`lib/tonightJump.ts`, D-897); `next` is disabled at the span's
 * last pass and `now` while `t` is real time, as FR-TONIGHT-4 says, and
 * `tonight` while the bands hold no night to land in (none yet, or none at all).
 * `PlaybackControls` stays for wide.
 */
export interface TimeTapsProps {
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  /** `tonight`: the first visible pass of tonight's night, or its start (FR-TONIGHT-4). */
  onTonight: () => void;
  /** No night in the bands (not loaded, or a polar summer): `tonight` is disabled. */
  tonightDisabled: boolean;
  /** `next`: the first visible pass rising after the shown instant. */
  onNext: () => void;
  /** No pass after the shown instant: `next` is disabled. */
  nextDisabled: boolean;
  /** `now`: back to real time, stopped, for the rest of the visit (D-898). */
  onNow: () => void;
  /** The shown instant is real time: `now` is disabled. */
  nowDisabled: boolean;
}

export function TimeTaps({ playing, onPlay, onPause, onTonight, tonightDisabled, onNext, nextDisabled, onNow, nowDisabled }: TimeTapsProps) {
  const t = useT();
  return (
    <div className={styles.taps} role="group" aria-label={t.live.taps} data-testid="live-taps">
      <div className={styles.row}>
        <TextButton inline label={playing ? t.live.pauseButton : t.live.playButton} aria-label={playing ? t.live.pause : t.live.play} className="target" data-testid="live-play" data-playing={playing} onClick={playing ? onPause : onPlay} />
      </div>
      <div className={styles.row} data-testid="live-jumps">
        <TextButton inline label={t.live.tap.tonight} className="target" data-testid="live-tap-tonight" disabled={tonightDisabled} onClick={onTonight} />
        <TextButton inline label={t.live.tap.next} className="target" data-testid="live-tap-next" disabled={nextDisabled} onClick={onNext} />
        <TextButton inline label={t.live.tap.now} className="target" data-testid="live-tap-now" disabled={nowDisabled} onClick={onNow} />
      </div>
    </div>
  );
}
