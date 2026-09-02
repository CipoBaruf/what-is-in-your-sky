import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Banner } from './Banner';

describe('Banner (R11, FR-X-5)', () => {
  it('info is a polite status with a spelled-out prefix', async () => {
    const { container } = render(<Banner variant="info">Elements are kept in memory only.</Banner>);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('[Note] Elements are kept in memory only.');
    expect(banner).toHaveAttribute('data-variant', 'info');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('warning is an alert with a spelled-out prefix', async () => {
    const { container } = render(
      <Banner variant="warning" testId="stale">
        CelesTrak could not be reached.
      </Banner>,
    );
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('[Warning] CelesTrak could not be reached.');
    expect(banner).toHaveAttribute('data-variant', 'warning');
    expect(screen.getByTestId('stale')).toBe(banner);
    expect(await axe(container)).toHaveNoViolations();
  });
});
