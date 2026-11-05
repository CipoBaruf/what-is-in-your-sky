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
export type ShortcutId = 'next' | 'previous' | 'open' | 'close' | 'live' | 'stars' | 'view' | 'theme' | 'help' | SkyShortcutId;

/**
 * R189 (FR-WIDE-9, D-1102): the desk sky pages' keys — `g` `w` `d` choose the view, `,` `.` step the hour, `t` is now,
 * `Space` plays, `a` faces the pass (FR-SKY-13's key, moved from `f`), `f` is full screen (FR-WIDE-10). They run where
 * a `SkyViewLayout` in its wide form is mounted (`skyShortcuts`); the app's own listener has no action for them.
 */
type SkyShortcutId ='globe' | 'window' | 'dome' | 'back' | 'ahead' | 'now' | 'play' | 'face' | 'full';

/** The ids the app's listener runs (`App.tsx`): every row but the sky pages'. */
export type AppShortcutId = Exclude<ShortcutId, SkyShortcutId>;

export interface Shortcut {
  id: ShortcutId;
  /** The `KeyboardEvent.key` values that run it. */
  keys: readonly string[];
  /** How the overlay prints the key. Not translated: it is what is written on the keyboard. */
  label: string;
  /** R189: the overlay's group that prints it — the app's keys, or the desk sky pages' (FR-WIDE-9). */
  group: 'app' | 'sky';
}

/**
 * FR-DESK-4's list, then FR-WIDE-9's, in the order they read in the overlay. Every key is a single character or a
 * named key with no modifier, and none of them is a browser or screen-reader default: the letters and `,` `.` `?` are
 * plain characters, `Enter` and `Escape` only act on what the app itself is showing, and `Space` declines a focused
 * control (`activatesOnSpace`), whose press stays the browser's. No key appears twice (`shortcuts.test.ts`).
 */
export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'next', keys: ['j'], label: 'j', group: 'app' },
  { id: 'previous', keys: ['k'], label: 'k', group: 'app' },
  { id: 'open', keys: ['Enter'], label: 'Enter', group: 'app' },
  { id: 'close', keys: ['Escape'], label: 'Esc', group: 'app' },
  { id: 'live', keys: ['l'], label: 'l', group: 'app' },
  // R115 (FR-DESK-4 as amended v2.4, V24-1): a plain letter, as `l` is.
  { id: 'stars', keys: ['s'], label: 's', group: 'app' },
  { id: 'view', keys: ['v'], label: 'v', group: 'app' },
  { id: 'theme', keys: ['n'], label: 'n', group: 'app' },
  { id: 'help', keys: ['?'], label: '?', group: 'app' },
  // R189 (FR-WIDE-9, D-1102): the desk sky pages' keys.
  { id: 'globe', keys: ['g'], label: 'g', group: 'sky' },
  { id: 'window', keys: ['w'], label: 'w', group: 'sky' },
  { id: 'dome', keys: ['d'], label: 'd', group: 'sky' },
  { id: 'back', keys: [','], label: ',', group: 'sky' },
  { id: 'ahead', keys: ['.'], label: '.', group: 'sky' },
  { id: 'now', keys: ['t'], label: 't', group: 'sky' },
  { id: 'play', keys: [' '], label: 'Space', group: 'sky' },
  /*
   * R127 (FR-SKY-13; D-797) → R189 (FR-WIDE-9 amends it): `a`, on the live page with the window in the box — `SkyWindow`
   * listens for it there, through `shortcutFor`'s one guard, since the window holds the camera and the pass it follows.
   */
  { id: 'face', keys: ['a'], label: 'a', group: 'sky' },
  { id: 'full', keys: ['f'], label: 'f', group: 'sky' },
];

/** R115 (FR-STAR-4) → R189 (FR-WIDE-9): the focused box's own keys, as the overlay names them. */
export type PageKeyId = 'starsTurn' | 'starsTilt' | 'boxZoom' | 'boxReset';

/**
 * R115 (FR-STAR-4, FR-DESK-4 as amended v2.4): the box's keys — `←` `→` `↑` `↓`; R189 (FR-WIDE-9) adds the zoom's
 * `+` `-` (FR-SKY-14, FR-GLOBE-6) and the reset's `0` / `Home`. They are printed by the overlay and run by nothing
 * here: the drawing's box handles them itself while it has the focus (`SkyWindow`, `SkyGlobe`), because an arrow key
 * anywhere else is the browser's scroll and the toggle groups' own move. Their descriptions are `t.stars.keys`.
 */
export const PAGE_KEYS: readonly { id: PageKeyId; label: string }[] = [
  { id: 'starsTurn', label: '← →' },
  { id: 'starsTilt', label: '↑ ↓' },
  { id: 'boxZoom', label: '+ −' },
  { id: 'boxReset', label: '0 Home' },
];

/**
 * The rows a listener runs; `installShortcuts` calls the one for an accepted key press where the listener has it.
 * Each returns whether it did anything, and that is what decides `preventDefault`: `Enter` on a focused button must
 * stay the browser's own click, so a shortcut that declines the press has to leave the event alone.
 */
export type ShortcutActions = Partial<Record<ShortcutId, () => boolean>>;

/** The views the desk's `g` `w` `d` choose (FR-WIDE-2's row). */
export type DeskView = 'globe' | 'window' | 'dome';

/**
 * R189 (FR-WIDE-9, D-1102, D-1126): what a desk sky page does for its keys — one object each page builds and hands
 * its layout (`SkyViewLayout`'s `keys`), whose listener runs it. Each returns whether it did anything. Facing the
 * pass is the window's own listener (the `face` row), and full screen is the layout's own state (D-1103).
 */
export interface SkyKeyActions {
  setView: (view: DeskView) => boolean;
  stepHour: (direction: 1 | -1) => boolean;
  toNow: () => boolean;
  togglePlay: () => boolean;
}

/** What `Space` presses by itself: a focused control the browser activates on it (FR-WIDE-9's "as the browser does"). */
export function activatesOnSpace(target: Element | null): boolean {
  if (target === null) return false;
  return target.closest('button, summary, a[href], [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="option"], [role="tab"], [role="menuitem"]') !== null;
}

/** R189 (D-1102): a page's sky actions and the layout's full screen, as rows of the table. */
export function skyShortcuts(sky: SkyKeyActions, fullscreen: () => boolean, focused: () => Element | null): ShortcutActions {
  return {
    globe: () => sky.setView('globe'),
    window: () => sky.setView('window'),
    dome: () => sky.setView('dome'),
    back: () => sky.stepHour(-1),
    ahead: () => sky.stepHour(1),
    now: () => sky.toNow(),
    play: () => !activatesOnSpace(focused()) && sky.togglePlay(),
    full: fullscreen,
  };
}

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
    if (actions()[shortcut.id]?.() === true) event.preventDefault();
  };
  target.addEventListener('keydown', onKeyDown);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
  };
}
