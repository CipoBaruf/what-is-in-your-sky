import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseFacts } from '../../../../data/catalog/facts';
import factsJson from '../../../../data/catalog/facts.json';
import { starCatalog } from '../../../../data/stars/catalog';
import { I18nProvider } from '../../../../i18n/useT';
import { constellationName, starName } from '../../../../lib/skyStars';
import type { Locale, NoradId, Observer } from '../../../../model';
import FactsGroup, { stagePayload } from './FactsGroup';
import shown from './factsShown.json';
import type { FactsStars, FactsSubject } from './subject';

/** R188 (FR-FACT-2, FR-FACT-3, FR-FACT-1 shown): the two facts groups in both languages. */
const BARILOCHE: Observer = { lat: -41.14557, lon: -71.30822, altM: 0, label: 'Bariloche', source: 'coords', timeZone: 'America/Argentina/Salta' };
// Midnight in Bariloche on the night of 2026-01-15, the rise-set fixture's night (FR-FACT-3, V214-23).
const NIGHT = Date.parse('2026-01-16T03:00:00Z');

const catalog = starCatalog();
const stars: FactsStars = {
  names: { star: (i, lang) => starName(catalog, i, lang), constellation: (con, lang) => constellationName(catalog, con, lang) },
  ra: catalog.ra,
  dec: catalog.dec,
  mag: catalog.mag,
  desig: catalog.desig,
  con: catalog.con,
};
const indexOf = (name: string): number => catalog.name.indexOf(name);

function show(subject: FactsSubject, locale: Locale, extra: { onClose?: () => void; focusOnOpen?: boolean } = {}) {
  return render(
    <I18nProvider locale={locale}>
      <FactsGroup subject={subject} observer={BARILOCHE} at={NIGHT} stars={stars} {...extra} />
    </I18nProvider>,
  );
}

const text = (id: string): string => screen.getByTestId(id).textContent;

