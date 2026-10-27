import { useId, type ReactNode } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { formatClockDuration, formatMagnitude } from '../../../lib/format';
import { isNoEvent, nextEvent, type NextEvent, type NextEventContext, type NoEvent } from '../../../lib/nextEvent';
import { passPath } from '../../../lib/passPath';
import { brightnessBand } from '../../../lib/phrases';
import { formatShortClock } from '../../../lib/timeFormat';
import type { EpochMs, Pass } from '../../../model';
import { useNow } from '../../hooks/useNow';
import { BracketLink } from '../primitives/BracketLink';
import { Card } from '../primitives/Card';
import { Rule } from '../primitives/Rule';
import { TextButton } from '../primitives/TextButton';
import styles from './NextEventBlock.module.css';
import { OpenGuide } from './OpenGuide';

/**
 * R76 (FR-FIRST-3, D-442), re-cut by R81 (FR-FIRST-3 as amended v2.0.2,
 * D-508): the next event as board 1B draws it. The label line with its
 * countdown (`Next up · in 3:45:07`, `Up now · peaks in 1:10`, `Up now · sets
 * in 2:05`), the event's clock time in the accent, the path line
 * (`ISS · NW low → 68° N → SE`, `lib/passPath`), and `[ Open the live sky ]`
 * under the block (FR-LIVE-1). One component with two hosts: the home page's
 * When reading here, the live page's watching headline in R77 (FR-WATCH-2),
 * each passing the passes it already holds.
 *
 * `form: 'card'` is the phone's third step's first card (FR-FIRST-4, R82):
 * `First up · in 12:34`, the time and the name, the path with the duration and
 * the brightness phrase with the magnitude, in a box ruled in the accent.
 * R84 (FR-FIRST-3 as amended v2.1, F-84): given `onOpen`, the whole card opens
 * its pass with the same stretched control a `PassCard` has (`OpenGuide`).
 *
 * It ticks once a second from the wall clock (`NEXT_EVENT_TICK_MS`, US-5 AC4)
 * against those passes; nothing is asked of the worker and nothing is written
 * to the store, and the tick stays here so a host never re-renders every
 * second. `formatClockDuration` writes the countdown, "m:ss" under an hour and
 * "h:mm:ss" above (D-502).
 *
 * R105 (FR-DS-4 items 4 and 5; D-719, D-720): the card form is a `Card`
 * ruled in the accent, and the block form's rule above it is a `Rule` — the
 * host says with `ruled` whether the block is a pane's last block (the home's
 * When reading, the wide live rail) or the page's own headline (the compact
 * live page, which drew no rule and had it taken off from `Live.module.css`).
 */
export const NEXT_EVENT_TICK_MS = 1000;

/** The label line, `Next up · in 3:45:07` — the verb by the boundary reason of the end it counts to. */
function nextEventLabel(event: NextEvent, now: EpochMs, t: Messages, first = false): string {
  const { pass, kind } = event;
  return t.nextEvent.label({ kind, reason: kind === 'end' ? pass.endReason : pass.startReason, countdown: formatClockDuration((event.at - now) / 1000), first });
}

/** The path, `NW low → 68° N → SE` (D-507). */
function nextEventPath(pass: Pass, t: Messages): string {
  return t.nextEvent.path(passPath(pass));
}

/** Whole minutes, at least one: a card's duration. */
export const passMinutes = (pass: Pass): number => Math.max(1, Math.round(pass.durationS / 60));

/** FR-LIVE-1, FR-FIRST-6: the Now panel's way to the live page, which the block carries now — with or without a pass to count to. */
function LiveLink() {
  const t = useT();
  return (
    <p className={styles.live}>
      <BracketLink href="#live" label={t.nextEvent.openLive} data-testid="now-live-link" />
    </p>
  );
}

/**
 * R101 (FR-JUMP-1, D-624): `[ see this pass ]` is on the watching headline only while its next event is a rise
 * more than this far ahead — closer than two minutes the reader is better served by watching it come — and inside
 * the stripe's span (`hours`). Seconds, as the spec names it.
 */
export const JUMP_MIN_AHEAD_S = 120;

