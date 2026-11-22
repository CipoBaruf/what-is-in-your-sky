import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localPrefs } from '../data/localPrefs';
import { ALWAYS_VISIBLE } from './effects';
import { registerServiceWorker, SERVICE_WORKER_URL, SKIP_WAITING, UPDATE_POLL_MIN, watchForUpdates, type UpdateWatchHost } from './serviceWorker';
import { createAppStore, type AppStore } from './store';

/**
 * R25 (FR-OFF-1, OQ-14, D-79, D-126): registration and the update lifecycle.
 * The point of every test here is the same one requirement — a new version
 * waits and is never applied by us — so the fake worker is scripted through
 * the exact sequence the browser fires: `updatefound`, the new worker's
 * `statechange` to `installed`, and, only after the banner's button, a
 * `controllerchange`. R207 (FR-UPD-1) adds when a new version is looked for.
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
  registration: { emit: (type: string) => void; update: ReturnType<typeof vi.fn>; installing: ReturnType<typeof fakeWorker> | null; waiting: ReturnType<typeof fakeWorker> | null };
  register: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
}

/** A container with a page already under a controller, i.e. a repeat visit. */
function fakes(options: { controlled?: boolean; waiting?: boolean; fails?: boolean } = {}): Fakes {
  const registration = { ...emitter(), update: vi.fn(() => Promise.resolve()), installing: null as ReturnType<typeof fakeWorker> | null, waiting: options.waiting === true ? fakeWorker() : null };
  const register = vi.fn(() => (options.fails === true ? Promise.reject(new Error('blocked')) : Promise.resolve(registration)));
  const container = { ...emitter(), controller: options.controlled === false ? null : {}, register };
  return { container: container as unknown as ServiceWorkerContainer, emitContainer: container.emit, registration, register, reload: vi.fn() };
}

/** Registration's tests are not about time: a page in view whose timer never fires. */
const updates: UpdateWatchHost = { visibility: ALWAYS_VISIBLE, setInterval: () => 0, clearInterval: () => undefined, now: () => 0 };

function store(): AppStore {
  return createAppStore({ now: () => 0, prefs: localPrefs });
}

describe('registerServiceWorker', () => {
  it('registers the generated worker at the root, so its scope is the whole app', async () => {
    const { container, register, reload } = fakes();
    await registerServiceWorker(store(), { container, reload, updates }, true);
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: '/', type: 'classic' });
  });

  it('registers nothing in a development build', async () => {
    const { container, register, reload } = fakes();
    // The default `enabled` is `IS_PROD` (`import.meta.env.PROD`), which is false under Vitest.
    expect(await registerServiceWorker(store(), { container, reload, updates })).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers nothing where the browser has no service workers', async () => {
    const app = store();
    expect(await registerServiceWorker(app, { container: undefined, reload: vi.fn(), updates }, true)).toBeNull();
    expect(app.getState().updateReady).toBe(false);
  });

  it('leaves the app working when registration is refused', async () => {
    const app = store();
    const { container, reload } = fakes({ fails: true });
    expect(await registerServiceWorker(app, { container, reload, updates }, true)).toBeNull();
    expect(app.getState().updateReady).toBe(false);
  });

  it('offers the update once a new worker has installed behind the current one', async () => {
    const app = store();
    const { container, registration, reload } = fakes();
    await registerServiceWorker(app, { container, reload, updates }, true);
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
    await registerServiceWorker(app, { container, reload, updates }, true);
    expect(app.getState().updateReady).toBe(true);
  });

  it('says nothing about the very first worker, which is an install and not an update', async () => {
    const app = store();
    const { container, registration, reload } = fakes({ controlled: false, waiting: true });
    await registerServiceWorker(app, { container, reload, updates }, true);

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
    await registerServiceWorker(app, { container, reload, updates }, true);

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
    await registerServiceWorker(app, { container, reload, updates }, true);
    app.getState().applyUpdate?.();
    expect(registration.waiting?.posted).toEqual([{ type: SKIP_WAITING }]);
  });

  it('FR-UPD-1: looks for a new version once on registering', async () => {
    const { container, registration, reload } = fakes();
    await registerServiceWorker(store(), { container, reload, updates }, true);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });
});

describe('FR-UPD-1: watchForUpdates', () => {
  const MINUTE_MS = 60_000;
  const POLL_MS = UPDATE_POLL_MIN * MINUTE_MS;

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function watched(options: { hidden?: boolean; fails?: boolean } = {}) {
    let hidden = options.hidden === true;
    const listeners = new Set<() => void>();
    const update = vi.fn(() => (options.fails === true ? Promise.reject(new Error('offline')) : Promise.resolve()));
    const host: UpdateWatchHost = {
      visibility: {
        hidden: () => hidden,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      setInterval: (tick, ms) => Number(setInterval(tick, ms)),
      clearInterval: (id) => {
        clearInterval(id);
      },
      now: () => Date.now(),
    };
    const stop = watchForUpdates({ update } as unknown as Pick<ServiceWorkerRegistration, 'update'>, host);
    const setHidden = (value: boolean): void => {
      hidden = value;
      for (const listener of listeners) listener();
    };
    return { update, stop, setHidden };
  }

  it('checks once on register and every 30 min while visible', () => {
    expect(UPDATE_POLL_MIN).toBe(30);
    const { update } = watched();
    expect(update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(POLL_MS - 1);
    expect(update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(3 * POLL_MS);
    expect(update).toHaveBeenCalledTimes(5);
  });

  it('never checks while hidden, and holds no timer', () => {
    const { update, setHidden } = watched();
    setHidden(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10 * POLL_MS);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('checks once per change to visible, and counts the 30 min from there', () => {
    const { update, setHidden } = watched();
    for (const expected of [2, 3, 4]) {
      vi.advanceTimersByTime(10 * MINUTE_MS + 123);
      setHidden(true);
      setHidden(false);
      expect(update).toHaveBeenCalledTimes(expected);
      expect(vi.getTimerCount()).toBe(1);
    }
    vi.advanceTimersByTime(POLL_MS - 1);
    expect(update).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(5);
  });

  it('checks on a load in the background, then waits to be seen', () => {
    const { update, setHidden } = watched({ hidden: true });
    expect(update).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2 * POLL_MS);
    expect(update).toHaveBeenCalledTimes(1);
    setHidden(false);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('goes by the clock when the machine slept through the timer', () => {
    const { update } = watched();
    vi.setSystemTime(2 * POLL_MS); // the clock moves, the timers do not
    vi.advanceTimersByTime(MINUTE_MS);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('keeps looking after a check that failed', async () => {
    const { update } = watched({ fails: true });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('stops when told', () => {
    const { update, stop, setHidden } = watched();
    stop();
    expect(vi.getTimerCount()).toBe(0);
    setHidden(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
