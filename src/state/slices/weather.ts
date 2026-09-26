import type { StateCreator } from 'zustand/vanilla';
import { favouriteCellKey } from '../../data/favourites';
import type { Observer, WeatherSnapshot } from '../../model';
import type { Failure } from '../failure';
import type { AppState } from '../store';
import { activeObserver, sameLocation } from './location';

/**
 * The cloud forecast for the current observer (FR-WX-1/3/5) and the observer
 * it belongs to, so a card never wears another location's verdict. Weather
 * never blocks passes: `error` leaves the pass job alone and every verdict
 * reads `unknown` (US-7 AC4). `fillTimeZone` is the D-3 hand-off: the
 * forecast's IANA zone completes a coordinate/device observer, replacing the
 * observer object and re-pointing every slice that referenced it, so the
 * identity checks elsewhere keep holding. F-12: a favourite already saved for
 * this cell, with no zone of its own (saved before the forecast resolved),
 * gets the same zone, so an offline selection of it stops rendering in UTC.
 *
 * R86 (FR-FAIL-3, D-540, D-542): a failure is stored as a `Failure`. A
 * refresh of the place already on screen keeps its snapshot: `startWeather`
 * leaves a ready snapshot where it is, and a refresh that fails records the
 * failure beside it (still `ready`) instead of blanking it, so the last
 * forecast stays on screen with its age until one answers. `error` being set
 * is what the recheck reads as "the last attempt failed".
 */
type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WeatherSliceState {
  observer: Observer | null;
  status: WeatherStatus;
  snapshot: WeatherSnapshot | null;
  error: Failure | null;
}

const IDLE_WEATHER: WeatherSliceState = { observer: null, status: 'idle', snapshot: null, error: null };

export interface WeatherSlice {
  weather: WeatherSliceState;
  startWeather: (observer: Observer) => void;
  setWeather: (observer: Observer, snapshot: WeatherSnapshot) => void;
  setWeatherError: (observer: Observer, failure: Failure) => void;
  resetWeather: () => void;
  /** Sets the observer's zone if it has none; a no-op otherwise (a geocoded observer already knows its zone). */
  fillTimeZone: (timeZone: string) => void;
}

export const createWeatherSlice: StateCreator<AppState, [], [], WeatherSlice> = (set, get) => ({
  weather: IDLE_WEATHER,
  startWeather: (observer) => {
    const { weather } = get();
    if (weather.status === 'ready' && weather.snapshot !== null && sameLocation(weather.observer, observer)) return; // a refresh: the snapshot stays up
    set({ weather: { observer, status: 'loading', snapshot: null, error: null } });
  },
  setWeather: (observer, snapshot) => {
    set({ weather: { observer, status: 'ready', snapshot, error: null } });
  },
  setWeatherError: (observer, failure) => {
    const { weather } = get();
    if (weather.status === 'ready' && weather.snapshot !== null && sameLocation(weather.observer, observer)) {
      set({ weather: { ...weather, observer, error: failure } });
      return;
    }
    set({ weather: { observer, status: 'error', snapshot: null, error: failure } });
  },
  resetWeather: () => {
    set({ weather: IDLE_WEATHER });
  },
  // R83 (D-538): the zone goes to the active observer. A visited place gets it in memory only —
  // neither the saved observer nor a favourite is touched, so nothing reaches `wiys:prefs:v1`.
  fillTimeZone: (timeZone) => {
    const visiting = get().visiting !== null;
    const previous = activeObserver(get());
    if (!previous || previous.timeZone !== null) return;
    set((state) => {
      const observer: Observer = { ...previous, timeZone };
      const repoint = <T extends { observer: Observer | null }>(slice: T): T => (slice.observer === previous ? { ...slice, observer } : slice);
      return { ...(visiting ? { visiting: observer } : { observer }), passes: repoint(state.passes), now: repoint(state.now), weather: repoint(state.weather) };
    });
    if (!visiting) get().refreshFavouriteTimeZone(favouriteCellKey(previous), timeZone);
  },
});
