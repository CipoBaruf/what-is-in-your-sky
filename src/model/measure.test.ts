/** R193 (FR-MEAS-1, FR-MEAS-2, D-1145): the closed list, its type and its runtime guard. */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { EVENTS, isMeasureEvent, type MeasureEvent, type MeasureName } from './measure';

const context = { visit: 'first', layout: 'compact', lang: 'en', id: '0123456789abcdef' } as const;

describe('FR-MEAS-2: the table', () => {
  it('is exactly the spec table, name by name and detail by detail', () => {
    expect(EVENTS).toEqual({
      open: ['home', 'pass', 'live', 'stars', 'settings'],
      example_shown: ['pass', 'none', 'no_city', 'failed', 'slow'],
      where_shown: ['example', 'fallback'],
      place_set: ['search', 'coords', 'device', 'favourite', 'link'],
      device_refused: ['denied', 'unavailable', 'timeout'],
      search_empty: [],
      door: ['satellites', 'stars', 'live'],
      watch: [],
      pass_open: [],
      live_open: [],
      stars_open: [],
      sky_screen_open: [],
      settings_open: [],
      follow_answer: ['allow', 'not_now', 'refused'],
      no_passes: [],
      failure: ['elements', 'forecast', 'search', 'passes', 'live'],
    });
  });
});

describe('FR-MEAS-1: the event type', () => {
  it('admits only the listed names and their details', () => {
    expectTypeOf<MeasureName>().toEqualTypeOf<keyof typeof EVENTS>();
    expectTypeOf({ name: 'place_set', detail: 'device', ...context } as const).toExtend<MeasureEvent>();
    expectTypeOf({ name: 'where_shown', ...context } as const).toExtend<MeasureEvent>();
    expectTypeOf({ name: 'where_shown', detail: 'fallback', ...context } as const).toExtend<MeasureEvent>();
    expectTypeOf({ name: 'example_shown', detail: 'no_city', ...context } as const).toExtend<MeasureEvent>();
    expectTypeOf({ name: 'watch', ...context } as const).toExtend<MeasureEvent>();
    expectTypeOf({ name: 'watch', detail: 'pass', ...context } as const).not.toExtend<MeasureEvent>();
    expectTypeOf({ name: 'when_shown', ...context } as const).not.toExtend<MeasureEvent>();
    expectTypeOf({ name: 'what_shown', ...context } as const).not.toExtend<MeasureEvent>();
    expectTypeOf({ name: 'place_set', detail: 'Neuquén', ...context } as const).not.toExtend<MeasureEvent>();
    expectTypeOf({ name: 'where_shown', detail: 'search', ...context } as const).not.toExtend<MeasureEvent>();
    expectTypeOf({ name: 'typed', ...context } as const).not.toExtend<MeasureEvent>();
    expectTypeOf({ name: 'open', ...context, lang: 'fr' } as const).not.toExtend<MeasureEvent>();
  });
});

describe('FR-MEAS-1: the runtime guard', () => {
  it('accepts every name alone and with each of its details', () => {
    for (const [name, details] of Object.entries(EVENTS)) {
      expect(isMeasureEvent({ name, ...context }), name).toBe(true);
      for (const detail of details) expect(isMeasureEvent({ name, detail, ...context }), `${name}:${detail}`).toBe(true);
    }
  });

  it('accepts every value of the context', () => {
    for (const visit of ['first', 'return']) for (const layout of ['compact', 'wide']) for (const lang of ['en', 'es']) expect(isMeasureEvent({ name: 'open', visit, layout, lang, id: 'ffffffffffffffff' })).toBe(true);
  });

  it('drops anything else: an unknown name, a foreign detail, free text, an extra field, a bad context or id', () => {
    const rejects: unknown[] = [
      null,
      'open',
      [],
      { ...context },
      { name: 'typed', ...context },
      { name: 'toString', ...context },
      { name: 'place_set', detail: 'Neuquén, Argentina', ...context },
      { name: 'place_set', detail: '-38.95', ...context },
      { name: 'where_shown', detail: 'search', ...context },
      { name: 'example_shown', detail: 'Buenos Aires', ...context },
      { name: 'when_shown', ...context },
      { name: 'what_shown', ...context },
      { name: 'door', detail: 7, ...context },
      { name: 'watch', detail: 'pass', ...context },
      { name: 'open', ...context, lat: -38.95 },
      { name: 'open', ...context, label: 'Neuquén' },
      { name: 'open', ...context, visit: 'third' },
      { name: 'open', ...context, layout: 'tablet' },
      { name: 'open', ...context, lang: 'fr' },
      { name: 'open', ...context, id: '0123456789ABCDEF' },
      { name: 'open', ...context, id: '0123456789abcde' },
      { name: 'open', ...context, id: 12 },
      { name: 'open', visit: 'first', layout: 'compact', lang: 'en' },
    ];
    for (const value of rejects) expect(isMeasureEvent(value), JSON.stringify(value)).toBe(false);
  });
});
