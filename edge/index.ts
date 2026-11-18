/**
 * FR-MEAS-4 (D-1148): the Worker script `wrangler.jsonc` names as `main`. `run_worker_first` sends only `/e` here;
 * every other request is the static assets', served as on 2.14.3. The bindings are typed by hand, as narrowly as the
 * script uses them, so no dependency is added (D-1148).
 */
import type { MeasureEvent } from '../src/model/measure';
import { collect } from './collect';

/** FR-MEAS-3's path on the site's own origin; `src/data/measure.ts` names the same path for the sender. */
const ROUTE = '/e';

/** The one data point shape this script writes to Workers Analytics Engine. */
interface DataPoint {
  indexes: string[];
  blobs: string[];
}

export interface Env {
  /** `assets.binding`: the static assets in `dist/`, with `_headers` and `not_found_handling` applied. */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  /** `analytics_engine_datasets`: the `inyoursky_events` dataset. */
  EVENTS: { writeDataPoint: (point: DataPoint) => void };
}

/**
 * D-1148: the six fields, in this order, as `blob1`..`blob6`; `detail` is `''` for a name that takes none.
 * The load's id is the index too, so the store samples a load's events together.
 */
export const toDataPoint = (event: MeasureEvent): DataPoint => ({
  indexes: [event.id],
  blobs: [event.name, event.detail ?? '', event.visit, event.layout, event.lang, event.id],
});

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === ROUTE) return collect(request, (event) => env.EVENTS.writeDataPoint(toDataPoint(event)));
    return env.ASSETS.fetch(request);
  },
};
