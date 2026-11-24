/**
 * R104 (FR-DS-4 item 1, US-37 AC2), R206 (FR-CTRL-1, FR-CTRL-17; D-1226): the
 * button in both themes — the words, the box on the span inside the hit box,
 * the state in `aria-pressed`, the disabled form, the note that describes and
 * does not name, the summary form.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decorations, rowCells } from '../../../../tests/styles/cells';
import { TextButton } from './TextButton';

const THEMES = ['dark', 'night'] as const;
const css = readFileSync('src/ui/components/primitives/TextButton.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the rule whose selector is exactly `selector`. */
const rule = (selector: string): string => new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe.each(THEMES)('<TextButton> under data-theme=%s', (theme) => {
  const themed = (): void => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  it('FR-CTRL-1: is a button named by its label alone, its box the span inside it', async () => {
    themed();
    const onClick = vi.fn();
    const { container } = render(<TextButton label="retry" onClick={onClick} data-testid="t" />);
    const button = screen.getByRole('button', { name: 'retry' });
    expect(button).toHaveTextContent(/^retry$/);
    expect(button.children).toHaveLength(1);
    expect(button.firstElementChild?.className).toMatch(/buttonBox/);
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('aria-pressed');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('carries its forms as classes of its own module and a disabled state that takes no tap', () => {
    themed();
    const onClick = vi.fn();
    render(
      <>
        <TextButton label="plain" onClick={onClick} />
        <TextButton label="dim" tone="dim" />
        <TextButton label="danger" tone="danger" />
        <TextButton label="inline" inline />
        <TextButton label="edge" box="plain" />
        <TextButton label="accent" box="accent" fill tall />
        <TextButton label="wrap" wrap />
        <TextButton label="bare" bare />
        <TextButton label="padded" padded />
        <TextButton label="off" disabled onClick={onClick} />
      </>,
    );
    const className = (name: string): string => screen.getByRole('button', { name }).className;
    expect(className('plain')).toMatch(/textButton/);
    // `bare` is a root class of its own with no box, so the cell count reads the words alone (D-911).
    expect(className('bare')).toMatch(/bare/);
    expect(className('bare')).not.toMatch(/textButton/);
    expect(screen.getByRole('button', { name: 'bare' }).children).toHaveLength(0);
    expect(className('padded')).toMatch(/padded/);
    expect(className('padded')).toMatch(/textButton/);
    expect(className('dim')).toMatch(/dim/);
    expect(className('danger')).toMatch(/danger/);
    expect(className('inline')).toMatch(/inline-control/);
    expect(className('inline')).toMatch(/inline/);
    // FR-CTRL-1: `plain` is the default's box; only the primary form carries a class.
    expect(className('edge')).toBe(className('plain'));
    expect(className('accent')).toMatch(/accent/);
    expect(className('accent')).toMatch(/fill/);
    expect(className('accent')).toMatch(/tall/);
    expect(className('wrap')).toMatch(/wrap/);
    fireEvent.click(screen.getByRole('button', { name: 'off' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'off' })).toBeDisabled();
  });

  it('FR-CTRL-2: pressed, it is an option — the option’s box and aria-pressed', async () => {
    themed();
    const { container, rerender } = render(<TextButton label="Soonest" pressed />);
    const button = screen.getByRole('button', { name: 'Soonest' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toMatch(/toggle/);
    expect(button.className).not.toMatch(/textButton/);
    expect(button.firstElementChild?.className).toMatch(/optionBox/);
    rerender(<TextButton label="Soonest" pressed={false} />);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('as a radio in a radiogroup, the state is aria-checked and never aria-pressed', () => {
    themed();
    render(
      <div role="radiogroup" aria-label="Pick">
        <TextButton label="A" pressed role="radio" />
        <TextButton label="B" pressed={false} role="radio" tabIndex={-1} />
      </div>,
    );
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'A' })).not.toHaveAttribute('aria-pressed');
  });

  it('note: the line under the label describes the control and does not name it (FR-FIRST-2)', async () => {
    themed();
    const { container } = render(<TextButton label="Use my location" box="accent" fill note="It is the quickest way" look="plain" aria-label="Use my location" />);
    const button = screen.getByRole('button', { name: 'Use my location' });
    expect(button).toHaveAccessibleDescription('It is the quickest way');
    expect(button.className).toMatch(/boxedNote/);
    expect(button.className).toMatch(/plain/);
    expect(button.className).not.toMatch(/textButton/);
    // With a note the button is the box itself (FR-FIRST-2), and has no second one inside.
    expect(button.querySelector('[class*="buttonBox"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('FR-CTRL-4: busy is aria-busy with the label, the box and the width unchanged, and takes no press', async () => {
    themed();
    const onClick = vi.fn();
    const rules = decorations(['src/ui/components/primitives/TextButton.module.css']);
    const form = (busy: boolean) => <TextButton label="Use my location" busy={busy} disabled={busy} onClick={onClick} />;
    const { container, rerender } = render(form(false));
    const button = screen.getByRole('button', { name: 'Use my location' });
    const width = rowCells(container, rules);
    expect(width).toBe('Use my location'.length + 2);
    expect(button).not.toHaveAttribute('aria-busy');
    const box = button.firstElementChild;
    const boxClass = box?.className;

    rerender(form(true));
    expect(screen.getByRole('button', { name: 'Use my location' })).toBe(button);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // D-1256: never the disabled look or its lost focus, even where the caller disables what is running.
    expect(button).toBeEnabled();
    expect(rowCells(container, rules)).toBe(width);
    expect(button.firstElementChild).toBe(box);
    expect(box?.className).toBe(boxClass);
    expect(box?.firstElementChild?.className).toMatch(/words/);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();

    rerender(form(false));
    expect(button).not.toHaveAttribute('aria-busy');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('FR-CTRL-4: under reduced motion the busy words are held, and only while busy', () => {
    themed();
    vi.stubGlobal('matchMedia', (media: string) => ({ media, matches: media.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { rerender } = render(<TextButton label="retry" busy />);
    expect(screen.getByRole('button')).toHaveAttribute('data-motion', 'reduce');
    rerender(<TextButton label="retry" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-motion');
  });

  it('FR-CTRL-4: busy with a note pulses the words and keeps the description', () => {
    themed();
    render(<TextButton label="Use my location" note="It is the quickest way" busy />);
    const button = screen.getByRole('button', { name: /Use my location/ });
    expect(button).toHaveAccessibleDescription('It is the quickest way');
    expect(button.className).toMatch(/busy/);
    expect(screen.getByText('Use my location').className).toMatch(/words/);
  });

  it('FR-CTRL-4: a busy summary is aria-busy, held under reduced motion, and toggles nothing', async () => {
    themed();
    vi.stubGlobal('matchMedia', (media: string) => ({ media, matches: media.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const onClick = vi.fn();
    const form = (busy: boolean) => (
      <details data-testid="d">
        <TextButton as="summary" label="details" busy={busy} disabled={busy} onClick={onClick} data-testid="s" />
        <p>trace</p>
      </details>
    );
    const { container, rerender } = render(form(true));
    const summary = screen.getByTestId('s');
    expect(summary).toHaveAttribute('aria-busy', 'true');
    expect(summary).toHaveAttribute('aria-disabled', 'true');
    expect(summary).toHaveAttribute('data-motion', 'reduce');
    expect(summary).not.toHaveAttribute('disabled');
    fireEvent.click(summary);
    expect(screen.getByTestId('d')).not.toHaveAttribute('open');
    expect(onClick).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();

    rerender(form(false));
    for (const name of ['aria-busy', 'aria-disabled', 'data-motion']) expect(summary).not.toHaveAttribute(name);
    fireEvent.click(summary);
    expect(screen.getByTestId('d')).toHaveAttribute('open');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('as="summary": the disclosure of a <details>, drawn as the control', () => {
    themed();
    render(
      <details>
        <TextButton as="summary" label="details" data-testid="s" />
        <pre>trace</pre>
      </details>,
    );
    const summary = screen.getByTestId('s');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.className).toMatch(/textButton/);
    expect(summary.className).toMatch(/summary/);
    expect(summary).toHaveTextContent(/^details$/);
  });
});

describe('<TextButton> forms in its stylesheet (R206)', () => {
  it('FR-CTRL-1: the box is --control-h tall with the cell of padding, the edge and the corners of the control tokens', () => {
    expect(rule('.buttonBox')).toMatch(/line-height:\s*calc\(var\(--control-h\) - 2 \* var\(--hairline\)\)/);
    expect(rule('.buttonBox')).toMatch(/padding-inline:\s*calc\(var\(--control-pad\) - var\(--hairline\)\)/);
    expect(rule('.buttonBox')).toMatch(/border:\s*var\(--control-edge\)/);
    expect(rule('.buttonBox')).toMatch(/border-radius:\s*var\(--control-radius\)/);
  });

  it('FR-CTRL-1: the --tap hit area on compact is the element’s — global.css’s floor, inline-control’s padding — and the box takes no height from it', () => {
    const global = readFileSync('src/ui/styles/global.css', 'utf8');
    expect(global).toMatch(/\ninput,\nbutton \{[^}]*min-height: var\(--tap\)/);
    expect(global).toMatch(/\.inline-control \{[^}]*padding-block: calc\(\(var\(--tap\) - var\(--row\)\) \/ 2\)/);
    for (const selector of ['.textButton,\n.bare,\n.toggle', '.textButton::after', '.buttonBox']) expect(rule(selector), selector).not.toMatch(/min-height|min-block-size|(^|[\s;])height:/);
    expect(rule('.buttonBox')).toMatch(/margin-block:\s*calc\(var\(--control-h\) \/ -2\)/);
  });

  it('FR-CTRL-1: hover and press lay the raised ground and the dim edge; the primary form’s edge is the mark', () => {
    const hover = rule('.textButton:is(:hover, :active):not(:disabled) > .buttonBox');
    expect(hover).toMatch(/background:\s*var\(--hover-ground\)/);
    expect(hover).toMatch(/border-color:\s*var\(--fg-dim\)/);
    expect(rule('.accent > .buttonBox')).toMatch(/border-color:\s*var\(--mark\)/);
  });

  it('FR-CTRL-4: the words pulse between 1 and 0.35, held at 0.35 under reduced motion, and nothing that has a size moves', () => {
    expect(css).toMatch(/@keyframes pulse \{\s*from \{\s*opacity: 1;\s*\}\s*to \{\s*opacity: 0\.35;/);
    expect(rule('.words,\n.busy > .note')).toMatch(/animation: pulse/);
    const held = rule(".busy[data-motion='reduce'] .words,\n.busy[data-motion='reduce'] > .note");
    expect(held).toMatch(/animation: none;\s*opacity: 0\.35/);
    expect(rule('.words,\n.busy > .note')).not.toMatch(/padding|margin|width|height|border|display/);
  });

  it('FR-CTRL-13: `link` is an action in a line of text — the accent, underlined, no box, inline-control’s --tap hit area with a --tap floor on its width', () => {
    render(<TextButton link label="change" />);
    const button = screen.getByRole('button', { name: 'change' });
    expect(button.className).toMatch(/link/);
    expect(button.className).toMatch(/inline-control/);
    expect(button.className).not.toMatch(/textButton/);
    expect(button.children).toHaveLength(0);
    const look = rule('.link');
    expect(look).toMatch(/color:\s*var\(--accent\)/);
    expect(look).toMatch(/text-decoration:\s*underline/);
    expect(look).toMatch(/border:\s*0/);
    expect(look).toMatch(/min-width:\s*var\(--tap\)/);
    expect(look).not.toMatch(/min-height|inline-size|padding-block/);
    expect(rule('.link:disabled')).toMatch(/color:\s*var\(--fg-dim\)/);
  });

  it('FR-CTRL-4: a busy summary loses the pointer', () => {
    expect(rule('.summary.busy')).toMatch(/cursor:\s*default/);
  });

  it('FR-CTRL-17: disabled keeps the shape, dim words in the rule’s edge, and no hover; the ring is the global one', () => {
    const disabled = rule('.textButton:disabled > .buttonBox');
    expect(disabled).toMatch(/color:\s*var\(--fg-dim\)/);
    expect(disabled).toMatch(/border-color:\s*var\(--rule\)/);
    for (const [selector] of css.matchAll(/[^{}]*:hover[^{}]*(?=\{)/g)) expect(selector).toContain(':not(:disabled)');
    expect(css).not.toMatch(/outline/);
  });
});
