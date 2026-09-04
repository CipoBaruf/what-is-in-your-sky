/**
 * TASKS R29 "Done when" for the Moon lore: the schema validates the file in CI
 * the way `catalog.test.ts` validates the catalog, every entry exists in both
 * languages, the wording is tradition rather than prediction or advice
 * (FR-MOON-5), the Spanish never addresses the reader (FR-I18N-3), and every
 * entry names where the tradition comes from (FR-SAT-5's style).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import loreJson from './lore.json';
import { MOON_LORE, MOON_PHASES, ZODIAC_SIGNS, fullMoonName, loreSchema, phaseLore, signAtLongitude, signByKey } from './index';
import type { LocalizedText, Provenance } from './index';
import { localizedSchema, moonPhaseLoreSchema, provenanceSchema, zodiacSignSchema } from './schema';

const LOCALES = ['en', 'es'] as const;

/** A word on its own, not a fragment of another: `\b` is ASCII-only and would not hold at an accented letter. */
function wholeWord(word: string): RegExp {
  return new RegExp(`(?:^|[^\\p{L}])${word}(?:[^\\p{L}]|$)`, 'iu');
}

/** Every piece of prose the app can show, with a label so a failure names the entry. */
const LINES: { where: string; text: LocalizedText }[] = [
  ...MOON_LORE.signs.map((sign) => ({ where: `sign ${sign.key}`, text: sign.line })),
  ...MOON_LORE.phases.map((phase) => ({ where: `phase ${phase.key}`, text: phase.line })),
  { where: 'full moon hemisphere note', text: MOON_LORE.fullMoons.hemisphereNote },
];

/** The names are shown too, but they are proper names — the sentence rules below do not apply to them. */
const NAMES: { where: string; text: LocalizedText }[] = [
  ...MOON_LORE.signs.map((sign) => ({ where: `sign name ${sign.key}`, text: sign.name })),
  ...MOON_LORE.fullMoons.months.map((month) => ({ where: `full moon name ${String(month.month)}`, text: month.name })),
];

const PROVENANCE: { where: string; source: Provenance }[] = [
  ...MOON_LORE.signs.map((sign) => ({ where: `sign ${sign.key}`, source: sign.source })),
  ...MOON_LORE.fullMoons.months.map((month) => ({ where: `full moon ${String(month.month)}`, source: month.source })),
  ...MOON_LORE.phases.map((phase) => ({ where: `phase ${phase.key}`, source: phase.source })),
];

