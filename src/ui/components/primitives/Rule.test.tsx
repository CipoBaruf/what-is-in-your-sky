/**
 * R105 (FR-DS-4 item 5): the plain divider in both themes — an `<hr>` kept out
 * of the accessibility tree, the module's class and the host's placement class
 * together, and nothing else on it.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { Rule } from './Rule';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Rule> under data-theme=%s', (theme) => {
  it('is a presentational hr carrying the module’s class and the host’s placement class', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const { container } = render(
      <section aria-label="A block">
        <p>Above the rule.</p>
        <Rule className="placed" />
        <p>Under it.</p>
      </section>,
    );
    const rule = container.querySelector('hr');
    expect(rule).not.toBeNull();
    expect(rule).toHaveAttribute('role', 'presentation');
    expect(rule?.className).toMatch(/rule/);
    expect(rule?.className).toMatch(/placed/);
    expect(rule).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
