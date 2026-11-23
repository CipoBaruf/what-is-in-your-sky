import { useId } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatMagnitude } from '../../../lib/format';
import { brightnessBand, elevationBand } from '../../../lib/phrases';
import { formatShortClock } from '../../../lib/timeFormat';
import type { Pass, WeatherSnapshot } from '../../../model';
import { MoonGlareLabel } from '../moon/MoonGlare';
import { Tag } from '../primitives/Tag';
import { CloudBadge } from '../weather/CloudBadge';
import { passMinutes } from './NextEventBlock';
import { OpenGuide } from './OpenGuide';
import styles from './PassCard.module.css';

/**
 * R81 (FR-FIRST-10, US-5 AC1, D-510): the one-line card of board 1B. A box
 * ruled in `--rule`, 12 px inside:
 *
 * - the start time and the name in the accent, three spaces between
 *   (`21:14   ISS`), and the `Next ISS` tag on the next featured pass's card
 *   (§8 rank 1 as amended v2.0.2: the tag is what the hero card said);
 * - at `--small` in `--fg-dim`, the duration, the peak altitude and compass
 *   point and the magnitude (`6 min · peak 68° N · mag −3.4`), or under the
 *   example the height as a word and the brightness phrase (`plain`, FR-OPEN-13);
 * - at `--small`, the cloud word in its colour where the list passes a forecast
 *   (US-7 AC2, its percentage and source as its description), with the labels
 *   that say the sky itself works against this pass: `[sky still bright]`
 *   (FR-VIS-7) and `[moon glare]` (FR-MOON-2), on that one line. R84 (US-18 AC1
 *   as amended v2.1, F-77): the Moon at the peak is the guide's, not a fourth
 *   line here.
 *
 * The card is the control that opens the pass (FR-DESK-3; the sheet on
 * compact), and its name is "Open guide → <name>". R84 (FR-FIRST-10 as
 * amended v2.1, D-548, F-85): the button (`OpenGuide`) covers the whole of the
 * positioned card, tags and cloud line included, so the whole box is one
 * pointer target and one tab stop; the tags are text inside it (`asText`), not
 * tooltip triggers of their own. Times are in `timeZone`, which the forecast fills in for coordinate
 * input (FR-LOC-3); with none yet, the clock says UTC (F-27).
 *
 * R97 (FR-FAINT-2): a faint pass the reader asked to see is an ordinary card,
 * with its name in `--fg-dim` and `[faint]` on the third line.
 *
 * R221 (FR-CTRL-15, FR-CTRL-14, D-1292): the card has no frame. Its `OpenGuide`
 * is a `PickRow` laid under the lines, so the box takes the row's hover ground
 * and, open, the raised ground with the accent line down its left edge and
 * `aria-current` on the control; the article keeps `data-selected` for the
 * pass cursor. `Next ISS`, `[sky still bright]` and `[faint]` are `Tag`s.
 */
export interface PassCardProps {
  pass: Pass;
  timeZone: string | null;
  /** When given, the whole card opens the pass. */
  onOpen?: (passId: string) => void;
  /** The forecast to judge the peak by; `null` shows "weather unknown"; omitted draws no cloud word. */
  weather?: WeatherSnapshot | null;
  /** This is the pass the guide is open on (FR-DESK-3, FR-CTRL-15): raised, the accent line at its left, its control `aria-current`. */
  selected?: boolean;
  /** The `Next ISS` tag, on the one card `nextFeaturedPass` chooses. */
  tag?: string;
  /** FR-NIGHT-2: the pass is over on the shown clock; the card reads `ended` in place of the cloud word while it lingers. */
  ended?: boolean;
  /**
   * R92 (FR-A11Y-2, D-530): the name's rank, one under what holds the card — 4 under a night's heading, 3 where the
   * cards sit straight under a pane's or a step's `h2`. The class draws it; the element only ranks it.
   */
  headingLevel?: 3 | 4;
  /** FR-FAINT-2: the pass is faint and shown; the name is dimmed and the third line carries `[faint]`. */
  faint?: boolean;
  /** v2.14.1 (V214-38, D-1135): one line — the time, the name, the detail — for the pass page's list in the rail. */
  dense?: boolean;
  /** R202 (FR-OPEN-13, D-1210): the example's card — the peak's height as a word and the brightness phrase, no degree and no `mag`. */
  plain?: boolean;
}

