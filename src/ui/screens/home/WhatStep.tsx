import { Fragment, useEffect, useId, useRef, type ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { tonightCloud } from '../../../lib/nightClouds';
import { formatShortClock } from '../../../lib/timeFormat';
import type { Observer } from '../../../model';
import { coordsLabel } from '../../../lib/place';
import { placeName } from '../../components/location/WherePlace';
import { Rule } from '../../components/primitives/Rule';
import { TextButton } from '../../components/primitives/TextButton';
import { HomeDoors } from './HomeDoors';
import styles from './Steps.module.css';
import { useNight } from './useNight';

/**
 * R82 (FR-FIRST-4, D-513, board 1B): the phone's third step on a first visit. v2.12 (FR-FIRST-4 as amended, D-1021):
 * the owner found the step a list of satellites with no way to the stars or the live sky — the home's three doors
 * showed only after leaving the steps — so the step is now the choice: "What do you want to see?" and the home's
 * three doors, Satellites, Stars and Live sky, as the stacked page draws them. Satellites opens the next pass, or,
 * with none to open, leaves the steps for the stacked page and opens its What reading (`onList`); Stars and Live
 * sky open their pages, and coming back from them is the stacked page (`useSteps`' `offHome`). Ruled off at the foot,
 * `<place> · dark 20:14–05:31 · clear [ edit ]`, whose `[ edit ]` returns to **where**.
 */
export interface WhatStepProps {
  observer: Observer;
  /** The step line, and the offers that head every state of the home page. */
  head: ReactNode;
  onEdit: () => void;
  /** The Satellites door with no pass to open: leave the steps for the stacked page's list. */
  onList: () => void;
  selectedPassId: string | null;
  /** Take the focus on arrival: the reader moved here, and the control they used is gone. */
  focus: boolean;
}

export function WhatStep({ observer, head, onEdit, onList, selectedPassId, focus }: WhatStepProps) {
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const night = useNight(observer);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);

  const zone = observer.timeZone;
  const { dark } = night;
  const foot = t.home.whatStep.foot({
    place: placeName(observer) ?? coordsLabel(observer.lat, observer.lon),
    dark: night.bands.length === 0 ? null : dark ? { from: formatShortClock(dark.from, zone, locale), to: formatShortClock(dark.to, zone, locale, zone === null) } : 'none',
    cloud: tonightCloud(night.clouds, (at) => formatShortClock(at, zone, locale)),
  });

  return (
    <section aria-labelledby={headingId} className={styles.step} data-testid="step-what" data-step="what">
      {head}
      <h2 id={headingId} ref={heading} tabIndex={-1} className={styles.heading}>
        {t.home.whatStep.title}
      </h2>
      <HomeDoors observer={observer} selectedPassId={selectedPassId} onWhat={onList} />
      <div className={styles.foot} data-testid="what-foot">
        {/* R105 (D-720): the foot's rule, across the text and the control. */}
        <Rule className={styles.footRule} />
        <p className={styles.footText}>
          {foot.map((piece, index) => (
            <Fragment key={index}>
              {index > 0 && ' · '}
              {/* The place is a name of any length and wraps where it must; the facts after it never break inside. */}
              <span className={index > 0 ? styles.piece : undefined}>{piece}</span>
            </Fragment>
          ))}
        </p>
        <TextButton inline label={t.home.whatStep.edit} data-testid="step-edit" onClick={onEdit} />
      </div>
    </section>
  );
}
