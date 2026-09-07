import { useEffect, useState, type RefObject } from 'react';

/**
 * R50 (F-43): what opens over the page — the compact guide sheet, the
 * shortcuts overlay — moves focus to its own heading and gives it back to
 * whatever had it when it closes. Both of those had the same bug, and it is
 * in the word "when".
 *
 * The opener used to be read in the mount effect, which runs *after* the
 * commit that put `inert` on the header, the main and the footer. `inert`
 * blurs whatever it contains, so by then `document.activeElement` was the
 * body: `Escape` closed the sheet and left focus at the top of the document,
 * with the pass the reader had been on nowhere near it. The read happens here
 * in the render instead, in a `useState` initialiser — before React touches
 * the DOM at all, while the card the reader pressed `Enter` on still has
 * focus. It is a read of the document during render, which is safe in a way a
 * write would not be: nothing about it depends on how many times React calls
 * the component, because the initialiser runs exactly once.
 *
 * `isConnected` is the other half: a pass card can be gone by the time the
 * guide over it closes — a recompute, a new list — and focusing a detached
 * element puts focus on the body, silently, which is the thing this exists to
 * avoid. When the opener has left, focus stays where the browser put it.
 */
export function useOpenerFocus(headingRef: RefObject<HTMLElement | null>): void {
  const [opener] = useState<HTMLElement | null>(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
    // Both are stable for the life of the instance — a ref and a `useState`
    // value that is never set — so this runs once per instance: crossing the
    // wide breakpoint swaps the shell around the same guide and must not take
    // the reader's focus away from wherever they had put it. A second pass is
    // a second instance (F-8).
  }, [headingRef, opener]);
}
