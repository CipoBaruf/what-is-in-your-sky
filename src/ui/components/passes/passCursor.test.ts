/**
 * R35 (FR-DESK-4): the cursor `j` and `k` move, over a page built by hand so
 * the cases the real list only reaches sometimes — a folded night, focus in
 * the guide, focus on a button inside a card — are all here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cursorCards, cursorCard, moveCursor, passIdAtCursor } from './passCursor';

function page(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

const card = (id: string, attrs = '') => `<article data-pass-id="${id}" data-pass-card tabindex="-1" ${attrs}><button type="button">Open guide</button></article>`;
const ids = (elements: HTMLElement[]) => elements.map((element) => element.dataset.passId);
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.passId ?? null;

describe('the pass cursor (FR-DESK-4)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('walks the cards in the order the page shows them, hero card first', () => {
    const root = page(`${card('hero')}<ol><li>${card('a')}</li><li>${card('b')}</li></ol>`);
    expect(ids(cursorCards(root))).toEqual(['hero', 'a', 'b']);
  });

  it('skips a night that is folded up and takes one that is open (US-16 AC5)', () => {
    const root = page(`${card('hero')}<details open><summary>Tonight</summary>${card('a')}</details><details><summary>Tomorrow</summary>${card('b')}</details>`);
    expect(ids(cursorCards(root))).toEqual(['hero', 'a']);
  });

  it('never lands on the open guide, which carries the same pass id', () => {
    const root = page(`${card('a')}<section data-pass-id="a" data-testid="guide-panel"><h2>ISS</h2></section>`);
    expect(ids(cursorCards(root))).toEqual(['a']);
  });

  it('starts at the first card with j and the last with k', () => {
    page(`${card('a')}${card('b')}${card('c')}`);
    expect(moveCursor(document, 1)?.dataset.passId).toBe('a');
    document.body.querySelector<HTMLElement>('[data-pass-card]')?.blur();
    expect(moveCursor(document, -1)?.dataset.passId).toBe('c');
  });

  it('moves down and up, and focus is what carries the cursor', () => {
    page(`${card('a')}${card('b')}${card('c')}`);
    moveCursor(document, 1);
    expect(focused()).toBe('a');
    moveCursor(document, 1);
    expect(focused()).toBe('b');
    moveCursor(document, -1);
    expect(focused()).toBe('a');
  });

  it('stops at both ends rather than wrapping', () => {
    page(`${card('a')}${card('b')}`);
    moveCursor(document, -1);
    expect(focused()).toBe('b');
    expect(moveCursor(document, 1)?.dataset.passId).toBe('b');
    moveCursor(document, -1);
    expect(moveCursor(document, -1)?.dataset.passId).toBe('a');
    expect(focused()).toBe('a');
  });

  it('does nothing when there is no list', () => {
    page('<p>No passes yet.</p>');
    expect(moveCursor(document, 1)).toBeNull();
    expect(cursorCard(document)).toBeNull();
  });

  it('picks up from the card inside which something else has focus', () => {
    page(`${card('a')}${card('b')}`);
    document.body.querySelectorAll('button')[0]?.focus();
    expect(cursorCard(document)?.dataset.passId).toBe('a');
    expect(moveCursor(document, 1)?.dataset.passId).toBe('b');
  });

  it('picks up from the open pass when focus has moved into the guide (FR-DESK-3)', () => {
    page(`${card('a')}${card('b', 'data-selected="true"')}${card('c')}<section data-pass-id="b"><h2 tabindex="-1">ISS</h2></section>`);
    document.querySelector<HTMLElement>('section h2')?.focus();
    expect(cursorCard(document)?.dataset.passId).toBe('b');
    expect(moveCursor(document, 1)?.dataset.passId).toBe('c');
  });

  it('opens the card that has focus itself, and leaves a focused button to the browser (D-73)', () => {
    page(`${card('a')}${card('b')}`);
    expect(passIdAtCursor(document)).toBeNull();
    moveCursor(document, 1);
    expect(passIdAtCursor(document)).toBe('a');
    document.body.querySelectorAll('button')[0]?.focus();
    expect(passIdAtCursor(document)).toBeNull();
  });
});
