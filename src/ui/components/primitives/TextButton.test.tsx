/**
 * R104 (FR-DS-4 item 1, US-37 AC2): the `[ label ]` button in both themes —
 * the words, the state in the characters (`aria-pressed`), the disabled dim,
 * the note that describes and does not name, the summary form; and that the
 * brackets are the stylesheet's `::before` / `::after` rather than text, which
 * is what keeps a control's accessible name its words alone.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextButton } from './TextButton';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<TextButton> under data-theme=%s', (theme) => {
  const themed = (): void => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  it('is a button named by its label alone, the brackets being the stylesheet’s', async () => {
    themed();
    const onClick = vi.fn();
    const { container } = render(<TextButton label="retry" onClick={onClick} data-testid="t" />);
    const button = screen.getByRole('button', { name: 'retry' });
    expect(button).toHaveTextContent(/^retry$/);
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
        <TextButton label="edge" box="edge" />
        <TextButton label="accent" box="accent" fill tall />
        <TextButton label="wrap" wrap />
        <TextButton label="off" disabled onClick={onClick} />
      </>,
    );
    const className = (name: string): string => screen.getByRole('button', { name }).className;
    expect(className('plain')).toMatch(/textButton/);
    expect(className('dim')).toMatch(/dim/);
    expect(className('danger')).toMatch(/danger/);
    expect(className('inline')).toMatch(/inline-control/);
    expect(className('inline')).toMatch(/inline/);
    expect(className('edge')).toMatch(/edge/);
    expect(className('accent')).toMatch(/accent/);
    expect(className('accent')).toMatch(/fill/);
    expect(className('accent')).toMatch(/tall/);
    expect(className('wrap')).toMatch(/wrap/);
    fireEvent.click(screen.getByRole('button', { name: 'off' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'off' })).toBeDisabled();
  });

  it('pressed: a pressed text control, its state in aria-pressed, and the tight form a class of its own', async () => {
    themed();
    const { container, rerender } = render(<TextButton label="Soonest" pressed />);
    const button = screen.getByRole('button', { name: 'Soonest' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toMatch(/toggle/);
    expect(button.className).not.toMatch(/toggleTight/);
    rerender(<TextButton label="Soonest" pressed={false} tight />);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.className).toMatch(/toggleTight/);
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
    expect(screen.getByText('Use my location').className).toMatch(/noteLabel/);
    expect(await axe(container)).toHaveNoViolations();
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
