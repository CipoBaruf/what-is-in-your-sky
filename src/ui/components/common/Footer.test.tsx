/** TASKS R12 (FR-X-2): the footer carries the three attribution sentences, each source linked, and the privacy note. R17: in whichever language is active, with the provider names untranslated (FR-I18N-6). */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { Footer } from './Footer';

const sentence = (text: { before: string; link: string; after: string }): string => `${text.before}${text.link}${text.after}`;

describe('<Footer>', () => {
  it('contains the CelesTrak, Open-Meteo and GeoNames attributions with links, and the privacy note', async () => {
    const { container } = render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    for (const text of [en.footer.celestrak, en.footer.openMeteo, en.footer.geonames]) expect(footer).toHaveTextContent(sentence(text));
    expect(footer).toHaveTextContent(en.footer.privacy);
    expect(screen.getByRole('link', { name: 'CelesTrak' })).toHaveAttribute('href', 'https://celestrak.org/');
    expect(screen.getByRole('link', { name: 'Open-Meteo.com' })).toHaveAttribute('href', 'https://open-meteo.com/');
    expect(screen.getByRole('link', { name: 'GeoNames' })).toHaveAttribute('href', 'https://www.geonames.org/');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says the same in Spanish, with the same three links (FR-I18N-2, FR-I18N-6)', () => {
    render(
      <I18nProvider locale="es">
        <Footer />
      </I18nProvider>,
    );
    const footer = screen.getByRole('contentinfo');
    for (const text of [es.footer.celestrak, es.footer.openMeteo, es.footer.geonames]) expect(footer).toHaveTextContent(sentence(text));
    expect(footer).toHaveTextContent(es.footer.privacy);
    expect(footer).not.toHaveTextContent(en.footer.privacy);
    expect(screen.getByRole('link', { name: 'CelesTrak' })).toHaveAttribute('href', 'https://celestrak.org/');
  });

  it('is inert while the detail sheet is up', () => {
    render(<Footer inert />);
    expect(screen.getByRole('contentinfo', { hidden: true })).toHaveAttribute('inert');
  });
});
