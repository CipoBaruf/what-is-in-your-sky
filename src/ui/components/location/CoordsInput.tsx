import { useId, useState, type ChangeEvent } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { coordsLabel, observerFromCoords } from '../../../lib/place';
import type { Observer } from '../../../model';
import styles from './CoordsInput.module.css';

/**
 * FR-LOC-1 (b), US-2: latitude and longitude as decimal degrees, comma- or
 * space-separated, with an optional sign or an N/S/E/W suffix (either order
 * when suffixed), plus an altitude in metres that defaults to 0. Range
 * errors are inline and leave the observer untouched (the parent gets null).
 * `initial` pre-fills both fields from a restored observer (US-8) without
 * emitting anything: the store already has it.
 */
/** R17: the parsers name what is wrong; `coordsErrorText` words it (FR-I18N-2), and both fields' ranges are the message's parameters. */
export type CoordsError = 'format' | 'suffix-on-both' | 'sign-or-suffix' | 'one-of-each' | 'latitude-range' | 'longitude-range';
export type AltitudeError = 'not-a-number' | 'range';
export type ParsedCoords = { ok: true; lat: number; lon: number } | { ok: false; error: CoordsError };
export type ParsedAltitude = { ok: true; altM: number } | { ok: false; error: AltitudeError };

const NUM = String.raw`([+-]?\d+(?:\.\d+)?)`;
const PART = String.raw`${NUM}\s*°?\s*([NSEWnsew])?`;
const PAIR = new RegExp(`^\\s*${PART}(?:\\s*,\\s*|\\s+)${PART}\\s*$`);

export const LATITUDE_RANGE = { min: -90, max: 90 };
export const LONGITUDE_RANGE = { min: -180, max: 180 };
/** Below the Dead Sea shore and above every town; guards against a typo like "27000". */
export const ALTITUDE_MIN_M = -500;
export const ALTITUDE_MAX_M = 9000;

export function coordsErrorText(t: Messages, error: CoordsError): string {
  switch (error) {
    case 'format':
      return t.location.coordsHint;
    case 'suffix-on-both':
      return t.location.suffixOnBoth;
    case 'sign-or-suffix':
      return t.location.signOrSuffix;
    case 'one-of-each':
      return t.location.oneOfEach;
    case 'latitude-range':
      return t.location.latitudeRange(LATITUDE_RANGE);
    case 'longitude-range':
      return t.location.longitudeRange(LONGITUDE_RANGE);
  }
}

export function altitudeErrorText(t: Messages, error: AltitudeError): string {
  return error === 'not-a-number' ? t.location.altitudeNumber : t.location.altitudeRange({ min: ALTITUDE_MIN_M, max: ALTITUDE_MAX_M });
}

export function parseCoords(text: string): ParsedCoords {
  const m = PAIR.exec(text);
  if (!m) return { ok: false, error: 'format' };
  const [, aText = '', aSuffix, bText = '', bSuffix] = m;
  let lat: number;
  let lon: number;
  if (aSuffix === undefined && bSuffix === undefined) {
    lat = Number(aText);
    lon = Number(bText);
  } else {
    if (aSuffix === undefined || bSuffix === undefined) return { ok: false, error: 'suffix-on-both' };
    if (/^[+-]/.test(aText) || /^[+-]/.test(bText)) return { ok: false, error: 'sign-or-suffix' };
    const a = suffixed(Number(aText), aSuffix);
    const b = suffixed(Number(bText), bSuffix);
    if (a.axis === b.axis) return { ok: false, error: 'one-of-each' };
    lat = a.axis === 'lat' ? a.value : b.value;
    lon = a.axis === 'lon' ? a.value : b.value;
  }
  if (lat < LATITUDE_RANGE.min || lat > LATITUDE_RANGE.max) return { ok: false, error: 'latitude-range' };
  if (lon < LONGITUDE_RANGE.min || lon > LONGITUDE_RANGE.max) return { ok: false, error: 'longitude-range' };
  return { ok: true, lat, lon };
}

function suffixed(value: number, suffix: string): { axis: 'lat' | 'lon'; value: number } {
  const letter = suffix.toUpperCase();
  const axis = letter === 'N' || letter === 'S' ? 'lat' : 'lon';
  return { axis, value: letter === 'S' || letter === 'W' ? -value : value };
}

/** Blank means the default, 0 m. */
export function parseAltitude(text: string): ParsedAltitude {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, altM: 0 };
  const altM = /^[+-]?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (Number.isNaN(altM)) return { ok: false, error: 'not-a-number' };
  if (altM < ALTITUDE_MIN_M || altM > ALTITUDE_MAX_M) return { ok: false, error: 'range' };
  return { ok: true, altM };
}

/* R31 moved `coordsLabel` and `observerFromCoords` to `lib/place.ts`, where a
   shared link can reach them too (FR-SHARE-1); they are re-exported here so
   that "the coordinate form's observer" keeps one name across the UI. */
export { coordsLabel, observerFromCoords };

export interface CoordsInputProps {
  /** Called with an observer on every valid value, null when the field is empty or either field is invalid. */
  onObserver: (observer: Observer | null) => void;
  /** The coordinates input's id, so the place picker's "enter coordinates instead" link can target it (R9); generated when absent. */
  id?: string;
  /** Pre-fills both fields (a restored `coords` observer, US-8); nothing is emitted for it. */
  initial?: { lat: number; lon: number; altM: number };
}

export function CoordsInput({ onObserver, id, initial }: CoordsInputProps) {
  const t = useT();
  const [text, setText] = useState(initial ? `${String(initial.lat)}, ${String(initial.lon)}` : '');
  const [altText, setAltText] = useState(initial ? String(initial.altM) : '0');
  const [error, setError] = useState<CoordsError | null>(null);
  const [altError, setAltError] = useState<AltitudeError | null>(null);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = useId();
  const altId = useId();
  const altErrorId = useId();

  const emit = (coordsText: string, altitudeText: string): void => {
    if (coordsText.trim() === '') {
      setError(null);
      onObserver(null);
      return;
    }
    const coords = parseCoords(coordsText);
    const altitude = parseAltitude(altitudeText);
    setError(coords.ok ? null : coords.error);
    if (coords.ok && altitude.ok) onObserver(observerFromCoords(coords.lat, coords.lon, altitude.altM));
    else onObserver(null);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setText(value);
    emit(value, altText);
  };

  const handleAltChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setAltText(value);
    const altitude = parseAltitude(value);
    setAltError(altitude.ok ? null : altitude.error);
    emit(text, value);
  };

  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <label htmlFor={inputId}>{t.location.coordsLabel}</label>
        <input
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={t.location.coordsPlaceholder}
          value={text}
          onChange={handleChange}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={styles.input}
        />
        {error && (
          <p id={errorId} role="alert" className={styles.error}>
            {coordsErrorText(t, error)}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={altId}>{t.location.altitudeLabel}</label>
        <input
          id={altId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={altText}
          onChange={handleAltChange}
          aria-invalid={altError !== null}
          aria-describedby={altError ? altErrorId : undefined}
          className={styles.altitude}
        />
        {altError && (
          <p id={altErrorId} role="alert" className={styles.error}>
            {altitudeErrorText(t, altError)}
          </p>
        )}
      </div>
    </div>
  );
}
