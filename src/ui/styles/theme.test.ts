/**
 * R156 (FR-PHONE-15, US-48 AC4, D-972, D-979): the theme by the clock. The
 * three values and the two sides of `THEME_AUTO_SUN_DEG`; the closed-form Sun
 * held to `astronomy-engine`'s (`physics/sun.ts`) so the switch lands within
 * half a minute of where the app's own twilight puts it; `data-theme` written
 * only on a change; and the shell's tick turning an evening open red at civil
 * dusk without a reload, on the saved place and never a visited one.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../model';
import { sunAltitudeDeg as engineSunAltitudeDeg } from '../../physics/sun';
import { appStore } from '../../state';
import { NOW_TICK_MS } from '../../state/effects';
import { applyTheme, resolveTheme, sunAltitudeDeg, THEME_AUTO_SUN_DEG, themeAt } from './theme';
import { useThemeTick } from './useThemeTick';

const NEUQUEN: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén', source: 'coords', timeZone: 'America/Argentina/Salta' };
const LONDON: Observer = { lat: 51.5, lon: -0.13, altM: 0, label: 'London', source: 'coords', timeZone: 'Europe/London' };
const initial = appStore.getInitialState();

/** The first instant, in 10 s steps from `from`, at which the Sun at `observer` is below `THEME_AUTO_SUN_DEG`. */
function civilDusk(observer: Observer, from: number): number {
  let t = from;
  while (sunAltitudeDeg(observer.lat, observer.lon, t) >= THEME_AUTO_SUN_DEG) t += NOW_TICK_MS;
  return t;
}

// 2026-11-01 21:00 UTC = 18:00 in Neuquén, about an hour before civil dusk; the Sun sets near 19:50 local.
const EVENING = Date.UTC(2026, 10, 1, 21, 0, 0);

afterEach(() => {
  delete document.documentElement.dataset['theme'];
  appStore.setState(initial, true);
});

describe('resolveTheme (R156: FR-PHONE-15)', () => {
  it('a palette is itself, whatever the Sun', () => {
    for (const sun of [null, 30, -30]) {
      expect(resolveTheme('dark', sun)).toBe('dark');
      expect(resolveTheme('night', sun)).toBe('night');
    }
  });

  it('auto is night below THEME_AUTO_SUN_DEG and dark at it and above', () => {
    expect(THEME_AUTO_SUN_DEG).toBe(-6);
    expect(resolveTheme('auto', -6.01)).toBe('night');
    expect(resolveTheme('auto', -18)).toBe('night');
    expect(resolveTheme('auto', -6)).toBe('dark');
    expect(resolveTheme('auto', -5.99)).toBe('dark');
    expect(resolveTheme('auto', 40)).toBe('dark');
  });

  it('auto with no place reads as dark', () => {
    expect(resolveTheme('auto', null)).toBe('dark');
    expect(themeAt('auto', null, EVENING + 6 * 3_600_000)).toBe('dark');
  });

  it('themeAt: an evening in Neuquén is dark before civil dusk and night after it, on the real instant', () => {
    const dusk = civilDusk(NEUQUEN, EVENING);
    expect(dusk - EVENING).toBeGreaterThan(60 * 60_000);
    expect(dusk - EVENING).toBeLessThan(3 * 60 * 60_000);
    expect(themeAt('auto', NEUQUEN, dusk - NOW_TICK_MS)).toBe('dark');
    expect(themeAt('auto', NEUQUEN, dusk)).toBe('night');
    // 21:00 UTC is already night in London in November: the same instant reads by the place.
    expect(themeAt('auto', LONDON, EVENING)).toBe('night');
    expect(themeAt('dark', NEUQUEN, dusk)).toBe('dark');
  });
});

describe('sunAltitudeDeg (D-979): the closed form against astronomy-engine', () => {
  it('agrees within 0.1° across a year, the hours and the latitudes', () => {
    let worst = 0;
    for (const lat of [-60, -38.93, 0, 35, 51.5, 69]) {
      for (let day = 0; day < 365; day += 17) {
        for (let hour = 0; hour < 24; hour += 3) {
          const t = Date.UTC(2026, 0, 1 + day, hour, 7);
          const lon = (day * 37) % 360 - 180;
          const ours = sunAltitudeDeg(lat, lon, t);
          const engine = engineSunAltitudeDeg({ lat, lon, altM: 0, label: '', source: 'coords', timeZone: null }, t);
          worst = Math.max(worst, Math.abs(ours - engine));
        }
      }
    }
    expect(worst).toBeLessThan(0.1);
  });
});

describe('applyTheme', () => {
  it('writes data-theme only when the palette changes', async () => {
    const records: MutationRecord[] = [];
    const watcher = new MutationObserver((list) => records.push(...list));
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    applyTheme('dark');
    applyTheme('dark');
    applyTheme('night');
    applyTheme('night');
    await Promise.resolve();
    watcher.disconnect();
    expect(records).toHaveLength(2);
    expect(document.documentElement.dataset['theme']).toBe('night');
  });
});

describe('useThemeTick (the shell’s one call)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('with Auto, turns the root red on the tick at civil dusk, without a reload', () => {
    const dusk = civilDusk(NEUQUEN, EVENING);
    vi.setSystemTime(dusk - 2 * NOW_TICK_MS);
    appStore.setState({ theme: 'auto', observer: NEUQUEN });
    renderHook(() => {
      useThemeTick();
    });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    act(() => {
      vi.advanceTimersByTime(NOW_TICK_MS);
    });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    act(() => {
      vi.advanceTimersByTime(2 * NOW_TICK_MS);
    });
    expect(document.documentElement.dataset['theme']).toBe('night');
  });

  it('follows a change of preference at once, and keeps no tick for a palette', () => {
    vi.setSystemTime(civilDusk(NEUQUEN, EVENING) + 60_000);
    appStore.setState({ theme: 'dark', observer: NEUQUEN });
    renderHook(() => {
      useThemeTick();
    });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      appStore.getState().setTheme('auto');
    });
    expect(document.documentElement.dataset['theme']).toBe('night');
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      appStore.getState().setTheme('night');
    });
    expect(document.documentElement.dataset['theme']).toBe('night');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('writes again the moment a hidden page becomes visible, without waiting for the tick', () => {
    const dusk = civilDusk(NEUQUEN, EVENING);
    vi.setSystemTime(dusk - NOW_TICK_MS);
    appStore.setState({ theme: 'auto', observer: NEUQUEN });
    renderHook(() => {
      useThemeTick();
    });
    expect(document.documentElement.dataset['theme']).toBe('dark');
    // The page was away past dusk and its interval did not run (a phone stops a hidden page's timers).
    vi.setSystemTime(dusk + 30 * 60_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(document.documentElement.dataset['theme']).toBe('night');
  });

  it('reads the saved place, not a visited one: the theme is about where the reader is', () => {
    vi.setSystemTime(civilDusk(NEUQUEN, EVENING) + 60_000);
    // Neuquén's dusk is Tokyo's morning: a visit there must not turn the reader's evening back to dark.
    const tokyo: Observer = { lat: 35.68, lon: 139.69, altM: 0, label: 'Tokyo', source: 'coords', timeZone: 'Asia/Tokyo' };
    appStore.setState({ theme: 'auto', observer: NEUQUEN, visiting: tokyo });
    renderHook(() => {
      useThemeTick();
    });
    expect(document.documentElement.dataset['theme']).toBe('night');
  });
});
