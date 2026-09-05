import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { FIXTURES_DIR } from '../../../tests/support/fixtures';
import { MOON_FIXTURE } from '../../../tests/support/moonFixtures';
import type { Observer } from '../../model';
import { appStore, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { App } from '../App';
import { PassDetail, TICK_MS } from './PassDetail';

const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as { en: { asComputed: string } };
const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const clearHash = (): void => {
  window.history.replaceState(null, '', window.location.pathname);
};

describe('<PassDetail> (US-6, FR-X-5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(pass.start.t - 754_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // R23 (D-117): the compact sheet is portaled to the body, so the axe runs here take the document and not RTL's container — which no longer holds the sheet at all.
  it('is a labelled dialog carrying the guide sentence (once, as the chart caption), the numbers, the twilight label and the sky chart', async () => {
    render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'ISS (Zarya)' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByTestId('guide-sentence').textContent).toBe(golden.en.asComputed);
    expect(within(dialog).getByRole('table')).toBeInTheDocument();
    expect(within(dialog).getByText('sky still bright', { selector: 'p span' })).toBeInTheDocument();
    // R13: the chart is a figure captioned by the sentence; the drawing is hidden from AT (FR-GUIDE-7) and is DOM, never canvas (FR-GUIDE-5).
    // R21 (FR-DOME-7): the dome is the default again and the polar view is one toggle away; the contract test covers both views themselves.
    const figure = within(dialog).getByRole('figure');
    expect(figure).toContainElement(within(dialog).getByTestId('guide-sentence'));
    expect(figure).toHaveAttribute('data-view', 'dome');
    // PLAN §11: the dome is the chart chunk, behind `React.lazy`, so the drawing arrives a tick after the sheet.
    await within(figure).findByRole('group', { name: 'Sky dome' });
    expect(figure.querySelector('[data-drawing="dome"]')).toHaveAttribute('aria-hidden', 'true');
    expect(dialog.querySelector('canvas')).toBeNull();
    // The orientation toggle is the polar view's (FR-GUIDE-4); the dome is turned by dragging it instead.
    expect(within(figure).queryByRole('group', { name: 'Chart orientation' })).toBeNull();
    expect(within(figure).getByRole('group', { name: 'Chart view' })).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('locks the page scroll while open and restores it on close (one scrollbar, the sheet\'s)', () => {
    document.documentElement.style.overflow = 'auto';
    const { unmount } = render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });

  it('adds the Moon warning under the chart when the pass has glare, and nothing when it has not (FR-MOON-2)', () => {
    const { rerender } = render(
      <PassDetail pass={{ ...pass, moonAtPeak: MOON_FIXTURE, moonGlare: { glare: true, separationDeg: 8.2 } }} observer={observer} onClose={() => undefined} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('The Moon is bright and close to the track.')).toHaveAccessibleDescription(/at least 50 % lit and closer than 30°/);
    rerender(<PassDetail pass={pass} observer={observer} onClose={() => undefined} />);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('The Moon is bright');
  });

  it('omits the twilight label when the pass is not a twilight one', () => {
    render(<PassDetail pass={{ ...pass, twilight: false }} observer={observer} onClose={() => undefined} />);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('sky still bright');
  });

  it('counts down every second without remounting', () => {
    render(<PassDetail pass={pass} observer={observer} onClose={() => undefined} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('Appears in 12:34');
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(screen.getByRole('timer')).toBe(timer);
    expect(timer).toHaveTextContent('Appears in 12:33');
    act(() => {
      vi.setSystemTime(pass.peak.t + 1000);
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(timer).toHaveTextContent('Sets in 0:22');
  });

  // R35 (D-73): Escape is no longer this component's; it is the `close` row of
  // the shortcut table, asserted end to end in `App.shortcuts.test.tsx`.
  it('moves focus to its heading on open and back to the opener on close; the close control closes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<PassDetail pass={pass} observer={observer} onClose={onClose} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'ISS (Zarya)' }));

    await user.click(screen.getByRole('button', { name: '← Back to the list' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('<App> with the detail sheet (D-13)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    clearHash();
  });

  const withPasses = (): void => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true } });
    });
  };

  it('opening a card sets the hash, the sheet shows the same pass, and closing returns to the list', async () => {
    withPasses();
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Open guide/ }));
    expect(window.location.hash).toBe(`#pass=${pass.id}`);
    const dialog = screen.getByRole('dialog', { name: 'ISS (Zarya)' });
    expect(dialog).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.getByRole('main')).toHaveAttribute('inert');

    await userEvent.click(within(dialog).getByRole('button', { name: '← Back to the list' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    expect(screen.getByRole('article', { name: 'ISS (Zarya)' })).toBeInTheDocument();
  });

  it('reopens the same pass when loaded with #pass=<id>, once the pass is in the store', () => {
    window.location.hash = `#pass=${pass.id}`;
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull(); // nothing computed yet
    withPasses();
    expect(screen.getByRole('dialog', { name: 'ISS (Zarya)' })).toHaveAttribute('data-pass-id', pass.id);
  });

  it('has no axe violations with the sheet open', async () => {
    window.location.hash = `#pass=${pass.id}`;
    withPasses();
    render(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
