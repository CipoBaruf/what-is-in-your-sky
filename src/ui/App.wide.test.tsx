/**
 * R23 (FR-DESK-1/2/3, D-72). The wide layout, with `matchMedia` stubbed
 * (PLAN §9.1): two columns in the order FR-DESK-2 fixes, the guide as a
 * panel beside a list that stays live and marks the open pass, `Esc` and the
 * close control closing it, the hash following the selection — and the same
 * pass still open after the width crosses the breakpoint in either
 * direction, in the other shell.
 *
 * R76 (FR-FIRST-5, D-444): `WIDE_PX` (1280) is a three-pane width now, where an
 * open pass takes the Where and When panes and the list stays in What, so
 * `[ list ]` has nothing to do there. The tests of D-253's swap run at 1024 px,
 * FR-DESK-5's mid width, where the two columns and the swap stand unchanged.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../tests/support/matchMedia';
import { en } from '../i18n/en';
import type { Observer } from '../model';
import { appStore, NIGHT_MS, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer } from './components/common/installOffer';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };
const panelName = en.guide.panelLabel({ name: pass.name });
/** FR-DESK-5's mid width: wide, two columns, under both the three panes and the split. */
const MID_PX = 1024;
/** R81 (FR-FIRST-5 as amended v2.0.2): a populated pane's heading is its plain word, `── Where ──`. */
/** The next ISS pass's card, which carries the tag the hero card was (R81, §8 rank 1 as amended). */
const tagged = (): HTMLElement => screen.getByTestId('next-tag').closest('article') as HTMLElement;
const pane = (step: 'where' | 'when' | 'what'): string => en.home.panes[step];

let media: MatchMediaStub;

const withPasses = (): void => {
  act(() => {
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass, other], hasDarkness: true } });
  });
};

