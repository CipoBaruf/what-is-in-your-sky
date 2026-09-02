import { createHandler, createHandlerState } from './handlers';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** The dedicated worker's global, typed for our protocol only (PLAN §6.2: `passes.worker.ts` is a thin binding). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(response: WorkerResponse): void;
}

const scope = self as unknown as WorkerScope;
const handle = createHandler(createHandlerState());
scope.onmessage = (event) => {
  void handle(event.data, (response) => {
    scope.postMessage(response);
  });
};
