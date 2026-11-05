import { useId } from 'react';
import { useLocale, useT } from '../../../../i18n/useT';
import { chipFor } from '../../../../lib/shownTime';
import { formatClock, formatDate } from '../../../../lib/timeFormat';
import { shortWeekday } from '../../../../lib/timeStripe';
import { SectionHeading } from '../../../components/primitives/SectionHeading';
import { TextButton } from '../../../components/primitives/TextButton';
import { VisuallyHidden } from '../../../components/primitives/VisuallyHidden';
import { PlaybackControls } from '../../../components/sky/time/PlaybackControls';
import type { Playback } from '../../../components/sky/time/usePlayback';
import { useNow } from '../../../hooks/useNow';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098) → R187 (FR-WIDE-4, D-1100) → v2.14.1 (FR-WIDE-4 as amended, V214-29; D-1138): the wide
 * stars page's `Time` group while the globe is the view — FR-GLOBE-7's clock, steps, `[ now ]` and time-lapse, and no
 * overview, stripe or pass marks (V214-34: its speeds are the live page's playback row): the stars page carries no satellite's time. The markup is R170's `GlobeClock` and
 * `GlobeTime` (`3cf618fd^:src/ui/screens/stars/GlobeRail.tsx`) over R187's playback, so a day step past the span
 * still moves the span (`shiftDays`) and the globe's instant is the playback's `t`.
 */
const STEPS = [
  { id: 'dayBack', days: -1 },
  { id: 'hourBack', days: -1 / 24 },
  { id: 'hourAhead', days: 1 / 24 },
  { id: 'dayAhead', days: 1 },
] as const;
/** FR-GLOBE-8: the clock's seconds tick each second while the globe is on real time, as the live headline's do. */
const CLOCK_TICK_MS = 1_000;

/** FR-GLOBE-8: "21:14:05 GMT−3 · 2026-11-03", then the chip — `now`, or the offset from real time (FR-TONIGHT-7). */
function GlobeClock({ playback, zone }: { playback: Playback; zone: string | null }) {
  const t = useT();
  const locale = useLocale();
  const clock = useNow(CLOCK_TICK_MS);
  // The offset is read against the same one-second clock, so the chip moves with the seconds and not per render.
  const shown = playback.realTime ? clock : playback.t;
  const chip = chipFor(shown, clock, playback.realTime, null, zone);
  const words = t.live.chip(chip.kind === 'now' ? chip : { ...chip, weekday: chip.weekday ? shortWeekday(shown, zone, locale) : null });
  return (
    <p className={styles.clock} data-testid="globe-clock" data-at={String(playback.t)}>
      <VisuallyHidden>{`${t.globe.clock}: `}</VisuallyHidden>
      <time dateTime={new Date(shown).toISOString()}>{`${formatClock(shown, zone, locale)} · ${formatDate(shown, zone, locale)}`}</time>{' '}
      <span className={styles.chip} data-kind={chip.kind} data-testid="globe-chip">
        {`· ${words}`}
      </span>
    </p>
  );
}

/**
 * FR-GLOBE-7: the clock, the four steps, then `[ now ]` and the live page's playback row (FR-LIVE-5: `[ Play ]` and
 * its speeds, V214-34), so time plays the same way on the three desk pages.
 */
export function StarsTime({ playback, zone }: { playback: Playback; zone: string | null }) {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.time} data-testid="stars-time" data-state={playback.realTime ? 'watching' : 'scrubbing'} data-playing={playback.playing}>
      <SectionHeading id={headingId}>{t.skyView.time}</SectionHeading>
      <GlobeClock playback={playback} zone={zone} />
      <div role="group" aria-label={t.globe.stepGroup} className={styles.steps} data-testid="globe-steps">
        {STEPS.map((step) => (
          <TextButton
            key={step.id}
            className="target"
            label={t.globe.steps[step.id]}
            aria-label={t.globe.stepNames[step.id]}
            data-step={step.id}
            onClick={() => {
              playback.shiftDays(step.days);
            }}
          />
        ))}
      </div>
      <div className={styles.playRow} data-testid="globe-speeds">
        <TextButton
          className="target"
          label={t.skyView.now}
          data-testid="globe-now"
          onClick={() => {
            playback.toNow();
          }}
        />
        <PlaybackControls playing={playback.playing} speed={playback.speed} onPlay={playback.play} onPause={playback.pause} onSpeed={playback.setSpeed} />
      </div>
    </section>
  );
}