describe('<App> wide (FR-DESK-2, FR-DESK-3)', () => {
  /**
   * F-68: the hero card's choice (`nextFeaturedPass`) reads the wall clock, and
   * the golden passes are dated; from the calendar day their window ends the
   * card never renders and every assertion on `iss-hero` is red, on any branch.
   * So the clock is pinned at `NOW`, the same fix F-67 gave the night labels.
   */
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    media = stubMatchMedia(WIDE_PX);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    media.restore();
    appStore.setState(initial, true);
    forgetInstallOffer();
    localStorage.clear();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('lays the page out in two columns: the Where and When readings on the left, the passes on the right (FR-DESK-2)', async () => {
    media.setWidth(MID_PX);
    withPasses();
    render(<App />);
    const columns = screen.getByRole('main').children;
    expect(columns).toHaveLength(2);
    const [left, right] = [columns[0] as HTMLElement, columns[1] as HTMLElement];
    // R76 (FR-FIRST-5): Where above When in the left column, What at the right.
    const where = within(left).getByRole('region', { name: pane('where') });
    expect(within(left).getByRole('region', { name: pane('when') })).toBeInTheDocument();
    expect(within(right).getByRole('region', { name: pane('what') })).toBeInTheDocument();
    // The location is the Where reading's line, and its form is one `[ change ]` away, in place.
    await userEvent.click(within(where).getByRole('button', { name: en.location.summaryChange }));
    expect(within(where).getByRole('region', { name: 'Location' })).toBeInTheDocument();
    // R81 (FR-FIRST-9): the Now panel's facts are the When reading's table.
    expect(within(within(left).getByRole('region', { name: pane('when') })).getByTestId('conditions')).toBeInTheDocument();
    expect(within(right).getByRole('region', { name: 'Upcoming passes' })).toBeInTheDocument();
    // The header spans both and keeps the title, the tagline and the controls.
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading', { level: 1, name: en.app.title })).toBeInTheDocument();
    expect(header).toHaveTextContent(en.app.tagline);
    for (const control of [en.app.language, en.app.theme]) expect(within(header).getByRole('group', { name: control })).toBeInTheDocument();
  });

  it('opens the guide as a panel beside the list, not over it: the list stays live, the open pass is marked, and the hash follows', async () => {
    withPasses();
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);

    expect(screen.queryByRole('dialog')).toBeNull();
    const panel = screen.getByRole('region', { name: panelName });
    expect(panel).toHaveAttribute('data-pass-id', pass.id);
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
    // FR-DESK-3: nothing is covered, so nothing is inert.
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role)).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
    // The list is still there, still open-able, with the open pass marked.
    expect(tagged()).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('article', { name: other.name })).not.toHaveAttribute('aria-current');
    expect(within(panel).getByTestId('guide-sentence')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('closes on the close control and on Escape, clearing the hash both times', async () => {
    withPasses();
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    await userEvent.click(within(screen.getByRole('region', { name: panelName })).getByRole('button', { name: en.guide.close }));
    expect(screen.queryByRole('region', { name: panelName })).toBeNull();
    expect(window.location.hash).toBe('');

    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: panelName })).toBeNull();
    expect(window.location.hash).toBe('');
  });

  /**
   * R49 (F-30), D-154: the reload button may not be reachable under an open
   * pass, and on wide nothing around it is made inert — the guide is a panel
   * beside a live list (FR-DESK-3). The offers carry the flag themselves, so
   * the rule holds at both widths while the page around them stays usable.
   */
  it('puts the update offer and the install hint out of reach while the guide is open, without touching the rest of the page', async () => {
    withPasses();
    act(() => {
      appStore.setState({ updateReady: true, applyUpdate: () => undefined });
    });
    render(<App />);
    act(() => {
      window.dispatchEvent(Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt: () => Promise.resolve() }));
    });
    const offers = () => [screen.getByTestId('update-banner'), screen.getByTestId('install-hint')];
    for (const offer of offers()) expect(offer).not.toHaveAttribute('inert');

    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument();
    for (const offer of offers()) expect(offer).toHaveAttribute('inert');
    // Only the offers: the list, the guide and the controls around them are still live.
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role)).not.toHaveAttribute('inert');
    expect(screen.getByRole('region', { name: pane('where') })).not.toHaveAttribute('inert');

    // Closing the guide gives them back, with no timer in it (D-154).
    await userEvent.keyboard('{Escape}');
    for (const offer of offers()) expect(offer).not.toHaveAttribute('inert');
  });

  /**
   * R50 (FR-DESK-3 as amended, F-6). Which of the two tracks the right column
   * shows is `data-guide`, and the stylesheet is what turns it into a layout:
   * below `WIDE_SPLIT_MIN_CELLS` one at a time, above it both at once. What is
   * testable here is the contract the stylesheet keys off — and that `[ list ]`
   * is a swap and not a close: the pass stays open, stays in the hash, and the
   * reader comes back to the card they were reading about.
   */
  it('marks the right column open, list or closed, and swaps between them on [ list ] (F-6)', async () => {
    media.setWidth(MID_PX);
    withPasses();
    render(<App />);
    const right = screen.getByTestId('col-right');
    expect(right).toHaveAttribute('data-guide', 'closed');

    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(right).toHaveAttribute('data-guide', 'open');

    await userEvent.click(within(screen.getByRole('region', { name: panelName })).getByRole('button', { name: en.guide.toList }));
    expect(right).toHaveAttribute('data-guide', 'list');
    // Not a close: the guide is still mounted, the pass is still the selected
    // one, and the hash still carries it (D-13).
    expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
    expect(tagged()).toHaveAttribute('aria-current', 'true');
    expect(tagged()).toHaveFocus();

    // Opening a pass is what asks for the guide again.
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[1] as HTMLElement);
    expect(right).toHaveAttribute('data-guide', 'open');

    // R92 (FR-ROUTE-1): the pass was opened by the app, so Esc closes it with `history.back()`, which lands a task later.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(right).toHaveAttribute('data-guide', 'closed');
    });
  });

  /**
   * Review of #79: the list view was a stored flag that only opening a card
   * reset, so a pass arriving by the hash — Back, a pasted link — kept the
   * list in front of the new pass's guide. The view is now derived from the
   * pass the list was asked for.
   */
  it('a pass arriving by the hash while the list is shown is a new guide, not the list again', async () => {
    media.setWidth(MID_PX);
    withPasses();
    render(<App />);
    const right = screen.getByTestId('col-right');
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    await userEvent.click(within(screen.getByRole('region', { name: panelName })).getByRole('button', { name: en.guide.toList }));
    expect(right).toHaveAttribute('data-guide', 'list');

    act(() => {
      window.location.hash = `#pass=${other.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(right).toHaveAttribute('data-guide', 'open');
    expect(screen.getByRole('region', { name: en.guide.panelLabel({ name: other.name }) })).toBeInTheDocument();
  });

  /**
   * Review of #79: `focus()` on a card inside a folded night does nothing
   * (`passCursor` skips them for the same reason), so `[ list ]` at such a
   * pass left focus on the body. The night unfolds first.
   */
  it('[ list ] at a pass inside a folded night unfolds the night and focuses the card', async () => {
    media.setWidth(MID_PX);
    const later = { ...pass, id: 'later', noradId: 3, name: 'Later object', start: { ...pass.start, t: pass.start.t + 26 * 3_600_000 } };
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, window: { startMs: NOW, endMs: NOW + 2 * NIGHT_MS }, passes: [pass, other, later], hasDarkness: true } });
    });
    render(<App />);
    const nights = screen.getAllByTestId('night-group');
    expect(nights).toHaveLength(2);
    const secondNight = nights[1] as HTMLElement;
    expect(secondNight.hidden).toBe(true);

    act(() => {
      window.location.hash = `#pass=${later.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await userEvent.click(within(screen.getByRole('region', { name: en.guide.panelLabel({ name: later.name }) })).getByRole('button', { name: en.guide.toList }));
    expect(secondNight.hidden).toBe(false);
    expect(screen.getAllByTestId('night-toggle')[1]).toHaveAttribute('aria-expanded', 'true');
    expect(within(secondNight).getByRole('article', { current: true })).toHaveFocus();
  });

  /**
   * R50 (F-8): the panel stays on the page between two passes, so React reused
   * the instance — the mount effect never ran again, the new guide's heading
   * was never focused, and closing it put the reader back on whatever had
   * opened the *first* one. `App` keys it by the pass; a second pass is a
   * second guide.
   */
  it('moves focus to the second guide when another pass is opened beside it, and back to its own opener (F-8)', async () => {
    withPasses();
    render(<App />);
    const openers = screen.getAllByRole('button', { name: /Open guide/ });
    await userEvent.click(openers[0] as HTMLElement);
    expect(within(screen.getByRole('region', { name: panelName })).getByRole('heading', { level: 2 })).toHaveFocus();

    const second = openers[1] as HTMLElement;
    await userEvent.click(second);
    const panel = screen.getByRole('region', { name: en.guide.panelLabel({ name: other.name }) });
    expect(panel).toHaveAttribute('data-pass-id', other.id);
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(second).toHaveFocus();
    });
  });

  /**
   * R76 (FR-FIRST-5, D-444): at three-pane widths the page grid says `pane` —
   * the stylesheet puts the panel across the Where and When columns — and the
   * list stays in What with the open card marked. `Esc` brings the two panes
   * back. Under the three-pane width the same pass is D-253's `open` again.
   */
  it('at three-pane widths an open pass is the pane state: the list stays, and Esc brings the panes back (D-444)', async () => {
    withPasses();
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-home', 'readings');
    expect(main).toHaveAttribute('data-guide', 'closed');
    for (const step of ['where', 'when', 'what'] as const) expect(screen.getByRole('region', { name: pane(step) })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(main).toHaveAttribute('data-guide', 'pane');
    expect(screen.getByTestId('col-right')).toHaveAttribute('data-guide', 'pane');
    const panel = screen.getByRole('region', { name: panelName });
    expect(panel).toHaveAttribute('data-guide-panel');
    expect(within(screen.getByRole('region', { name: pane('what') })).getByTestId('next-tag').closest('article')).toHaveAttribute('aria-current', 'true');
    expect(window.location.hash).toBe(`#pass=${pass.id}`);

    act(() => {
      media.setWidth(MID_PX);
    });
    expect(main).toHaveAttribute('data-guide', 'open');
    act(() => {
      media.setWidth(WIDE_PX);
    });
    expect(main).toHaveAttribute('data-guide', 'pane');

    await userEvent.keyboard('{Escape}');
    expect(main).toHaveAttribute('data-guide', 'closed');
    expect(screen.queryByRole('region', { name: panelName })).toBeNull();
  });

  it('keeps the same pass open across the breakpoint, in the other shell (D-72)', async () => {
    withPasses();
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument();

    act(() => {
      media.setWidth(COMPACT_PX);
    });
    const sheet = screen.getByRole('dialog', { name: pass.name });
    expect(sheet).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.queryByRole('region', { name: panelName })).toBeNull();
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
    expect(window.location.hash).toBe(`#pass=${pass.id}`);

    act(() => {
      media.setWidth(WIDE_PX);
    });
    expect(screen.getByRole('region', { name: panelName })).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
  });
});

describe('<App> compact (FR-DESK-3: the MVP sheet is unchanged)', () => {
  beforeEach(() => {
    media = stubMatchMedia(COMPACT_PX);
  });
  afterEach(() => {
    media.restore();
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('opens the full-screen sheet over an inert page, and no panel', async () => {
    withPasses();
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(screen.getByRole('dialog', { name: pass.name })).toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByRole('region', { name: panelName, hidden: true })).toBeNull();
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role, { hidden: true })).toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });
});
