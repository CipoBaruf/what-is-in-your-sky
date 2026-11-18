/**
 * FR-MEAS-1, FR-MEAS-3 (D-1146): the load's context and its one sender, built by `startApp`; `count` is what `src/ui` imports.
 * It imports neither the store, React nor `lib/layout`, so it stays inside `MEASURE_MAX_KB` (D-1151). It cannot read a
 * place: the context is four values fixed at load, and `id` lives in this module's memory only, never in any storage.
 */
import { createMeasure, type Count, type DetailArg, type MeasureEnv } from '../data/measure';
import type { MeasureContext, MeasureName } from '../model/measure';

let sender: Count = () => undefined;

/** FR-MEAS-2: counts one name-and-detail pair, at most once per load; a no-op until `startMeasure` has run. */
export function count<N extends MeasureName>(name: N, ...detail: DetailArg<N>): void {
  sender(name, ...detail);
}

/** FR-MEAS-1: 16 hex characters from the platform's random source, made per load. */
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** D-1146: the browser's own gates, read once; the paint deferral is `requestAnimationFrame` then a zero timeout. */
export function browserEnv(): MeasureEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    beacon: typeof nav?.sendBeacon === 'function' ? nav.sendBeacon.bind(nav) : undefined,
    online: () => nav?.onLine !== false,
    origin: typeof location === 'undefined' ? '' : location.origin,
    webdriver: nav?.webdriver === true,
    forced: (globalThis as { __WIYS_MEASURE__?: unknown }).__WIYS_MEASURE__ === true,
    defer: (run) => {
      try {
        requestAnimationFrame(() => setTimeout(run, 0));
      } catch {
        // No frame to wait for (a hidden or headless page): nothing is sent rather than something on the paint path.
      }
    },
  };
}

/** What `startApp` knows at load: whether an observer was there, whether the wide query matched, the resolved language. */
export interface LoadFacts {
  returning: boolean;
  wide: boolean;
  lang: MeasureContext['lang'];
}

/** Builds this load's sender; `startApp` calls it once, after the saved place is restored and before a link is read. */
export function startMeasure(facts: LoadFacts, env: MeasureEnv = browserEnv()): Count {
  sender = createMeasure(env, { visit: facts.returning ? 'return' : 'first', layout: facts.wide ? 'wide' : 'compact', lang: facts.lang, id: randomId() });
  return count;
}
