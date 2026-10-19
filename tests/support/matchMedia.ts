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
  /** Move both sides of the viewport (the dome ladder asks the height too). */
  setSize: (widthPx: number, heightPx: number) => void;
  /** R74 (FR-MARK-5): answer `(prefers-reduced-motion: reduce)` the way a reader who asked for less motion would. */
  setReducedMotion: (on: boolean) => void;
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

/**
 * `(min-width: 960px)` (`useLayoutMode`), since R61 `(min-width: …px) and (min-height: …px)` — the dome
 * ladder's queries (`useDomeStep`, D-314) — since R63 `(orientation: landscape)`, the follow screen's
 * (D-323), which is the stubbed size read the way CSS reads it: landscape unless it is taller than it is wide,
 * and since R74 `(prefers-reduced-motion: reduce)`, which the mark asks (FR-MARK-5) and which is a
 * preference rather than a size, so it is answered from the stub's own switch. Nothing else: a query with
 * none of the four is a mistake, not a match.
 */
function evaluate(query: string, widthPx: number, heightPx: number, reducedMotion: boolean): boolean {
  // R103 (FR-DS-3, D-702): the app's own queries are range syntax — `(width >= 964px)`, `(height <= 500px)` —
  // read the way CSS reads them; the `min-`/`max-` forms stay understood for the tests that still write them.
  const sizes = [...query.matchAll(/\((?:(min|max)-)?(width|height)\s*(?::|(<=|>=|<|>))\s*(\d+(?:\.\d+)?)px\)/g)].map((m) => {
    const feature = m[2] === 'width' ? widthPx : heightPx;
    const comparator = m[3] ?? (m[1] === 'min' ? '>=' : m[1] === 'max' ? '<=' : null);
    const value = Number(m[4]);
    if (comparator === null) throw new Error(`the matchMedia stub cannot read "${query}"`);
    return comparator === '>=' ? feature >= value : comparator === '<=' ? feature <= value : comparator === '<' ? feature < value : feature > value;
  });
  const orientation = /orientation:\s*(landscape|portrait)/.exec(query);
  const motion = /prefers-reduced-motion:\s*(reduce|no-preference)/.exec(query);
  if (sizes.length === 0 && !orientation && !motion) throw new Error(`the matchMedia stub only understands width, height, orientation and prefers-reduced-motion queries, not "${query}"`);
  const landscape = widthPx >= heightPx;
  return sizes.every(Boolean) && (!orientation || (orientation[1] === 'landscape') === landscape) && (!motion || (motion[1] === 'reduce') === reducedMotion);
}

export function stubMatchMedia(widthPx: number, heightPx = DEFAULT_HEIGHT_PX): MatchMediaStub {
  const real = window.matchMedia as typeof window.matchMedia | undefined;
  const registered: Registered[] = [];
  let width = widthPx;
  let height = heightPx;
  let reducedMotion = false;

  const matchMedia = (query: string): MediaQueryList => {
    const handlers = new Set<(event: MediaQueryListEvent) => void>();
    const list = {
      media: query,
      get matches() {
        return evaluate(query, width, height, reducedMotion);
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
    registered.push({ query, matched: evaluate(query, width, height, reducedMotion), handlers });
    return list;
  };

  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });

  const moved = (): void => {
    for (const entry of registered) {
      const matched = evaluate(entry.query, width, height, reducedMotion);
      if (matched === entry.matched) continue;
      entry.matched = matched;
      for (const handler of entry.handlers) handler({ matches: matched, media: entry.query } as MediaQueryListEvent);
    }
  };

  return {
    setWidth: (px: number) => {
      width = px;
      moved();
    },
    setSize: (widthPx: number, heightPx: number) => {
      width = widthPx;
      height = heightPx;
      moved();
    },
    setReducedMotion: (on: boolean) => {
      reducedMotion = on;
      moved();
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
/** The height a width-only stub stands at: the 1280 × 800 desktop capture's, which is step 1 of the dome ladder. */
const DEFAULT_HEIGHT_PX = 800;
