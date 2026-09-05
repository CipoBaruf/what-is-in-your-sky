import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { LinkedText } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { observerFromPlace, placeRegion } from '../../../lib/place';
import type { Observer, Place } from '../../../model';
import { useOnline } from '../../hooks/useOnline';
import { coordsLabel } from './CoordsInput';
import styles from './PlacePicker.module.css';

/**
 * FR-LOC-1 (a), FR-LOC-2, US-1: one free-text field, searched 500 ms after
 * typing stops (Enter searches at once), with the results as a listbox the
 * arrow keys walk and Enter or a click picks. Picking sets a `geocode`
 * observer whose zone came with the result (FR-LOC-3) and shows "Using the
 * centre of <place>" with the coordinates, which is also the FR-LOC-6 note:
 * the app resolves places, not addresses. No match and a failed search both
 * say so and point at the coordinates input (US-1 AC3); the field stays
 * usable throughout. The search function is injected: the app passes
 * `searchPlaces` from `src/state`, tests a stub.
 *
 * R27 (FR-OFF-8): place search is the one input that cannot fail soft, because
 * it needs a provider. With the browser reporting no connection the request is
 * not made at all — a timeout says nothing a reader can act on — and the line
 * under the field says so and names the two inputs that still work: the device
 * button and the coordinates. Nothing is retried when the connection comes
 * back; the message goes, and the next keystroke or Enter searches (D-147).
 */
export const DEBOUNCE_MS = 500;

export type PlaceSearchFn = (query: string, options: { signal: AbortSignal }) => Promise<Place[]>;

export interface PlacePickerProps {
  search: PlaceSearchFn;
  onObserver: (observer: Observer) => void;
  /** The current observer: the confirmation line shows only while it is a geocoded one. */
  observer: Observer | null;
  /** id of the coordinates input the empty and error states link to. */
  coordsInputId: string;
  /** Pre-fills the field (a restored `geocode` observer's label, US-8); nothing is searched for it. */
  initialText?: string;
  /** The field's id, so the container can move focus to it; generated when absent. */
  inputId?: string;
}

type ListState = { kind: 'idle' } | { kind: 'searching'; query: string } | { kind: 'results'; query: string; places: Place[] } | { kind: 'error'; query: string; message: string };

/** The provider needs two characters; one letter or blanks would only clear the list. */
const MIN_CHARS = 2;

export function PlacePicker({ search, onObserver, observer, coordsInputId, initialText, inputId: givenId }: PlacePickerProps) {
  const t = useT();
  const [text, setText] = useState(initialText ?? '');
  const [list, setList] = useState<ListState>({ kind: 'idle' });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const generatedId = useId();
  const inputId = givenId ?? generatedId;
  const listId = useId();
  const noteId = useId();
  const online = useOnline();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const seq = useRef(0);

  const cancelPending = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    controller.current?.abort();
    controller.current = null;
  };

  useEffect(() => cancelPending, []);

  /** Nothing to ask and nothing to wait for: the offline line is derived from the text, so it clears itself when the connection returns. */
  const stopForOffline = (): void => {
    cancelPending();
    seq.current++;
    setList({ kind: 'idle' });
    setOpen(false);
  };

  const runSearch = (query: string): void => {
    cancelPending();
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      setList({ kind: 'idle' });
      setOpen(false);
      return;
    }
    if (!online) {
      stopForOffline();
      return;
    }
    const mine = ++seq.current;
    const ac = new AbortController();
    controller.current = ac;
    setList({ kind: 'searching', query: trimmed });
    setOpen(true);
    setActive(-1);
    search(trimmed, { signal: ac.signal }).then(
      (places) => {
        if (mine !== seq.current) return;
        setList({ kind: 'results', query: trimmed, places });
      },
      (error: unknown) => {
        if (mine !== seq.current || ac.signal.aborted) return;
        setList({ kind: 'error', query: trimmed, message: error instanceof Error ? error.message : String(error) });
      },
    );
  };

  const schedule = (query: string): void => {
    cancelPending();
    seq.current++; // an answer to the previous text is no longer wanted
    if (query.trim().length < MIN_CHARS) {
      setList({ kind: 'idle' });
      setOpen(false);
      return;
    }
    if (!online) {
      stopForOffline();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      runSearch(query);
    }, DEBOUNCE_MS);
  };

  const choose = (place: Place): void => {
    cancelPending();
    seq.current++;
    const chosen = observerFromPlace(place);
    setText(chosen.label);
    setList({ kind: 'idle' });
    setOpen(false);
    setActive(-1);
    onObserver(chosen);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setText(value);
    schedule(value);
  };

  const places = list.kind === 'results' ? list.places : [];
  const showList = open && list.kind === 'results' && places.length > 0;
  /** FR-OFF-8: said as soon as there is something the reader meant to search for, and only then. */
  const offline = !online && text.trim().length >= MIN_CHARS;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        if (!showList) return;
        event.preventDefault();
        setActive((i) => (i + 1) % places.length);
        return;
      case 'ArrowUp':
        if (!showList) return;
        event.preventDefault();
        setActive((i) => (i <= 0 ? places.length - 1 : i - 1));
        return;
      case 'Enter': {
        event.preventDefault();
        if (showList) {
          const place = places[active] ?? places[0];
          if (place) choose(place);
          return;
        }
        runSearch(text); // search now rather than after the debounce
        return;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        return;
      default:
    }
  };

  const focusCoords = (event: MouseEvent<HTMLAnchorElement>): void => {
    const target = document.getElementById(coordsInputId);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  /** A message whose link the language places (FR-I18N-2): "…, or <enter coordinates instead>." */
  const linked = (text: LinkedText) => (
    <>
      {text.before}
      <a href={`#${coordsInputId}`} onClick={focusCoords}>
        {text.link}
      </a>
      {text.after}
    </>
  );

  const activeId = showList && active >= 0 ? `${listId}-${String(active)}` : undefined;
  const confirming = observer?.source === 'geocode' ? observer : null;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{t.location.placeLabel}</label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={t.location.placePlaceholder}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-describedby={confirming ? noteId : undefined}
        className={styles.input}
      />
      <ul id={listId} role="listbox" aria-label={t.location.placeList} className={styles.list} hidden={!showList}>
        {showList &&
          places.map((place, i) => {
            const region = placeRegion(place);
            return (
              <li
                key={`${place.timeZone}:${String(place.lat)}:${String(place.lon)}:${place.name}`}
                id={`${listId}-${String(i)}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? styles.optionActive : styles.option}
                onMouseDown={(event) => {
                  event.preventDefault(); // keep focus in the input
                }}
                onClick={() => {
                  choose(place);
                }}
                onMouseEnter={() => {
                  setActive(i);
                }}
              >
                <span className={styles.name}>{place.name}</span>
                {region && <span className={styles.region}>{region}</span>}
              </li>
            );
          })}
      </ul>
      <p role="status" className={styles.status} data-testid="place-search-status">
        {offline && linked(t.location.searchOffline)}
        {!offline && list.kind === 'searching' && t.location.searching(list.query)}
        {!offline && list.kind === 'results' && list.places.length === 0 && linked(t.location.noMatch(list.query))}
      </p>
      {!offline && list.kind === 'error' && (
        <p role="alert" className={styles.error}>
          {linked(t.location.searchFailed(list.message))}
        </p>
      )}
      {confirming && (
        <p id={noteId} className={styles.note} data-testid="place-confirmation">
          {t.location.placeCentre({ place: confirming.label, coords: coordsLabel(confirming.lat, confirming.lon) })}
        </p>
      )}
    </div>
  );
}
