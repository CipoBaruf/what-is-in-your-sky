/**
 * FR-FACT-1's verification: one entry per catalogue id and no other, every
 * field present and sourced, every country a known code, every purpose a key.
 */
import { describe, expect, it } from 'vitest';
import factsJson from './facts.json';
import { CATALOG } from './index';
import { FACT_COUNTRIES, FACT_PURPOSES, factEntrySchema, parseFacts } from './facts';

const facts = parseFacts(factsJson);

describe('facts.json', () => {
  it('validates every entry against the schema', () => {
    for (const [id, entry] of Object.entries(factsJson)) expect(factEntrySchema.safeParse(entry).success, id).toBe(true);
  });

  it('has one entry per catalogue id and no other', () => {
    expect([...facts.keys()].sort((a, b) => a - b)).toEqual(CATALOG.map((e) => e.noradId).sort((a, b) => a - b));
  });

  it('sources every fact with a real date', () => {
    for (const [id, entry] of facts) {
      for (const [field, source] of Object.entries(entry.source)) {
        expect(source.source.trim().length, `${String(id)} ${field}`).toBeGreaterThan(0);
        expect(Number.isNaN(Date.parse(source.date)), `${String(id)} ${field}`).toBe(false);
      }
    }
  });

  it('names known countries and purposes only', () => {
    for (const [id, entry] of facts) {
      for (const c of entry.countries) expect(FACT_COUNTRIES, String(id)).toContain(c);
      expect(FACT_PURPOSES, String(id)).toContain(entry.purpose);
    }
  });

  it('calls every rocket body a rocket stage, and nothing else one', () => {
    for (const e of CATALOG) expect(facts.get(e.noradId)?.purpose === 'rocket-stage', e.name).toBe(e.category === 'rocket-body');
  });

  it('launched each object on a real day no later than its source was read', () => {
    for (const [id, entry] of facts) {
      expect(Number.isNaN(Date.parse(entry.launched)), String(id)).toBe(false);
      expect(entry.launched <= entry.source.launched.date, String(id)).toBe(true);
    }
  });

  it('rounds each size to two significant figures', () => {
    for (const [id, entry] of facts) expect(Number(entry.sizeM.toPrecision(2)), String(id)).toBe(entry.sizeM);
  });

  it('gives every object a Spanish description beside an English one', () => {
    for (const e of CATALOG) {
      expect(e.description, e.name).toBeTruthy();
      expect(facts.get(e.noradId)?.descriptionEs, e.name).toBeTruthy();
    }
  });
});
