import { useT } from '../../../i18n/useT';
import type { SkyBand } from '../../../lib/timeStripe';
import type { EpochMs, Observer } from '../../../model';
import { SEARCH_WINDOW_HOURS } from '../../../state';
import { TonightStripe } from '../../components/now/TonightStripe';
import { useTonight } from '../../components/now/useTonight';
import { NextEventBlock } from '../../components/passes/NextEventBlock';
import { TextButton } from '../../components/primitives/TextButton';
import styles from './ExampleBand.module.css';
import { usePassContext, useShownPasses } from './shownPasses';

/** FR-OPEN-14 (D-1211): whether the Sun is in the stripe's day band at `now` — the band holding it is `day`. */
export function isDay(bands: readonly SkyBand[], now: EpochMs): boolean {
  return bands.some((band) => band.sky === 'day' && band.from <= now && now < band.to);
}

export interface ExampleBandProps {
  /** The example observer; null for the moment before the zone's city is known, when the band holds its height. */
  observer: Observer | null;
  /** FR-OPEN-4: the example's run is not ready — the label, `example.finding` and the action, already live. */
  pending: boolean;
  onSetPlace: () => void;
  onOpenPass: (passId: string) => void;
  selectedPassId: string | null;
}

/**
 * R202 (FR-OPEN-3, FR-OPEN-4, FR-OPEN-12..14; D-1179): the compact first visit's example band — the label, the next
 * pass as FR-FIRST-3's first card in words (`plain`), the day line, tonight's stripe and `[ Not there? Set your
 * place ]`, in a box ruled in the accent. No dome: the stripe is the band's picture.
 */
export function ExampleBand({ observer, pending, onSetPlace, onOpenPass, selectedPassId }: ExampleBandProps) {
  const t = useT();
  const waiting = pending || observer === null;
  return (
    <section aria-label={observer ? t.example.label(observer.label) : undefined} className={styles.band} data-testid="example-band" data-state={waiting ? 'pending' : 'pass'}>
      <p className={styles.label} data-testid="example-label">
        {observer ? t.example.label(observer.label) : ' '}
      </p>
      {observer && !waiting ? (
        <Shown observer={observer} onOpenPass={onOpenPass} selectedPassId={selectedPassId} />
      ) : (
        <>
          <div className={styles.cardHold} data-testid="example-hold">
            {observer && (
              <p className={styles.finding} role="status" data-testid="example-finding">
                {t.example.finding(observer.label)}
              </p>
            )}
          </div>
          <div className={styles.stripeHold} />
        </>
      )}
      <TextButton box="accent" fill label={t.example.setPlace} data-testid="example-set-place" onClick={onSetPlace} />
    </section>
  );
}

/** The band once the run is in: the card, the day line and the stripe, which read the run and tonight's bands. */
function Shown({ observer, onOpenPass, selectedPassId }: { observer: Observer; onOpenPass: (passId: string) => void; selectedPassId: string | null }) {
  const t = useT();
  const passes = useShownPasses(selectedPassId);
  const { elementCount, hasDarkness } = usePassContext();
  const tonight = useTonight(observer);
  return (
    <>
      <NextEventBlock form="card" plain passes={passes} timeZone={observer.timeZone} context={{ elementCount, hasDarkness }} hours={SEARCH_WINDOW_HOURS} onOpen={onOpenPass} />
      {isDay(tonight.bands, tonight.now) && (
        <p className={styles.dusk} data-testid="example-after-dusk">
          {t.example.afterDusk}
        </p>
      )}
      <div className={styles.stripeHold}>
        <TonightStripe bands={tonight.bands} passes={passes} observer={observer} now={tonight.now} />
      </div>
    </>
  );
}
