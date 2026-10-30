// @vitest-environment jsdom
/**
 * R147 (FR-FULL-3, FR-FULL-4, FR-FULL-5, FR-FULL-8; D-921; US-43 AC3 at the component's level): `[ controls ]` and
 * the sheet it opens, on their own. The button's words and state (`aria-expanded`, `aria-controls`) in both
 * languages; the region's name, its head (the place, `[ settings ]` to `#settings` under the header's key,
 * the `×`) and its body; open and close by each of the component's ways and by the page's prop (the page's
 * `Esc`, R148); focus into the body's first control and back to `[ controls ]`; one bottom form in both shapes with
 * `SHEET_MAX_SHARE` from `lib/layout.ts` (R150, FR-GYRO-7); a turn with the sheet open; no transition under reduced
 * motion; no backdrop, no trap, nothing written to the URL.
 *
 * R150 (FR-GYRO-8, D-948): the `×` named "Close controls" / "Cerrar controles"; the swipe on the head row — 40 px
 * snaps back, 80 px closes, a short fast flick closes — the sheet following the finger downward only, with no
 * transition while dragged; a press on the head's controls is not a drag.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { SHEET_FLICK_PX_PER_MS, SHEET_MAX_SHARE, SHEET_SWIPE_CLOSE_PX } from '../../../lib/layout';
import type { Locale } from '../../../model';
import { ControlsSheet } from './ControlsSheet';

let media: MatchMediaStub;

beforeEach(() => {
  media = stubMatchMedia(390, 844);
});

afterEach(() => {
  cleanup();
  media.restore();
});

/** The rows a page hands the sheet: two controls, so the first one is the one focus lands on. */
const rows = (
  <>
    <button type="button" data-testid="row-first">
      first
    </button>
    <button type="button" data-testid="row-second">
      second
    </button>
  </>
);

