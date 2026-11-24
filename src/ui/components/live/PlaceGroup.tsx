import { useId, useState } from 'react';
import { useT } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { searchPlaces, useAppStore } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useOwnObserver } from '../../hooks/useOwnObserver';
import { LocationInput, type LocationInputProps } from '../location/LocationInput';
import type { PlaceSearchFn } from '../location/PlacePicker';
import { Card } from '../primitives/Card';
import { Stack } from '../primitives/Stack';
import { TextButton } from '../primitives/TextButton';
import styles from './PlaceGroup.module.css';

/**
 * R222 (FR-LAND-5, US-62 AC2): with no stored place and no example the live page draws the place group in the sky's
 * box, the tagline above it — the place dialog's group (`PlaceDialog`, D-1238) in a card rather than a modal frame.
 * A searched place, the device's, or a saved one is set as it arrives; a typed pair waits for `continue`, as there.
 */
export interface PlaceGroupProps {
  search?: PlaceSearchFn;
  geolocation?: LocationInputProps['geolocation'];
}

export function PlaceGroup({ search = searchPlaces, geolocation }: PlaceGroupProps) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  const headingId = useId();
  const own = useOwnObserver();
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const [typed, setTyped] = useState<Observer | null>(null);
  const onObserver = (next: Observer | null): void => {
    if (next?.source === 'coords') {
      setTyped(next);
      return;
    }
    setTyped(null);
    if (next !== null) setObserver(next);
  };
  return (
    <div className={styles.box} data-testid="live-no-place">
      <p className={styles.tagline} data-testid="live-tagline">
        {t.app.tagline}
      </p>
      <Card as="section" className={styles.card} data-testid="live-place-group">
        <Stack gap="row">
          <h2 id={headingId} className={styles.heading}>
            {t.home.coldHeading}
          </h2>
          <p className={styles.sentence}>{t.home.coldSentence}</p>
          <LocationInput
            observer={own}
            onObserver={onObserver}
            onClear={clearSavedObserver}
            search={search}
            {...(geolocation ? { geolocation } : {})}
            variant="group"
            look={compact ? 'boxed' : 'plain'}
            labelledBy={headingId}
            afterCoords={
              <TextButton
                label={t.location.continue}
                disabled={typed === null}
                data-testid="live-place-continue"
                onClick={() => {
                  if (typed !== null) setObserver(typed);
                }}
              />
            }
          />
        </Stack>
      </Card>
    </div>
  );
}
