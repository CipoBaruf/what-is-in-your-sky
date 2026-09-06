/**
 * R49 (F-14), US-18 AC1: the Moon's phase and illumination at the pass peak,
 * on their own account. R30 tied them to the glare verdict, so an ordinary
 * pass under an ordinary Moon said nothing about it; every test here uses a
 * Moon the worker did *not* mark, which is the case that used to be silent.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import { MoonAtPeak } from './MoonAtPeak';

describe('<MoonAtPeak> (US-18 AC1)', () => {
  it('names the phase and the illumination for a Moon that is up, with no glare in sight', async () => {
    const { container } = render(<MoonAtPeak moon={MOON_FIXTURE} />);
    expect(screen.getByTestId('moon-at-peak')).toHaveTextContent('Moon at the peak: waning gibbous, 72 % lit');
    // It is a statement, not a warning: nothing to focus, nothing to hover.
    expect(screen.queryByText('moon glare')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says nothing when the Moon is below the horizon at the peak', () => {
    const { container } = render(<MoonAtPeak moon={MOON_DOWN} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing at exactly the horizon, the same edge the Now panel takes', () => {
    const { container } = render(<MoonAtPeak moon={{ ...MOON_FIXTURE, elDeg: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reads in Spanish (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <MoonAtPeak moon={MOON_FIXTURE} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('moon-at-peak')).toHaveTextContent('Luna en el máximo: gibosa menguante, 72 % iluminada');
    expect(screen.queryByText(/Moon/)).toBeNull();
  });

  it('is the same line in the guide, spaced for the paragraphs around it', () => {
    const card = render(<MoonAtPeak moon={MOON_FIXTURE} />);
    const cardClass = screen.getByTestId('moon-at-peak').className;
    const cardText = screen.getByTestId('moon-at-peak').textContent;
    card.unmount();

    render(<MoonAtPeak moon={MOON_FIXTURE} variant="guide" />);
    expect(screen.getByTestId('moon-at-peak')).toHaveTextContent(cardText ?? '');
    expect(screen.getByTestId('moon-at-peak').className).not.toBe(cardClass);
  });
});
