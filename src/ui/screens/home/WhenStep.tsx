import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import { formatShortClock } from '../../../lib/timeFormat';
import type { Observer } from '../../../model';
import { SEARCH_WINDOW_HOURS, useAppStore } from '../../../state';
import { coordsLabel } from '../../../lib/place';
import { placeName } from '../../components/location/WherePlace';
import { TonightStripe } from '../../components/now/TonightStripe';
import { CloudBadge } from '../../components/weather/CloudBadge';
import { usePassContext, useShownPasses } from './shownPasses';
import styles from './Steps.module.css';
import { splitTonight } from './tonight';
import { useMoonNote, useNight } from './useNight';

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513, board 1B): the phone's second
 * step on a first visit. Under the step line, the question and its sentence;
 * then a box ruled in `--rule` holding tonight's stripe (FR-FIRST-8, R81's
 * component) and the night's three rows — `Dark from`, `Until` and `Passes in
 * it`, the last value in the accent; a second box holding `Clouds tonight`,
 * `Moon` and the Moon's sentence (`lib/moonNote`); and at the foot of the
 * screen `[ See what crosses ]`, which moves on to **what**.
 *
 * The step is one screen tall, as the cold open is, so the control stands at
 * the bottom of it.
 */
export interface WhenStepProps {
  observer: Observer;
  /** The step line, and the offers that head every state of the home page. */
  head: ReactNode;
  onNext: () => void;
  /** Take the focus on arrival: the reader moved here, and the control they used is gone. */
  focus: boolean;
}

export function WhenStep({ observer, head, onNext, focus }: WhenStepProps) {
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const passes = useShownPasses();
  const window = useAppStore((s) => s.passes.window);
  const nowSlice = useAppStore((s) => s.now);
  const context = usePassContext();
  const night = useNight(observer);
  const note = useMoonNote(observer, night.window);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);

  const zone = observer.timeZone;
  const split = splitTonight(passes, window, night.now);
  const state = nowSlice.observer === observer ? nowSlice.state : null;
  const moon = state ? moonFacts(state.moon) : null;
  const place = placeName(observer) ?? coordsLabel(observer.lat, observer.lon);
  const { dark } = night;
  return (
    <section aria-labelledby={headingId} className={styles.step} data-testid="step-when" data-step="when">
      {head}
      <h2 id={headingId} ref={heading} tabIndex={-1} className={styles.heading}>
        {t.home.whenStep.heading}
      </h2>
      <p className={styles.sentence}>{t.home.whenStep.sentence(place)}</p>
      <div className={styles.box} data-testid="when-night">
        <TonightStripe bands={night.bands} passes={passes} observer={observer} now={night.now} />
        <dl className={styles.rows} aria-label={t.home.whenStep.nightLabel}>
          {dark && dark.from > night.sampledFrom && (
            <div className={styles.row} data-row="dark-from">
              <dt>{t.home.whenStep.darkFrom}</dt>
              <dd>{formatShortClock(dark.from, zone, locale)}</dd>
            </div>
          )}
          {dark && (
            <div className={styles.row} data-row="until">
              <dt>{t.home.whenStep.until}</dt>
              <dd>{formatShortClock(dark.to, zone, locale, zone === null)}</dd>
            </div>
          )}
          <div className={styles.row} data-row="passes">
            <dt>{t.home.whenStep.passesIn}</dt>
            <dd className={styles.accent} data-testid="when-passes">
              {context.pending && passes.length === 0 ? '…' : t.home.whenStep.passesValue({ tonight: split.tonight.length, total: split.tonight.length + split.later.length, hours: SEARCH_WINDOW_HOURS })}
            </dd>
          </div>
        </dl>
        {night.bands.length > 0 && !dark && (
          <p className={styles.note} data-testid="when-no-dark">
            {t.home.noDarkWindow}
          </p>
        )}
      </div>
      <div className={`${styles.box} ${styles.sky}`} data-testid="when-sky">
        <dl className={styles.rows} aria-label={t.home.whenStep.skyLabel}>
          <div className={styles.row} data-row="clouds">
            <dt>{t.home.whenStep.clouds}</dt>
            <dd>
              <CloudBadge form="word" verdict={night.clouds} forecast={night.snapshot ? { provider: night.snapshot.provider, fetchedAt: night.snapshot.fetchedAt } : null} timeZone={zone} moment={t.home.whenStep.cloudsMoment} />
            </dd>
          </div>
          {moon && (
            <div className={styles.row} data-row="moon">
              <dt>{t.home.whenStep.moon}</dt>
              <dd data-testid="when-moon">{t.home.whenStep.moonValue({ phase: moon.phase, illumination: moon.illumination })}</dd>
            </div>
          )}
        </dl>
        {note && (
          <p className={styles.note} data-testid="moon-note" data-note={note}>
            {t.home.whenStep.moonNote(note)}
          </p>
        )}
      </div>
      <button type="button" className={styles.next} data-testid="see-what" onClick={onNext}>
        {t.home.whenStep.next}
      </button>
    </section>
  );
}
