import { useId, useState, type ChangeEvent } from 'react';
import type { Observer } from '../../../model';
import styles from './CoordsInput.module.css';

/**
 * FR-LOC-1 (b), thin form: `lat, lon` decimal degrees with range checks only.
 * DMS and other formats, altitude, persistence and geolocation come in R10.
 */
export type ParsedCoords = { ok: true; lat: number; lon: number } | { ok: false; error: string };

const PAIR = /^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/;

export function parseCoords(text: string): ParsedCoords {
  const m = PAIR.exec(text);
  if (!m) return { ok: false, error: 'Enter latitude, longitude in decimal degrees, e.g. -38.93, -67.99' };
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (lat < -90 || lat > 90) return { ok: false, error: 'Latitude must be between -90 and 90' };
  if (lon < -180 || lon > 180) return { ok: false, error: 'Longitude must be between -180 and 180' };
  return { ok: true, lat, lon };
}

/** Rounded, with a real minus sign: "−38.93, −67.99" (PLAN §5, FR-LOC-4 MVP behaviour). */
export function coordsLabel(lat: number, lon: number): string {
  const f = (n: number): string => n.toFixed(2).replace('-', '−');
  return `${f(lat)}, ${f(lon)}`;
}

export function observerFromCoords(lat: number, lon: number): Observer {
  return { lat, lon, altM: 0, label: coordsLabel(lat, lon), source: 'coords', timeZone: null };
}

export interface CoordsInputProps {
  /** Called with an observer on every valid value, null when the field is empty or invalid. */
  onObserver: (observer: Observer | null) => void;
  /** The input's id, so the place picker's "enter coordinates instead" link can target it (R9); generated when absent. */
  id?: string;
}

export function CoordsInput({ onObserver, id }: CoordsInputProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setText(value);
    if (value.trim() === '') {
      setError(null);
      onObserver(null);
      return;
    }
    const parsed = parseCoords(value);
    if (parsed.ok) {
      setError(null);
      onObserver(observerFromCoords(parsed.lat, parsed.lon));
    } else {
      setError(parsed.error);
      onObserver(null);
    }
  };

  return (
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
  );
}