describe('FactsGroup — This satellite (FR-FACT-2)', () => {
  const tiangong: FactsSubject = { kind: 'satellite', noradId: 48274 as NoradId, name: 'CSS (Tianhe)', description: undefined, height: { kind: 'range', perigeeKm: 380, apogeeKm: 390 } };
  const stage: FactsSubject = { kind: 'satellite', noradId: 22220 as NoradId, name: 'SL-16 R/B (Cosmos 2219)', description: undefined, height: { kind: 'one', km: 850 } };

  it('FR-FACT-2: a station in English — countries, operator, purpose; launched, age, size, height; the description', () => {
    show(tiangong, 'en');
    expect(screen.getByRole('heading', { name: 'This satellite' })).toBeInTheDocument();
    expect(text('facts-name')).toBe('CSS (Tianhe)');
    expect(text('facts-who')).toBe('China · CMSA · crewed space station');
    expect(text('facts-when')).toBe('launched 2021 · 4 years ago · about 55 m · 380–390 km up');
    expect(screen.getByText(/^The Chinese space station/)).toBeInTheDocument();
  });

  it('FR-FACT-2: the same station in Spanish, with the Spanish description', () => {
    show(tiangong, 'es');
    expect(screen.getByRole('heading', { name: 'Este satélite' })).toBeInTheDocument();
    expect(text('facts-who')).toBe('China · CMSA · estación espacial tripulada');
    expect(text('facts-when')).toBe('lanzado en 2021 · hace 4 años · unos 55 m · a 380–390 km');
    expect(screen.getByText(/^La estación espacial china/)).toBeInTheDocument();
  });

  it('FR-FACT-1: a rocket stage names the payload it launched, from the catalogue name, in both languages', () => {
    const { unmount } = show(stage, 'en');
    expect(text('facts-who')).toMatch(/ · rocket stage that launched Cosmos 2219$/);
    expect(text('facts-when')).toMatch(/ · 850 km up$/);
    unmount();
    show(stage, 'es');
    expect(text('facts-who')).toMatch(/ · etapa de cohete que lanzó Cosmos 2219$/);
    expect(text('facts-when')).toMatch(/ · a 850 km$/);
    expect(stagePayload('Titan 4B R/B')).toBeNull();
  });

  it('FR-FACT-1 (AC4): with no elements yet the height is left out, not guessed', () => {
    show({ ...tiangong, height: null }, 'en');
    expect(text('facts-when')).toBe('launched 2021 · 4 years ago · about 55 m');
  });

  it('FR-FACT-2: `[ × ]` closes, and a group opened from the keyboard takes the focus on its heading', () => {
    const onClose = vi.fn();
    show(tiangong, 'en', { onClose, focusOnOpen: true });
    expect(screen.getByRole('heading', { name: 'This satellite' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close the facts' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('facts-group')).not.toHaveAttribute('aria-live');
  });
});

describe('FactsGroup — what is that star (FR-FACT-3)', () => {
  it('FR-FACT-3: Sirius in Spanish is `Sirio · Sirius`, α CMa in Can Mayor, with its magnitude, place and the night’s rise and set', () => {
    show({ kind: 'sky', pick: { kind: 'star', index: indexOf('Sirius') } }, 'es');
    expect(screen.getByRole('heading', { name: 'En el cielo' })).toBeInTheDocument();
    expect(text('facts-name')).toBe('Sirio · Sirius');
    expect(text('facts-kind')).toBe(`α CMa · ${constellationName(catalog, 'CMa', 'es') ?? ''}`);
    expect(text('facts-where')).toMatch(/^mag −1,5 · \d+° de altura · [NESW]{1,3}$/);
    // The US Naval Observatory's 20:49Z and 10:49Z (`rise-set-horizons.json`), in Bariloche's time, to the minute.
    expect(text('facts-times')).toMatch(/^sale 17:(48|49|50) · se pone 07:(48|49|50)$/);
  });

  it('FR-FACT-3: Sirius in English is `Sirius · Sirio`', () => {
    show({ kind: 'sky', pick: { kind: 'star', index: indexOf('Sirius') } }, 'en');
    expect(text('facts-name')).toBe('Sirius · Sirio');
    expect(text('facts-times')).toMatch(/^rises 17:(48|49|50) · sets 07:(48|49|50)$/);
  });

  it('FR-FACT-3: a star that never sets over the place says so', () => {
    show({ kind: 'sky', pick: { kind: 'star', index: indexOf('Acrux') } }, 'en');
    expect(text('facts-times')).toBe('never sets');
    expect(text('facts-kind')).toMatch(/Crux$/);
  });

  it('FR-FACT-3: a planet adds `planet` and its constellation now, in both languages', () => {
    const { unmount } = show({ kind: 'sky', pick: { kind: 'planet', body: 'Jupiter' } }, 'en');
    expect(text('facts-name')).toBe('Jupiter');
    expect(text('facts-kind')).toBe('planet · Gemini');
    expect(text('facts-where')).toMatch(/^mag −2\.\d · \d+° up · [NESW]{1,3}$/);
    // JPL Horizons: 23:51Z and 09:02Z.
    expect(text('facts-times')).toMatch(/^rises 20:(50|51|52) · sets 06:(01|02|03)$/);
    unmount();
    show({ kind: 'sky', pick: { kind: 'planet', body: 'Jupiter' } }, 'es');
    expect(text('facts-name')).toBe('Júpiter');
    expect(text('facts-kind')).toMatch(/^planeta · /);
  });

  it('FR-FACT-3, FR-MOON-*: the Moon adds its phase and lit share', () => {
    const { unmount } = show({ kind: 'sky', pick: { kind: 'moon' } }, 'en');
    expect(text('facts-name')).toBe('Moon');
    expect(text('facts-moon')).toMatch(/^waning crescent · \d+ % lit$/);
    unmount();
    show({ kind: 'sky', pick: { kind: 'moon' } }, 'es');
    expect(text('facts-name')).toBe('Luna');
    expect(text('facts-moon')).toMatch(/^menguante · \d+ % iluminada$/);
    // JPL Horizons: set 22:19Z, rise 07:05Z — each the first of its kind in the night.
    expect(text('facts-times')).toMatch(/^sale 04:(04|05|06) · se pone 19:(18|19|20)$/);
  });
});

describe('factsShown.json (D-1124)', () => {
  it('FR-FACT-1: is facts.json without the sources, entry for entry, so the bundle carries what the group shows', () => {
    const expected = Object.fromEntries([...parseFacts(factsJson)].map(([id, { source: _source, ...rest }]) => [String(id), rest]));
    expect(shown).toEqual(expected);
  });
});
