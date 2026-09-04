import { useId } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { moonLoreParams, showsFullMoonName } from '../../../lib/moonPhrases';
import { calendarMonth } from '../../../lib/timeFormat';
import type { MoonState } from '../../../model';
import { MOON_LORE, fullMoonName, phaseLore, signAtLongitude } from '../../../state';
import { SectionHeading } from '../common/SectionHeading';
import styles from './MoonLore.module.css';

/**
 * FR-MOON-4 / FR-MOON-5 (US-18 AC3): the "Moon tonight" line — the sign the
 * Moon stands in, the folk name of the month's full Moon when it is within a
 * day of full, and one curated one-liner (D-123) — under a label that says it
 * is tradition, in its own section below the facts.
 *
 * Everything it renders comes from `lore.json`, one hand-reviewed file, read
 * through `src/state` because §3 keeps `src/ui` out of `src/data` (D-97). The
 * section's accessible name carries the tradition word, so it is not only a
 * colour: a reader who meets this line through a screen reader is told what
 * kind of line it is before hearing it. No observing fact is stated here and
 * none is derived from it — take this component out and the Moon line, the
 * cards and the guide are unchanged.
 */
export interface MoonLoreProps {
  moon: MoonState;
  /** The observer's zone: the folk names are keyed by the calendar month where the reader is standing. */
  timeZone: string | null;
}

export function MoonLore({ moon, timeZone }: MoonLoreProps) {
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const traditionId = useId();
  const params = moonLoreParams(
    {
      sign: signAtLongitude(moon.eclipticLonDeg),
      phase: phaseLore(moon.phase),
      fullMoon: showsFullMoonName(moon) ? fullMoonName(calendarMonth(moon.t, timeZone)) : null,
      hemisphereNote: MOON_LORE.fullMoons.hemisphereNote,
    },
    moon,
    locale,
  );
  return (
    <section aria-labelledby={`${headingId} ${traditionId}`} className={styles.section} data-testid="moon-lore">
      <SectionHeading id={headingId}>{t.moon.lore.heading}</SectionHeading>
      <p className={styles.line}>
        <span id={traditionId} className={styles.tradition}>
          {t.moon.lore.tradition}
        </span>{' '}
        {t.moon.lore.line(params)}
      </p>
      {params.hemisphereNote !== null && <p className={styles.note}>{params.hemisphereNote}</p>}
    </section>
  );
}
