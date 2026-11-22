/**
 * TASKS R13, moved and re-cut by R104 (FR-DS-4 item 3), R206 (FR-CTRL-2): one
 * option in both themes — a pressed-state button whose state is `aria-pressed`
 * and a filled block, whose tap means what the parent says (nothing, when the
 * parent passes nothing), and whose value is findable as `data-option` (R66).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OptionToggle } from './OptionToggle';

const THEMES = ['dark', 'night'] as const;
const css = readFileSync('src/ui/components/primitives/OptionToggle.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the rule whose selector is exactly `selector`. */
const rule = (selector: string): string => new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<OptionToggle> under data-theme=%s', (theme) => {
  it('is a pressed-state button named by its label, with its value as data-option', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const onPress = vi.fn();
    const { container, rerender } = render(<OptionToggle label="Alpha" pressed={false} value="a" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Alpha' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('data-option', 'a');
    expect(button).toHaveTextContent(/^Alpha$/);
    expect(button.firstElementChild?.className).toMatch(/optionBox/);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<OptionToggle label="Alpha" pressed value="a" />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('alone, it is drawn as any other; as a radio, its state is aria-checked', () => {
    document.documentElement.setAttribute('data-theme', theme);
    render(
      <>
        <OptionToggle label="Hidden" pressed alone aria-label="Hidden objects" />
        <div role="radiogroup" aria-label="Pick">
          <OptionToggle label="A" pressed role="radio" />
        </div>
      </>,
    );
    const alone = screen.getByRole('button', { name: 'Hidden objects' });
    expect(alone.className).toMatch(/option/);
    expect(alone.firstElementChild?.className).toMatch(/optionBox/);
    const radio = screen.getByRole('radio', { name: 'A' });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    expect(radio).not.toHaveAttribute('aria-pressed');
    expect(radio.className).toBe(alone.className);
  });
});

describe('<OptionToggle> target (R134, FR-FLOW-11, D-851)', () => {
  it('is a .target, alone or in a group', () => {
    render(<OptionToggle label="Hidden" pressed={false} alone />);
    expect(screen.getByRole('button', { name: 'Hidden' })).toHaveClass('target');
  });

  it('is no .target when its row is the target', () => {
    render(<OptionToggle label="N" pressed={false} target={false} />);
    const point = screen.getByRole('button', { name: /N/ });
    expect(point).not.toHaveClass('target');
    expect(point.firstElementChild?.className).toMatch(/denseBox/);
  });
});

describe('<OptionToggle> forms in its stylesheet (R206)', () => {
  const boxes = ' > :is(.optionBox, .denseBox)';

  it('FR-CTRL-2: off is the dim word, on is --on-ink on a block of --on-ground, the same cell of padding in both', () => {
    expect(rule('.optionBox,\n.denseBox')).toMatch(/color:\s*var\(--fg-dim\)/);
    expect(rule('.optionBox,\n.denseBox')).toMatch(/border-radius:\s*var\(--control-radius\)/);
    expect(rule('.optionBox,\n.denseBox')).toMatch(/line-height:\s*var\(--control-h\)/);
    expect(rule('.optionBox')).toMatch(/padding-inline:\s*var\(--control-pad\)/);
    const on = rule(`:is(button, summary):is([aria-pressed='true'], [aria-checked='true']):not(:disabled)${boxes}`);
    expect(on).toMatch(/background:\s*var\(--on-ground\)/);
    expect(on).toMatch(/color:\s*var\(--on-ink\)/);
    expect(on).not.toMatch(/padding|margin|border/);
    expect(css).not.toMatch(/content:\s*'[^']+'/);
  });

  it('FR-CTRL-2: hover lays the raised ground under an option that is off, and loses to on', () => {
    const hover = `:is(button, summary):is(:hover, :active):not(:disabled)${boxes}`;
    expect(rule(hover)).toMatch(/background:\s*var\(--hover-ground\)/);
    expect(css.indexOf(hover)).toBeLessThan(css.indexOf(":is([aria-pressed='true']"));
  });

  it('FR-CTRL-17: disabled and on, the block keeps its shape', () => {
    expect(rule(`:is(button, summary):disabled:is([aria-pressed='true'], [aria-checked='true'])${boxes}`)).toMatch(/background:\s*var\(--hover-ground\)/);
  });
});
