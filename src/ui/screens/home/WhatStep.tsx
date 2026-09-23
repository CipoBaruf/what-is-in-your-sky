import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { isNoEvent, nextEvent } from '../../../lib/nextEvent';
import { formatShortClock } from '../../../lib/timeFormat';
import type { Observer, Pass } from '../../../model';
import { SEARCH_WINDOW_HOURS, useAppStore } from '../../../state';
import { coordsLabel } from '../../../lib/place';
import { placeName } from '../../components/location/WherePlace';
import { NextEventBlock } from '../../components/passes/NextEventBlock';
import { PassCard } from '../../components/passes/PassCard';
import { nightLabel } from '../../components/passes/PassList';
import { hasEnded, usePassContext, useShownClock, useShownPasses } from './shownPasses';
import styles from './Steps.module.css';
import { splitTonight } from './tonight';
import { useNight } from './useNight';

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513, board 1B): the phone's third
 * step on a first visit. The count in words (`home.count`, "Five things cross
 * tonight"; FR-FIRST-3's no-pass line with none in the window), the sentence,
 * the first card (FR-FIRST-3's first-card form of R81's block), tonight's
 * other cards in FR-FIRST-10's phone form — the brightness phrase in place of
 * the magnitude — `[<n> more tonight]` and `[<n> more nights]` where there are
 * more, and, ruled off at the foot of the screen, `<place> · dark 20:14–05:31
 * · clear [ edit ]`, whose `[ edit ]` returns to **where**.
 *
 * Board 1B draws the first card and two more before the two controls
 * (`WHAT_STEP_CARDS`); each control shows the cards it counts in place, the
 * later nights under their night's name, since a card gives only a time.
 */
export const WHAT_STEP_CARDS = 3;

export interface WhatStepProps {
  observer: Observer;
  /** The step line, and the offers that head every state of the home page. */
  head: ReactNode;
  onEdit: () => void;
  onOpenPass: (passId: string) => void;
  selectedPassId: string | null;
  /** Take the focus on arrival: the reader moved here, and the control they used is gone. */
  focus: boolean;
}

export function WhatStep({ observer, head, onEdit, onOpenPass, selectedPassId, focus }: WhatStepProps) {
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const passes = useShownPasses(selectedPassId);
  const weather = useAppStore((s) => s.weather);
  const context = usePassContext();
  const night = useNight(observer);
  // R88 (FR-NIGHT-2, D-535): the store's clock, the one the passes above were pruned by.
  const now = useShownClock();
  const [moreTonight, setMoreTonight] = useState(false);
  const [moreNights, setMoreNights] = useState(false);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);

  const zone = observer.timeZone;
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const nextContext = { hasDarkness: context.hasDarkness, elementCount: context.elementCount };
  const next = nextEvent(passes, now, nextContext);
  const firstId = isNoEvent(next) ? null : next.pass.id;
  const split = splitTonight(passes, zone, now);
  const others = split.tonight.filter((pass) => pass.id !== firstId);
  const shown = moreTonight ? others : others.slice(0, WHAT_STEP_CARDS - 1);
  const laterNights = split.laterNights.map((group) => ({ ...group, passes: group.passes.filter((pass) => pass.id !== firstId) })).filter((group) => group.passes.length > 0);
  const laterCount = laterNights.reduce((sum, group) => sum + group.passes.length, 0);
  const hiddenTonight = others.length - shown.length;

  const title = (() => {
    if (passes.length > 0) return t.home.count(split.tonight.length);
    if (context.pending) return t.nextEvent.pending;
    return isNoEvent(next) ? t.nextEvent.none({ reason: next.reason, hours: SEARCH_WINDOW_HOURS }) : t.home.count(0);
  })();

  const card = (pass: Pass) => (
    <li key={pass.id}>
      <PassCard pass={pass} timeZone={zone} weather={snapshot} detail="phrase" selected={pass.id === selectedPassId} ended={hasEnded(pass, now)} onOpen={onOpenPass} />
    </li>
  );

  const { dark } = night;
  const foot = t.home.whatStep.foot({
    place: placeName(observer) ?? coordsLabel(observer.lat, observer.lon),
    dark: night.bands.length === 0 ? null : dark ? { from: formatShortClock(dark.from, zone, locale), to: formatShortClock(dark.to, zone, locale, zone === null) } : 'none',
    cloud: night.clouds.state,
  });

  return (
    <section aria-labelledby={headingId} className={styles.step} data-testid="step-what" data-step="what">
      {head}
      <h2 id={headingId} ref={heading} tabIndex={-1} className={styles.heading}>
        {title}
      </h2>
      <p className={styles.sentence}>{t.home.whatStep.sentence}</p>
      {passes.length > 0 && (
        <div className={styles.cards} data-testid="what-cards">
          <NextEventBlock passes={passes} timeZone={zone} context={nextContext} pending={context.pending} hours={SEARCH_WINDOW_HOURS} form="card" onOpen={onOpenPass} />
          {shown.length > 0 && <ol className={styles.list}>{shown.map(card)}</ol>}
          {moreNights &&
            laterNights.map((group) => (
              <Fragment key={group.index}>
                <p className={styles.nightLabel} data-testid="what-night">
                  {nightLabel(group, split.tonightKey, t)}
                </p>
                <ol className={styles.list}>{group.passes.map(card)}</ol>
              </Fragment>
            ))}
          {(hiddenTonight > 0 || (laterCount > 0 && !moreNights)) && (
            <div className={styles.more} data-testid="what-more">
              {hiddenTonight > 0 && (
                <button
                  type="button"
                  className={`inline-control ${styles.moreControl}`}
                  data-testid="more-tonight"
                  onClick={() => {
                    setMoreTonight(true);
                  }}
                >
                  {t.home.whatStep.moreTonight(hiddenTonight)}
                </button>
              )}
              {laterCount > 0 && !moreNights && (
                <button
                  type="button"
                  className={`inline-control ${styles.moreControl}`}
                  data-testid="more-nights"
                  onClick={() => {
                    setMoreNights(true);
                  }}
                >
                  {t.home.whatStep.moreNights(laterCount)}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className={styles.foot} data-testid="what-foot">
        <p className={styles.footText}>
          {foot.map((piece, index) => (
            <Fragment key={index}>
              {index > 0 && ' · '}
              {/* The place is a name of any length and wraps where it must; the facts after it never break inside. */}
              <span className={index > 0 ? styles.piece : undefined}>{piece}</span>
            </Fragment>
          ))}
        </p>
        <button type="button" className={`inline-control ${styles.moreControl}`} data-testid="step-edit" onClick={onEdit}>
          {t.home.whatStep.edit}
        </button>
      </div>
    </section>
  );
}
