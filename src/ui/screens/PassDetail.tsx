import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useT } from '../../i18n/useT';
import { formatDate } from '../../lib/timeFormat';
import type { Observer, Pass } from '../../model';
import { Countdown } from '../components/common/Countdown';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { GuidePanel } from '../components/guide/GuidePanel';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import { PassNumbers } from '../components/guide/PassNumbers';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import styles from './PassDetail.module.css';

/**
 * US-6 (R6): the guide for one pass. A labelled modal dialog: focus moves to
 * its heading on open and back to the opener on close; Escape and the close
 * control both return to the list. The parent decides what "close" means
 * (D-13: it clears the URL hash). R13: the sky chart (`SkyChart`, the
 * PLAN §8.1 boundary) sits between the countdown and the numbers; its
 * caption is the FR-GUIDE-1 sentence, so the screen shows it once. The
 * observer is passed whole: the chart wants it (PLAN §8.1), the times want
 * its zone. The page's own scroll is locked while the sheet is up: the sheet
 * is fixed and scrolls itself, so the list's scrollbar behind it was a
 * second, dead scrollbar on desktop (R13 review). R17 (D-94): the sheet
 * carries the language switch beside the back control — the page behind it,
 * header included, is inert while the sheet is up, so without it the
 * language could not be changed on this screen at all, and R31's share links
 * open straight onto it. R20 puts the theme switch beside it for the same
 * reason, and a stronger one: this is the screen someone is looking at while
 * standing outside in the dark (US-19).
 *
 * R23 (FR-DESK-3, D-72): two shells over that one content. Compact keeps the
 * full-screen sheet, portaled to `document.body` so that the page behind it
 * can be made inert while the sheet is not (D-117). Wide renders
 * `GuidePanel` in place — the second track of the right column, beside a list
 * that stays live — so it carries neither the language and theme switches
 * (the header is right there and interactive) nor the scroll lock (nothing is
 * covered). What both shells share is everything that is about the guide
 * rather than its frame: the heading and its focus, Escape, and the content.
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
  const mode = useLayoutMode();
  const compact = mode === 'compact';
  const timeZone = observer.timeZone;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const now = useNow(TICK_MS);

  // Focus in on open, back to the opener on close. Once, on open: crossing
  // the breakpoint swaps the shell around the same guide and must not take
  // the reader's focus away from wherever they had put it.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    return () => {
      opener?.focus();
    };
  }, []);

  // Lock the page scroll behind the sheet; the list keeps its scroll position
  // for the return. Only compact: the wide panel covers nothing.
  useEffect(() => {
    if (!compact) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [compact]);

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

  const body = (
    <>
      <p className={styles.meta}>
        {formatDate(pass.start.t, timeZone, locale)}
        {pass.twilight && <span className={styles.twilight}>{t.passes.twilightLabel}</span>}
      </p>
      <Countdown pass={pass} now={now} timeZone={timeZone} />
      <SkyChart passes={[pass]} observer={observer} highlightedPassId={pass.id} now={now} />
      <PassNumbers pass={pass} timeZone={timeZone} />
    </>
  );

  if (!compact) {
    return (
      <GuidePanel passId={pass.id} name={pass.name} headingId={headingId} headingRef={headingRef} onClose={onClose}>
        {body}
      </GuidePanel>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.sheet} data-pass-id={pass.id}>
      <div className={styles.frame}>
        <div className={styles.topRow}>
          <button type="button" className={styles.close} onClick={onClose}>
            {t.guide.back}
          </button>
          <div className={styles.controls}>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {pass.name}
        </h2>
        {body}
      </div>
    </div>,
    document.body,
  );
}
