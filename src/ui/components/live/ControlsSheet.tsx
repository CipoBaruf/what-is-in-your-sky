import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useT } from '../../../i18n/useT';
import { SHEET_MAX_SHARE, SHEET_SIDE_SHARE } from '../../../lib/layout';
import { SETTINGS_HASH } from '../../../lib/shareLinks';
import { REDUCED_MOTION, useMediaQuery } from '../../hooks/useMediaQuery';
import { useOpenerFocus } from '../../hooks/useOpenerFocus';
import { loadSettingsChunk } from '../../screens/settingsChunk';
import { BracketLink } from '../primitives/BracketLink';
import { TextButton } from '../primitives/TextButton';
import { usePageShape } from './usePageShape';
import styles from './ControlsSheet.module.css';

/**
 * R147 (FR-FULL-3, FR-FULL-4, FR-FULL-5; D-921): the compact live page's one button over the sky and the sheet it
 * opens. `[ controls ]` is a `TextButton` and a toggle (`aria-expanded`, `aria-controls` naming the sheet), placed by
 * the page through `className`. The sheet is a non-modal `<section role="region">` named "Sky controls": a head —
 * the place in the dim ink, cut with an ellipsis, `[ settings ]` (the header's key and route) and `[ close ]` — over
 * a body that renders the page's rows (`children`) and scrolls inside the sheet while the head stays.
 *
 * Two forms, by `usePageShape`: in portrait a bottom sheet the full width of the box, as tall as its content up to
 * `SHEET_MAX_SHARE` of `100dvh`; on the landscape phone a panel at the right, `SHEET_SIDE_SHARE` of the viewport's
 * width and its full height. The two shares reach the stylesheet as custom properties written through the CSSOM
 * (the CSP allows no style attribute), as `SkyViewLayout` writes `LANDSCAPE_DRAWING_MIN_SHARE`.
 *
 * The section stays mounted while closed — `inert`, slid off the screen and `visibility: hidden` once the slide is
 * over — so it can slide out as well as in, and so `aria-controls` always names an element (D-932). The slide is a
 * `transform` transition of 200 ms, none under `prefers-reduced-motion: reduce` (asked in script, `data-motion`).
 *
 * The open state is the page's (`open`, `onOpenChange`): R148 lifts it to `Live.tsx` so a turn of the phone keeps
 * it and every visit starts closed. Focus: opening moves it to the body's first focusable element (the head's
 * `[ close ]` where the body has none) and closing gives it back to `[ controls ]` — `useOpenerFocus`, as the pass
 * detail's sheet does, mounted with the open sheet; the button takes the focus itself before it opens the sheet,
 * so the opener is `[ controls ]` on a browser that does not focus a pressed button (Safari). No focus trap, no
 * backdrop: the sky above stays hit-testable. Nothing here writes the URL or the history (§4.37).
 */
export interface ControlsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The place's name for the sheet's head, `null` where there is none. */
  place: string | null;
  /** The sheet's rows, in FR-FULL-4's order (the page's, R148). */
  children?: ReactNode;
  /** Placement of `[ controls ]` only (D-704): the overlay's bottom-right corner is the page's. */
  className?: string | undefined;
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** The first element in `root` the keyboard can reach, in document order. */
function firstFocusable(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
}

export function ControlsSheet({ open, onOpenChange, place, children, className }: ControlsSheetProps) {
  const t = useT();
  const shape = usePageShape();
  const sheetId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const side = shape === 'landscape-phone';
  const still = useMediaQuery(REDUCED_MOTION);
  /*
   * R148 (FR-FSC-2, D-935): the focus moves in only on an open the reader made while the sheet was on the page. A
   * sheet mounted already open — the live page's layout coming back after the sky screen, with the sheet and the
   * picker as the reader left them — leaves the focus where the screen's close put it (`[ hold up to the sky ]`),
   * and arms itself for the next open once it has closed.
   */
  const armed = useRef(!open);
  if (!open) armed.current = true;

  // The two shares, from the one constant each (CSSOM, not a style attribute: the CSP).
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.setProperty('--sheet-max-share', String(SHEET_MAX_SHARE));
    sheet.style.setProperty('--sheet-side-share', String(SHEET_SIDE_SHARE));
  }, []);

  // The settings page's chunk is fetched as the pointer or the focus reaches its link, as the header's is (D-545).
  const prefetch = (): void => void loadSettingsChunk().catch(() => undefined);

  const toggle = (): void => {
    if (!open) buttonRef.current?.focus();
    onOpenChange(!open);
  };

  return (
    <>
      <TextButton
        ref={buttonRef}
        label={t.sheet.controls}
        aria-expanded={open}
        aria-controls={sheetId}
        className={['target', className].filter(Boolean).join(' ')}
        onClick={toggle}
        data-testid="live-controls"
      />
      <section
        ref={sheetRef}
        id={sheetId}
        role="region"
        aria-label={t.sheet.name}
        className={styles.sheet}
        data-form={side ? 'side' : 'bottom'}
        data-open={open ? 'true' : 'false'}
        data-motion={still ? 'reduce' : 'slide'}
        inert={!open}
        data-testid="live-sheet"
      >
        <div className={styles.head} data-testid="sheet-head">
          <span className={styles.place} data-testid="sheet-place">
            {place ?? ''}
          </span>
          <BracketLink href={SETTINGS_HASH} label={t.settings.open} className="target" data-testid="sheet-settings" onPointerEnter={prefetch} onFocus={prefetch} />
          <TextButton ref={closeRef} label={t.sheet.close} className="target" onClick={() => onOpenChange(false)} data-testid="sheet-close" />
        </div>
        <div ref={bodyRef} className={styles.body} data-testid="sheet-body">
          {children}
        </div>
        {open && armed.current && <FocusIn body={bodyRef} fallback={closeRef} />}
      </section>
    </>
  );
}

/**
 * Mounted while the sheet is open, so `useOpenerFocus`'s mount and unmount are the sheet's open and close: it reads
 * the opener (`[ controls ]`, which `toggle` focused) as it mounts, focuses the body's first control, and gives the
 * focus back to the opener as the sheet closes.
 */
function FocusIn({ body, fallback }: { body: RefObject<HTMLElement | null>; fallback: RefObject<HTMLElement | null> }) {
  const target = useRef<HTMLElement | null>(null);
  // A layout effect runs before `useOpenerFocus`'s passive one, so the target is known when it focuses.
  useLayoutEffect(() => {
    target.current = firstFocusable(body.current) ?? fallback.current;
  }, [body, fallback]);
  useOpenerFocus(target);
  return null;
}
