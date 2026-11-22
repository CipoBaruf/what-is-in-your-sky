import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import type { NextPassStrip as StripFacts } from '../../../lib/nextPassStrip';
import { heldOffset } from '../../../lib/playback';
import { interpolateTrack } from '../../../lib/skyGeometry';
import { formatShortClock } from '../../../lib/timeFormat';
import type { EpochMs, Pass } from '../../../model';
import { Tag } from '../primitives/Tag';
import { TextButton } from '../primitives/TextButton';
import styles from './NextPassStrip.module.css';

/**
 * R213 (FR-STRIP-1..3, D-1232): the next-pass strip, always drawn. `row` is the compact box's foot, one text row
 * that gives from the name; `head` is the wide rail's, the next-event block (`block`) with the buttons under it.
 */
export interface NextPassStripProps {
  strip: StripFacts<Pass>;
  /** The shown instant the countdown and the direction are read at. */
  t: EpochMs;
  timeZone: string | null;
  form: 'row' | 'head';
  /** `head`: the next-event block, which keeps its form (V30-30). */
  block?: ReactNode;
  /** `row`: the example's city while the example is the observer (V30-32). */
  exampleCity?: string | null;
  /** The passes are still arriving, so `none` is not yet "no pass". */
  pending?: boolean;
  /** The shown instant is real time: no `● back to live`. */
  live: boolean;
  onWatch: (pass: Pass) => void;
  onLive: () => void;
}

export function NextPassStrip({ strip, t: at, timeZone, form, block, exampleCity = null, pending = false, live, onWatch, onLive }: NextPassStripProps) {
  const t = useT();
  const locale = useLocale();
  const words = t.live.nextPass;
  const row = form === 'row';
  const root = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  // A press can take its own button away: the focus goes to the strip's next one, or to the strip, never to the body.
  useLayoutEffect(() => {
    if (!pressed.current) return;
    pressed.current = false;
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    (root.current?.querySelector('button') ?? root.current)?.focus();
  }, [live]);

  // D-1268: on the phone's one row `● back to live` takes `▶ watch`'s place; the rail has room for both.
  const watch = strip.kind === 'next' && (live || !row) ? strip.pass : null;
  const clock = (instant: EpochMs): string => formatShortClock(instant, timeZone, locale, timeZone === null);
  const upTail = strip.kind === 'up' ? words.up({ time: clock(strip.pass.end.t), point: compassPoint(interpolateTrack(strip.pass.track, at).azDeg) }) : null;

  let line: ReactNode;
  if (strip.kind === 'none') line = <span className={styles.name}>{pending ? t.nextEvent.pending : words.none}</span>;
  else {
    line = (
      <>
        <span className={styles.lead}>{`${strip.kind === 'up' ? words.upNow : words.next}  `}</span>
        <span className={styles.name}>{strip.pass.name}</span>
        <span className={styles.tail}>{`${words.separator}${upTail ?? words.ahead({ time: clock(strip.pass.start.t), ...heldOffset(strip.pass.start.t, at) })}`}</span>
      </>
    );
  }

  return (
    <div ref={root} className={row ? styles.row : styles.head} role="group" aria-label={words.region} tabIndex={-1} data-testid="live-strip" data-kind={strip.kind}>
      {row ? (
        <p className={styles.text} data-testid="strip-text">
          {exampleCity !== null && (
            <>
              <Tag tone="accent" className={styles.tag}>
                {words.example}
              </Tag>
              <span className={styles.city}>{` ${exampleCity}`}</span>
              <span className={styles.separator}>{words.separator}</span>
            </>
          )}
          {line}
        </p>
      ) : (
        <>
          {block}
          {upTail !== null && (
            <p className={styles.upLine} data-testid="strip-up">
              {upTail}
            </p>
          )}
        </>
      )}
      {(watch !== null || !live) && (
        <div className={styles.buttons}>
          {watch !== null && (
            <TextButton
              inline={row}
              box="accent"
              label={`▶ ${words.watch}`}
              aria-label={words.watchName(watch.name)}
              data-testid="live-watch"
              onClick={() => {
                pressed.current = true;
                onWatch(watch);
              }}
            />
          )}
          {!live && (
            <TextButton
              inline={row}
              label={`● ${t.live.backToLive}`}
              aria-label={t.live.backToLive}
              data-testid="live-now"
              onClick={() => {
                pressed.current = true;
                onLive();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
