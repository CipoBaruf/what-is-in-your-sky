import { useEffect, useId, useRef } from 'react';
import { useLocale, useT } from '../../i18n/useT';
import { formatDate } from '../../lib/timeFormat';
import type { Observer, Pass } from '../../model';
import { Countdown } from '../components/common/Countdown';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { useNow } from '../hooks/useNow';
import { PassNumbers } from '../components/guide/PassNumbers';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import styles from './PassDetail.module.css';

/**
 * US-6 (R6): the full-screen detail sheet. A labelled modal dialog: focus
 * moves to its heading on open and back to the opener on close; Escape and
 * the close control both return to the list. The parent decides what "close"
 * means (D-13: it clears the URL hash). R13: the sky chart (`SkyChart`, the
 * PLAN §8.1 boundary) sits between the countdown and the numbers; its
 * caption is the FR-GUIDE-1 sentence, so the screen shows it once. The
 * observer is passed whole: the chart wants it (PLAN §8.1), the times want
 * its zone. The page's own scroll is locked while the sheet is up: the sheet
 * is fixed and scrolls itself, so the list's scrollbar behind it was a
 * second, dead scrollbar on desktop (R13 review). R17 (D-94): the sheet
 * carries the language switch beside the back control — the page behind it,
 * header included, is inert while the sheet is up, so without it the
 * language could not be changed on this screen at all, and R31's share links
 * open straight onto it.
 */
export interface PassDetailProps {
  pass: Pass;
  observer: Observer;
  onClose: () => void;
}

export const TICK_MS = 1000;

export function PassDetail({ pass, observer, onClose }: PassDetailProps) {
  const t = useT();
  const locale = useLocale();
  const timeZone = observer.timeZone;
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

  // Lock the page scroll behind the sheet; the list keeps its scroll position for the return.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
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
        <div className={styles.topRow}>
          <button type="button" className={styles.close} onClick={onClose}>
            {t.guide.back}
          </button>
          <LanguageToggle />
        </div>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {pass.name}
        </h2>
        <p className={styles.meta}>
          {formatDate(pass.start.t, timeZone, locale)}
          {pass.twilight && <span className={styles.twilight}>{t.passes.twilightLabel}</span>}
        </p>
        <Countdown pass={pass} now={now} timeZone={timeZone} />
        <SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} now={now} />
        <PassNumbers pass={pass} timeZone={timeZone} />
      </div>
    </div>
  );
}
