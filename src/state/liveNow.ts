import type { EpochMs, NowState, Observer } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import type { WorkerClient } from './workerClient';

/**
 * R33 (FR-LIVE-6, D-169): the live page's way to the worker. The effects own
 * the 10 s `computeNow` for the Now panel and write its answer to the store;
 * the live page's request is a different thing — the Now pipeline at the
 * *shown* instant, with the dimmed set, throttled by the page and dropped
 * when stale — and its answer belongs to the page, not to `now` in the store,
 * or the Now panel would show the sky of an instant nobody is standing in.
 * So the client is handed to this module by `startApp` and the page asks it
 * directly, with the same thresholds the effects send (D-27).
 *
 * `null` until the app has started (or in a test that set none): the promise
 * rejects, and the page shows nothing dimmed rather than waiting.
 */
let client: Pick<WorkerClient, 'computeNow'> | null = null;

export function setLiveNowClient(next: Pick<WorkerClient, 'computeNow'> | null): void {
  client = next;
}

/** The Now pipeline at `t` for `observer`, hidden set included (`computeNow { includeHidden: true }`, D-76). */
export function computeNowAt(observer: Observer, t: EpochMs): Promise<NowState> {
  if (client === null) return Promise.reject(new Error('computeNowAt: the worker is not running'));
  return client.computeNow(observer, t, DEFAULT_THRESHOLDS, { includeHidden: true });
}
