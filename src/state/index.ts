import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import { documentVisibility, startEffects } from './effects';
import { appStore } from './store';
import { createAppWorker, createWorkerClient } from './workerClient';

export { appStore, useAppStore, type AppState } from './store';
export type { ElementsState } from './slices/elements';
export type { PassesState, PassesStatus } from './slices/passes';
export type { NowSliceState } from './slices/now';
export { SEARCH_WINDOW_HOURS } from './passWindow';
export { NOW_TICK_MS } from './effects';
/** The thresholds the state sends to the worker (D-27); the UI quotes them (e.g. "above 10°") from here, never from `src/physics`. */
export { DEFAULT_THRESHOLDS } from '../physics/constants';

/** Creates the worker and wires the effects to the app store. Called once from `main.tsx`. */
export function startApp(): () => void {
  const client = createWorkerClient(createAppWorker());
  const stop = startEffects({ store: appStore, client, catalog: CATALOG, loadElements, now: () => Date.now(), visibility: documentVisibility(document) });
  return () => {
    stop();
    client.terminate();
  };
}
