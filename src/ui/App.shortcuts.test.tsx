/**
 * R35 (FR-DESK-4, US-14 AC4, D-73): every row of the shortcut table driven
 * against the real screen — the cursor down and up the list, `Enter` opening
 * the pass it is on, `Esc` taking the overlay before the guide, `l`, `v`, `n`
 * and `?`. The guard's own cases are `lib/shortcuts.test.ts`; that the overlay
 * lists exactly the table is `ShortcutsOverlay.test.tsx`. What is here is the
 * wiring between them, including the two things only this level can show: that
 * the keys do nothing while the location field has focus, and that they are
 * not installed at all on the live page.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../tests/support/matchMedia';
import { en } from '../i18n/en';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };
const panelName = en.guide.panelLabel({ name: pass.name });

let media: MatchMediaStub;

const withPasses = (): void => {
  act(() => {
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass, other], hasDarkness: true } });
  });
};

/** Whatever the cursor is on, by the pass id its card carries. */
const cursor = (): string | null => (document.activeElement as HTMLElement | null)?.dataset.passId ?? null;

describe('<App> keyboard shortcuts (FR-DESK-4)', () => {
  beforeEach(() => {
    media = stubMatchMedia(WIDE_PX);
  });
  afterEach(() => {
    media.restore();
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('moves the cursor down with j and up with k, over the hero card and then the list', async () => {
    withPasses();
    render(<App />);
    // The hero card holds the ISS pass; the other object is the one card in the list.
    await userEvent.keyboard('j');
    expect(cursor()).toBe(pass.id);
    await userEvent.keyboard('j');
    expect(cursor()).toBe(other.id);
    // The end of the list stops rather than wrapping.
    await userEvent.keyboard('j');
    expect(cursor()).toBe(other.id);
    await userEvent.keyboard('k');
    expect(cursor()).toBe(pass.id);
    await userEvent.keyboard('k');
    expect(cursor()).toBe(pass.id);
  });

  it('opens the pass the cursor is on with Enter, and closes it with Esc', async () => {
    withPasses();
    render(<App />);
    await userEvent.keyboard('jj{Enter}');
    expect(screen.getByRole('region', { name: en.guide.panelLabel({ name: other.name }) })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#pass=${other.id}`);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: en.guide.panelLabel({ name: other.name }) })).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('keeps moving from the open pass once focus has gone into the guide (FR-DESK-3)', async () => {
    withPasses();
    render(<App />);
    await userEvent.keyboard('j{Enter}');
    expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument();
    // The guide took focus; j picks up from the card of the pass it is showing.
    await userEvent.keyboard('j');
    expect(cursor()).toBe(other.id);
  });

  it('does nothing on Enter when the cursor is not on a card, so a focused button keeps its own click (D-73)', async () => {
    withPasses();
    render(<App />);
    const openGuide = screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement;
    openGuide.focus();
    await userEvent.keyboard('{Enter}');
    // The browser's activation of the focused button, not the shortcut: the same pass either way, so what is asserted is that the press was not swallowed.
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
  });

  it('opens the live page with l', async () => {
    withPasses();
    render(<App />);
    await userEvent.keyboard('l');
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(window.location.hash).toBe('#live');
    expect(screen.queryByRole('region', { name: 'Upcoming passes' })).toBeNull();
  });

  it('toggles the chart view with v and the palette with n, both persisted through the store', async () => {
    withPasses();
    render(<App />);
    expect(appStore.getState().chartView).toBe('dome');
    await userEvent.keyboard('v');
    expect(appStore.getState().chartView).toBe('polar');
    await userEvent.keyboard('v');
    expect(appStore.getState().chartView).toBe('dome');

    expect(appStore.getState().theme).toBe('dark');
    await userEvent.keyboard('n');
    expect(appStore.getState().theme).toBe('night');
    await userEvent.keyboard('n');
    expect(appStore.getState().theme).toBe('dark');
  });

  it('opens the overlay with ?, makes the page behind it inert, and closes it with Esc', async () => {
    withPasses();
    render(<App />);
    await userEvent.keyboard('?');
    const overlay = screen.getByRole('dialog', { name: en.shortcuts.title });
    expect(within(overlay).getAllByRole('row')).toHaveLength(8 + 1); // the eight shortcuts and the header row
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role, { hidden: true })).toHaveAttribute('inert');

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: en.shortcuts.title })).toBeNull();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
  });

  it('closes the overlay before the guide when both are up', async () => {
    withPasses();
    render(<App />);
    await userEvent.keyboard('j{Enter}?');
    expect(screen.getByRole('dialog', { name: en.shortcuts.title })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: en.shortcuts.title })).toBeNull();
    // The guide is still open: one Esc, one thing closed.
    expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#pass=${pass.id}`);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: panelName })).toBeNull();
  });

  it('fires nothing while the location field has focus: the letters are typed (FR-DESK-4)', async () => {
    withPasses();
    render(<App />);
    const field = screen.getByLabelText(en.location.placeLabel);
    await userEvent.click(field);
    await userEvent.keyboard('jknvl');

    expect(field).toHaveValue('jknvl');
    expect(appStore.getState().chartView).toBe('dome');
    expect(appStore.getState().theme).toBe('dark');
    expect(window.location.hash).toBe('');
    expect(screen.queryByRole('dialog', { name: en.shortcuts.title })).toBeNull();
  });

  it('is not installed on the live page, which has its own keys (R32)', async () => {
    withPasses();
    window.history.replaceState(null, '', '#live');
    render(<App />);
    await userEvent.keyboard('n');
    expect(appStore.getState().theme).toBe('dark');
    expect(screen.queryByRole('dialog', { name: en.shortcuts.title })).toBeNull();
  });

  /**
   * R50 (F-44). `j` and `k` under the overlay used to be claimed and then not
   * acted on: the cards are still in the DOM, `moveCursor` walked to one and
   * called `focus()` on it, `inert` made that do nothing, and the press was
   * `preventDefault`ed all the same — so the key moved no cursor and did not
   * scroll the overlay either. jsdom has no `inert`, so what stands in for it
   * is the same thing it does: the cards cannot take focus.
   */
  it('leaves j and k to the browser under the overlay, rather than claiming a move that cannot happen (F-44)', async () => {
    withPasses();
    render(<App />);
    await userEvent.keyboard('j');
    expect(cursor()).toBe(pass.id);

    await userEvent.keyboard('?');
    for (const card of screen.getAllByRole('article', { hidden: true })) card.focus = () => undefined;
    const pressed = new KeyboardEvent('keydown', { key: 'j', cancelable: true, bubbles: true });
    document.dispatchEvent(pressed);
    expect(pressed.defaultPrevented).toBe(false);
  });
});

/**
 * R50 (F-45): the compact sheet is portaled to the body (D-117), which is what
 * lets the page behind it be inert while it is not — and is why the `inert`
 * `App` puts on the header, the main and the footer misses it entirely. With
 * the shortcuts overlay up, the sheet is behind it like everything else and
 * its back control, its switches and its share button were all still live.
 */
describe('<App> the shortcuts overlay over the compact sheet (F-45)', () => {
  beforeEach(() => {
    media = stubMatchMedia(COMPACT_PX);
  });
  afterEach(() => {
    media.restore();
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('makes the sheet inert as well, and gives it back when the overlay closes', async () => {
    withPasses();
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    const sheet = screen.getByRole('dialog', { name: pass.name });
    expect(sheet).not.toHaveAttribute('inert');

    await userEvent.keyboard('?');
    expect(screen.getByRole('dialog', { name: en.shortcuts.title })).toBeInTheDocument();
    expect(sheet).toHaveAttribute('inert');
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role, { hidden: true })).toHaveAttribute('inert');

    // One Esc, one thing closed: the overlay goes and the sheet is the reader's again.
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: en.shortcuts.title })).toBeNull();
    expect(sheet).not.toHaveAttribute('inert');
  });
});