describe('lore.json', () => {
  it('validates against the schema', () => {
    const result = loreSchema.safeParse(loreJson);
    expect(JSON.stringify(result.error?.issues ?? [])).toBe('[]');
    expect(result.success).toBe(true);
  });

  it('has the twelve tropical signs in order, 30° apart from 0° Aries (FR-MOON-4)', () => {
    expect(MOON_LORE.signs.map((s) => s.key)).toEqual([...ZODIAC_SIGNS]);
    expect(MOON_LORE.signs.map((s) => s.startLonDeg)).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  });

  it('has a folk full-moon name for every calendar month, labelled as Northern-hemisphere tradition', () => {
    expect(MOON_LORE.fullMoons.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(MOON_LORE.fullMoons.hemisphereNote.en).toMatch(/northern hemisphere/i);
    expect(MOON_LORE.fullMoons.hemisphereNote.es).toMatch(/hemisferio norte/i);
  });

  it('has a one-liner for every phase of FR-MOON-1', () => {
    expect(MOON_LORE.phases.map((p) => p.key)).toEqual([...MOON_PHASES]);
  });

  it('carries every entry in both languages (FR-I18N-2)', () => {
    for (const { where, text } of [...LINES, ...NAMES]) {
      for (const locale of LOCALES) expect(text[locale].trim(), `${where} (${locale})`).not.toBe('');
    }
  });

  it('is one line per entry: a single sentence, no line breaks', () => {
    for (const { where, text } of LINES) {
      for (const locale of LOCALES) {
        const line = text[locale];
        expect(line, `${where} (${locale})`).not.toMatch(/[\n\r]/);
        expect(line.endsWith('.'), `${where} (${locale}) ends with a full stop`).toBe(true);
        expect(line.slice(0, -1), `${where} (${locale}) is one sentence`).not.toMatch(/\./);
        expect(line.length, `${where} (${locale}) length`).toBeLessThanOrEqual(200);
      }
    }
  });
});

describe('the lore accessors', () => {
  it('maps an ecliptic longitude to the sign whose band contains it', () => {
    expect(signAtLongitude(0).key).toBe('aries');
    expect(signAtLongitude(29.999).key).toBe('aries');
    expect(signAtLongitude(30).key).toBe('taurus');
    expect(signAtLongitude(180).key).toBe('libra');
    expect(signAtLongitude(359.999).key).toBe('pisces');
  });

  it('normalises longitudes outside 0–360°', () => {
    expect(signAtLongitude(360).key).toBe('aries');
    expect(signAtLongitude(720.5).key).toBe('aries');
    expect(signAtLongitude(-0.5).key).toBe('pisces');
    expect(signAtLongitude(-31).key).toBe('aquarius');
  });

  it('finds a sign, a folk name and a phase line by key', () => {
    expect(signByKey('leo').name.es).toBe('Leo');
    expect(fullMoonName(1).name.en).toBe('Wolf Moon');
    expect(fullMoonName(12).name.es).toBe('Luna Fría');
    expect(phaseLore('full').line.en).toMatch(/full Moon/);
  });
});

describe('the wording is tradition, not prediction or advice (FR-MOON-5)', () => {
  /** Addressing the reader, promising an outcome, or telling anyone what to do. Tradition is described in the third person and in the past. */
  const BANNED_EN = [
    'you',
    'your',
    'yours',
    'yourself',
    'will',
    'shall',
    'should',
    'must',
    'ought',
    'expect',
    'expects',
    'predict',
    'predicts',
    'foretell',
    'foretells',
    'portend',
    'portends',
    'promise',
    'promises',
    'omen',
    'luck',
    'lucky',
    'fortune',
    'destiny',
    'fate',
    'influence',
    'influences',
    'govern',
    'governs',
    'rule',
    'rules',
    'favour',
    'favours',
    'favor',
    'favors',
  ];

  /** An imperative is a bare verb opening a sentence; the same words are ordinary in the middle of one ("the arrow points at"). */
  const IMPERATIVES = ['look', 'watch', 'check', 'wait', 'plan', 'avoid', 'try', 'use', 'choose', 'pick', 'see', 'find', 'head', 'face', 'point', 'take', 'make', 'turn', 'start', 'remember', 'note', 'expect'];

  const imperative = new RegExp(`(?:^|[.;:]\\s+)(?:${IMPERATIVES.join('|')})(?:[^\\p{L}]|$)`, 'iu');

  it('never addresses the reader or promises an outcome', () => {
    for (const { where, text } of LINES) {
      for (const word of BANNED_EN) {
        expect(text.en, `${where}: "${word}"`).not.toMatch(wholeWord(word));
      }
    }
  });

  it('never opens a sentence with an instruction', () => {
    for (const { where, text } of LINES) expect(text.en, where).not.toMatch(imperative);
  });

  /** The guard has to be able to fail: copy that reads like a horoscope or like observing advice must trip it. */
  it('catches a planted prediction or instruction', () => {
    const planted = [
      'A Moon in Leo will bring you a bright week.',
      'This phase favours travel and your plans.',
      'The waning Moon is a bad omen for the harvest.',
      'Luck runs with the crescent.',
    ];
    for (const line of planted) expect(BANNED_EN.some((word) => wholeWord(word).test(line)), line).toBe(true);
    for (const line of ['Look for the crescent low in the west.', 'Wait for the Moon to clear the horizon.']) expect(imperative.test(line), line).toBe(true);
  });

  it('keeps the second person out of the provenance notes too', () => {
    for (const { where, source } of PROVENANCE) {
      for (const word of ['you', 'your', 'yours']) {
        expect(`${source.source} ${source.note}`, `${where}: "${word}"`).not.toMatch(new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu'));
      }
    }
  });
});

describe('the Spanish lore (FR-I18N-3)', () => {
  /** The same forms `src/i18n/messages.test.ts` bans in the catalogs: the pronouns, the possessive and the imperatives the copy could slip into. */
  const BANNED_ES = [
    'tú',
    'vos',
    'usted',
    'ustedes',
    'tu',
    'tus',
    'mira',
    'mirá',
    'busca',
    'buscá',
    'ingresa',
    'ingresá',
    'elige',
    'elegí',
    'escribe',
    'escribí',
    'prueba',
    'probá',
    'usa',
    'usá',
    'toca',
    'tocá',
    'arrastra',
    'arrastrá',
    'vuelve',
    'volvé',
    'presiona',
    'presioná',
    'selecciona',
    'seleccioná',
    'intenta',
    'intentá',
    'haz',
    'hacé',
    'pon',
    'poné',
    'fíjate',
    'fijate',
  ];

  /** Spanish prediction: the fortune vocabulary and the verbs that make the sky act on a person. */
  const PREDICTION_ES = ['suerte', 'destino', 'fortuna', 'augura', 'augurio', 'presagia', 'presagio', 'predice', 'vaticina', 'anuncia', 'influye', 'rige', 'gobierna', 'favorece', 'conviene', 'deberá', 'energía'];

  /** Whole lower-case words only: the endings that make a Spanish future also end proper names such as Aldebarán. */
  const FUTURE_TENSE = /(?:^|[^\p{L}])\p{Ll}\p{L}{2,}(?:rá|rán)(?:[^\p{L}]|$)/u;

  it('never addresses the reader', () => {
    for (const { where, text } of LINES) {
      for (const word of [...BANNED_ES, ...PREDICTION_ES]) {
        expect(text.es, `${where}: "${word}"`).not.toMatch(wholeWord(word));
      }
    }
  });

  it('catches a planted prediction or instruction', () => {
    const planted = ['La Luna en Leo trae suerte a tu semana.', 'Esta fase rige los viajes.', 'Mirá el creciente bajo en el oeste.', 'La luna nueva anuncia un cambio.'];
    for (const line of planted) expect([...BANNED_ES, ...PREDICTION_ES].some((word) => wholeWord(word).test(line)), line).toBe(true);
    expect(FUTURE_TENSE.test('La luna llena traerá lluvia.')).toBe(true);
  });

  it('is written in the past and the present, never in the future tense', () => {
    for (const { where, text } of LINES) expect(text.es, where).not.toMatch(FUTURE_TENSE);
  });

  it('is actually Spanish, not English left in place', () => {
    for (const { where, text } of LINES) expect(text.es, where).not.toBe(text.en);
    // The sign names are the same in both languages by design where Latin gave both of them the same word (FR-I18N-4).
    const sameName = MOON_LORE.signs.filter((sign) => sign.name.en === sign.name.es).map((sign) => sign.key);
    expect([...sameName].sort()).toEqual(['aries', 'leo', 'libra', 'virgo']);
    for (const month of MOON_LORE.fullMoons.months) expect(month.name.es, `month ${String(month.month)}`).not.toBe(month.name.en);
  });
});

describe('the file is the only source of tradition text (FR-MOON-4)', () => {
  it('names a source, a review date and a note for every entry (FR-SAT-5)', () => {
    for (const { where, source } of PROVENANCE) {
      expect(source.source.trim().length, where).toBeGreaterThan(0);
      expect(source.date, where).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(source.date)), where).toBe(false);
      expect(source.note.trim().length, where).toBeGreaterThan(0);
    }
  });

  it('has nothing generated: no entry repeats another and no placeholder is left', () => {
    for (const locale of LOCALES) {
      const lines = LINES.map(({ text }) => text[locale]);
      expect(new Set(lines).size, `${locale} lines`).toBe(lines.length);
    }
    const notes = PROVENANCE.map(({ source }) => source.note);
    expect(new Set(notes).size, 'provenance notes').toBe(notes.length);
    for (const { where, text } of [...LINES, ...NAMES]) {
      for (const locale of LOCALES) expect(text[locale], `${where} (${locale})`).not.toMatch(/[{}]|TODO|TBD|Lorem|%s/);
    }
  });

  it('is not duplicated into the message catalogs', () => {
    const catalogs = LOCALES.map((locale) => readFileSync(new URL(`../../i18n/${locale}.ts`, import.meta.url), 'utf8')).join('\n');
    for (const { where, text } of LINES) {
      for (const locale of LOCALES) expect(catalogs, `${where} (${locale})`).not.toContain(text[locale]);
    }
    for (const month of MOON_LORE.fullMoons.months) {
      for (const locale of LOCALES) expect(catalogs, `full moon name ${String(month.month)} (${locale})`).not.toContain(month.name[locale]);
    }
  });
});

