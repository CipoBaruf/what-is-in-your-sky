import type { CompassPoint } from '../../lib/compass';
import type { FACT_COUNTRIES, FACT_PURPOSES } from '../../data/catalog/facts';
import type { PLANETS } from '../../lib/skyStars';

type Planet = (typeof PLANETS)[number];

/**
 * FR-I18N-2, FR-FACT-2, FR-FACT-3 (R188, D-1101, D-1125): the facts groups' words — `This satellite` and a sky
 * object's — with FR-FACT-1's purpose phrases and the countries' names. Not merged into `en.ts`: like `starsPage.ts`
 * they ride in the `facts` chunk that draws them (`factsT.ts`); `es/facts.ts` is typed against this.
 */
export const facts = {
  satelliteHeading: 'This satellite',
  skyHeading: 'In the sky',
  close: 'close',
  closeLabel: 'Close the facts',
  countries: { US: 'United States', RU: 'Russia', JP: 'Japan', CA: 'Canada', ESA: 'ESA', CN: 'China', UA: 'Ukraine', FR: 'France' } satisfies Record<(typeof FACT_COUNTRIES)[number], string>,
  purposes: {
    'crewed-station': 'crewed space station',
    'space-telescope': 'space telescope',
    'earth-observation': 'Earth observation',
    'ocean-observation': 'ocean observation',
    'radar-observation': 'radar observation',
    military: 'military',
    'rocket-stage': 'rocket stage',
  } satisfies Record<(typeof FACT_PURPOSES)[number], string>,
  /** FR-FACT-1: a rocket stage names the payload it launched, from the catalogue's name. */
  stageOf: (p: { payload: string }) => `rocket stage that launched ${p.payload}`,
  launched: (p: { year: string }) => `launched ${p.year}`,
  age: (p: { years: number }) => (p.years < 1 ? 'this year' : p.years === 1 ? '1 year ago' : `${String(p.years)} years ago`),
  size: (p: { metres: string }) => `about ${p.metres} m`,
  heightOne: (p: { km: string }) => `${p.km} km up`,
  heightRange: (p: { from: string; to: string }) => `${p.from}–${p.to} km up`,
  planets: { Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn' } satisfies Record<Planet, string>,
  moon: 'Moon',
  planet: 'planet',
  mag: (p: { mag: string }) => `mag ${p.mag}`,
  up: (p: { altitude: string; point: CompassPoint }) => `${p.altitude} up · ${p.point}`,
  below: (p: { altitude: string; point: CompassPoint }) => `${p.altitude} below · ${p.point}`,
  rises: (p: { time: string }) => `rises ${p.time}`,
  sets: (p: { time: string }) => `sets ${p.time}`,
  neverSets: 'never sets',
  neverRises: 'never rises',
  lit: (p: { phase: string; pct: string }) => `${p.phase} · ${p.pct} % lit`,
};
