import { useT } from '../../../i18n/useT';
import { usePageObserver } from '../../hooks/useOwnObserver';
import { requestPlace } from '../../screens/home/placeRequest';
import { TextButton } from '../primitives/TextButton';
import styles from './PlaceLine.module.css';

/**
 * R215 (FR-LAND-4, FR-LAND-5's header reading, FR-OPEN-7 as amended; D-1238): the place line — `Salta · example
 * change` while the example is the observer, `<place name>  change` once a place is set, `Set your place` with
 * neither. `change` opens the place dialog. The wide header draws it centred in its row; on a phone it heads the
 * satellites list (and, from R219, the controls sheet). The name ellipsises; the control never does.
 */
export interface HeaderPlace {
  label: string;
  example: boolean;
}

/** The place the pages open for, as the line reads it: none once the fallback has replaced the example (FR-OPEN-6). */
export function useHeaderPlace(): HeaderPlace | null {
  const observer = usePageObserver();
  return observer === null ? null : { label: observer.label, example: observer.source === 'example' };
}

export interface PlaceLineProps {
  place: HeaderPlace | null;
  /** What `change` and `Set your place` do; the place dialog (`requestPlace`). */
  onChangePlace?: () => void;
  /** Placement only. */
  className?: string | undefined;
}

export function PlaceLine({ place, onChangePlace = requestPlace, className }: PlaceLineProps) {
  const t = useT();
  const classes = [styles.line, className].filter(Boolean).join(' ');
  if (place === null) {
    return (
      <p className={classes} data-testid="place-line" data-place="none">
        <TextButton link label={t.header.place.set} className="target" data-testid="place-set" onClick={onChangePlace} />
      </p>
    );
  }
  return (
    <p className={classes} data-testid="place-line" data-place={place.example ? 'example' : 'set'}>
      <span className={styles.name} data-testid="place-name">
        {place.label}
      </span>
      {place.example && <span className={styles.example}>{` · ${t.header.place.example}`}</span>}
      <TextButton link label={t.header.place.change} className={`${styles.change} target`} data-testid="place-change" onClick={onChangePlace} />
    </p>
  );
}
