import { useEffect, useId, useMemo, type ReactNode } from 'react';
import { CATALOG } from '../../../../data/catalog';
import { useLocale } from '../../../../i18n/useT';
import { useFactsT, type FactsMessages } from '../../../../i18n/factsT';
import { INTL_LOCALE } from '../../../../i18n/locale';
import { useT } from '../../../../i18n/useT';
import { compassPoint } from '../../../../lib/compass';
import { degrees } from '../../../../lib/format';
import { bodyNow, bodyRiseSet, starRiseSet, type RiseSet } from '../../../../lib/riseSet';
import { skyBodiesAt } from '../../../../lib/skyBodies';
import { constellationName, starName, starsAt } from '../../../../lib/skyStars';
import { formatShortClock } from '../../../../lib/timeFormat';
import type { EpochMs, Locale, Observer } from '../../../../model';
import { SectionHeading } from '../../primitives/SectionHeading';
import { TextButton } from '../../primitives/TextButton';
import type { FactEntry } from '../../../../data/catalog/facts';
import shown from './factsShown.json';
import type { FactsStars, FactsSubject, SkyPick } from './subject';
import styles from './FactsGroup.module.css';

/**
 * R188 (FR-FACT-2, FR-FACT-3, FR-FACT-1 shown; D-1101, D-1124): the facts groups — `This satellite` (who flies it,
 * what for, since when, how big, how high) and a star's, a planet's or the Moon's (names, magnitude, place, rise and
 * set). Lazy as `facts-*.js` (`facts.ts`); the file's sources stay out of the bundle (`factsShown.json`, D-1124).
 */
type ShownFact = Omit<FactEntry, 'source'>;
const FACTS = shown as Readonly<Record<string, ShownFact>>;

export interface FactsGroupProps {
  subject: FactsSubject;
  observer: Observer;
  /** The page's shown instant: the height's age, the sky object's place and its night. */
  at: EpochMs;
  /** The star catalogue, for a star's names and place; a planet and the Moon need none. */
  stars?: FactsStars | null;
  /** `[ × ]`: absent on the pass detail, where the group is the page's own. */
  onClose?: () => void;
  /** Opened from the keyboard: the heading takes the focus (FR-FACT-2); it is not a live region. */
  focusOnOpen?: boolean;
}

export default function FactsGroup({ subject, observer, at, stars = null, onClose, focusOnOpen = false }: FactsGroupProps) {
  const f = useFactsT();
  const headingId = useId();
  const key = subject.kind === 'satellite' ? `sat-${String(subject.noradId)}` : pickKey(subject.pick);
  useEffect(() => {
    if (!focusOnOpen) return;
    const heading = document.getElementById(headingId);
    if (heading === null) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }, [focusOnOpen, headingId, key]);
  return (
    <section className={styles.group} aria-labelledby={headingId} data-testid="facts-group" data-facts={subject.kind === 'satellite' ? 'satellite' : subject.pick.kind}>
      <div className={styles.head}>
        <SectionHeading id={headingId}>{subject.kind === 'satellite' ? f.satelliteHeading : f.skyHeading}</SectionHeading>
        {onClose !== undefined && <TextButton label="×" padded tone="dim" aria-label={f.closeLabel} onClick={onClose} data-testid="facts-close" />}
      </div>
      {subject.kind === 'satellite' ? <SatelliteLines subject={subject} at={at} f={f} /> : <SkyLines pick={subject.pick} observer={observer} at={at} stars={stars} f={f} />}
    </section>
  );
}

const pickKey = (pick: SkyPick): string => (pick.kind === 'star' ? `star-${String(pick.index)}` : pick.kind === 'planet' ? pick.body : 'moon');

const YEAR_MS = 365.2425 * 86_400_000;

function number(n: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: digits, useGrouping: false }).format(n);
}

/** FR-FACT-1: a rocket stage's payload, the catalogue name's parenthesis (`SL-16 R/B (Cosmos 2219)`), or none. */
export function stagePayload(name: string): string | null {
  const match = /\(([^)]+)\)\s*$/.exec(name);
  return match?.[1]?.trim() ?? null;
}

function SatelliteLines({ subject, at, f }: { subject: Extract<FactsSubject, { kind: 'satellite' }>; at: EpochMs; f: FactsMessages }) {
  const locale = useLocale();
  const fact = Object.hasOwn(FACTS, String(subject.noradId)) ? FACTS[String(subject.noradId)] : undefined;
  const description = locale === 'es' && fact ? fact.descriptionEs : (subject.description ?? CATALOG.find((entry) => entry.noradId === subject.noradId)?.description);
  const lines: ReactNode[] = [];
  if (fact) {
    const payload = fact.purpose === 'rocket-stage' ? stagePayload(subject.name) : null;
    const countries = fact.countries.map((code) => f.countries[code]).join(', ');
    lines.push(<p key="who" data-testid="facts-who">{[countries, fact.operator, payload === null ? f.purposes[fact.purpose] : f.stageOf({ payload })].join(' · ')}</p>);
    const year = fact.launched.slice(0, 4);
    const launchedMs = Date.parse(`${fact.launched}T00:00:00Z`);
    const when = [f.launched({ year }), f.age({ years: Math.floor((at - launchedMs) / YEAR_MS) }), f.size({ metres: number(fact.sizeM, locale, 1) })];
    const { height } = subject;
    if (height !== null) when.push(height.kind === 'one' ? f.heightOne({ km: number(height.km, locale) }) : f.heightRange({ from: number(height.perigeeKm, locale), to: number(height.apogeeKm, locale) }));
    lines.push(<p key="when" data-testid="facts-when">{when.join(' · ')}</p>);
  }
  return (
    <>
      <p className={styles.name} data-testid="facts-name">
        {subject.name}
      </p>
      {lines}
      {description !== undefined && <p className={styles.description}>{description}</p>}
    </>
  );
}

