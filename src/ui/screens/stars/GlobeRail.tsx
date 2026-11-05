import { useEffect, useId, useMemo, useState } from 'react';
import { starCatalog } from '../../../data/stars/catalog';
import { loadDeepChunk, type DeepCatalog } from '../../../data/stars/deepChunk';
import { useStarsPageT } from '../../../i18n/starsPageT';
import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { BODIES_EVERY_MS } from '../../../lib/playback';
import type { EpochMs, Favourite, Observer } from '../../../model';
import { dayStars, globeSky, starVectors, upCount, upList } from '../../components/guide/skychart/globe/scene';
import { useWallThrottle } from '../../components/live/useWallThrottle';
import { SectionHeading } from '../../components/primitives/SectionHeading';
import { ToggleGroup } from '../../components/primitives/ToggleGroup';
import { FieldList } from './FieldList';
import styles from './GlobeRail.module.css';

/**
 * R170 (FR-GLOBE-5, FR-GLOBE-7..10, FR-GLOBE-12, FR-GLOBE-16; PLAN D-1035, D-1039, D-1040): the wide stars page's rail
 * groups while the globe is shown — `Turn`, `Place` and the count with `Up from <place>`; R187 (FR-WIDE-4) moved `Time`
 * to the shared time control (`sky/stars/Time.tsx`).
 * Pure composition over props: the page owns every state (the playback, the turn, the place's choice), so leaving the globe
 * and coming back within the visit keeps them, and nothing here writes the hash, the prefs or the store.
 */

export type GlobeTurn = 'you' | 'stars';
/** The `Place` group's choice: `null` for the observer, else a saved place's `cellKey` (D-1051). */
export type PlaceChoice = string | null;
/** The observer's button value inside the group; a cell key is `"lat,lon"`, so it never collides. */
const OBSERVER_VALUE = 'observer';

/** FR-GLOBE-5: `[x] with you [ ] with the stars`; R190 (FR-KEEP-1): the page keeps it on the device (`globeTurn`). */
export function GlobeTurnRow({ turn, onTurn }: { turn: GlobeTurn; onTurn: (turn: GlobeTurn) => void }) {
  const t = useT();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.block} data-testid="globe-turn">
      <SectionHeading id={headingId}>{t.globe.turnHeading}</SectionHeading>
      <div className={styles.row} data-testid="globe-turn-row">
        <ToggleGroup
          name={t.globe.turnHeading}
          options={[
            { value: 'you', label: t.globe.turn.you },
            { value: 'stars', label: t.globe.turn.stars },
          ]}
          value={turn}
          onChange={onTurn}
        />
      </div>
    </section>
  );
}

/** FR-GLOBE-9: the observer, then the saved places by `mostRecentlyUsed`, one press each; the observer's own saved entry is not listed twice. */
export function GlobePlaces({ observer, places, choice, onChoice }: { observer: Observer; places: readonly Favourite[]; choice: PlaceChoice; onChoice: (choice: PlaceChoice) => void }) {
  const t = useT();
  const headingId = useId();
  const options = [{ value: OBSERVER_VALUE, label: observer.label }, ...places.map((place) => ({ value: place.cellKey, label: place.observer.label }))];
  return (
    <section aria-labelledby={headingId} className={styles.block} data-testid="globe-place">
      <SectionHeading id={headingId}>{t.globe.placeHeading}</SectionHeading>
      <ToggleGroup name={t.globe.placeHeading} options={options} value={choice ?? OBSERVER_VALUE} onChange={(value) => { onChoice(value === OBSERVER_VALUE ? null : value); }} className={styles.places} />
    </section>
  );
}

const NO_DEEP: DeepCatalog | null = null;

/** The deep catalogue once `faint` has asked for it (`deepChunk.ts`'s one fetch, shared with the globe); `null` before and while off. */
function useDeep(faint: boolean): DeepCatalog | null {
  const [deep, setDeep] = useState<DeepCatalog | null>(NO_DEEP);
  useEffect(() => {
    if (!faint || deep !== null) return;
    let live = true;
    loadDeepChunk().then(
      (loaded) => {
        if (live) setDeep(loaded);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [faint, deep]);
  return faint ? deep : null;
}

export interface GlobeFieldProps {
  place: Observer;
  instant: EpochMs;
  layers: { stars: boolean; planets: boolean };
  faint: boolean;
  named: number | null;
  onName: (index: number | null) => void;
}

/**
 * FR-GLOBE-12: the count, the planets up with their direction, and `Up from <place>` — the `FIELD_LIST_MAX` brightest
 * above the shown place's horizon at the globe's instant, brightest first (`upList`). Read at the instant held to one
 * change per `BODIES_EVERY_MS` of wall time, as the live page's bodies are (D-1039), so a time-lapse recomputes them
 * once a second while the globe writes every frame.
 */
export function GlobeField({ place, instant, layers, faint, named, onName }: GlobeFieldProps) {
  const t = useT();
  const p = useStarsPageT();
  const lang = useLocale();
  const headingId = useId();
  const catalog = starCatalog();
  const deep = useDeep(faint);
  const at = useWallThrottle(instant, BODIES_EVERY_MS);
  const sky = useMemo(() => globeSky(place, at), [place, at]);
  const count = useMemo(() => {
    const up = upCount(sky, starVectors(catalog)) + (deep === null ? 0 : upCount(sky, starVectors(deep)));
    return { up, total: catalog.size + (deep?.size ?? 0) };
  }, [sky, catalog, deep]);
  const objects = useMemo(() => {
    // V214-36 (D-1139): above −6° the globe draws the stars to `DAY_STARS_MAG`, and the list names only those.
    const listed = upList(sky, catalog, layers.planets ? sky.planets : [], lang, dayStars(sky.sunAltDeg)?.maxMag);
    return layers.stars ? listed : listed.filter((object) => object.planet !== null);
  }, [sky, catalog, layers.planets, layers.stars, lang]);
  const planets = sky.planets.filter((planet) => planet.altDeg >= 0);
  return (
    <section aria-labelledby={headingId} className={styles.block} data-testid="stars-field" data-field="globe">
      <div className={styles.counts} data-testid="globe-count">
        <p>{t.globe.count(count)}</p>
        <p data-testid="globe-planets">{planets.length === 0 ? t.globe.planetsNone : t.globe.planetsUp(planets.map((planet) => `${p.planets[planet.body]} ${compassPoint(planet.azDeg)}`).join(' · '))}</p>
      </div>
      <SectionHeading id={headingId}>{t.globe.upFrom(place.label)}</SectionHeading>
      <FieldList objects={objects} named={named} onName={onName} buried={false} labelledBy={headingId} />
    </section>
  );
}
