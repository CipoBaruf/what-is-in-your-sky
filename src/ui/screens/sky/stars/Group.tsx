import { lazy, Suspense, type ReactNode } from 'react';
import type { Favourite, Observer } from '../../../../model';
import { loadGlobeRail } from '../../stars/globeChunk';
import type { GlobeTurn, PlaceChoice } from '../../stars/GlobeRail';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098): the wide stars page's group — on the globe `Turn` and `Place` (FR-GLOBE-5, FR-GLOBE-9),
 * lazy with the globe's rail; then what the page hands under them (`Facing` on the window, `[ follow the phone ]`).
 * The layers and the count are the `layers` slot's. R188 adds a picked object's facts here.
 */
const GlobeTurnRow = lazy(() => loadGlobeRail().then((module) => ({ default: module.GlobeTurnRow })));
const GlobePlaces = lazy(() => loadGlobeRail().then((module) => ({ default: module.GlobePlaces })));

/** The globe's turn and place, while the globe is the view. */
export interface StarsGlobeChoices {
  turn: GlobeTurn;
  onTurn: (turn: GlobeTurn) => void;
  observer: Observer;
  places: readonly Favourite[];
  choice: PlaceChoice;
  onChoice: (choice: PlaceChoice) => void;
}

export function StarsGroup({ globe, children }: { globe?: StarsGlobeChoices | undefined; children?: ReactNode }) {
  if (globe === undefined && (children === undefined || children === null || children === false)) return null;
  return (
    <div className={styles.group} data-testid="stars-group">
      {globe !== undefined && (
        <Suspense fallback={null}>
          <GlobeTurnRow turn={globe.turn} onTurn={globe.onTurn} />
          <GlobePlaces observer={globe.observer} places={globe.places} choice={globe.choice} onChoice={globe.onChoice} />
        </Suspense>
      )}
      {children}
    </div>
  );
}