/** The page's side of the contract: the open state is its own (D-921), and it can close the sheet itself. */
function Page({ initial = false, children = rows, onChange }: { initial?: boolean; children?: ReactNode; onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(initial);
  return (
    <>
      <button type="button" data-testid="page-close" onClick={() => setOpen(false)}>
        page close
      </button>
      <ControlsSheet
        open={open}
        onOpenChange={(next) => {
          onChange?.(next);
          setOpen(next);
        }}
        place="Cipolletti, Río Negro"
      >
        {children}
      </ControlsSheet>
    </>
  );
}

const mount = (locale: Locale = 'en', props: Parameters<typeof Page>[0] = {}) =>
  render(
    <I18nProvider locale={locale}>
      <Page {...props} />
    </I18nProvider>,
  );

const button = (): HTMLElement => screen.getByTestId('live-controls');
const sheet = (): HTMLElement => screen.getByTestId('live-sheet');

describe('<ControlsSheet> (FR-FULL-3, FR-FULL-4, FR-FULL-5)', () => {
  it.each([
    ['en', en],
    ['es', es],
  ] as const)('is `[ controls ]` naming the closed sheet in %s, a 44 px target and a collapsed toggle', (locale, m) => {
    mount(locale);
    expect(button()).toHaveTextContent(new RegExp(`^${m.sheet.controls}$`));
    expect(button().classList.contains('target')).toBe(true);
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button().getAttribute('aria-controls')).toBe(sheet().id);
    expect(sheet()).toHaveAttribute('role', 'region');
    expect(sheet()).toHaveAttribute('aria-label', m.sheet.name);
    // Closed: still in the tree for `aria-controls` and the slide out, but inert — nothing in it is reached.
    expect(sheet()).toHaveAttribute('data-open', 'false');
    expect(sheet()).toHaveAttribute('inert');
  });

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('opens on `[ controls ]` with the head and the rows in %s', async (locale, m) => {
    const onChange = vi.fn();
    const { container } = mount(locale, { onChange });
    fireEvent.click(button());
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(sheet()).toHaveAttribute('data-open', 'true');
    expect(sheet()).not.toHaveAttribute('inert');
    const region = screen.getByRole('region', { name: m.sheet.name });
    expect(region).toBe(sheet());
    const head = within(region).getByTestId('sheet-head');
    expect(within(head).getByTestId('sheet-place')).toHaveTextContent('Cipolletti, Río Negro');
    const settings = within(head).getByRole('link', { name: m.settings.open });
    expect(settings).toHaveAttribute('href', '#settings');
    expect(settings).toHaveAttribute('data-testid', 'sheet-settings');
    // R150 (FR-GYRO-8): the `×` alone, named "Close controls" / "Cerrar controles".
    const close = within(head).getByRole('button', { name: m.sheet.close });
    expect(close).toHaveAttribute('data-testid', 'sheet-close');
    expect(close).toHaveTextContent(/^×$/);
    expect(m.sheet.close).toBe(locale === 'en' ? 'Close controls' : 'Cerrar controles');
    // The head's order: the place, `[ settings ]`, then the `×` at the row's end.
    expect([...head.children].map((child) => child.getAttribute('data-testid'))).toEqual(['sheet-place', 'sheet-settings', 'sheet-close']);
    for (const control of [settings, close]) expect(control.classList.contains('target')).toBe(true);
    // The body holds the page's rows, after the head.
    const body = within(region).getByTestId('sheet-body');
    expect(within(body).getByTestId('row-first')).toBeInTheDocument();
    expect([...region.children].map((child) => child.getAttribute('data-testid'))).toEqual(['sheet-head', 'sheet-body']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves focus to the body’s first control on open, and back to `[ controls ]` on the `×`', () => {
    mount();
    fireEvent.click(button());
    expect(document.activeElement).toBe(screen.getByTestId('row-first'));
    fireEvent.click(screen.getByTestId('sheet-close'));
    expect(sheet()).toHaveAttribute('data-open', 'false');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(button());
  });

  it('closes on `[ controls ]` too, which stays a toggle while the sheet is open, and gives the focus back', () => {
    mount();
    fireEvent.click(button());
    expect(document.activeElement).toBe(screen.getByTestId('row-first'));
    fireEvent.click(button());
    expect(sheet()).toHaveAttribute('data-open', 'false');
    expect(document.activeElement).toBe(button());
  });

  it('gives the focus back to `[ controls ]` when the page closes it (its `Esc`)', () => {
    mount();
    fireEvent.click(button());
    screen.getByTestId('row-second').focus();
    fireEvent.click(screen.getByTestId('page-close'));
    expect(sheet()).toHaveAttribute('data-open', 'false');
    expect(document.activeElement).toBe(button());
  });

  it('takes the focus to `[ controls ]` before it opens, so a browser that does not focus a pressed button gets it back there', () => {
    mount();
    // Safari: a click does not focus the button; the reader's focus is on the body.
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.click(button());
    fireEvent.click(screen.getByTestId('sheet-close'));
    expect(document.activeElement).toBe(button());
  });

  it('focuses the `×` when the body has no control', () => {
    mount('en', { children: <p>nothing to press</p> });
    fireEvent.click(button());
    expect(document.activeElement).toBe(screen.getByTestId('sheet-close'));
  });

  it('opens and closes again and again, each time focusing in and back', () => {
    mount();
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(button());
      expect(document.activeElement).toBe(screen.getByTestId('row-first'));
      fireEvent.click(screen.getByTestId('sheet-close'));
      expect(document.activeElement).toBe(button());
    }
  });

  it('marks the sheet still under reduced motion, and follows the preference as it changes', () => {
    mount();
    expect(sheet()).toHaveAttribute('data-motion', 'slide');
    act(() => {
      media.setReducedMotion(true);
    });
    expect(sheet()).toHaveAttribute('data-motion', 'reduce');
  });

  it('is a bottom sheet in portrait, at most SHEET_MAX_SHARE of the height', () => {
    mount();
    expect(sheet()).not.toHaveAttribute('data-form');
    expect(sheet().style.getPropertyValue('--sheet-max-share')).toBe(String(SHEET_MAX_SHARE));
  });

  it('is the same bottom sheet on the landscape phone, with no side form, and keeps its state through a turn (FR-GYRO-7)', () => {
    media.setSize(844, 390);
    mount('en', { initial: true });
    expect(sheet()).not.toHaveAttribute('data-form');
    expect(sheet().style.getPropertyValue('--sheet-max-share')).toBe(String(SHEET_MAX_SHARE));
    expect(sheet().style.getPropertyValue('--sheet-side-share')).toBe('');
    act(() => {
      media.setSize(390, 844);
    });
    expect(sheet()).toHaveAttribute('data-open', 'true');
    expect(button()).toHaveAttribute('aria-expanded', 'true');
  });

  it('is not modal: no dialog, no backdrop, the page around it still reachable', () => {
    const { container } = mount('en', { initial: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('[aria-modal]')).toBeNull();
    // The sheet's own parts are its head and body; the button and the page's control stand beside it, not inert.
    expect(sheet().children).toHaveLength(2);
    expect(button().closest('[inert]')).toBeNull();
    expect(screen.getByTestId('page-close').closest('[inert]')).toBeNull();
  });

  it('writes nothing to the URL or the history', () => {
    const before = { hash: window.location.hash, length: window.history.length, state: window.history.state as unknown };
    mount();
    fireEvent.click(button());
    fireEvent.click(screen.getByTestId('sheet-close'));
    fireEvent.click(button());
    fireEvent.click(screen.getByTestId('page-close'));
    expect({ hash: window.location.hash, length: window.history.length, state: window.history.state as unknown }).toEqual(before);
  });
});

/**
 * R150 (FR-GYRO-8, D-948): the swipe. A drag is pointer events on the head row, timed by the events' `timeStamp`
 * (jsdom's is `Date.now()`, so the fake clock sets it): `drag(travel, ms)` presses on the place, moves down in ten
 * steps over `ms` and releases there.
 */
describe('<ControlsSheet>’s swipe (FR-GYRO-8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const head = (): HTMLElement => screen.getByTestId('sheet-head');
  const drift = (): string => sheet().style.getPropertyValue('--sheet-drag');
  const Y0 = 400;
  const up = (y: number): void => {
    fireEvent.pointerUp(head(), { pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: 100, clientY: y });
  };

  function drag(travel: number, ms: number, { release = true, from }: { release?: boolean; from?: HTMLElement } = {}): void {
    fireEvent.pointerDown(from ?? screen.getByTestId('sheet-place'), { pointerId: 7, isPrimary: true, button: 0, pointerType: 'touch', clientX: 100, clientY: Y0 });
    for (let step = 1; step <= 10; step += 1) {
      act(() => {
        vi.advanceTimersByTime(ms / 10);
      });
      fireEvent.pointerMove(head(), { pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: 100, clientY: Y0 + (travel * step) / 10 });
    }
    if (release) up(Y0 + travel);
  }

  it('takes the touch on the head row alone, so the body keeps its native scroll', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/live/ControlsSheet.module.css'), 'utf8');
    expect(/\.head \{[^}]*touch-action: none;/.exec(css)).not.toBeNull();
    expect(/\.body \{[^}]*touch-action/.exec(css)).toBeNull();
  });

  it('snaps back on a slow 40 px drag: the sheet stays open', () => {
    mount('en', { initial: true });
    drag(40, 400, { release: false });
    // While dragged it follows the finger, with no transition.
    expect(drift()).toBe('40px');
    expect(sheet()).toHaveAttribute('data-dragging', 'true');
    up(Y0 + 40);
    expect(sheet()).toHaveAttribute('data-open', 'true');
    expect(drift()).toBe('');
    expect(sheet()).not.toHaveAttribute('data-dragging');
  });

  it('closes on a slow 80 px drag, past SHEET_SWIPE_CLOSE_PX, and gives the focus back to `[ controls ]`', () => {
    expect(80).toBeGreaterThan(SHEET_SWIPE_CLOSE_PX);
    // Slow: 80 px over 800 ms is 0.1 px/ms, so the travel alone closes it.
    expect(80 / 800).toBeLessThan(SHEET_FLICK_PX_PER_MS);
    mount('en');
    fireEvent.click(button());
    drag(80, 800);
    expect(sheet()).toHaveAttribute('data-open', 'false');
    expect(drift()).toBe('');
    expect(document.activeElement).toBe(button());
  });

  it('closes on a short fast flick, faster than SHEET_FLICK_PX_PER_MS', () => {
    expect(30).toBeLessThan(SHEET_SWIPE_CLOSE_PX);
    expect(30 / 40).toBeGreaterThan(SHEET_FLICK_PX_PER_MS);
    mount('en', { initial: true });
    drag(30, 40);
    expect(sheet()).toHaveAttribute('data-open', 'false');
  });

  it('reads the flick over the drag’s last 100 ms: a quick drag held still before the release does not close', () => {
    mount('en', { initial: true });
    drag(40, 60, { release: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    up(Y0 + 40);
    expect(sheet()).toHaveAttribute('data-open', 'true');
  });

  it('never moves the sheet up, and an upward drag closes nothing', () => {
    mount('en', { initial: true });
    drag(-120, 60, { release: false });
    expect(drift()).toBe('0px');
    up(Y0 - 120);
    expect(sheet()).toHaveAttribute('data-open', 'true');
  });

  it('snaps back on a cancel', () => {
    mount('en', { initial: true });
    drag(200, 100, { release: false });
    fireEvent.pointerCancel(head(), { pointerId: 7, isPrimary: true, pointerType: 'touch' });
    expect(sheet()).toHaveAttribute('data-open', 'true');
    expect(drift()).toBe('');
  });

  it('leaves a press on the head’s controls to them: no drag from the `×` or `[ settings ]`', () => {
    mount('en', { initial: true });
    for (const control of [screen.getByTestId('sheet-close'), screen.getByTestId('sheet-settings')]) {
      drag(120, 100, { from: control });
      expect(sheet()).toHaveAttribute('data-open', 'true');
      expect(drift()).toBe('');
    }
  });

  it('ignores a drag on the body: the body scrolls, the sheet stays', () => {
    mount('en', { initial: true });
    drag(120, 100, { from: screen.getByTestId('row-first') });
    expect(sheet()).toHaveAttribute('data-open', 'true');
  });
});

describe('ControlsSheet.module.css (FR-FULL-4)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/components/live/ControlsSheet.module.css'), 'utf8');

  it('slides by `transform` in at most 200 ms, and not at all under reduced motion', () => {
    const slide = /--sheet-slide:\s*(\d+)ms/.exec(css);
    expect(slide).not.toBeNull();
    expect(Number(slide?.[1])).toBeLessThanOrEqual(200);
    expect(css).toMatch(/transition: transform var\(--sheet-slide\) ease-out;/);
    // R150 (D-948): none while the head row is dragged, so the sheet follows the finger.
    expect(css).toMatch(/\.sheet\[data-dragging='true'\] \{\s*transition: none;\s*\}/);
    expect(css).toMatch(/transform: translateY\(var\(--sheet-drag, 0\)\);/);
    // Last of the sheet's transition rules, so it outranks the open one and the drag's at the same weight.
    expect(css).toMatch(/\.sheet\[data-motion='reduce'\] \{\s*transition: none;\s*\}/);
    expect(css.lastIndexOf('transition')).toBe(css.lastIndexOf('transition: none'));
    expect(css.lastIndexOf('transition')).toBeGreaterThan(css.indexOf(".sheet[data-motion='reduce']"));
  });

  it('caps the bottom sheet by the dynamic viewport height, with no side form (FR-GYRO-7), at --z-sheet', () => {
    expect(css).toMatch(/max-block-size: calc\(var\(--sheet-max-share\) \* 100dvh\)/);
    expect(css).not.toMatch(/--sheet-side-share|data-form/);
    expect(css).toMatch(/z-index: var\(--z-sheet\)/);
    expect(css).toMatch(/overflow-y: auto/);
  });
});
