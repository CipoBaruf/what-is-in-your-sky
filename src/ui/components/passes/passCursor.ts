/**
 * R35 (FR-DESK-4, US-14 AC4): where `j` and `k` move, and what `Enter` opens.
 *
 * The cursor is DOM focus on a card, not a second selection in React state.
 * The list already decides which cards exist and in what order — the hero card
 * first, then each night's own sorted cards, with a closed night's cards
 * present but not on offer — and reading that order back off the page is the
 * only way to move through it without copying the hero split, the sort and the
 * per-night disclosure state out of `PassList`. Focus also does the work a
 * private cursor would not: the screen reader announces the card, the browser
 * scrolls it into view, and `:focus-visible` draws the ring the rest of the
 * app already uses (FR-X-5).
 *
 * `[data-pass-card]` and not `[data-pass-id]`: the open guide — the compact
 * sheet and the wide panel both — carries the pass id too, and the cursor must
 * not land on it.
 */
export const PASS_CARD = '[data-pass-card]';

/**
 * The cards the reader can actually move to, in the order the page shows them.
 * A card inside a closed `<details>` is in the DOM but not on the page, so
 * `j` skips the nights that are folded up rather than walking into them
 * invisibly.
 */
export function cursorCards(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(PASS_CARD)].filter((card) => card.closest('details:not([open])') === null);
}

/** The card the cursor is on: whatever holds focus, or — when focus has moved into the guide — the open pass's card. */
export function cursorCard(root: Document): HTMLElement | null {
  const focused = root.activeElement instanceof HTMLElement ? root.activeElement.closest<HTMLElement>(PASS_CARD) : null;
  return focused ?? root.querySelector<HTMLElement>(`${PASS_CARD}[data-selected]`);
}

/**
 * Moves the cursor one card down (`1`) or up (`-1`) and returns the card it
 * landed on, or `null` when there is no list to move in. Both ends stop rather
 * than wrap: a list of three nights is long, and silently jumping from the last
 * pass back to the hero card reads as nothing having happened.
 *
 * With no cursor yet, `j` starts at the first card and `k` at the last, so the
 * first press always lands somewhere.
 */
export function moveCursor(root: Document, delta: 1 | -1): HTMLElement | null {
  const cards = cursorCards(root);
  if (cards.length === 0) return null;
  const current = cursorCard(root);
  const index = current === null ? -1 : cards.indexOf(current);
  const next = index === -1 ? (delta === 1 ? cards[0] : cards[cards.length - 1]) : cards[Math.min(Math.max(index + delta, 0), cards.length - 1)];
  if (!next) return null;
  next.focus();
  next.scrollIntoView?.({ block: 'nearest' });
  return next;
}

/**
 * The pass `Enter` opens: the card that *has* focus, not the card focus is
 * merely inside. Enter on the card's own "Open guide" button, or on any other
 * control in it, is the browser's click and must stay that way (D-73).
 */
export function passIdAtCursor(root: Document): string | null {
  const focused = root.activeElement;
  if (!(focused instanceof HTMLElement) || !focused.matches(PASS_CARD)) return null;
  return focused.dataset.passId ?? null;
}
