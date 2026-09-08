import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useT } from '../../i18n/useT';
import { guideParams } from '../../lib/phrases';
import { passLinkFor, shareUrl } from '../../lib/shareLinks';
import { formatDate } from '../../lib/timeFormat';
import type { Observer, Pass } from '../../model';
import { Countdown } from '../components/common/Countdown';
import { ShareButton } from '../components/common/ShareButton';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { GuidePanel } from '../components/guide/GuidePanel';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import { useOpenerFocus } from '../hooks/useOpenerFocus';
import { MoonAtPeak } from '../components/moon/MoonAtPeak';
import { MoonGlareNote } from '../components/moon/MoonGlare';
import { PassNumbers } from '../components/guide/PassNumbers';
import { useAppStore } from '../../state';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { SkyScreen } from '../components/screen/SkyScreen';
import styles from './PassDetail.module.css';

/**
 * US-6 (R6): the guide for one pass. A labelled modal dialog: focus moves to
 * its heading on open and back to the opener on close, and the close control
 * returns to the list. Escape returns to the list too, but from the shortcut
 * table rather than from here (R35, D-73): it is one of FR-DESK-4's keys, and
 * the one listener is what decides that Escape closes the shortcuts overlay
 * before it closes the guide. The parent decides what "close" means
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
 * rather than its frame: the heading and its focus, and the content.
 *
 * R30 (FR-MOON-2): the glare sentence follows the chart, directly under the
 * FR-GUIDE-1 sentence the chart captions itself with — one warning about this
 * pass, right where the reader has just been told what to expect from it.
 *
 * R51 (FR-LEG-3, US-23 AC3): the numeric table is no longer a block of its own
 * further down the sheet — it is the chart's legend, handed to `SkyChart` as
 * the block that stands in for the explained pass's row, so it lands directly
 * under the drawing with the drawing's key and the arc's colour in its
 * heading, and any other pass drawn dim is listed under it. The screen still
 * shows the FR-GUIDE-1 sentence once, above the drawing, as the figure's
 * caption.
 *
 * R50 (F-43, F-45): the focus in and out is `useOpenerFocus`, which reads the
 * opener during the render rather than in the mount effect — by the effect the
 * page around this is already `inert` and the card that opened it has been
 * blurred. And the sheet takes an `inert` of its own: it is portaled to the
 * body, so the flag `App` puts on the header, the main and the footer does not
 * reach it, and with the shortcuts overlay up its controls were live under it.
 *
 * R31 (US-12, FR-SHARE-1/2): the share action closes the guide, below the
 * numbers — the end of what there is to read about this pass is where handing
 * it on belongs, and it is part of the shared content, so both shells carry
 * it. The link is built here rather than in the button: the observer and the
 * pass are what identify it (D-83), and the page's own URL is what it is
 * relative to.
 */
export interface PassDetailProps {
  pass: Pass;
  observer: Observer;
  onClose: () => void;
  /** R50 (F-6): the wide panel's `[ list ]`; the compact sheet has `← Back`, which closes instead. */
  onShowList: () => void;
  /** R50 (F-45): the compact sheet portals out of everything `App` makes inert, so the overlay has to say so here. */
  inert?: boolean;
}

export const TICK_MS = 1000;

