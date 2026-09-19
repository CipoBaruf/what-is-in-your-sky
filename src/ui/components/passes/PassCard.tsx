import { useId } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatMagnitude } from '../../../lib/format';
import { brightnessBand } from '../../../lib/phrases';
import { formatShortClock } from '../../../lib/timeFormat';
import type { Pass, WeatherSnapshot } from '../../../model';
import { MoonAtPeak } from '../moon/MoonAtPeak';
import { MoonGlareLabel } from '../moon/MoonGlare';
import { CloudBadge } from '../weather/CloudBadge';
import { passMinutes } from './NextEventBlock';
import styles from './PassCard.module.css';

/**
 * R81 (FR-FIRST-10, US-5 AC1, D-510): the one-line card of board 1B. A box
 * ruled in `--rule`, 12 px inside:
 *
 * - the start time and the name in the accent, three spaces between
 *   (`21:14   ISS`), and the `Next ISS` tag on the next featured pass's card
 *   (§8 rank 1 as amended v2.0.2: the tag is what the hero card said);
 * - at `--small` in `--fg-dim`, the duration, the peak altitude and compass
 *   point and the magnitude (`6 min · peak 68° N · mag −3.4`), or on the
 *   phone's third step the brightness phrase in its place (`detail: 'phrase'`);
 * - at `--small`, the cloud word in its colour where the list passes a forecast
 *   (US-7 AC2, its percentage and source in the tooltip), with the labels that
 *   say the sky itself works against this pass: `[sky still bright]`
 *   (FR-VIS-7), `[moon glare]` (FR-MOON-2) and the Moon at the peak while it is
 *   up (US-18 AC1).
 *
 * The card is the control that opens the pass (FR-DESK-3; the sheet on
 * compact): the button lies over the card's first two lines and the padding
 * around them, and its name is "Open guide → <name>". The flags line stays
 * outside it, because its words are tooltip triggers of their own, and a
 * button whose box held them had one under its middle, where a pointer aims. The open pass's card is ruled in the
 * accent. Times are in `timeZone`, which the forecast fills in for coordinate
 * input (FR-LOC-3); with none yet, the clock says UTC (F-27).
 */
export interface PassCardProps {
  pass: Pass;
  timeZone: string | null;
  /** When given, the whole card opens the pass. */
  onOpen?: (passId: string) => void;
  /** The forecast to judge the peak by; `null` shows "weather unknown"; omitted draws no cloud word. */
  weather?: WeatherSnapshot | null;
  /** This is the pass the guide is open on (FR-DESK-3): the card is ruled in the accent and announced as the current item. */
  selected?: boolean;
  /** The magnitude (the list) or the brightness phrase (the phone's third step, FR-FIRST-4). */
  detail?: 'magnitude' | 'phrase';
  /** The `Next ISS` tag, on the one card `nextFeaturedPass` chooses. */
  tag?: string;
}

/** The accessible control ("Open guide → <name>"); its `::after` stretches the hit area over the positioned card. */
export function OpenGuide({ pass, headingId, onOpen }: { pass: Pass; headingId: string; onOpen: (passId: string) => void }) {
  const t = useT();
  const openId = useId();
  return (
    <button
      type="button"
      id={openId}
      className={styles.open}
      aria-labelledby={`${openId} ${headingId}`}
      onClick={() => {
        onOpen(pass.id);
      }}
    >
      <span className="sr-only">{t.passes.openGuide}</span>
    </button>
  );
}

export function PassCard({ pass, timeZone, onOpen, weather, selected = false, detail = 'magnitude', tag }: PassCardProps) {
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const moonUp = pass.moonAtPeak.elDeg > 0;
  const flags = weather !== undefined || pass.twilight || pass.moonGlare.glare || moonUp;
  return (
    <article className={styles.card} aria-labelledby={headingId} data-pass-id={pass.id} data-pass-card="" tabIndex={-1} {...(selected ? { 'data-selected': 'true', 'aria-current': true as const } : {})}>
      <div className={styles.hit}>
        <div className={styles.first} data-testid="card-first-line">
          <span className={styles.time}>{formatShortClock(pass.start.t, timeZone, locale, timeZone === null)}</span>
          <h2 id={headingId} className={styles.name}>
            {pass.name}
          </h2>
          {tag !== undefined && (
            <span className={styles.tag} data-testid="next-tag">
              {tag}
            </span>
          )}
        </div>
        <p className={styles.detail} data-testid="card-detail">
          {t.passes.cardDetail({
            minutes: passMinutes(pass),
            altitude: degrees(pass.peak.elDeg),
            point: compassPoint(pass.peak.azDeg),
            brightness: detail === 'phrase' ? { band: brightnessBand(pass.peakMagnitude) } : { magnitude: formatMagnitude(pass.peakMagnitude, locale) },
          })}
        </p>
        {onOpen && <OpenGuide pass={pass} headingId={headingId} onOpen={onOpen} />}
      </div>
      {flags && (
        <div className={styles.flags}>
          {weather !== undefined && (
            <CloudBadge
              form="word"
              verdict={cloudVerdict(weather, pass.peak.t)}
              forecast={weather ? { provider: weather.provider, fetchedAt: weather.fetchedAt } : null}
              timeZone={timeZone}
              moment={t.weather.momentPeak}
            />
          )}
          {pass.twilight && <span className={styles.twilight}>{t.passes.twilightLabel}</span>}
          <MoonGlareLabel moon={pass.moonAtPeak} glare={pass.moonGlare} />
          <MoonAtPeak moon={pass.moonAtPeak} />
        </div>
      )}
    </article>
  );
}
