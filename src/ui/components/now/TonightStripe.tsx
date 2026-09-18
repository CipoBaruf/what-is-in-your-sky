import { useMemo } from 'react';
import type { SkyBand } from '../../../lib/timeStripe';
import { tickLine, tonightSpan, tonightStripe, type StripeCell } from '../../../lib/tonightStripe';
import type { EpochMs, Observer, Pass, SkyState } from '../../../model';
import styles from './TonightStripe.module.css';

/**
 * R81 (FR-FIRST-8, D-506): tonight's stripe, the When reading's first block —
 * three lines of text in one `pre`: the hour labels, the band (`▓` day in
 * `--warn`, `▒` bright twilight in `--chart-pass-flown`, `█` dark in
 * `--chart-sky`) and a `▲` in the accent under each listed pass's peak. The
 * geometry is `lib/tonightStripe`'s; this only colours it.
 *
 * A picture of what the conditions table under it says in words, so it is
 * `aria-hidden`. Nothing until the bands have arrived: an unshaded stripe
 * would say it is day all night.
 */
export interface TonightStripeProps {
  bands: readonly SkyBand[];
  passes: readonly Pass[];
  observer: Pick<Observer, 'lon' | 'timeZone'>;
  now: EpochMs;
}

/** Consecutive cells of one sky, so the band is a handful of spans and not thirty. */
function runs(cells: readonly StripeCell[]): { sky: SkyState | null; text: string }[] {
  const out: { sky: SkyState | null; text: string }[] = [];
  for (const cell of cells) {
    const last = out[out.length - 1];
    if (last && last.sky === cell.sky) last.text += cell.char;
    else out.push({ sky: cell.sky, text: cell.char });
  }
  return out;
}

export function TonightStripe({ bands, passes, observer, now }: TonightStripeProps) {
  const { lon, timeZone } = observer;
  const stripe = useMemo(() => {
    if (bands.length === 0) return null;
    return tonightStripe(bands, passes, tonightSpan(bands, { lon, timeZone }, now), timeZone);
  }, [bands, passes, lon, timeZone, now]);
  if (stripe === null) return null;
  return (
    <pre className={styles.stripe} aria-hidden="true" data-testid="tonight-stripe">
      <span className={styles.labels}>{stripe.labels}</span>
      {'\n'}
      {runs(stripe.cells).map((run, index) => (
        <span key={index} className={styles.band} data-sky={run.sky ?? 'none'}>
          {run.text}
        </span>
      ))}
      {'\n'}
      <span className={styles.ticks}>{tickLine(stripe.ticks)}</span>
    </pre>
  );
}
