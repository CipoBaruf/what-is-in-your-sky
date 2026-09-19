import { useId, useState } from 'react';
import { useT } from '../../../i18n/useT';
import { ageParts, epochIsOld, newestEpoch } from '../../../lib/elementsAge';
import type { EpochMs } from '../../../model';
import { useAppStore } from '../../../state';
import { useNow } from '../../hooks/useNow';
import { StoredLine } from '../common/ReadinessLine';
import { AGE_TICK_MS, ElementsBanners } from './ElementsBanners';
import styles from './ElementsLine.module.css';

/**
 * R81 (FR-SAT-4 as amended v2.0.2, FR-FIRST-11, D-511): the elements as one
 * line in the Where reading — `Elements 9 d 4 h old · [ details ]`, in
 * `--warn` past the five days (FR-SAT-4) or while a copy CelesTrak could not
 * confirm is in use (FR-SAT-6). `[ details ]` is a disclosure that opens, in
 * place, everything `ElementsBanners` says — the epoch, the confirmation, the
 * warnings and the notes — and the stored run's storage time the readiness
 * line no longer carries on the home page (FR-OFF-4 as amended). Nothing
 * before the elements load, as the banners had: the pass list's status line
 * covers loading and errors.
 */
export interface ElementsLineProps {
  /** The clock, for tests; the app re-reads it every minute. */
  now?: EpochMs;
}

export function ElementsLine({ now: nowProp }: ElementsLineProps) {
  const t = useT();
  const elements = useAppStore((s) => s.elements);
  const clock = useNow(AGE_TICK_MS);
  const now = nowProp ?? clock;
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  if (elements.status !== 'ready') return null;
  const newest = newestEpoch(elements.records);
  const warn = elements.stale || (newest !== null && epochIsOld(newest, now));
  return (
    <div className={styles.block}>
      <p className={styles.line} data-testid="elements-line" data-warn={warn}>
        <span className={styles.age}>{newest === null ? t.elements.lineNone : t.elements.line(t.elements.age(ageParts(now - newest)))}</span>
        <span aria-hidden="true">{' · '}</span>
        <button
          type="button"
          className={`inline-control ${styles.details}`}
          aria-expanded={open}
          aria-controls={detailsId}
          data-testid="elements-details"
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {t.elements.details}
        </button>
      </p>
      <div id={detailsId} hidden={!open} className={styles.panel}>
        <ElementsBanners {...(nowProp === undefined ? {} : { now: nowProp })} />
        <StoredLine />
      </div>
    </div>
  );
}
