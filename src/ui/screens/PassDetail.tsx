import { useEffect, useId, useRef, useState } from 'react';
import { TWILIGHT_LABEL } from '../../lib/phrases';
import { formatDate } from '../../lib/timeFormat';
import type { EpochMs, Pass } from '../../model';
import { Countdown } from '../components/common/Countdown';
import { GuideText } from '../components/guide/GuideText';
import { PassNumbers } from '../components/guide/PassNumbers';
import styles from './PassDetail.module.css';

/**
 * US-6 (R6): the full-screen detail sheet. A labelled modal dialog: focus
 * moves to its heading on open and back to the opener on close; Escape and
 * the close control both return to the list. The parent decides what "close"
 * means (D-13: it clears the URL hash). The sky chart mounts in the labelled
 * slot below the sentence from R13 on.
 */
export interface PassDetailProps {
  pass: Pass;
  timeZone: string | null;
  onClose: () => void;
}

export const TICK_MS = 1000;

/** The wall clock, re-read every `intervalMs` while mounted. UI code may read the clock; `src/lib` may not (D-15). */
export function useNow(intervalMs: number): EpochMs {
  const [now, setNow] = useState<EpochMs>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function PassDetail({ pass, timeZone, onClose }: PassDetailProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const now = useNow(TICK_MS);

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    return () => {
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.sheet} data-pass-id={pass.id}>
      <div className={styles.frame}>
        <button type="button" className={styles.close} onClick={onClose}>
          ← Back to the list
        </button>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {pass.name}
        </h2>
        <p className={styles.meta}>
          {formatDate(pass.start.t, timeZone)}
          {pass.twilight && <span className={styles.twilight}>{TWILIGHT_LABEL}</span>}
        </p>
        <Countdown pass={pass} now={now} timeZone={timeZone} />
        <GuideText pass={pass} timeZone={timeZone} />
        <div className={styles.chartSlot} data-slot="sky-chart">
          <p className={styles.chartNote}>[ sky chart: coming in a later release ]</p>
        </div>
        <PassNumbers pass={pass} timeZone={timeZone} />
      </div>
    </div>
  );
}
