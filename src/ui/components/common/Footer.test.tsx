/** TASKS R12 (FR-X-2): the footer carries the three attribution sentences, each source linked, and the privacy note. */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTIONS, Footer, PRIVACY_NOTE } from './Footer';

describe('<Footer>', () => {
  it('contains the CelesTrak, Open-Meteo and GeoNames attributions with links, and the privacy note', async () => {
    const { container } = render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    for (const text of Object.values(ATTRIBUTIONS)) expect(footer).toHaveTextContent(text);
    expect(footer).toHaveTextContent(PRIVACY_NOTE);
    expect(screen.getByRole('link', { name: 'CelesTrak' })).toHaveAttribute('href', 'https://celestrak.org/');
    expect(screen.getByRole('link', { name: 'Open-Meteo.com' })).toHaveAttribute('href', 'https://open-meteo.com/');
    expect(screen.getByRole('link', { name: 'GeoNames' })).toHaveAttribute('href', 'https://www.geonames.org/');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is inert while the detail sheet is up', () => {
    render(<Footer inert />);
    expect(screen.getByRole('contentinfo', { hidden: true })).toHaveAttribute('inert');
  });
});
