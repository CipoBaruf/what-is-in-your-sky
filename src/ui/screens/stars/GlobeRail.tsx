import { useEffect, useId, useMemo, useState } from 'react';
import { starCatalog } from '../../../data/stars/catalog';
import { loadDeepChunk, type DeepCatalog } from '../../../data/stars/deepChunk';
import { useStarsPageT } from '../../../i18n/starsPageT';
import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { BODIES_EVERY_MS } from '../../../lib/playback';
import { chipFor } from '../../../lib/shownTime';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import { DAY_MS, HOUR_MS, shortWeekday } from '../../../lib/timeStripe';
import type { EpochMs, Favourite, Observer } from '../../../model';
import { GLOBE_SPEEDS } from '../../components/guide/skychart/globe/constants';
import { globeSky, starVectors, upCount, upList } from '../../components/guide/skychart/globe/scene';
import type { Playback } from '../../components/live/usePlayback';
import { useWallThrottle } from '../../components/live/useWallThrottle';
import { SectionHeading } from '../../components/primitives/SectionHeading';
import { TextButton } from '../../components/primitives/TextButton';
import { ToggleGroup } from '../../components/primitives/ToggleGroup';
import { VisuallyHidden } from '../../components/primitives/VisuallyHidden';
import { useNow } from '../../hooks/useNow';
import { FieldList } from './FieldList';
import styles from './GlobeRail.module.css';

/**
 * R170 (FR-GLOBE-5, FR-GLOBE-7..10, FR-GLOBE-12, FR-GLOBE-16; PLAN D-1035, D-1039, D-1040): the wide stars page's rail
 * groups while the globe is shown — `Time` (the clock in the shown place's zone, the four steps, `[ now ]` and the
 * three speeds, on the page's second `usePlayback`), `Turn`, `Place` and the count with `Up from <place>`. Pure
 * composition over props: the page owns every state (the playback, the turn, the place's choice), so leaving the globe
 * and coming back within the visit keeps them, and nothing here writes the hash, the prefs or the store.
 */

export type GlobeTurn = 'you' | 'stars';
/** The `Place` group's choice: `null` for the observer, else a saved place's `cellKey` (D-1051). */
export type PlaceChoice = string | null;
/** The observer's button value inside the group; a cell key is `"lat,lon"`, so it never collides. */
const OBSERVER_VALUE = 'observer';

const STEPS = [
  { id: 'dayBack', ms: -DAY_MS },
  { id: 'hourBack', ms: -HOUR_MS },
  { id: 'hourAhead', ms: HOUR_MS },
  { id: 'dayAhead', ms: DAY_MS },
] as const;
/** FR-GLOBE-8: the clock's seconds tick each second while the globe is on real time, as the live headline's do. */
const CLOCK_TICK_MS = 1_000;

/** FR-GLOBE-8: "21:14:05 GMT−3 · 2026-11-03", then the chip — `now`, or the offset from real time (FR-TONIGHT-7). */
export function GlobeClock({ playback, zone }: { playback: Playback; zone: string | null }) {
  const t = useT();
  const locale = useLocale();
  const clock = useNow(CLOCK_TICK_MS);
  // The offset is read against the same one-second clock, so the chip moves with the seconds and not per render.
  const shown = playback.realTime ? clock : playback.t;
  const chip = chipFor(shown, clock, playback.realTime, null, zone);
  const words = t.live.chip(chip.kind === 'now' ? chip : { ...chip, weekday: chip.weekday ? shortWeekday(shown, zone, locale) : null });
  return (
    <p className={styles.clock} data-testid="globe-clock" data-at={String(playback.t)}>
      <VisuallyHidden>{`${t.globe.clock}: `}</VisuallyHidden>
      <time dateTime={new Date(shown).toISOString()}>{`${formatClock(shown, zone, locale)} · ${formatDate(shown, zone, locale)}`}</time>{' '}
      <span className={styles.chip} data-kind={chip.kind} data-testid="globe-chip">
        {`· ${words}`}
      </span>
    </p>
  );
}

/** FR-GLOBE-7: the `Time` group — the clock, the four steps, then `[ now ]` and the time-lapse. */
export function GlobeTime({ playback, zone }: { playback: Playback; zone: string | null }) {
  const t = useT();
  const headingId = useId();
  const speed = (rate: (typeof GLOBE_SPEEDS)[number]) => {
    const pressed = playback.playing && playback.speed === rate;
    return (
      <TextButton
        key={rate}
        className="target"
        label={t.globe.speed(rate)}
        aria-label={t.globe.speedName(rate)}
        pressed={pressed}
        data-speed={rate}
        onClick={() => {
          if (pressed) {
            playback.pause();
            return;
          }
          playback.setSpeed(rate);
          playback.play();
        }}
      />
    );
  };
  return (
    <section aria-labelledby={headingId} className={styles.block} data-testid="globe-time">
      <SectionHeading id={headingId}>{t.globe.timeHeading}</SectionHeading>
      <GlobeClock playback={playback} zone={zone} />
      <div role="group" aria-label={t.globe.stepGroup} className={styles.row} data-testid="globe-steps">
        {STEPS.map((step) => (
          <TextButton
            key={step.id}
            className="target"
            label={t.globe.steps[step.id]}
            aria-label={t.globe.stepNames[step.id]}
            data-step={step.id}
            onClick={() => {
              playback.stepTo(playback.t + step.ms);
            }}
          />
        ))}
      </div>
      <div className={styles.row} data-testid="globe-speeds">
        <TextButton
          className="target"
          label={t.globe.now}
          data-testid="globe-now"
          onClick={() => {
            playback.toNow();
          }}
        />
        <div role="group" aria-label={t.globe.speedGroup} className={styles.speeds}>
          {GLOBE_SPEEDS.map(speed)}
        </div>
      </div>
    </section>
  );
}

/** FR-GLOBE-5: `[x] with you [ ] with the stars`, the visit's and not saved. */
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

export interface GlobeGroupsProps {
  playback: Playback;
  zone: string | null;
  turn: GlobeTurn;
  onTurn: (turn: GlobeTurn) => void;
  observer: Observer;
  places: readonly Favourite[];
  choice: PlaceChoice;
  onChoice: (choice: PlaceChoice) => void;
}

/** The rail's `Time`, `Turn` and `Place` groups, a group apart, as the page's `timeline` slot holds them. */
export function GlobeGroups({ playback, zone, turn, onTurn, observer, places, choice, onChoice }: GlobeGroupsProps) {
  return (
    <div className={styles.groups} data-testid="globe-groups">
      <GlobeTime playback={playback} zone={zone} />
      <GlobeTurnRow turn={turn} onTurn={onTurn} />
      <GlobePlaces observer={observer} places={places} choice={choice} onChoice={onChoice} />
    </div>
  );
}