function formatMag(mag: number, locale: Locale): string {
  const rounded = Math.round(mag * 10) / 10;
  const digits = new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(rounded));
  return rounded < 0 ? `−${digits}` : digits;
}

interface SkyFacts {
  names: string;
  designation: string | null;
  constellation: string | null;
  planet: boolean;
  mag: number;
  altDeg: number;
  azDeg: number;
  riseSet: RiseSet;
  moon: { phase: string; pct: string } | null;
}

function useSkyFacts(pick: SkyPick, observer: Observer, at: EpochMs, stars: FactsStars | null, f: FactsMessages): SkyFacts | null {
  const locale = useLocale();
  const t = useT();
  return useMemo(() => {
    const con = (abbr: string): string | null => (stars ? (constellationName(stars, abbr, locale) ?? null) : null);
    if (pick.kind === 'star') {
      if (stars === null) return null;
      const i = pick.index;
      const own = starName(stars, i, locale);
      const other = starName(stars, i, locale === 'es' ? 'en' : 'es');
      const desig = stars.desig[i] ?? '';
      const positions = starsAt({ size: stars.mag.length, ra: stars.ra, dec: stars.dec }, observer, at);
      return {
        names: other !== own && other !== desig ? `${own} · ${other}` : own,
        designation: desig !== '' && desig !== own ? desig : null,
        constellation: con(stars.con[i] ?? ''),
        planet: false,
        mag: stars.mag[i] ?? 0,
        altDeg: positions.altDeg[i] ?? 0,
        azDeg: positions.azDeg[i] ?? 0,
        riseSet: starRiseSet(stars.ra[i] ?? 0, stars.dec[i] ?? 0, observer, at),
        moon: null,
      };
    }
    const body = pick.kind === 'moon' ? 'Moon' : pick.body;
    const now = bodyNow(body, observer, at);
    const moonState = pick.kind === 'moon' ? skyBodiesAt(at, observer).moon : null;
    return {
      names: pick.kind === 'moon' ? f.moon : f.planets[pick.body],
      designation: null,
      constellation: con(now.con),
      planet: pick.kind === 'planet',
      mag: now.mag,
      altDeg: now.altDeg,
      azDeg: now.azDeg,
      riseSet: bodyRiseSet(body, observer, at),
      moon: moonState === null ? null : { phase: t.moon.phase[moonState.phase], pct: number(Math.round(moonState.illuminatedFraction * 100), locale) },
    };
  }, [pick, observer, at, stars, f, locale, t]);
}

function SkyLines({ pick, observer, at, stars, f }: { pick: SkyPick; observer: Observer; at: EpochMs; stars: FactsStars | null; f: FactsMessages }) {
  const locale = useLocale();
  const facts = useSkyFacts(pick, observer, at, stars, f);
  if (facts === null) return null;
  const clock = (ms: number): string => formatShortClock(ms, observer.timeZone, locale);
  const point = compassPoint(facts.azDeg);
  const altitude = degrees(Math.abs(facts.altDeg));
  const kind = [facts.planet ? f.planet : null, facts.designation, facts.constellation].filter((part): part is string => part !== null && part !== '');
  const { riseSet } = facts;
  const times =
    riseSet.kind === 'never-sets'
      ? f.neverSets
      : riseSet.kind === 'never-rises'
        ? f.neverRises
        : [riseSet.rise === null ? null : f.rises({ time: clock(riseSet.rise) }), riseSet.set === null ? null : f.sets({ time: clock(riseSet.set) })].filter((part): part is string => part !== null).join(' · ');
  return (
    <>
      <p className={styles.name} data-testid="facts-name">
        {facts.names}
      </p>
      {kind.length > 0 && <p data-testid="facts-kind">{kind.join(' · ')}</p>}
      <p data-testid="facts-where">{[f.mag({ mag: formatMag(facts.mag, locale) }), facts.altDeg >= 0 ? f.up({ altitude, point }) : f.below({ altitude, point })].join(' · ')}</p>
      {times !== '' && <p data-testid="facts-times">{times}</p>}
      {facts.moon !== null && <p data-testid="facts-moon">{f.lit(facts.moon)}</p>}
    </>
  );
}
