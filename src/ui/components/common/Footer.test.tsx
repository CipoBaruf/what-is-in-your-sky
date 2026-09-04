/** TASKS R12 (FR-X-2): the footer carries the three attribution sentences, each source linked, and the privacy note. R17: in whichever language is active, with the provider names untranslated (FR-I18N-6). R23 (D-120): and the author's credit, in both of the two forms the layout picks between. */
import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { Footer } from './Footer';

let media: MatchMediaStub | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

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
    // D-120: whose page this is, linked to the profile.
    expect(footer).toHaveTextContent(sentence(en.footer.credit));
    expect(screen.getByRole('link', { name: 'Ezequiel Baruf' })).toHaveAttribute('href', 'https://github.com/CipoBaruf');
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

  // D-120: wide says the same thing in one row, and may not drop the attribution doing it.
  it('condenses to one row when the layout is wide, every source still named and linked', async () => {
    media = stubMatchMedia(1280);
    const { container } = render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-form', 'short');
    expect(footer.querySelectorAll('p')).toHaveLength(1);
    for (const name of ['CelesTrak', 'Open-Meteo.com', 'GeoNames', 'Ezequiel Baruf']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Ezequiel Baruf' })).toHaveAttribute('href', 'https://github.com/CipoBaruf');
    // The licence the geocoding data is used under is still named.
    expect(footer).toHaveTextContent('CC BY 4.0');
    expect(footer).toHaveTextContent(en.footer.short.privacy);
    // The four long sentences are gone, not merely hidden.
    expect(footer).not.toHaveTextContent(en.footer.privacy);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('goes back to the four sentences when the viewport narrows again', () => {
    media = stubMatchMedia(1280);
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toHaveAttribute('data-form', 'short');
    act(() => {
      media?.setWidth(390);
    });
    expect(screen.getByRole('contentinfo')).toHaveAttribute('data-form', 'full');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(en.footer.privacy);
  });

  it('is inert while the detail sheet is up', () => {
    render(<Footer inert />);
    expect(screen.getByRole('contentinfo', { hidden: true })).toHaveAttribute('inert');
  });
});
