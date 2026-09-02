import { useId, useState, type ChangeEvent } from 'react';
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
export type ParsedCoords = { ok: true; lat: number; lon: number } | { ok: false; error: string };
export type ParsedAltitude = { ok: true; altM: number } | { ok: false; error: string };

const NUM = String.raw`([+-]?\d+(?:\.\d+)?)`;
const PART = String.raw`${NUM}\s*°?\s*([NSEWnsew])?`;
const PAIR = new RegExp(`^\\s*${PART}(?:\\s*,\\s*|\\s+)${PART}\\s*$`);

export const FORMAT_HINT = 'Enter latitude, longitude in decimal degrees, e.g. -38.93, -67.99 or 38.93 S, 67.99 W';
/** Below the Dead Sea shore and above every town; guards against a typo like "27000". */
export const ALTITUDE_MIN_M = -500;
export const ALTITUDE_MAX_M = 9000;

export function parseCoords(text: string): ParsedCoords {
  const m = PAIR.exec(text);
  if (!m) return { ok: false, error: FORMAT_HINT };
  const [, aText = '', aSuffix, bText = '', bSuffix] = m;
  let lat: number;
  let lon: number;
  if (aSuffix === undefined && bSuffix === undefined) {
    lat = Number(aText);
    lon = Number(bText);
  } else {
    if (aSuffix === undefined || bSuffix === undefined) return { ok: false, error: 'Use N/S/E/W on both values, or on neither' };
    if (/^[+-]/.test(aText) || /^[+-]/.test(bText)) return { ok: false, error: 'Use a sign or N/S/E/W, not both' };
    const a = suffixed(Number(aText), aSuffix);
    const b = suffixed(Number(bText), bSuffix);
    if (a.axis === b.axis) return { ok: false, error: 'Give one latitude (N or S) and one longitude (E or W)' };
    lat = a.axis === 'lat' ? a.value : b.value;
    lon = a.axis === 'lon' ? a.value : b.value;
  }
  if (lat < -90 || lat > 90) return { ok: false, error: 'Latitude must be between -90 and 90' };
  if (lon < -180 || lon > 180) return { ok: false, error: 'Longitude must be between -180 and 180' };
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
  if (Number.isNaN(altM)) return { ok: false, error: 'Altitude must be a number of metres, e.g. 270' };
  if (altM < ALTITUDE_MIN_M || altM > ALTITUDE_MAX_M) return { ok: false, error: `Altitude must be between ${String(ALTITUDE_MIN_M)} and ${String(ALTITUDE_MAX_M)} m` };
  return { ok: true, altM };
}

/** Rounded, with a real minus sign: "−38.93, −67.99" (PLAN §5, FR-LOC-4 MVP behaviour). */
export function coordsLabel(lat: number, lon: number): string {
  const f = (n: number): string => n.toFixed(2).replace('-', '−');
  return `${f(lat)}, ${f(lon)}`;
}

export function observerFromCoords(lat: number, lon: number, altM = 0): Observer {
  return { lat, lon, altM, label: coordsLabel(lat, lon), source: 'coords', timeZone: null };
}

export interface CoordsInputProps {
  /** Called with an observer on every valid value, null when the field is empty or either field is invalid. */
  onObserver: (observer: Observer | null) => void;
  /** The coordinates input's id, so the place picker's "enter coordinates instead" link can target it (R9); generated when absent. */
  id?: string;
  /** Pre-fills both fields (a restored `coords` observer, US-8); nothing is emitted for it. */
  initial?: { lat: number; lon: number; altM: number };
}

export function CoordsInput({ onObserver, id, initial }: CoordsInputProps) {
  const [text, setText] = useState(initial ? `${String(initial.lat)}, ${String(initial.lon)}` : '');
  const [altText, setAltText] = useState(initial ? String(initial.altM) : '0');
  const [error, setError] = useState<string | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
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
        <label htmlFor={inputId}>Coordinates (lat, lon)</label>
        <input
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="-38.93, -67.99"
          value={text}
          onChange={handleChange}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={styles.input}
        />
        {error && (
          <p id={errorId} role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={altId}>Altitude (m)</label>
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
            {altError}
          </p>
        )}
      </div>
    </div>
  );
}
