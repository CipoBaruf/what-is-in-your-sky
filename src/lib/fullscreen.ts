/**
 * R189 (FR-WIDE-10, D-1103): the browser's Fullscreen API behind three functions, so the layout holds no vendor detail
 * and the e2e spec can stub the one call a headless browser may refuse. No React here (D-116). What it cannot do: a
 * prefixed API (`webkitRequestFullscreen`, older Safari) counts as missing, and the control is then absent.
 */

/** Whether the page may put an element in full screen: the document allows it and elements have the call. */
export function fullscreenSupported(doc: Document = document): boolean {
  return doc.fullscreenEnabled && typeof doc.documentElement.requestFullscreen === 'function';
}

/** Asks for `element` in full screen; resolves to whether the browser granted it (a refusal changes nothing). */
export async function enterFullscreen(element: Element): Promise<boolean> {
  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

/** Leaves full screen where the page is in it; nothing otherwise. */
export async function exitFullscreen(doc: Document = document): Promise<void> {
  if (doc.fullscreenElement === null) return;
  try {
    await doc.exitFullscreen();
  } catch {
    // Already left (the browser's own `Esc` raced the call): nothing to undo.
  }
}

/** The element in full screen, for the layout's `fullscreenchange` listener. */
export function fullscreenElement(doc: Document = document): Element | null {
  return doc.fullscreenElement;
}
