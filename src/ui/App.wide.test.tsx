/**
 * R23 (FR-DESK-3, D-72), R186 (FR-WIDE-1, D-1098). The wide layout, with `matchMedia` stubbed (PLAN §9.1): the
 * satellites are the desk's shell — the pass beside a list that stays live and marks it — `Esc` and the close
 * control leaving it, the hash following the selection, and the same pass still open after the width crosses the
 * breakpoint in either direction, in the other shell. R212 (FR-LAND-1, FR-LAND-6): the first page is live, and
 * `#pass` the pass up now or next.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../tests/support/matchMedia';
import { en } from '../i18n/en';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';
import { forgetInstallOffer } from './components/common/installOffer';
import { resetNavigation } from './navigation';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };
const panelName = en.guide.panelLabel({ name: pass.name });
/** FR-DESK-5's mid width: wide, two columns, under both the three panes and the split. */
const MID_PX = 1024;
/** The next ISS pass's card, which carries the tag the hero card was (R81, §8 rank 1 as amended). */
const tagged = (): HTMLElement => screen.getByTestId('next-tag').closest('article') as HTMLElement;

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
    resetNavigation();
    window.history.replaceState(null, '', '#pass');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    media.restore();
    appStore.setState(initial, true);
    forgetInstallOffer();
    localStorage.clear();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('FR-LAND-1, FR-LAND-6: the first page is live under the header’s links, with no Back and no home', async () => {
    window.history.replaceState(null, '', window.location.pathname);
    withPasses();
    render(<App />);
    expect(await screen.findByTestId('live-page')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(within(header).queryByTestId('live-back')).toBeNull();
    expect(within(header).queryByTestId('home-link')).toBeNull();
    expect(within(header).getByTestId('live-link')).toHaveAttribute('aria-current', 'page');
    expect(within(header).getByTestId('pass-link')).toHaveAttribute('href', `#pass=${pass.id}`);
    expect(header).not.toHaveTextContent(en.app.tagline);
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
    expect(tagged().querySelector(':scope > button')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('article', { name: other.name }).querySelector(':scope > button')).not.toHaveAttribute('aria-current');
    expect(within(panel).getByTestId('guide-sentence')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FR-LAND-1: closes to the live page on the close control and on Escape, where the pass was the load’s', async () => {
    for (const leave of ['close', 'escape'] as const) {
      window.history.replaceState(null, '', `#pass=${pass.id}`);
      withPasses();
      const { unmount } = render(<App />);
      const panel = screen.getByRole('region', { name: panelName });
      const entries = window.history.length;
      if (leave === 'close') await userEvent.click(within(panel).getByRole('button', { name: en.guide.close }));
      else await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('region', { name: panelName })).toBeNull();
      expect(window.location.hash).toBe('#live');
      expect(window.history.length).toBe(entries);
      unmount();
    }
  });

  it('FR-UPD-2: the update bar stays on the pass page, under the header and in reach', () => {
    withPasses();
    act(() => {
      appStore.setState({ updateReady: true, applyUpdate: () => undefined });
    });
    render(<App />);
    const bar = screen.getByTestId('update-banner');
    expect(bar).not.toHaveAttribute('inert');
    expect(bar.parentElement?.previousElementSibling).toBe(screen.getByTestId('header'));
  });

  it('FR-WIDE-1: the satellites are the desk shell at the mid width and at three-pane widths', () => {
    for (const width of [MID_PX, WIDE_PX]) {
      media.setWidth(width);
      window.history.replaceState(null, '', '#pass');
      withPasses();
      const { unmount } = render(<App />);
      expect(screen.getByRole('main')).toHaveAttribute('data-sky', 'pass');
      expect(screen.queryByTestId('pass-tonight')).toBeNull();
      expect(screen.getByRole('region', { name: panelName })).toHaveAttribute('data-pass-id', pass.id);
      expect(tagged().querySelector(':scope > button')).toHaveAttribute('aria-current', 'true');
      // FR-CLEAN-14: a bare #pass becomes the pass up now or next.
      expect(window.location.hash).toBe(`#pass=${pass.id}`);
      unmount();
    }
  });

  it('FR-ROUTE-3: an id the run no longer has keeps its address and says so over the list', () => {
    const gone = `#pass=25544-${String(NOW - 86_400_000)}`;
    window.history.replaceState(null, '', gone);
    withPasses();
    render(<App />);
    expect(screen.getByTestId('share-fallback')).toBeInTheDocument();
    expect(window.location.hash).toBe(gone);
  });

  /** R50 (F-8): a second pass is a second guide, keyed by the pass, so its mount moves focus into it. */
  it('moves focus into the second pass opened from the rail (F-8)', async () => {
    withPasses();
    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[1] as HTMLElement);
    const panel = screen.getByRole('region', { name: en.guide.panelLabel({ name: other.name }) });
    expect(panel).toHaveAttribute('data-pass-id', other.id);
    expect(panel).toContainElement(document.activeElement as HTMLElement);
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
    resetNavigation();
    window.history.replaceState(null, '', '#pass');
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

  it('FR-LAND-6: a card’s sheet stacks on the list and closes back to it', async () => {
    withPasses();
    render(<App />);
    expect(screen.getByTestId('pass-tonight')).toBeInTheDocument();
    expect(window.location.hash).toBe('#pass');
    await userEvent.click(screen.getAllByRole('button', { name: /Open guide/ })[0] as HTMLElement);
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#pass');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('D-1231: a sheet that was the load’s closes to the list in place', async () => {
    window.history.replaceState(null, '', `#pass=${pass.id}`);
    withPasses();
    render(<App />);
    const entries = window.history.length;
    await userEvent.keyboard('{Escape}');
    expect(window.location.hash).toBe('#pass');
    expect(window.history.length).toBe(entries);
  });
});
