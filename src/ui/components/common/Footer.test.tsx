/** TASKS R12 (FR-X-2): the footer carries the three attribution sentences, each source linked, and the privacy note. R17: in whichever language is active, with the provider names untranslated (FR-I18N-6). R23 (D-120): and the author's credit, in both of the two forms the layout picks between. R102 (FR-SHOW-8, D-657): and the chart's credit — glyphcss and Juan Cruz Fortunatti, two links — in all three forms and both languages. */
import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import type { LinkedText } from '../../../i18n/messages';
import { I18nProvider } from '../../../i18n/useT';
import { stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { Footer } from './Footer';

let media: MatchMediaStub | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

const sentence = (text: LinkedText): string => `${text.before}${text.link}${text.middle ?? ''}${text.link2 ?? ''}${text.after}`;

/** FR-X-2 as amended v2.2: the four credits, each name linked to where it says (R102, FR-SHOW-8). */
const CREDITS: Record<string, string> = {
  CelesTrak: 'https://celestrak.org/',
  'Open-Meteo.com': 'https://open-meteo.com/',
  GeoNames: 'https://www.geonames.org/',
  'Ezequiel Baruf': 'https://github.com/CipoBaruf',
  glyphcss: 'https://glyphcss.com',
  'Juan Cruz Fortunatti': 'https://www.linkedin.com/in/juancfortunatti/',
};

function expectCredits(): void {
  const footer = screen.getByRole('contentinfo');
  for (const [name, href] of Object.entries(CREDITS)) expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  expect(footer.querySelectorAll('a')).toHaveLength(Object.keys(CREDITS).length);
}

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

  // R102 (FR-SHOW-8, FR-X-2 as amended v2.2, D-657): the fourth credit, one sentence with two links.
  it('credits the chart library and its author in the full form, as its last sentence', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-form', 'full');
    expect(footer).toHaveTextContent('Sky chart: glyphcss by Juan Cruz Fortunatti.');
    expectCredits();
    const lines = Array.from(footer.querySelectorAll('p')).map((p) => p.textContent);
    expect(lines).toHaveLength(6);
    expect(lines[5]).toBe('Sky chart: glyphcss by Juan Cruz Fortunatti.');
    // The two links are in the one sentence, in this order.
    const chart = footer.querySelectorAll('p')[5];
    expect(Array.from(chart?.querySelectorAll('a') ?? []).map((a) => a.textContent)).toEqual(['glyphcss', 'Juan Cruz Fortunatti']);
  });

  it('says the same in Spanish, with the same links (FR-I18N-2, FR-I18N-6)', () => {
    render(
      <I18nProvider locale="es">
        <Footer />
      </I18nProvider>,
    );
    const footer = screen.getByRole('contentinfo');
    for (const text of [es.footer.celestrak, es.footer.openMeteo, es.footer.geonames, es.footer.chart]) expect(footer).toHaveTextContent(sentence(text));
    expect(footer).toHaveTextContent(es.footer.privacy);
    expect(footer).not.toHaveTextContent(en.footer.privacy);
    expect(footer).toHaveTextContent('Carta del cielo: glyphcss, de Juan Cruz Fortunatti.');
    expect(footer).not.toHaveTextContent('Sky chart');
    expectCredits();
  });

  // D-120: wide says the same thing in one row, and may not drop the attribution doing it.
  it('condenses to one row when the layout is wide, every source still named and linked', async () => {
    media = stubMatchMedia(1280);
    const { container } = render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-form', 'short');
    expect(footer.querySelectorAll('p')).toHaveLength(1);
    expectCredits();
    // The licence the geocoding data is used under is still named.
    expect(footer).toHaveTextContent('CC BY 4.0');
    expect(footer).toHaveTextContent(en.footer.short.privacy);
    // R102 (D-657): the chart's two names stand as links after `Chart:`, the last item of the row.
    expect(footer).toHaveTextContent(/Built by Ezequiel Baruf\.\s*·\s*Chart: glyphcss, Juan Cruz Fortunatti$/);
    // The four long sentences are gone, not merely hidden.
    expect(footer).not.toHaveTextContent(en.footer.privacy);
    expect(footer).not.toHaveTextContent('Sky chart');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('condenses the same way in Spanish (FR-I18N-2)', () => {
    media = stubMatchMedia(1280);
    render(
      <I18nProvider locale="es">
        <Footer />
      </I18nProvider>,
    );
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-form', 'short');
    expect(footer.querySelectorAll('p')).toHaveLength(1);
    expectCredits();
    expect(footer).toHaveTextContent(/Datos: CelesTrak, Open-Meteo\.com, GeoNames \(CC BY 4\.0\)\s*·\s*Sin rastreo\s*·\s*Hecho por Ezequiel Baruf\.\s*·\s*Carta: glyphcss, Juan Cruz Fortunatti$/);
    expect(footer).not.toHaveTextContent('Chart:');
  });

  // R87 (D-548): the phone's first-run steps take the row without its privacy word; R102: the chart's credit rides on it too.
  it('is the row without its privacy word in the line form, at a compact width, with all four credits', async () => {
    media = stubMatchMedia(390);
    const { container } = render(<Footer form="line" />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-form', 'line');
    expect(footer.querySelectorAll('p')).toHaveLength(1);
    expectCredits();
    expect(footer).not.toHaveTextContent(en.footer.short.privacy);
    expect(footer).toHaveTextContent(/^Data: CelesTrak, Open-Meteo\.com, GeoNames \(CC BY 4\.0\)\s*·\s*Built by Ezequiel Baruf\.\s*·\s*Chart: glyphcss, Juan Cruz Fortunatti$/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is the same line in Spanish', () => {
    media = stubMatchMedia(390);
    render(
      <I18nProvider locale="es">
        <Footer form="line" />
      </I18nProvider>,
    );
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-form', 'line');
    expectCredits();
    expect(footer).toHaveTextContent(/^Datos: CelesTrak, Open-Meteo\.com, GeoNames \(CC BY 4\.0\)\s*·\s*Hecho por Ezequiel Baruf\.\s*·\s*Carta: glyphcss, Juan Cruz Fortunatti$/);
    expect(footer).not.toHaveTextContent('Sin rastreo');
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
