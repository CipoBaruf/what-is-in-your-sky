/**
 * R35 (FR-DESK-4, US-14 AC4, D-73): every keyboard shortcut in the app, the
 * one guard that decides whether a key press is one, and the one `keydown`
 * listener that runs it.
 *
 * The table below is the only place a shortcut exists. `installShortcuts`
 * dispatches from it and `ui/components/common/ShortcutsOverlay.tsx` prints
 * it, so a shortcut cannot be registered without being documented, nor
 * documented without being registered. The description of each one is a
 * message keyed by its id (`t.shortcuts.does`), which `tsc -b` requires both
 * catalogs to carry (FR-I18N-2) — adding a row here without translating it is
 * a type error, not a missing line in the overlay.
 *
 * The guard is FR-DESK-4's "active when no input has focus", written once:
 * any modifier held, an IME composition in progress, or a target that takes
 * typing (`input`, `textarea`, `select`, `[contenteditable]`) and the event is
 * not ours. FR-DESK-4's prose also says "or button"; D-73 narrowed that to the
 * typing targets, because the shortcuts have to keep working while the cursor
 * sits on a pass card or a toggle — a focused button is exactly where `j`
 * lands the reader. Native activation still wins where it exists: `Enter` on a
 * focused button is the browser's click, and the `open` action only fires when
 * the focused element is a pass card, which nothing activates on its own.
 *
 * No React here (PLAN §3, D-116): the hook that mounts this is
 * `ui/hooks/useShortcuts.ts`.
 */

/** What a shortcut does; also the message key for its description. */
export type ShortcutId = 'next' | 'previous' | 'open' | 'close' | 'live' | 'view' | 'theme' | 'help';

export interface Shortcut {
  id: ShortcutId;
  /** The `KeyboardEvent.key` values that run it. */
  keys: readonly string[];
  /** How the overlay prints the key. Not translated: it is what is written on the keyboard. */
  label: string;
}

/**
 * FR-DESK-4's list, in the order it reads in the overlay. Every key is a
 * single character or a named key with no modifier, and none of them is a
 * browser or screen-reader default: `j`/`k`/`l`/`v`/`n`/`?` are plain letters,
 * and `Enter` and `Escape` only act on what the app itself is showing.
 */
export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'next', keys: ['j'], label: 'j' },
  { id: 'previous', keys: ['k'], label: 'k' },
  { id: 'open', keys: ['Enter'], label: 'Enter' },
  { id: 'close', keys: ['Escape'], label: 'Esc' },
  { id: 'live', keys: ['l'], label: 'l' },
  { id: 'view', keys: ['v'], label: 'v' },
  { id: 'theme', keys: ['n'], label: 'n' },
  { id: 'help', keys: ['?'], label: '?' },
];

/**
 * One function per row of the table; `installShortcuts` calls exactly one of
 * them per accepted key press. Each returns whether it did anything, and that
 * is what decides `preventDefault`: `Enter` on a focused button must stay the
 * browser's own click, so a shortcut that declines the press has to leave the
 * event alone.
 */
export type ShortcutActions = Record<ShortcutId, () => boolean>;

/** The elements a key press belongs to rather than to the app (FR-DESK-4, D-73). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * The shortcut a key press is, or `null` when it is not one — the whole guard
 * in one expression, so no caller can hold half of it.
 */
export function shortcutFor(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'isComposing'> & { target?: EventTarget | null }): Shortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.isComposing) return null;
  if (isTypingTarget(event.target ?? null)) return null;
  return SHORTCUTS.find((shortcut) => shortcut.keys.includes(event.key)) ?? null;
}

/**
 * The one `keydown` listener (D-73). `actions` is read through a getter on
 * every event rather than captured, so the caller's handlers can close over
 * fresh React state without the listener being torn down and rebuilt on every
 * render.
 *
 * The default action is prevented only when the action says it did something,
 * so the keys the app does not claim — and the presses it declines — keep
 * whatever the browser does with them.
 */
export function installShortcuts(target: Pick<Document, 'addEventListener' | 'removeEventListener'>, actions: () => ShortcutActions): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const shortcut = shortcutFor(event);
    if (shortcut === null) return;
    if (actions()[shortcut.id]()) event.preventDefault();
  };
  target.addEventListener('keydown', onKeyDown);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
  };
}
