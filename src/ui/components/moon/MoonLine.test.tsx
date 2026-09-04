/**
 * R30 (FR-MOON-3, US-18 AC2): the Moon's observing facts, in one line, in
 * both languages, with the direction and the elevation only while it is up.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import { I18nProvider } from '../../../i18n/useT';
import { MoonLine } from './MoonLine';

describe('<MoonLine> (FR-MOON-3)', () => {
  it('names the phase, the illumination and where the Moon is', () => {
    render(<MoonLine moon={MOON_FIXTURE} />);
    expect(screen.getByTestId('moon-line')).toHaveTextContent('Moon: waning gibbous, 72 % lit, N 7°, 29° up.');
  });

  it('says the Moon is below the horizon instead of pointing at it', () => {
    render(<MoonLine moon={MOON_DOWN} />);
    expect(screen.getByTestId('moon-line')).toHaveTextContent('Moon: waning gibbous, 72 % lit, below the horizon.');
  });

  it('is Spanish under a Spanish provider (FR-I18N-2)', () => {
    render(
      <I18nProvider locale="es">
        <MoonLine moon={MOON_FIXTURE} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('moon-line')).toHaveTextContent('Luna: gibosa menguante, 72 % iluminada, N 7°, 29° de altura.');
  });
});
