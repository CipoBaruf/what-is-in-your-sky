import type { StateCreator } from 'zustand/vanilla';
import type { Observer, WeatherSnapshot } from '../../model';
import type { AppState } from '../store';

/**
 * The cloud forecast for the current observer (FR-WX-1/3/5) and the observer
 * it belongs to, so a card never wears another location's verdict. Weather
 * never blocks passes: `error` leaves the pass job alone and every verdict
 * reads `unknown` (US-7 AC4). `fillTimeZone` is the D-3 hand-off: the
 * forecast's IANA zone completes a coordinate/device observer, replacing the
 * observer object and re-pointing every slice that referenced it, so the
 * identity checks elsewhere keep holding.
 */
export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WeatherSliceState {
  observer: Observer | null;
  status: WeatherStatus;
  snapshot: WeatherSnapshot | null;
  error: string | null;
}

export const IDLE_WEATHER: WeatherSliceState = { observer: null, status: 'idle', snapshot: null, error: null };

export interface WeatherSlice {
  weather: WeatherSliceState;
  startWeather: (observer: Observer) => void;
  setWeather: (observer: Observer, snapshot: WeatherSnapshot) => void;
  setWeatherError: (observer: Observer, error: string) => void;
  resetWeather: () => void;
  /** Sets the observer's zone if it has none; a no-op otherwise (a geocoded observer already knows its zone). */
  fillTimeZone: (timeZone: string) => void;
}

export const createWeatherSlice: StateCreator<AppState, [], [], WeatherSlice> = (set) => ({
  weather: IDLE_WEATHER,
  startWeather: (observer) => {
    set({ weather: { observer, status: 'loading', snapshot: null, error: null } });
  },
  setWeather: (observer, snapshot) => {
    set({ weather: { observer, status: 'ready', snapshot, error: null } });
  },
  setWeatherError: (observer, error) => {
    set({ weather: { observer, status: 'error', snapshot: null, error } });
  },
  resetWeather: () => {
    set({ weather: IDLE_WEATHER });
  },
  fillTimeZone: (timeZone) => {
    set((state) => {
      const previous = state.observer;
      if (!previous || previous.timeZone !== null) return {};
      const observer: Observer = { ...previous, timeZone };
      const repoint = <T extends { observer: Observer | null }>(slice: T): T => (slice.observer === previous ? { ...slice, observer } : slice);
      return { observer, passes: repoint(state.passes), now: repoint(state.now), weather: repoint(state.weather) };
    });
  },
});