describe('loreSchema', () => {
  /** The parsed file, so a malformed variant below is built from a known-good one rather than from the JSON's looser type. */
  const valid = MOON_LORE;

  it('rejects a missing language', () => {
    expect(localizedSchema.safeParse({ en: 'a line' }).success).toBe(false);
    expect(localizedSchema.safeParse({ en: 'a line', es: '' }).success).toBe(false);
    expect(localizedSchema.safeParse({ en: 'a line', es: '   ' }).success).toBe(false);
  });

  it('rejects a missing or malformed provenance', () => {
    const source = { source: 'a tradition', date: '2026-09-04', note: 'where it comes from' };
    expect(provenanceSchema.safeParse(source).success).toBe(true);
    expect(provenanceSchema.safeParse({ ...source, date: 'last year' }).success).toBe(false);
    expect(provenanceSchema.safeParse({ source: source.source, date: source.date }).success).toBe(false);
    expect(provenanceSchema.safeParse({ ...source, source: '' }).success).toBe(false);
  });

  it('rejects a sign out of order, at the wrong longitude, or missing', () => {
    const swapped = { ...valid, signs: [signByKey('taurus'), signByKey('aries'), ...valid.signs.slice(2)] };
    expect(loreSchema.safeParse(swapped).success).toBe(false);

    const moved = { ...valid, signs: valid.signs.map((sign) => (sign.key === 'leo' ? { ...sign, startLonDeg: 125 } : sign)) };
    const result = loreSchema.safeParse(moved);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/leo starts at 120/);

    expect(loreSchema.safeParse({ ...valid, signs: valid.signs.slice(0, -1) }).success).toBe(false);
  });

  it('rejects an unknown sign or phase key', () => {
    expect(zodiacSignSchema.safeParse({ ...signByKey('aries'), key: 'ophiuchus' }).success).toBe(false);
    expect(moonPhaseLoreSchema.safeParse({ ...phaseLore('new'), key: 'gibbous' }).success).toBe(false);
  });

  it('rejects a month out of place and a thirteenth month', () => {
    const months = valid.fullMoons.months;
    const shuffled = { ...valid, fullMoons: { ...valid.fullMoons, months: months.map((m) => (m.month === 4 ? { ...m, month: 5 } : m)) } };
    expect(loreSchema.safeParse(shuffled).success).toBe(false);

    const extra = { ...valid, fullMoons: { ...valid.fullMoons, months: [...months, { ...fullMoonName(1), month: 13 }] } };
    expect(loreSchema.safeParse(extra).success).toBe(false);
  });

  it('rejects a missing phase', () => {
    expect(loreSchema.safeParse({ ...valid, phases: valid.phases.filter((phase) => phase.key !== 'full') }).success).toBe(false);
  });
});
