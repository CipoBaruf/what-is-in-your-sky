// @vitest-environment jsdom
/**
 * R35 (FR-DESK-4, D-73): the guard, one test per ignored case, and the single
 * listener's dispatch. What the actions themselves do is `App.shortcuts.test.tsx`;
 * that the overlay lists exactly this table is `ShortcutsOverlay.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHORTCUTS, activatesOnSpace, installShortcuts, isTypingTarget, shortcutFor, skyShortcuts, type ShortcutActions, type ShortcutId } from './shortcuts';

function press(key: string, extra: Partial<KeyboardEventInit> & { target?: EventTarget | null } = {}) {
  return { key, altKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...extra };
}

function spyActions(): ShortcutActions & { calls: ShortcutId[] } {
  const calls: ShortcutId[] = [];
  const actions = Object.fromEntries(
    SHORTCUTS.map((shortcut) => [
      shortcut.id,
      () => {
        calls.push(shortcut.id);
        return true;
      },
    ]),
  ) as ShortcutActions;
  return Object.assign(actions, { calls });
}

describe('the shortcut table', () => {
  it("holds FR-DESK-4's keys, then FR-WIDE-9's: g w d , . t Space a f (R189)", () => {
    expect(SHORTCUTS.map((shortcut) => shortcut.keys.join('/'))).toEqual(['j', 'k', 'Enter', 'Escape', 'l', 's', 'v', 'n', '?', 'g', 'w', 'd', ',', '.', 't', ' ', 'a', 'f']);
    expect(SHORTCUTS.filter((shortcut) => shortcut.group === 'sky').map((shortcut) => shortcut.id)).toEqual(['globe', 'window', 'dome', 'back', 'ahead', 'now', 'play', 'face', 'full']);
    // FR-WIDE-9 amends FR-SKY-13: `a` faces the pass, `f` is full screen.
    expect(shortcutFor(press('a'))?.id).toBe('face');
    expect(shortcutFor(press('f'))?.id).toBe('full');
    expect(SHORTCUTS.find((shortcut) => shortcut.id === 'play')?.label).toBe('Space');
  });

  it('FR-WIDE-9: no two entries of the key table share a key, and every shortcut has a distinct id', () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
    const keys = SHORTCUTS.flatMap((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('claims no key that needs a modifier', () => {
    // FR-DESK-4: single keys only, so nothing here can collide with a browser
    // accelerator, which is always modifier + key.
    for (const shortcut of SHORTCUTS) for (const key of shortcut.keys) expect(key).not.toMatch(/^(Alt|Control|Meta|Shift)/);
  });
});

describe('the guard (FR-DESK-4, D-73)', () => {
  it('matches a plain key press', () => {
    expect(shortcutFor(press('j'))?.id).toBe('next');
  });

  it('ignores a key that is not registered', () => {
    expect(shortcutFor(press('q'))).toBeNull();
  });

  it.each(['altKey', 'ctrlKey', 'metaKey'] as const)('ignores the press when %s is held', (modifier) => {
    expect(shortcutFor(press('j', { [modifier]: true }))).toBeNull();
  });

  it('ignores the press during an IME composition', () => {
    expect(shortcutFor(press('j', { isComposing: true }))).toBeNull();
  });

  it.each(['input', 'textarea', 'select'])('ignores the press while a <%s> has focus', (tag) => {
    const target = document.createElement(tag);
    expect(shortcutFor(press('j', { target }))).toBeNull();
    expect(isTypingTarget(target)).toBe(true);
  });

  it('ignores the press inside a [contenteditable]', () => {
    const host = document.createElement('div');
    host.setAttribute('contenteditable', '');
    const inner = document.createElement('span');
    host.append(inner);
    expect(shortcutFor(press('j', { target: inner }))).toBeNull();
  });

  it('does not treat contenteditable="false" as a typing target', () => {
    const target = document.createElement('div');
    target.setAttribute('contenteditable', 'false');
    expect(isTypingTarget(target)).toBe(false);
    expect(shortcutFor(press('j', { target }))?.id).toBe('next');
  });

  it('does not treat a button or the document as a typing target: the cursor lands on a card and j must still work', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  // Shift is what produces `?` on most layouts, so it cannot be part of the modifier guard.
  it('accepts ? even though it is typed with Shift', () => {
    expect(shortcutFor(press('?', { shiftKey: true }))?.id).toBe('help');
  });
});

describe('the one listener', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('runs the action for the key and reads the actions afresh on every press', () => {
    const first = spyActions();
    const second = spyActions();
    let current = first;
    const remove = installShortcuts(document, () => current);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    current = second;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    remove();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));

    expect(first.calls).toEqual(['next']);
    expect(second.calls).toEqual(['view']);
  });

  it('prevents the default only when the action did something', () => {
    const actions = { ...spyActions(), open: () => false };
    installShortcuts(document, () => actions);

    const handled = new KeyboardEvent('keydown', { key: 'j', cancelable: true });
    const declined = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    document.dispatchEvent(handled);
    document.dispatchEvent(declined);

    expect(handled.defaultPrevented).toBe(true);
    // A focused button's Enter is the browser's click; declining must not swallow it.
    expect(declined.defaultPrevented).toBe(false);
  });

  it('leaves an unregistered key alone', () => {
    const actions = spyActions();
    installShortcuts(document, () => actions);
    const event = new KeyboardEvent('keydown', { key: 'q', cancelable: true });
    document.dispatchEvent(event);
    expect(actions.calls).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a key alone where the listener has no row for it (R189: the app has no sky rows, a layout no app rows)', () => {
    const play = vi.fn(() => true);
    const target = new EventTarget();
    const remove = installShortcuts(target, () => ({ play }));
    const event = new KeyboardEvent('keydown', { key: 'j', cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(play).toHaveBeenCalledOnce();
    remove();
  });

  it('removes itself', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const remove = installShortcuts(target, spyActions);
    expect(target.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    remove();
    expect(target.removeEventListener).toHaveBeenCalledWith('keydown', (target.addEventListener.mock.calls[0] as unknown[])[1]);
  });
});

describe('FR-WIDE-9: the sky rows (D-1102)', () => {
  const sky = () => ({ setView: vi.fn(() => true), stepHour: vi.fn(() => true), toNow: vi.fn(() => true), togglePlay: vi.fn(() => true) });

  it('maps g w d , . t Space f onto the page actions and the layout full screen', () => {
    const actions = sky();
    const full = vi.fn(() => true);
    const rows = skyShortcuts(actions, full, () => null);
    for (const id of ['globe', 'window', 'dome', 'back', 'ahead', 'now', 'play', 'full'] as const) expect(rows[id]?.()).toBe(true);
    expect(actions.setView.mock.calls).toEqual([['globe'], ['window'], ['dome']]);
    expect(actions.stepHour.mock.calls).toEqual([[-1], [1]]);
    expect(actions.toNow).toHaveBeenCalledOnce();
    expect(actions.togglePlay).toHaveBeenCalledOnce();
    expect(full).toHaveBeenCalledOnce();
    // `a` is the window's own listener.
    expect(rows.face).toBeUndefined();
  });

  it('Space with a button focused is the button press, as the browser does', () => {
    const actions = sky();
    const button = document.createElement('button');
    expect(skyShortcuts(actions, () => false, () => button).play?.()).toBe(false);
    expect(actions.togglePlay).not.toHaveBeenCalled();
    expect(activatesOnSpace(document.createElement('div'))).toBe(false);
    const option = document.createElement('div');
    option.setAttribute('role', 'radio');
    expect(activatesOnSpace(option)).toBe(true);
  });
});
