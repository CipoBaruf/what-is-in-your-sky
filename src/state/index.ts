import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import { startEffects } from './effects';
import { appStore } from './store';
import { createAppWorker, createWorkerClient } from './workerClient';

export { appStore, useAppStore, type AppState } from './store';
export type { ElementsState } from './slices/elements';
export type { PassesState, PassesStatus } from './slices/passes';
export { SEARCH_WINDOW_HOURS } from './passWindow';

/** Creates the worker and wires the effects to the app store. Called once from `main.tsx`. */
export function startApp(): () => void {
  const client = createWorkerClient(createAppWorker());
  const stop = startEffects({ store: appStore, client, catalog: CATALOG, loadElements });
  return () => {
    stop();
    client.terminate();
  };
}