export function PassCard({ pass, timeZone, onOpen, weather, selected = false, tag, ended = false, headingLevel = 3, faint = false, dense = false, plain = false }: PassCardProps) {
  const Name = headingLevel === 4 ? 'h4' : 'h3';
  const t = useT();
  const locale = useLocale();
  const headingId = useId();
  const flags = ended || weather !== undefined || pass.twilight || pass.moonGlare.glare || faint;
  const peak = {
    altitude: plain ? t.nextEvent.height(elevationBand(pass.peak.elDeg)) : degrees(pass.peak.elDeg),
    point: compassPoint(pass.peak.azDeg),
    brightness: plain ? { band: brightnessBand(pass.peakMagnitude) } : { magnitude: formatMagnitude(pass.peakMagnitude, locale) },
  };
  // The `data-card` hook hands the card the ring of its focused control (global.css); `data-selected` is the pass cursor's.
  const selection = { 'data-card': '', ...(selected ? { 'data-selected': 'true' } : {}) };
  if (dense) {
    // V214-38: the one-line row drops the minutes so the detail fits the rail's 44..60 cells; the name gives first.
    const detailText = t.passes.cardDetailShort(peak);
    const cardClass = [styles.card, styles.dense, faint ? styles.faint : undefined].filter(Boolean).join(' ');
    return (
      <article className={cardClass} {...selection} aria-labelledby={headingId} data-pass-id={pass.id} data-pass-card="" data-dense="" tabIndex={-1}>
        <div className={styles.first} data-testid="card-first-line">
          <span className={styles.time}>{formatShortClock(pass.start.t, timeZone, locale, timeZone === null)}</span>
          <Name id={headingId} className={styles.name}>
            {pass.name}
          </Name>
          {tag !== undefined && (
            <Tag tone="accent" className={[styles.tag, styles.denseTag].join(' ')} data-testid="next-tag">
              {tag}
            </Tag>
          )}
          <span className={styles.denseDetail} data-testid="card-detail">
            {ended ? t.passes.ended : detailText}
          </span>
        </div>
        {onOpen && <OpenGuide passId={pass.id} nameId={headingId} onOpen={onOpen} picked={selected} />}
      </article>
    );
  }
  return (
    <article className={faint ? `${styles.card} ${styles.faint}` : styles.card} {...selection} aria-labelledby={headingId} data-pass-id={pass.id} data-pass-card="" tabIndex={-1}>
      <div className={styles.first} data-testid="card-first-line">
        <span className={styles.time}>{formatShortClock(pass.start.t, timeZone, locale, timeZone === null)}</span>
        <Name id={headingId} className={styles.name}>
          {pass.name}
        </Name>
        {tag !== undefined && (
          <Tag tone="accent" className={styles.tag} data-testid="next-tag">
            {tag}
          </Tag>
        )}
      </div>
      <p className={styles.detail} data-testid="card-detail">
        {t.passes.cardDetail({ minutes: passMinutes(pass), ...peak })}
      </p>
      {flags && (
        <div className={styles.flags} data-testid="card-flags">
          {ended && (
            <span className={styles.ended} data-testid="card-ended">
              {t.passes.ended}
            </span>
          )}
          {!ended && weather !== undefined && (
            <CloudBadge
              form="word"
              asText
              verdict={cloudVerdict(weather, pass.peak.t)}
              forecast={weather ? { provider: weather.provider, fetchedAt: weather.fetchedAt } : null}
              timeZone={timeZone}
              moment={t.weather.momentPeak}
            />
          )}
          {pass.twilight && <Tag tone="dim">{t.passes.twilightLabel}</Tag>}
          <MoonGlareLabel moon={pass.moonAtPeak} glare={pass.moonGlare} asText />
          {faint && (
            <Tag tone="dim" data-testid="card-faint">
              {t.passes.faintTag}
            </Tag>
          )}
        </div>
      )}
      {/* Last in the card, so its stretched box lies over everything before it. */}
      {onOpen && <OpenGuide passId={pass.id} nameId={headingId} onOpen={onOpen} picked={selected} />}
    </article>
  );
}
