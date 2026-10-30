import { useT } from '../../../i18n/useT';
import { TextButton } from '../primitives/TextButton';
import styles from './TimeTaps.module.css';

/**
 * R144 (FR-TONIGHT-4, D-901): the compact live page's row under the time
 * track — the play control, then `[ tonight ]`, `[ next ]` and `[ now ]`
 * (`[ noche ]`, `[ próximo ]`, `[ ahora ]`): 30 cells in English and 33 in
 * Spanish (D-911), inside FR-COMP-4's 36. The play control is one glyph, `▶`
 * or `‖`, named "Play" / "Pause", padded to a `.target` like the three words
 * (FR-FLOW-11) — `inline`, D-246's device: the 48 px hit box is padding and a
 * matching negative margin, so the row is one text row (24 px) and the box
 * keeps the rows' worth (FR-TONIGHT-9: 280 px at 390 × 667 asks for it).
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
      <TextButton bare inline label={playing ? t.live.pauseShort : t.live.playShort} aria-label={playing ? t.live.pause : t.live.play} className={`${styles.play} target`} data-testid="live-play" data-playing={playing} onClick={playing ? onPause : onPlay} />
      <TextButton inline label={t.live.tap.tonight} className="target" data-testid="live-tap-tonight" disabled={tonightDisabled} onClick={onTonight} />
      <TextButton inline label={t.live.tap.next} className="target" data-testid="live-tap-next" disabled={nextDisabled} onClick={onNext} />
      <TextButton inline label={t.live.tap.now} className="target" data-testid="live-tap-now" disabled={nowDisabled} onClick={onNow} />
    </div>
  );
}
