// @vitest-environment jsdom
/**
 * R147 (FR-FULL-3, FR-FULL-4, FR-FULL-5, FR-FULL-8; D-921; US-43 AC3 at the component's level): `[ controls ]` and
 * the sheet it opens, on their own. The button's words and state (`aria-expanded`, `aria-controls`) in both
 * languages; the region's name, its head (the place, `[ settings ]` to `#settings` under the header's key,
 * `[ close ]`) and its body; open and close by each of the component's ways and by the page's prop (the page's
 * `Esc` and the tap on the sky, R148); focus into the body's first control and back to `[ controls ]`; the bottom
 * form in portrait and the side form on the landscape phone, each with its share from `lib/layout.ts`; a turn with
 * the sheet open; no transition under reduced motion; no backdrop, no trap, nothing written to the URL.
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
import { SHEET_MAX_SHARE, SHEET_SIDE_SHARE } from '../../../lib/layout';
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
    const close = within(head).getByRole('button', { name: m.sheet.close });
    expect(close).toHaveAttribute('data-testid', 'sheet-close');
    // The head's order: the place, `[ settings ]`, then `[ close ]` at the row's end.
    expect([...head.children].map((child) => child.getAttribute('data-testid'))).toEqual(['sheet-place', 'sheet-settings', 'sheet-close']);
    for (const control of [settings, close]) expect(control.classList.contains('target')).toBe(true);
    // The body holds the page's rows, after the head.
    const body = within(region).getByTestId('sheet-body');
    expect(within(body).getByTestId('row-first')).toBeInTheDocument();
    expect([...region.children].map((child) => child.getAttribute('data-testid'))).toEqual(['sheet-head', 'sheet-body']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves focus to the body’s first control on open, and back to `[ controls ]` on `[ close ]`', () => {
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

  it('gives the focus back to `[ controls ]` when the page closes it (its `Esc`, the tap on the sky)', () => {
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

  it('focuses `[ close ]` when the body has no control', () => {
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
    expect(sheet()).toHaveAttribute('data-form', 'bottom');
    expect(sheet().style.getPropertyValue('--sheet-max-share')).toBe(String(SHEET_MAX_SHARE));
  });

  it('is a side panel on the landscape phone, SHEET_SIDE_SHARE of the width, and keeps its state through a turn', () => {
    media.setSize(844, 390);
    mount('en', { initial: true });
    expect(sheet()).toHaveAttribute('data-form', 'side');
    expect(sheet().style.getPropertyValue('--sheet-side-share')).toBe(String(SHEET_SIDE_SHARE));
    act(() => {
      media.setSize(390, 844);
    });
    expect(sheet()).toHaveAttribute('data-form', 'bottom');
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

describe('ControlsSheet.module.css (FR-FULL-4)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/components/live/ControlsSheet.module.css'), 'utf8');

  it('slides by `transform` in at most 200 ms, and not at all under reduced motion', () => {
    const slide = /--sheet-slide:\s*(\d+)ms/.exec(css);
    expect(slide).not.toBeNull();
    expect(Number(slide?.[1])).toBeLessThanOrEqual(200);
    expect(css).toMatch(/transition: transform var\(--sheet-slide\) ease-out;/);
    // Last of the sheet's transition rules, so it outranks the open one at the same weight.
    expect(css).toMatch(/\.sheet\[data-motion='reduce'\] \{\s*transition: none;\s*\}/);
    expect(css.lastIndexOf('transition')).toBe(css.indexOf("transition: none"));
  });

  it('caps the bottom sheet by the dynamic viewport height and sizes the side sheet by the width, at --z-sheet', () => {
    expect(css).toMatch(/max-block-size: calc\(var\(--sheet-max-share\) \* 100dvh\)/);
    expect(css).toMatch(/inline-size: calc\(var\(--sheet-side-share\) \* 100vw\)/);
    expect(css).toMatch(/z-index: var\(--z-sheet\)/);
    expect(css).toMatch(/overflow-y: auto/);
  });
});
