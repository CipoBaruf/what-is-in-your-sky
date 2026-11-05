/**
 * R23 (FR-DESK-1/2/3, D-72). The wide layout, with `matchMedia` stubbed
 * (PLAN §9.1): two columns in the order FR-DESK-2 fixes, the guide as a
 * panel beside a list that stays live and marks the open pass, `Esc` and the
 * close control closing it, the hash following the selection — and the same
 * pass still open after the width crosses the breakpoint in either
 * direction, in the other shell.
 *
 * R186 (FR-WIDE-1, D-1098): an open pass on wide is the desk's shell in the home's place at every wide width; the
 * split, `[ list ]` and the three-pane state (R76, D-444) are retired.
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
    // R130 (FR-FLOW-1): the three doors are the main's first row, over the two columns.
    const [doors, ...columns] = Array.from(screen.getByRole('main').children);
    expect(doors).toHaveAttribute('data-testid', 'home-doors');
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
    // The header spans both and keeps the title and the tagline; the switches are the settings page's (R129, V26-10).
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading', { level: 1, name: en.app.title })).toBeInTheDocument();
    expect(header).toHaveTextContent(en.app.tagline);
    for (const control of [en.app.language, en.app.theme]) expect(within(header).queryByRole('group', { name: control })).toBeNull();
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
   * pass. R186 (FR-WIDE-1, D-1098): on wide the open pass is the desk's shell in
   * the home's place, so the offers go with the home and come back with it.
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
    expect(screen.queryByTestId('update-banner')).toBeNull();
    expect(screen.queryByTestId('install-hint')).toBeNull();
    // Nothing else is made inert: the list, the pass and the controls around them are live.
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role)).not.toHaveAttribute('inert');

    // Closing the pass gives them back (D-154).
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      for (const offer of offers()) expect(offer).not.toHaveAttribute('inert');
    });
  });

  /**
   * R186 (FR-WIDE-1, D-1098; amends FR-DESK-3): an open pass on wide is the desk's shell in the home's place — the doors
   * and the panes are not mounted, the home's list stands in the rail with the card marked — at every wide width, so
   * the split, `[ list ]` and R76's pane state are gone. The hash still carries the pass (D-13).
   */
  it('FR-WIDE-1: opens the desk shell in the home\'s place at the mid width and at three-pane widths', async () => {
    for (const width of [MID_PX, WIDE_PX]) {
      media.setWidth(width);
      withPasses();
      const { unmount } = render(<App />);
      expect(screen.getByTestId('home-doors')).toBeInTheDocument();
      await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
      expect(screen.getByRole('main')).toHaveAttribute('data-sky', 'pass');
      expect(screen.queryByTestId('home-doors')).toBeNull();
      for (const step of ['where', 'when'] as const) expect(screen.queryByRole('region', { name: pane(step) })).toBeNull();
      expect(screen.queryByRole('button', { name: en.guide.toList })).toBeNull();
      expect(screen.getByRole('region', { name: panelName })).toHaveAttribute('data-pass-id', pass.id);
      expect(tagged()).toHaveAttribute('aria-current', 'true');
      expect(window.location.hash).toBe(`#pass=${pass.id}`);
      unmount();
      appStore.setState(initial, true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  });

  /**
   * FR-WIDE-1: `Esc` returns to the home with the list at the card. A pass that arrived by the hash inside a folded
   * night unfolds that night first, since `focus()` on a hidden card does nothing (`passCursor`).
   */
  it('FR-WIDE-1: Esc at a pass inside a folded night returns home with the night unfolded and the card focused', async () => {
    media.setWidth(MID_PX);
    const later = { ...pass, id: 'later', noradId: 3, name: 'Later object', start: { ...pass.start, t: pass.start.t + 26 * 3_600_000 } };
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, window: { startMs: NOW, endMs: NOW + 2 * NIGHT_MS }, passes: [pass, other, later], hasDarkness: true } });
    });
    render(<App />);
    act(() => {
      window.location.hash = `#pass=${later.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('region', { name: en.guide.panelLabel({ name: later.name }) })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByTestId('home-doors')).toBeInTheDocument();
    });
    const card = screen.getByRole('article', { name: later.name });
    await waitFor(() => {
      expect(card).toHaveFocus();
    });
    expect(screen.getAllByTestId('night-group')[1]?.hidden).toBe(false);
  });

  /**
   * R50 (F-8): a second pass is a second guide, keyed by the pass, so its mount moves focus into it. R186 (FR-WIDE-1):
   * on wide the second is opened from the rail's list, and closing it returns to the home with its card focused.
   */
  it('moves focus into the second pass opened from the rail, and back to its card on the home (F-8)', async () => {
    withPasses();
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(screen.getByRole('region', { name: panelName })).toContainElement(document.activeElement as HTMLElement);

    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[1] as HTMLElement);
    const panel = screen.getByRole('region', { name: en.guide.panelLabel({ name: other.name }) });
    expect(panel).toHaveAttribute('data-pass-id', other.id);
    expect(panel).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByTestId('home-doors')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement?.closest('article')).toHaveAttribute('data-pass-id', expect.any(String));
    });
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
