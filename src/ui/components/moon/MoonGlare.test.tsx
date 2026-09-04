/**
 * R30 (FR-MOON-2, US-18 AC1): the label and the guide sentence appear
 * together with the worker's verdict and never on their own reading of it,
 * and both describe themselves with the thresholds they were judged against
 * (OQ-12). The truth table of the three conditions is `physics/moon.test.ts`;
 * what is checked here is that the UI shows exactly what the verdict says.
 */
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MOON_DOWN, MOON_FIXTURE, NO_MOON_GLARE } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import type { MoonGlare } from '../../../model';
import { MoonGlareLabel, MoonGlareNote } from './MoonGlare';

const GLARE: MoonGlare = { glare: true, separationDeg: 8.2 };

describe('<MoonGlareLabel> (FR-MOON-2)', () => {
  it('labels a pass the worker marked, and describes it with the measurement and the thresholds', async () => {
    const { container } = render(<MoonGlareLabel moon={MOON_FIXTURE} glare={GLARE} />);
    const label = screen.getByText('moon glare');
    expect(label).toHaveAccessibleDescription('The Moon is 72 % lit and 8° from the pass peak. A pass is marked when the Moon is above the horizon at the peak, at least 50 % lit and closer than 30°.');
    expect(label).toHaveAttribute('tabindex', '0');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders nothing when the verdict is no glare, whatever the Moon is doing', () => {
    const { container } = render(<MoonGlareLabel moon={MOON_FIXTURE} glare={NO_MOON_GLARE} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('moon-glare-label')).toBeNull();
  });

  it('follows the verdict, not the Moon: a Moon below the horizon with a glare verdict is not second-guessed here (D-109)', () => {
    render(<MoonGlareLabel moon={MOON_DOWN} glare={GLARE} />);
    expect(screen.getByTestId('moon-glare-label')).toBeInTheDocument();
  });

  it('is Spanish under a Spanish provider, thresholds and all (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <MoonGlareLabel moon={MOON_FIXTURE} glare={GLARE} />
      </I18nProvider>,
    );
    const label = screen.getByText('resplandor lunar');
    expect(label).toHaveAccessibleDescription(/iluminada al 72 % y a 8° del máximo del pase.*al menos al 50 % y a menos de 30°/);
    expect(screen.queryByText('moon glare')).toBeNull();
  });
});

describe('<MoonGlareNote> (FR-MOON-2, the guide)', () => {
  it('is the requirement’s one sentence, carrying the same tooltip as the label', () => {
    render(<MoonGlareNote moon={MOON_FIXTURE} glare={GLARE} />);
    const sentence = screen.getByText('The Moon is bright and close to the track.');
    expect(sentence).toHaveAccessibleDescription(/at least 50 % lit and closer than 30°/);
  });

  it('says nothing when there is no glare', () => {
    const { container } = render(<MoonGlareNote moon={MOON_FIXTURE} glare={NO_MOON_GLARE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is Spanish under a Spanish provider', () => {
    render(
      <I18nProvider locale="es">
        <MoonGlareNote moon={MOON_FIXTURE} glare={GLARE} />
      </I18nProvider>,
    );
    expect(screen.getByText('La Luna está brillante y cerca del recorrido.')).toBeInTheDocument();
  });
});
