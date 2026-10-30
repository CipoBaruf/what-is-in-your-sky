import { useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { useT } from '../../../i18n/useT';
import { SHEET_FLICK_PX_PER_MS, SHEET_MAX_SHARE, SHEET_SWIPE_CLOSE_PX } from '../../../lib/layout';
import { SETTINGS_HASH } from '../../../lib/shareLinks';
import { REDUCED_MOTION, useMediaQuery } from '../../hooks/useMediaQuery';
import { useOpenerFocus } from '../../hooks/useOpenerFocus';
import { loadSettingsChunk } from '../../screens/settingsChunk';
import { BracketLink } from '../primitives/BracketLink';
import { TextButton } from '../primitives/TextButton';
import styles from './ControlsSheet.module.css';

/**
 * R147 (FR-FULL-3, FR-FULL-4, FR-FULL-5; D-921): the compact live page's one button over the sky and the sheet it
 * opens. `[ controls ]` is a `TextButton` and a toggle (`aria-expanded`, `aria-controls` naming the sheet), placed by
 * the page through `className`. The sheet is a non-modal `<section role="region">` named "Sky controls": a head —
 * the place in the dim ink, cut with an ellipsis, `[ settings ]` (the header's key and route) and the `×` — over
 * a body that renders the page's rows (`children`) and scrolls inside the sheet while the head stays.
 *
 * R150 (FR-GYRO-7, D-947): one form, a bottom sheet the full width of the box in both shapes, as tall as its content
 * up to `SHEET_MAX_SHARE` of `100dvh`; v2.8's side panel on the landscape phone is gone. The share reaches the
 * stylesheet as a custom property written through the CSSOM (the CSP allows no style attribute), as `SkyViewLayout`
 * writes `LANDSCAPE_DRAWING_MIN_SHARE`.
 *
 * R150 (FR-GYRO-8, D-948): the head ends in a `×` (FR-FSC-2's form: the character alone, a 44 px target) named
 * "Close controls", and the head row is a handle: a downward drag that starts on it moves the sheet with the finger
 * (`--sheet-drag`, never upward, no transition while it lasts) and on release closes it past `SHEET_SWIPE_CLOSE_PX`
 * or faster than `SHEET_FLICK_PX_PER_MS` over its last 100 ms, else snaps it back. The row alone has
 * `touch-action: none`, so the body keeps its native scroll. A press on `[ settings ]` or the `×` is theirs (D-953).
 *
 * The section stays mounted while closed — `inert`, slid off the screen and `visibility: hidden` once the slide is
 * over — so it can slide out as well as in, and so `aria-controls` always names an element (D-932). The slide is a
 * `transform` transition of 200 ms, none under `prefers-reduced-motion: reduce` (asked in script, `data-motion`).
 *
 * The open state is the page's (`open`, `onOpenChange`): R148 lifts it to `Live.tsx` so a turn of the phone keeps
 * it and every visit starts closed. Focus: opening moves it to the body's first focusable element (the head's
 * `×` where the body has none) and closing gives it back to `[ controls ]` — `useOpenerFocus`, as the pass
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

/** The span over which a release's speed is read (D-948): the drag's last 100 ms. */
const FLICK_WINDOW_MS = 100;

/** A point of a drag: the event's time, ms, and its `clientY`. */
interface Sample {
  t: number;
  y: number;
}

/** A drag on the head row: its pointer, where it started and its points. */
interface Drag {
  id: number;
  y0: number;
  samples: Sample[];
}

/**
 * Whether a release `travel` px below the press, with `samples` the drag's points (time-ordered, the release last),
 * closes the sheet: past `SHEET_SWIPE_CLOSE_PX`, or a downward speed over the last `FLICK_WINDOW_MS` faster than
 * `SHEET_FLICK_PX_PER_MS`.
 */
function swipeCloses(travel: number, samples: readonly Sample[]): boolean {
  if (travel > SHEET_SWIPE_CLOSE_PX) return true;
  if (travel <= 0 || samples.length < 2) return false;
  const end = samples.length - 1;
  const last = samples[end] as Sample;
  // The earliest point inside the window, or the one before the release where the window holds only the release.
  const inside = samples.findIndex((sample) => last.t - sample.t <= FLICK_WINDOW_MS);
  const first = samples[Math.min(inside, end - 1)] as Sample;
  const dt = last.t - first.t;
  if (dt <= 0) return false;
  return (last.y - first.y) / dt > SHEET_FLICK_PX_PER_MS;
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** The first element in `root` the keyboard can reach, in document order. */
function firstFocusable(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
}

export function ControlsSheet({ open, onOpenChange, place, children, className }: ControlsSheetProps) {
  const t = useT();
  const sheetId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const still = useMediaQuery(REDUCED_MOTION);
  /*
   * R148 (FR-FSC-2, D-935): the focus moves in only on an open the reader made while the sheet was on the page. A
   * sheet mounted already open — the live page's layout coming back after the sky screen, with the sheet and the
   * picker as the reader left them — leaves the focus where the screen's close put it (`[ hold up to the sky ]`),
   * and arms itself for the next open once it has closed.
   */
  const [armed, setArmed] = useState(!open);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setArmed(true);
  }

  // The share, from the one constant (CSSOM, not a style attribute: the CSP).
  useLayoutEffect(() => {
    sheetRef.current?.style.setProperty('--sheet-max-share', String(SHEET_MAX_SHARE));
  }, []);

  /** Moves the sheet `dy` px down from its place, or back to it with `null`. */
  const follow = (dy: number | null): void => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (dy === null) sheet.style.removeProperty('--sheet-drag');
    else sheet.style.setProperty('--sheet-drag', `${String(dy)}px`);
  };

  /*
   * R150 (FR-GYRO-8, D-948): the swipe. A primary press on the head row, not on one of its controls, starts a drag
   * and captures the pointer, so the moves keep coming when the finger leaves the row; each move puts the sheet that
   * far under its place (never above it); the release closes or snaps back. A cancel snaps back.
   */
  const onHeadDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!open || !event.isPrimary || event.button > 0) return;
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    drag.current = { id: event.pointerId, y0: event.clientY, samples: [{ t: event.timeStamp, y: event.clientY }] };
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const track = (event: PointerEvent<HTMLDivElement>): Drag | null => {
    const current = drag.current;
    if (current?.id !== event.pointerId) return null;
    current.samples.push({ t: event.timeStamp, y: event.clientY });
    // Only the window's points and the one before it are ever read.
    while (current.samples.length > 2 && event.timeStamp - (current.samples[1] as Sample).t > FLICK_WINDOW_MS) current.samples.shift();
    return current;
  };

  const onHeadMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = track(event);
    if (current) follow(Math.max(0, event.clientY - current.y0));
  };

  const end = (): void => {
    drag.current = null;
    setDragging(false);
    follow(null);
  };

  const onHeadUp = (event: PointerEvent<HTMLDivElement>): void => {
    const current = track(event);
    if (!current) return;
    const closes = swipeCloses(event.clientY - current.y0, current.samples);
    end();
    if (closes) onOpenChange(false);
  };

  const onHeadCancel = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current?.id === event.pointerId) end();
  };

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
        data-open={open ? 'true' : 'false'}
        data-dragging={dragging ? 'true' : undefined}
        data-motion={still ? 'reduce' : 'slide'}
        inert={!open}
        data-testid="live-sheet"
      >
        <div className={styles.head} data-testid="sheet-head" onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp} onPointerCancel={onHeadCancel}>
          <span className={styles.place} data-testid="sheet-place">
            {place ?? ''}
          </span>
          <BracketLink href={SETTINGS_HASH} label={t.settings.open} className="target" data-testid="sheet-settings" onPointerEnter={prefetch} onFocus={prefetch} />
          <button type="button" ref={closeRef} className={`target ${styles.close}`} aria-label={t.sheet.close} onClick={() => onOpenChange(false)} data-testid="sheet-close">
            ×
          </button>
        </div>
        <div ref={bodyRef} className={styles.body} data-testid="sheet-body">
          {children}
        </div>
        {open && armed && <FocusIn body={bodyRef} fallback={closeRef} />}
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
