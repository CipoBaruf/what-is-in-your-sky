/**
 * R23 (PLAN §9.1, "Layout — `matchMedia` stubbed"). jsdom parses a media
 * query but never evaluates one: `matches` is always false, so every UI test
 * is in the compact layout unless it says otherwise. This installs a
 * `matchMedia` that answers a width you choose and dispatches the `change`
 * event when you move it, which is the only thing `useLayoutMode` listens to.
 */
export interface MatchMediaStub {
  /** Move the viewport; every listener on an affected query gets a `change`. */
  setWidth: (px: number) => void;
  /** Put the real `matchMedia` back. */
  restore: () => void;
  /** Live listener count, so a test can prove the hook detaches on unmount. */
  listeners: () => number;
}

interface Registered {
  query: string;
  matched: boolean;
  handlers: Set<(event: MediaQueryListEvent) => void>;
}

/** `(min-width: 960px)` and nothing else: it is the only query the app writes. */
function evaluate(query: string, widthPx: number): boolean {
  const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
  if (!min) throw new Error(`the matchMedia stub only understands min-width queries, not "${query}"`);
  return widthPx >= Number(min[1]);
}

export function stubMatchMedia(widthPx: number): MatchMediaStub {
  const real = window.matchMedia as typeof window.matchMedia | undefined;
  const registered: Registered[] = [];
  let width = widthPx;

  const matchMedia = (query: string): MediaQueryList => {
    const handlers = new Set<(event: MediaQueryListEvent) => void>();
    const list = {
      media: query,
      get matches() {
        return evaluate(query, width);
      },
      addEventListener: (type: string, handler: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') handlers.add(handler);
      },
      removeEventListener: (type: string, handler: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') handlers.delete(handler);
      },
      addListener: (handler: (event: MediaQueryListEvent) => void) => handlers.add(handler),
      removeListener: (handler: (event: MediaQueryListEvent) => void) => handlers.delete(handler),
      dispatchEvent: () => true,
      onchange: null,
    } as unknown as MediaQueryList;
    registered.push({ query, matched: evaluate(query, width), handlers });
    return list;
  };

  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });

  return {
    setWidth: (px: number) => {
      width = px;
      for (const entry of registered) {
        const matched = evaluate(entry.query, width);
        if (matched === entry.matched) continue;
        entry.matched = matched;
        for (const handler of entry.handlers) handler({ matches: matched, media: entry.query } as MediaQueryListEvent);
      }
    },
    restore: () => {
      if (real) Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: real });
      else delete (window as Partial<Window>).matchMedia;
    },
    listeners: () => registered.reduce((total, entry) => total + entry.handlers.size, 0),
  };
}

/** The two widths every capture and every layout test uses (FR-DESK-5). */
export const WIDE_PX = 1280;
export const COMPACT_PX = 390;
