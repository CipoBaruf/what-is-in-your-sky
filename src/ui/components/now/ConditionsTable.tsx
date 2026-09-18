import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { formatClockDuration } from '../../../lib/format';
import { moonFacts } from '../../../lib/moonPhrases';
import type { SkyBand } from '../../../lib/timeStripe';
import { formatShortClock } from '../../../lib/timeFormat';
import { tonightsDark } from '../../../lib/tonightStripe';
import type { EpochMs, Locale, NowItem, Observer } from '../../../model';
import { useAppStore } from '../../../state';
import { CloudBadge } from '../weather/CloudBadge';
import styles from './ConditionsTable.module.css';

/**
 * R81 (FR-FIRST-9, D-509): the conditions table, under tonight's stripe — a
 * description list, so each value is read with its label:
 *
 * - `Dark` · `20:14 → 05:31`: the first `dark` band still open or to come, from
 *   the stripe's own bands (D-470), or "No full darkness tonight.";
 * - `Clouds now` · FR-WX-3's current cover as its word, in the verdict's
 *   colour, the percentage and the source in its tooltip (US-7 AC3);
 * - `Moon` · FR-MOON-3's phase and illumination, and while it is up its
 *   compass point;
 * - `Up now` — only while at least one satellite is visible (US-4 as amended
 *   v2.0.2) — the first one's name and time left, and `+<n>` for the rest.
 *
 * It replaces the Now panel on the home page and reads what the panel read:
 * the store's `now` for this observer (refreshed every 10 s, FR-VIS-5) and the
 * weather slice. With nothing up there is no `Up now` row rather than a
 * sentence about why: the `Dark` row and the next-event block say when to look
 * instead. The live page keeps the full statement (US-4 AC1).
 */
export interface ConditionsTableProps {
  observer: Observer;
  /** The stripe's bands (`useTonight`); empty until the astronomy chunk lands, and then there is no `Dark` row. */
  bands: readonly SkyBand[];
  /** The first instant the bands cover. */
  sampledFrom: EpochMs;
  now: EpochMs;
}

/**
 * The `Dark` value. A band reaching back to the first sample began before
 * anything sampled — a polar winter — so its `from` is the sample's edge and
 * not a dusk, and the value names only the end. The times name their zone only
 * when the observer's is not known yet and the digits are UTC (F-27).
 */
export function darkWindowText(band: SkyBand | null, sampledFrom: EpochMs, timeZone: string | null, locale: Locale, t: Messages): string {
  if (!band) return t.home.noDarkWindow;
  const zone = timeZone === null;
  const to = formatShortClock(band.to, timeZone, locale, zone);
  if (band.from <= sampledFrom) return t.home.darkUntil(to);
  return t.home.darkWindow({ from: formatShortClock(band.from, timeZone, locale), to });
}

/** The satellites visible now, highest first: the first is the one the row names. */
export function visibleNow(items: readonly NowItem[]): NowItem[] {
  return items.filter((item) => item.visible).sort((a, b) => b.elDeg - a.elDeg);
}

/** `ISS (Zarya) · 3:12 left +2`. */
export function upNowText(visible: readonly NowItem[], at: EpochMs, t: Messages): string {
  const [first] = visible;
  if (!first) return '';
  const left = first.visibleUntil === undefined ? null : formatClockDuration((first.visibleUntil - at) / 1000);
  return t.home.upNow({ name: first.name, left, more: visible.length - 1 });
}

export function ConditionsTable({ observer, bands, sampledFrom, now }: ConditionsTableProps) {
  const t = useT();
  const locale = useLocale();
  const nowSlice = useAppStore((s) => s.now);
  const weather = useAppStore((s) => s.weather);
  const state = nowSlice.observer === observer ? nowSlice.state : null;
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const visible = state ? visibleNow(state.items) : [];
  const moon = state ? moonFacts(state.moon) : null;
  return (
    <dl className={styles.table} aria-label={t.home.conditions.label} data-testid="conditions">
      {bands.length > 0 && (
        <div className={styles.row} data-row="dark">
          <dt>{t.home.conditions.dark}</dt>
          <dd data-testid="dark-window">{darkWindowText(tonightsDark(bands, now), sampledFrom, observer.timeZone, locale, t)}</dd>
        </div>
      )}
      <div className={styles.row} data-row="clouds">
        <dt>{t.home.conditions.cloudsNow}</dt>
        <dd>
          {/* The cover at the instant of the last sky check, so it is dated with the rows beside it. */}
          <CloudBadge
            form="word"
            verdict={cloudVerdict(snapshot, state?.t ?? now)}
            forecast={snapshot ? { provider: snapshot.provider, fetchedAt: snapshot.fetchedAt } : null}
            timeZone={observer.timeZone}
            moment={t.weather.momentNow}
          />
        </dd>
      </div>
      {moon && (
        <div className={styles.row} data-row="moon">
          <dt>{t.home.conditions.moon}</dt>
          <dd data-testid="moon-row">{t.home.moonRow({ phase: moon.phase, illumination: moon.illumination, point: moon.up ? moon.direction : null })}</dd>
        </div>
      )}
      {state && visible.length > 0 && (
        <div className={styles.row} data-row="up-now">
          <dt>{t.home.conditions.upNow}</dt>
          <dd data-testid="up-now">{upNowText(visible, state.t, t)}</dd>
        </div>
      )}
    </dl>
  );
}
