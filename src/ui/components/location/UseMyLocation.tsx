import { useEffect, useRef, useState } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { coordsLabel } from './CoordsInput';
import styles from './UseMyLocation.module.css';

/**
 * FR-LOC-1 (c), US-3: one button that asks the Geolocation API once. It is
 * rendered only when the API exists and the page is a secure context (the
 * API refuses otherwise, US-3 AC1); denial and the other failures show a
 * message next to the button and touch nothing else, so the place and
 * coordinate inputs stay usable (AC2). The environment is a prop so tests
 * can supply a fake API; the app uses the browser's.
 */
export interface GeolocationEnv {
  geolocation: Geolocation | undefined;
  secure: boolean;
}

export function browserGeolocationEnv(): GeolocationEnv {
  const nav: { geolocation?: Geolocation } | undefined = typeof navigator === 'undefined' ? undefined : navigator;
  return { geolocation: nav?.geolocation, secure: globalThis.isSecureContext === true };
}

/** US-3 AC3: shown only when worse than about 1 km, as "about 2 km" / "about 1.5 km"; null below that, and the caller says nothing. */
export const ACCURACY_SHOW_M = 1000;
export function accuracyText(accuracyM: number | undefined, t: Messages): string | null {
  if (accuracyM === undefined || !(accuracyM > ACCURACY_SHOW_M)) return null;
  const km = accuracyM / 1000;
  return t.location.accuracy(km >= 10 ? String(Math.round(km)) : String(Math.round(km * 10) / 10));
}

export function observerFromPosition(coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'altitude' | 'accuracy'>): Observer {
  const { latitude: lat, longitude: lon } = coords;
  return { lat, lon, altM: Math.round(coords.altitude ?? 0), label: coordsLabel(lat, lon), source: 'device', timeZone: null, accuracyM: Math.round(coords.accuracy) };
}

export function positionErrorText(error: Pick<GeolocationPositionError, 'code'>, t: Messages): string {
  switch (error.code) {
    case 1:
      return t.location.permissionDenied;
    case 2:
      return t.location.positionUnavailable;
    default:
      return t.location.positionTimeout;
  }
}

/** A press asks for a fresh fix (`maximumAge: 0`): a cached one would keep an old accuracy on the screen. */
const OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 20_000, maximumAge: 0 };

export interface UseMyLocationProps {
  onObserver: (observer: Observer) => void;
  env?: GeolocationEnv;
}

export function UseMyLocation({ onObserver, env }: UseMyLocationProps) {
  const t = useT();
  const { geolocation, secure } = env ?? browserGeolocationEnv();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!geolocation || !secure) return null;

  const locate = (): void => {
    setLocating(true);
    setError(null);
    geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setLocating(false);
        onObserver(observerFromPosition(position.coords));
      },
      (positionError) => {
        if (!mounted.current) return;
        setLocating(false);
        setError(positionErrorText(positionError, t));
      },
      OPTIONS,
    );
  };

  return (
    <div className={styles.field}>
      <button type="button" onClick={locate} disabled={locating} aria-busy={locating} className={styles.button}>
        {locating ? t.location.locating : t.location.useMyLocation}
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