/**
 * The far edge is held back by one of `Live`'s ticks. This block reads the clock every second, but the span the
 * jump lands in is `{ start: now, end: now + LIVE_WINDOW_MS }` built from `Live`'s own 10 s clock, and the two
 * `useNow` calls are separate intervals that drift apart. For a rise in the sliver between the stale span's end
 * and this block's fresher one, the control would show and then `clampToSpan` would stop the jump short of the
 * rise — silently landing somewhere that is not the rise, against FR-JUMP-2 (D-624, "to the second"). The
 * control simply does not appear for that sliver instead.
 *
 * Kept equal to `Live`'s `TICK_MS`; importing it here would make `Live` and `NextEventBlock` a cycle, so the
 * two are asserted equal in the test.
 */
export const JUMP_SPAN_MARGIN_MS = 10_000;

/** FR-JUMP-1: the instant `[ see this pass ]` holds the page at — the named pass's rise — or null where the control is absent. */
export function jumpInstant(result: NextEvent | NoEvent, now: EpochMs, hours: number): EpochMs | null {
  if (isNoEvent(result) || result.kind !== 'rise') return null;
  const ahead = result.at - now;
  return ahead > JUMP_MIN_AHEAD_S * 1000 && ahead <= hours * 3_600_000 - JUMP_SPAN_MARGIN_MS ? result.at : null;
}

/** The control itself, wherever it stands: bracketed text in the accent with a 48 px hit box on a text row (D-246). */
function SeeThisPass({ rise, pass, onSee }: { rise: EpochMs; pass: Pass; onSee: (rise: EpochMs) => void }) {
  const t = useT();
  return (
    <TextButton inline label={t.live.seeThisPass} data-testid="next-event-see" data-rise={rise} data-pass={pass.id} aria-label={t.live.seeThisPassName(pass.name)} onClick={() => onSee(rise)} />
  );
}

/**
 * R101 (FR-JUMP-1, D-624): the same control where `liveRows.ts` puts it beside `[ scrub the night ]` rather than on
 * the path line. It reads the same passes the headline does and ticks itself on the headline's second, so the
 * control and the countdown above it agree to the second at the 120 s boundary and the page never re-renders for it.
 */
export function JumpControl({ passes, context, hours, now: nowProp, onSee }: Pick<NextEventBlockProps, 'passes' | 'context' | 'hours' | 'now'> & { onSee: (rise: EpochMs) => void }) {
  const clock = useNow(NEXT_EVENT_TICK_MS);
  const now = nowProp ?? clock;
  const result = nextEvent(passes, now, context);
  const rise = jumpInstant(result, now, hours);
  return rise === null || isNoEvent(result) ? null : <SeeThisPass rise={rise} pass={result.pass} onSee={onSee} />;
}

export interface NextEventBlockProps {
  passes: readonly Pass[];
  /** The observer's zone, for the event's clock time; null reads UTC and says so. */
  timeZone: string | null;
  /** Why there may be none (`nextEvent`'s context). */
  context?: NextEventContext;
  /** True while the passes are still arriving, so an empty list is not yet "no pass". */
  pending?: boolean;
  /** The clock, for tests; the block ticks itself otherwise. */
  now?: EpochMs;
  /** The window's length in hours, for the "no pass" line. */
  hours: number;
  /** `block` on the home page and the live page; `card` for the phone's first card (FR-FIRST-4). */
  form?: 'block' | 'card';
  /**
   * R77 (FR-WATCH-2): whether the block carries `[ Open the live sky ]` under it. The live page's watching
   * headline is the same block (V20-18) on the page the link opens, so it passes `false`.
   */
  liveLink?: boolean;
  /**
   * R84 (FR-FIRST-3 as amended v2.1, D-548, F-84): the card form opens its pass the way a `PassCard` does — the
   * whole box, the same "Open guide → <name>" control, the same sheet — since the list under it leaves that pass out.
   */
  onOpen?: (passId: string) => void;
  /**
   * R101 (FR-JUMP-1, D-624): the live page's watching headline, where `liveRows.ts` puts the jump on the path
   * line — `[ see this pass ]` after the path, calling this with the pass's rise while `jumpInstant` names one.
   * The home page passes nothing (FR-JUMP-3).
   */
  onSee?: (rise: EpochMs) => void;
  /** R93 (FR-HOME-2): the host's own class on the section, for where the reading's grid puts the block. */
  className?: string | undefined;
  /**
   * R127 (FR-SKY-11, D-796): the landmark line under the pass's name line — "passes 7° above Betelgeuse, in Orion",
   * already worded by `lib/landmarkLine.ts` from the page's scene — on the live page's headline block alone (wide and
   * compact); the home page passes nothing. `null` or absent draws no line.
   */
  line?: string | null | undefined;
  /**
   * R105 (D-720): whether the block form is ruled off above — a pane's last block (the default) — or is the
   * page's own headline with no rule, which the compact live page passes (R77). The card form is never ruled.
   */
  ruled?: boolean;
}