export function PassDetail({ pass, observer, onClose, onShowList, inert = false }: PassDetailProps) {
  const t = useT();
  const locale = useLocale();
  const mode = useLayoutMode();
  const compact = mode === 'compact';
  const timeZone = observer.timeZone;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const now = useNow(TICK_MS);
  /*
   * R66 (FR-FSC-1, FR-FSC-9; V13-9, D-351, D-354): the sky screen over this
   * sheet. The window is a view this page offers again (FR-FSC-6) and what
   * choosing it opens is the same layer the live page opens — the chart's view
   * control sets the flag, this page renders the screen, and the `×` closes it.
   *
   * The layer is portaled to the body like the sheet itself: inside the sheet
   * it would be a fixed child of a scrolling container, and on iOS a fixed
   * child of a scrolled ancestor is not reliably the viewport.
   */
  const screenOpen = useAppStore((s) => s.skyScreen);
  const closeScreen = useAppStore((s) => s.closeSkyScreen);
  /*
   * FR-FSC-2: `Esc` closes the screen and stops, before the app's one `keydown`
   * listener (`lib/shortcuts.ts`) can read the same press as "close the guide".
   * Capture, so it runs before that listener's bubble phase on the same
   * document, and `stopPropagation` is what keeps the press from reaching it.
   */
  useEffect(() => {
    if (!screenOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeScreen();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [screenOpen, closeScreen]);
  // FR-FSC-2: leaving the guide by any route closes the screen.
  const openRef = useRef(screenOpen);
  useEffect(() => {
    openRef.current = screenOpen;
  }, [screenOpen]);
  useEffect(
    () => () => {
      if (openRef.current) closeScreen();
    },
    [closeScreen],
  );
  /*
   * FR-FSC-9: the sheet is held still under the layer and gets its place back.
   * It is the app's one scrolling container (`.sheet`), so without this a drag
   * on the screen that the layer does not consume scrolls the guide behind it,
   * and closing would come back somewhere else.
   */
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!screenOpen || !sheet) return;
    const top = sheet.scrollTop;
    const previous = sheet.style.overflow;
    sheet.style.overflow = 'hidden';
    return () => {
      sheet.style.overflow = previous;
      sheet.scrollTop = top;
    };
  }, [screenOpen]);
  // Focus in on open, back to the opener on close. Once, on open: crossing
  // the breakpoint swaps the shell around the same guide and must not take
  // the reader's focus away from wherever they had put it. R50 (F-8): a
  // second pass is a second instance — `App` keys this by the pass — so
  // "on open" is once per guide and not once per selection.
  useOpenerFocus(headingRef);

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

  const body = (
    <>
      <p className={styles.meta}>
        {formatDate(pass.start.t, timeZone, locale)}
        {pass.twilight && <span className={styles.twilight}>{t.passes.twilightLabel}</span>}
      </p>
      <Countdown pass={pass} now={now} timeZone={timeZone} />
      <SkyChart
        passes={[pass]}
        observer={observer}
        highlightedPassId={pass.id}
        now={now}
        legendLead={(row) => <PassNumbers pass={pass} timeZone={timeZone} legendKey={row.key} colorToken={row.colorToken} />}
      />
      <MoonAtPeak moon={pass.moonAtPeak} variant="guide" />
      <MoonGlareNote moon={pass.moonAtPeak} glare={pass.moonGlare} />
      <ShareButton url={shareUrl(window.location.href, passLinkFor(observer, pass))} title={t.share.title({ name: pass.name })} text={t.guide.sentence(guideParams(pass, timeZone, locale))} />
    </>
  );

  // The screen is the same layer on both shells; the sheet is what has a scroll to hold still.
  const screen = screenOpen && createPortal(<SkyScreen passes={[pass]} observer={observer} now={now} highlightedPassId={pass.id} onClose={closeScreen} />, document.body);

  if (!compact) {
    return (
      <>
        <GuidePanel passId={pass.id} name={pass.name} headingId={headingId} headingRef={headingRef} onClose={onClose} onShowList={onShowList}>
          {body}
        </GuidePanel>
        {screen}
      </>
    );
  }

  return createPortal(
    <>
    <div ref={sheetRef} inert={inert || screenOpen} role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.sheet} data-pass-id={pass.id}>
      <div className={styles.frame}>
        <div className={styles.topRow}>
          <button type="button" className={styles.close} onClick={onClose}>
            {t.guide.back}
          </button>
          <div className={styles.controls}>
            <LanguageToggle className={styles.prefsToggle} />
            <ThemeToggle />
          </div>
        </div>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {pass.name}
        </h2>
        {body}
      </div>
    </div>
    {screen}
    </>,
    document.body,
  );
}
