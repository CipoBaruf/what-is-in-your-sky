/**
 * R224 (FR-CTRL-13, US-65 AC5): an action inside a line of text is drawn as a link — its own `<button>` or `<a>`, the
 * accent underlined with no box and no brackets, and the `--tap` hit area of `inline-control` (an `<a>` has it from
 * global.css's `a` rule). The look itself is held by `TextButton.test.tsx`; this says which form a control took.
 */
import { expect } from 'vitest';

export function expectInlineLink(control: HTMLElement): void {
  expect(['BUTTON', 'A']).toContain(control.tagName);
  expect(control.textContent).not.toMatch(/[[\]]/);
  if (control.tagName === 'A') return;
  expect(control.className).toMatch(/inline-control/);
  expect(control.className).toMatch(/\blink\b|_link_/);
  expect(control.children, 'no box inside').toHaveLength(0);
}