export function NextEventBlock({ passes, timeZone, context, pending = false, now: nowProp, hours, form = 'block', liveLink = true, onOpen, onSee, className, ruled = true, line = null }: NextEventBlockProps) {
  const t = useT();
  const locale = useLocale();
  const nameId = useId();
  const clock = useNow(NEXT_EVENT_TICK_MS);
  const now = nowProp ?? clock;
  const result = nextEvent(passes, now, context);
  const card = form === 'card';
  const Section = card ? CardSection : BlockSection;
  const sectionProps = { 'aria-label': t.nextEvent.region, className, 'data-testid': 'next-event', 'data-form': form, ruled };

  if (isNoEvent(result)) {
    return (
      <Section {...sectionProps}>
        <p className={styles.none} data-testid="next-event-none" data-reason={pending ? 'pending' : result.reason}>
          {pending ? t.nextEvent.pending : t.nextEvent.none({ reason: result.reason, hours })}
        </p>
        {!card && liveLink && <LiveLink />}
      </Section>
    );
  }

  const { pass } = result;
  // The time stands alone at 32 px; with no zone for the observer yet the digits are UTC, and say so (F-27).
  const time = formatShortClock(result.at, timeZone, locale, timeZone === null);
  const path = nextEventPath(pass, t);
  const rise = onSee && !card ? jumpInstant(result, now, hours) : null;
  return (
    <Section {...sectionProps}>
      <p role="timer" aria-live="off" className={styles.label} data-kind={result.kind} data-testid="next-event-label">
        {nextEventLabel(result, now, t, card)}
      </p>
      {card ? (
        <>
          <p className={styles.cardTime} data-testid="next-event-time">
            {`${time}   `}
            <span id={nameId}>{pass.name}</span>
          </p>
          <p className={styles.path} data-testid="next-event-path">
            {t.nextEvent.withDuration({ path, minutes: passMinutes(pass) })}
          </p>
          <p className={styles.brightness} data-testid="next-event-brightness">
            {t.nextEvent.brightness({ band: brightnessBand(pass.peakMagnitude), magnitude: formatMagnitude(pass.peakMagnitude, locale) })}
          </p>
          {onOpen && <OpenGuide passId={pass.id} nameId={nameId} onOpen={onOpen} />}
        </>
      ) : (
        <>
          <p className={styles.time} data-testid="next-event-time">
            {time}
          </p>
          <p className={styles.path} data-testid="next-event-path">
            {/* The words alone in a span, so a host can find where their last line ends (R101, `Live.tsx`). */}
            <span data-path-text="">{t.nextEvent.named({ name: pass.name, path })}</span>
            {/* FR-JUMP-1: inline after the path, so it takes the path's last line where that has the cells and
                the headline has no row of its own for it. */}
            {rise !== null && onSee && (
              <>
                {' '}
                <SeeThisPass rise={rise} pass={pass} onSee={onSee} />
              </>
            )}
          </p>
          {/* R127 (FR-SKY-11): the landmark line, under the name line, where the live page hands one. */}
          {line !== null && (
            <p className={styles.landmark} data-testid="next-event-landmark">
              {line}
            </p>
          )}
          {liveLink && <LiveLink />}
        </>
      )}
    </Section>
  );
}

interface SectionProps {
  'aria-label': string;
  className: string | undefined;
  'data-testid': string;
  'data-form': 'block' | 'card';
  ruled: boolean;
  children: ReactNode;
}

/** The block form: the reading's section, ruled off above by a `Rule` unless the host is the page's headline. */
function BlockSection({ ruled, className, children, ...rest }: SectionProps) {
  return (
    <section className={className ? `${styles.block} ${className}` : styles.block} {...rest}>
      {ruled && <Rule className={styles.rule} />}
      {children}
    </section>
  );
}

/** The card form (FR-FIRST-4): a `Card` ruled in the accent, the section the first card is. */
function CardSection({ ruled: _ruled, className, children, ...rest }: SectionProps) {
  return (
    <Card as="section" frame="accent" className={className} {...rest}>
      {children}
    </Card>
  );
}
