// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AskDialog } from './AskDialog';

/** R224 (FR-CTRL-16, FR-CTRL-17): one dialog frame, its answers boxes with the first one primary. */
describe('<AskDialog> (FR-CTRL-16, FR-CTRL-17)', () => {
  it('FR-CTRL-16: the first answer is the primary box, the second a plain box', () => {
    render(<AskDialog question="Follow?" yes="Yes" no="No" onYes={() => {}} onNo={() => {}} testId="ask" yesTestId="ask-yes" noTestId="ask-no" />);
    expect(screen.getByTestId('ask-yes').className).toMatch(/accent/);
    expect(screen.getByTestId('ask-no').className).not.toMatch(/accent/);
    expect(screen.getByTestId('ask-yes')).toHaveFocus();
  });

  it('FR-CTRL-17: the frame is --bg-raised with --border-control and --radius-2', () => {
    const css = readFileSync(join(__dirname, 'AskDialog.module.css'), 'utf8');
    const frame = /\.frame\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(frame).toMatch(/border:\s*var\(--border-control\)/);
    expect(frame).toMatch(/border-radius:\s*var\(--radius-2\)/);
    expect(frame).toMatch(/background:\s*var\(--bg-raised\)/);
  });
});
