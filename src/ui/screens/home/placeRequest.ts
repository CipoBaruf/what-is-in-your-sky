import { useSyncExternalStore } from 'react';

/**
 * R215 (FR-LAND-4, D-1238): `set your place` and the header's `change`, wherever they stand, open the place dialog
 * (`PlaceDialog`, mounted once by `AppRoot`). The open flag is this module's: a tiny store, so a caller needs no prop.
 */
let open = false;
const listeners = new Set<() => void>();

const set = (next: boolean): void => {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
};

/** Opens the place dialog over the page. */
export function requestPlace(): void {
  set(true);
}

/** Closes it: a place was set, or the reader left it. */
export function closePlaceRequest(): void {
  set(false);
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether the place dialog is up. */
export function usePlaceRequested(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
