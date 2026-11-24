import { useEffect, useId, useMemo, useState } from 'react';
import { starCatalog } from '../../../data/stars/catalog';
import { loadDeepChunk, type DeepCatalog } from '../../../data/stars/deepChunk';
import { useStarsPageT } from '../../../i18n/starsPageT';
import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { BODIES_EVERY_MS } from '../../../lib/playback';
import type { EpochMs, Observer } from '../../../model';
import { globeSky, starVectors, upCount, upList } from '../guide/skychart/globe/scene';
import { useWallThrottle } from './useWallThrottle';
import { SectionHeading } from '../primitives/SectionHeading';
import { FieldList } from './FieldList';
import styles from './UpFrom.module.css';

/**
 * R170 (FR-GLOBE-12; D-1035, D-1039), the live page's since R222 (FR-LAND-3, D-1240, D-1295): the count, the planets up and
 * `Up from <place>`, its own lazy chunk (`UpFrom-*.js`, the `live` budget row) so the compact page, which lists it too,
 * never fetches a globe chunk (FR-GLOBE-15). Pure composition over props; it writes nothing.
 */

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

export interface UpFromFieldProps {
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
export function UpFromField({ place, instant, layers, faint, named, onName }: UpFromFieldProps) {
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
    const listed = upList(sky, catalog, layers.planets ? sky.planets : [], lang);
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
