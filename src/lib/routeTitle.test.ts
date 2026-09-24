import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { routeTitle } from './routeTitle';

describe('routeTitle (FR-A11Y-3, D-531)', () => {
  it('is the bare app title on home', () => {
    expect(routeTitle('home', en)).toBe('What is in your sky right now');
    expect(routeTitle('home', es)).toBe('Qué hay en el cielo ahora mismo');
  });

  it('puts the route before the app title on the live and settings pages, in the active language', () => {
    expect(routeTitle('live', en)).toBe('Live sky · What is in your sky right now');
    expect(routeTitle('settings', en)).toBe('Settings · What is in your sky right now');
    expect(routeTitle('live', es)).toBe('Cielo en vivo · Qué hay en el cielo ahora mismo');
    expect(routeTitle('settings', es)).toBe('Ajustes · Qué hay en el cielo ahora mismo');
  });

  it('names an open pass by its satellite and start time', () => {
    expect(routeTitle('pass', en, { name: 'ISS (Zarya)', time: '2026-09-11 21:14' })).toBe('ISS (Zarya) 2026-09-11 21:14 · What is in your sky right now');
  });

  it('falls back to the app title for a pass that is not in the run', () => {
    expect(routeTitle('pass', en, null)).toBe('What is in your sky right now');
  });
});
