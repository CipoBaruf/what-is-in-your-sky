import { useEffect, useRef, useState } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import type { MeasureDetail } from '../../../model/measure';
import { count } from '../../../state/measure';
import { Stack } from '../primitives/Stack';
import { StatusLine } from '../primitives/StatusLine';
import { TextButton } from '../primitives/TextButton';
import { coordsLabel } from './CoordsInput';
import styles from './UseMyLocation.module.css';

/**
 * FR-LOC-1 (c), US-3: one button that asks the Geolocation API once. It is
 * rendered only when the API exists and the page is a secure context (the
 * API refuses otherwise, US-3 AC1); denial and the other failures show a
 * message under the button and touch nothing else, so the place and
 * coordinate inputs stay usable (AC2). R218 (FR-CTRL-4, FR-CTRL-17): the
 * button keeps its label and box while the device answers (`busy`), and the
 * progress and the failure are one `StatusLine` under it. The environment is a prop so tests
 * can supply a fake API; the app uses the browser's.
 */
export interface GeolocationEnv {
  geolocation: Geolocation | undefined;
  secure: boolean;
}

function browserGeolocationEnv(): GeolocationEnv {
  const nav: { geolocation?: Geolocation } | undefined = typeof navigator === 'undefined' ? undefined : navigator;
  return { geolocation: nav?.geolocation, secure: globalThis.isSecureContext === true };
}

/** US-3 AC3: shown only when worse than about 1 km, as "about 2 km" / "about 1.5 km"; null below that, and the caller says nothing. */
const ACCURACY_SHOW_M = 1000;
export function accuracyText(accuracyM: number | undefined, t: Messages): string | null {
  if (accuracyM === undefined || !(accuracyM > ACCURACY_SHOW_M)) return null;
  const km = accuracyM / 1000;
  return t.location.accuracy(km >= 10 ? String(Math.round(km)) : String(Math.round(km * 10) / 10));
}

export function observerFromPosition(coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'altitude' | 'accuracy'>): Observer {
  const { latitude: lat, longitude: lon } = coords;
  return { lat, lon, altM: Math.round(coords.altitude ?? 0), label: coordsLabel(lat, lon), source: 'device', timeZone: null, accuracyM: Math.round(coords.accuracy) };
}

/** FR-MEAS-2: `device_refused`'s detail by the error's code (1 denied, 2 unavailable, 3 and anything else timeout, as the text). */
const REFUSAL: Record<number, MeasureDetail<'device_refused'>> = { 1: 'denied', 2: 'unavailable' };

function positionErrorText(error: Pick<GeolocationPositionError, 'code'>, t: Messages): string {
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
  /**
   * R76 (FR-FIRST-2): the home page's input group makes this the one primary
   * action — a boxed control with a line under its label saying why it is the
   * quickest. The line describes the button rather than naming it, so its
   * accessible name stays "Use my location".
   */
  primary?: boolean;
  /** R104: with `primary`, the input group's look (R76, board 1B) — `boxed` on a phone, `plain` in the wide pane — which the group used to hand down as `data-look`. */
  look?: 'boxed' | 'plain';
}

export function UseMyLocation({ onObserver, env, primary = false, look = 'boxed' }: UseMyLocationProps) {
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
        count('device_refused', REFUSAL[positionError.code] ?? 'timeout');
      },
      OPTIONS,
    );
  };

  // R218 (FR-CTRL-4, US-65 AC3): the label never changes, so the box keeps its width before, during and after.
  const label = t.location.useMyLocation;
  return (
    <Stack gap="row" className={primary ? `${styles.field} ${styles.primary}` : styles.field} data-testid={primary ? 'use-my-location-primary' : undefined}>
      {primary ? (
        // R76 (FR-FIRST-2, at the owner's gate): the primary action is the whole box — the label and its note
        // are one control, so the note is as much a place to tap as the words. The name stays the label alone
        // and the note is its description, as they were when the note sat under the button. R104 (D-704): the
        // box, the note and the two looks are `TextButton`'s.
        <TextButton box="accent" fill note={t.location.useMyLocationNote} look={look} label={label} aria-label={label} onClick={locate} busy={locating} />
      ) : (
        <TextButton label={label} className={styles.device} onClick={locate} busy={locating} />
      )}
      {/* FR-CTRL-4: the progress words go under the control, never into its label; FR-CTRL-17: a failure in the same place. */}
      {locating && <StatusLine tone="progress">{t.location.locating}</StatusLine>}
      {error !== null && <StatusLine tone="failure">{error}</StatusLine>}
    </Stack>
  );
}
