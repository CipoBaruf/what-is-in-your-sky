import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { searchPlaces, useActiveObserver, useAppStore } from '../../../state';
import { count } from '../../../state/measure';
import { sameLocation } from '../../../state/slices/location';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useOwnObserver, usePageObserver } from '../../hooks/useOwnObserver';
import { closePlaceRequest, usePlaceRequested } from '../../screens/home/placeRequest';
import { Close } from '../primitives/Close';
import { TextButton } from '../primitives/TextButton';
import { LocationInput, type LocationInputProps } from './LocationInput';
import { type PlaceSearchFn } from './PlacePicker';
import styles from './PlaceDialog.module.css';

/**
 * R215 (FR-LAND-4, FR-OPEN-5 as amended; D-1238): the place group (search, use my location, coordinates, saved places)
 * in a modal frame over the page, as `AskDialog` is drawn: a portal to the body, the rest of the document `inert`,
 * the focus in the group on open and back to the opener on close. A place set by any way in closes it — a searched
 * or the device's place as it arrives, a saved place as the store takes it, a typed pair on `continue` (the fields
 * emit as they are typed, so the pair is held until then). `Esc` and `×` leave it with nothing changed.
 * `where_shown` is counted as it opens (FR-MEAS-2 as amended, D-1242).
 */
export interface PlaceDialogProps {
  onClose: () => void;
  /** The place search; the app's `searchPlaces` (a test passes its own). */
  search?: PlaceSearchFn;
  geolocation?: LocationInputProps['geolocation'];
}

export function PlaceDialog({ onClose, search = searchPlaces, geolocation }: PlaceDialogProps) {
  const t = useT();
  const mode = useLayoutMode();
  const headingId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const own = useOwnObserver();
  const page = usePageObserver();
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const [typed, setTyped] = useState<Observer | null>(null);
  const [opener] = useState<HTMLElement | null>(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const [shownWith] = useState(own);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // FR-MEAS-2 as amended: the example's dialog, the fallback's (no place, no example), or a set place's (no detail).
  const active = useActiveObserver();
  const [detail] = useState<'example' | 'fallback' | null>(() => (active === null || page === null ? 'fallback' : active.source === 'example' ? 'example' : null));
  useEffect(() => {
    if (detail === null) count('where_shown');
    else count('where_shown', detail);
  }, [detail]);

  // A saved place picked, or any place the store takes from inside: the dialog's work is done.
  useEffect(() => {
    if (own !== null && !sameLocation(own, shownWith)) closeRef.current();
  }, [own, shownWith]);

  useEffect(() => {
    const root = frame.current;
    // The document behind is inert while the dialog is up: every child of the body but the dialog's own.
    const made: Element[] = [];
    for (const child of document.body.children) {
      if (root !== null && child.contains(root)) continue;
      if (child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      made.push(child);
    }
    // `Esc` leaves, before any page's own `Esc` (the window's capture phase); the page's keys do not act behind it.
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeRef.current();
    };
    // The page's keys listen on the document and the window: a key pressed in the dialog stops at the body, after
    // the dialog's own handlers (React's, on the portal's container) have had it.
    const onKey = (event: KeyboardEvent): void => {
      if (root?.contains(event.target as Node)) event.stopPropagation();
    };
    window.addEventListener('keydown', onEscape, true);
    document.body.addEventListener('keydown', onKey);
    (root?.querySelector('input') ?? root)?.focus();
    return () => {
      window.removeEventListener('keydown', onEscape, true);
      document.body.removeEventListener('keydown', onKey);
      for (const child of made) child.removeAttribute('inert');
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  const onObserver = (next: Observer | null): void => {
    if (next?.source === 'coords') {
      setTyped(next);
      return;
    }
    setTyped(null);
    if (next === null) return;
    setObserver(next);
    onClose();
  };
  const commitTyped = (): void => {
    if (typed === null) return;
    setObserver(typed);
    onClose();
  };

  return createPortal(
    <div className={styles.overlay} data-testid="place-dialog-overlay">
      <div ref={frame} role="dialog" aria-modal="true" aria-labelledby={headingId} className={styles.frame} data-testid="place-dialog" tabIndex={-1}>
        <div className={styles.head}>
          <h2 id={headingId} className={styles.heading}>
            {t.home.coldHeading}
          </h2>
          <Close onClose={onClose} data-testid="place-dialog-close" />
        </div>
        <p className={styles.sentence}>{t.home.coldSentence}</p>
        <LocationInput
          observer={own}
          onObserver={onObserver}
          onClear={clearSavedObserver}
          search={search}
          {...(geolocation ? { geolocation } : {})}
          variant="group"
          look={mode === 'compact' ? 'boxed' : 'plain'}
          labelledBy={headingId}
          afterCoords={<TextButton label={t.location.continue} disabled={typed === null} data-testid="place-dialog-continue" onClick={commitTyped} />}
        />
      </div>
    </div>,
    document.body,
  );
}

/** The one place the dialog is mounted (`AppRoot`): up while `requestPlace()` has asked for it. */
export function PlaceDialogHost() {
  const open = usePlaceRequested();
  return open ? <PlaceDialog onClose={closePlaceRequest} /> : null;
}
