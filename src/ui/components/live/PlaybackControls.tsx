import { useT } from '../../../i18n/useT';
import { isSpeed, SPEEDS, type Speed } from '../../../lib/playback';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { OptionToggle } from '../common/OptionToggle';
import styles from './PlaybackControls.module.css';

/**
 * R33 (FR-LIVE-5, FR-LIVE-6, US-15 AC4, AC6): the playback row under the
 * stripe. Play or pause, `Now` — back to real time, disabled while the page
 * already shows it — and the four speeds. Pure display: the page owns the
 * state.
 *
 * R48 (FR-LIVE-7 as amended, FR-COMP-4, D-245): on compact the row is one of
 * the page's two control rows and must fit 36 cells, so play and pause are
 * glyphs (`▶`, `‖`) whose accessible names are still the words, and the
 * speeds are a group where the chosen one is bracketed, `1× [60×] 600×
 * 3600×` — the state in the characters (FR-X-5), 19 cells where the `[x]`
 * form was 33. Wide keeps the words and the `[x]` toggle. The hidden-objects
 * toggle moved to the actions row (`HiddenToggle`, below), which is the other
 * control row.
 *
 * R77 (FR-WATCH-1, FR-LIVE-5 as amended v2.0): the row is the scrubbing
 * state's alone, and `Now` has left it — `[ back to live ]` is that action
 * under a name that says where it goes, and it stands where FR-WATCH-4 puts it
 * (`BackToLive`, below) rather than beside play.
 */
export interface PlaybackControlsProps {
  playing: boolean;
  speed: Speed;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (speed: Speed) => void;
}

export function PlaybackControls({ playing, speed, onPlay, onPause, onSpeed }: PlaybackControlsProps) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  const playWord = playing ? t.live.pause : t.live.play;
  return (
    <div className={styles.controls} role="group" aria-label={t.live.playback} data-testid="playback-controls" data-compact={compact}>
      <button type="button" className={styles.action} data-testid="live-play" data-playing={playing} aria-label={playWord} onClick={playing ? onPause : onPlay}>
        {compact ? (playing ? t.live.pauseShort : t.live.playShort) : playWord}
      </button>
      {compact ? (
        <div role="group" aria-label={t.live.speedGroup} className={styles.speedsCompact}>
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={styles.speed}
              aria-pressed={value === speed}
              onClick={() => {
                if (value !== speed) onSpeed(value);
              }}
            >
              {t.live.speed(value)}
            </button>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}

/**
 * R77 (FR-WATCH-1 a, D-446): `[ scrub ]` — `[ scrub the night ]` on wide — the
 * way into the scrubbing state from watching. It is FR-LIVE-5's pause at now:
 * the page holds the instant of the tap, so the first frame held is the last
 * one watched.
 */
export function ScrubButton({ onScrub }: { onScrub: () => void }) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  return (
    <button type="button" className={styles.action} data-testid="live-scrub" onClick={onScrub}>
      {compact ? t.live.scrub : t.live.scrubWide}
    </button>
  );
}

/**
 * R77 (FR-WATCH-1, D-446): `[ back to live ]` — FR-LIVE-5's `now` action,
 * renamed for where it goes: the shown instant returns to real time and
 * advances on the tick again, and the scrub block goes away with the state.
 * It keeps the old control's test id, since it is the same action.
 *
 * R85 (FR-COMP-7, D-549): `short` on the compact actions row, where Share has
 * its brackets back — `[ live ]`, named by the whole phrase, which contains it.
 */
export function BackToLive({ onNow, short = false }: { onNow: () => void; short?: boolean }) {
  const t = useT();
  return (
    <button type="button" className={styles.action} data-testid="live-now" onClick={onNow} {...(short ? { 'aria-label': t.live.backToLive } : {})}>
      {short ? t.live.backToLiveShort : t.live.backToLive}
    </button>
  );
}

/**
 * FR-LIVE-6's toggle: a pressed button that reads `[x]` like the other text
 * toggles (FR-X-5). R48: on the actions row, one word on compact ("Hidden")
 * under the full accessible name.
 */
export function HiddenToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  return (
    <button type="button" className={styles.toggle} data-testid="live-hidden-toggle" aria-pressed={hidden} aria-label={t.live.hiddenToggle} onClick={onToggle}>
      {compact ? t.live.hiddenShort : t.live.hiddenToggle}
    </button>
  );
}

/**
 * FR-LEG-7 (R71, D-387, D-388): the compact live page's legend control,
 * `[ list (n) ]`, on the actions row beside the hidden-objects toggle. It is
 * a *disclosure*, not a state toggle: `aria-expanded` says whether the panel
 * under the drawing is open, and `aria-controls` names it, so the two are one
 * control and one region rather than a button and a surprise. It reads as an
 * action (`[ … ]`, the bracket rule the row's other action uses) because that
 * is what it is — the count is the reason to tap it.
 *
 * `count` is the drawn passes and not the panel's lines: the Sun and the Moon
 * are in the panel, uncounted (OQ-26).
 */
export function LegendToggle({ open, count, controls, onToggle }: { open: boolean; count: number; controls: string; onToggle: () => void }) {
  const t = useT();
  return (
    <button type="button" className={styles.action} data-testid="live-legend-toggle" aria-expanded={open} {...(open ? { 'aria-controls': controls } : {})} onClick={onToggle}>
      {t.live.list({ count })}
    </button>
  );
}
