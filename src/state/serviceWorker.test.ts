import { describe, expect, it, vi } from 'vitest';
import { localPrefs } from '../data/localPrefs';
import { registerServiceWorker, SERVICE_WORKER_URL, SKIP_WAITING } from './serviceWorker';
import { createAppStore, type AppStore } from './store';

/**
 * R25 (FR-OFF-1, OQ-14, D-79, D-126): registration and the update lifecycle.
 * The point of every test here is the same one requirement — a new version
 * waits and is never applied by us — so the fake worker is scripted through
 * the exact sequence the browser fires: `updatefound`, the new worker's
 * `statechange` to `installed`, and, only after the banner's button, a
 * `controllerchange`.
 */

type Listener = (event?: unknown) => void;

/** An `EventTarget` thin enough to script, recording what was attached. */
function emitter() {
  const listeners = new Map<string, Listener[]>();
  return {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    emit: (type: string) => {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

function fakeWorker() {
  return { ...emitter(), state: 'installing' as ServiceWorker['state'], posted: [] as unknown[], postMessage(message: unknown) { this.posted.push(message); } };
}

interface Fakes {
  container: ServiceWorkerContainer;
  emitContainer: (type: string) => void;
  registration: { emit: (type: string) => void; installing: ReturnType<typeof fakeWorker> | null; waiting: ReturnType<typeof fakeWorker> | null };
  register: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
}

/** A container with a page already under a controller, i.e. a repeat visit. */
function fakes(options: { controlled?: boolean; waiting?: boolean; fails?: boolean } = {}): Fakes {
  const registration = { ...emitter(), installing: null as ReturnType<typeof fakeWorker> | null, waiting: options.waiting === true ? fakeWorker() : null };
  const register = vi.fn(() => (options.fails === true ? Promise.reject(new Error('blocked')) : Promise.resolve(registration)));
  const container = { ...emitter(), controller: options.controlled === false ? null : {}, register };
  return { container: container as unknown as ServiceWorkerContainer, emitContainer: container.emit, registration, register, reload: vi.fn() };
}

function store(): AppStore {
  return createAppStore({ now: () => 0, prefs: localPrefs });
}

describe('registerServiceWorker', () => {
  it('registers the generated worker at the root, so its scope is the whole app', async () => {
    const { container, register, reload } = fakes();
    await registerServiceWorker(store(), { container, reload }, true);
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: '/', type: 'classic' });
  });

  it('registers nothing in a development build', async () => {
    const { container, register, reload } = fakes();
    // The default `enabled` is `import.meta.env.PROD`, which is false under Vitest.
    expect(await registerServiceWorker(store(), { container, reload })).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers nothing where the browser has no service workers', async () => {
    const app = store();
    expect(await registerServiceWorker(app, { container: undefined, reload: vi.fn() }, true)).toBeNull();
    expect(app.getState().updateReady).toBe(false);
  });

  it('leaves the app working when registration is refused', async () => {
    const app = store();
    const { container, reload } = fakes({ fails: true });
    expect(await registerServiceWorker(app, { container, reload }, true)).toBeNull();
    expect(app.getState().updateReady).toBe(false);
  });

  it('offers the update once a new worker has installed behind the current one', async () => {
    const app = store();
    const { container, registration, reload } = fakes();
    await registerServiceWorker(app, { container, reload }, true);
    expect(app.getState().updateReady).toBe(false);

    const installing = fakeWorker();
    registration.installing = installing;
    registration.emit('updatefound');
    expect(app.getState().updateReady).toBe(false); // still downloading

    installing.state = 'installed';
    installing.emit('statechange');
    expect(app.getState().updateReady).toBe(true);
    // Waiting means waiting: nothing was told to skip it, and the page did not reload.
    expect(installing.posted).toEqual([]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers a version that was already waiting from an earlier visit', async () => {
    const app = store();
    const { container, reload } = fakes({ waiting: true });
    await registerServiceWorker(app, { container, reload }, true);
    expect(app.getState().updateReady).toBe(true);
  });

  it('says nothing about the very first worker, which is an install and not an update', async () => {
    const app = store();
    const { container, registration, reload } = fakes({ controlled: false, waiting: true });
    await registerServiceWorker(app, { container, reload }, true);

    const installing = fakeWorker();
    registration.installing = installing;
    registration.emit('updatefound');
    installing.state = 'installed';
    installing.emit('statechange');
    expect(app.getState().updateReady).toBe(false);
  });

  it('applies the update only when asked, and reloads when the new worker takes over', async () => {
    const app = store();
    const { container, emitContainer, reload } = fakes({ waiting: true });
    await registerServiceWorker(app, { container, reload }, true);

    // A controller change we did not ask for must not reload the page.
    emitContainer('controllerchange');
    expect(reload).not.toHaveBeenCalled();

    app.getState().applyUpdate?.();
    emitContainer('controllerchange');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('sends the waiting worker the message Workbox listens for', async () => {
    const app = store();
    const { container, registration, reload } = fakes({ waiting: true });
    await registerServiceWorker(app, { container, reload }, true);
    app.getState().applyUpdate?.();
    expect(registration.waiting?.posted).toEqual([{ type: SKIP_WAITING }]);
  });
});
