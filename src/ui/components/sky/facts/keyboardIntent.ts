/**
 * R188 (FR-FACT-2): whether the last press was a key — a group opened by `Enter` moves the focus to its heading, one
 * opened by a click or a tap leaves it where it is. Listened for once, in the capture phase, before any handler runs.
 */
let keyboard = false;
let listening = false;

function listen(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('keydown', () => {
    keyboard = true;
  }, true);
  document.addEventListener('pointerdown', () => {
    keyboard = false;
  }, true);
}

/** Starts listening on first call; answers for the press that is being handled now. */
export function fromKeyboard(): boolean {
  listen();
  return keyboard;
}

/** Called where a page mounts, so the first press is already heard. */
export function listenForKeyboard(): void {
  listen();
}
