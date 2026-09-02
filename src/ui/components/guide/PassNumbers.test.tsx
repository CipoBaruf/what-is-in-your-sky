import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { PassNumbers } from './PassNumbers';

const pass = { ...goldenPassFixture(), start: { ...goldenPassFixture().start, rangeKm: 1513.1 }, peak: { ...goldenPassFixture().peak, rangeKm: 1504.8 }, end: { ...goldenPassFixture().end, rangeKm: 1515.7 } };

describe('<PassNumbers> (US-6 AC2, FR-VIS-3)', () => {
  it('lists start, peak and end with time to the second, azimuth in degrees and compass, elevation and range', () => {
    render(<PassNumbers pass={pass} timeZone={null} />);
    const row = (name: string): string[] =>
      within(screen.getByRole('row', { name: new RegExp(`^${name} `) }))
        .getAllByRole('cell')
        .map((c) => c.textContent ?? '');
    expect(row('Start')).toEqual(['09:48:14 UTC', 'NE 46°', '10°', '1 513 km']);
    expect(row('Peak')).toEqual(['09:48:38 UTC', 'NE 53°', '10°', '1 505 km']);
    expect(row('End')).toEqual(['09:49:02 UTC', 'ENE 60°', '10°', '1 516 km']);
  });

  it('carries duration, magnitude with its phrase, range at peak, both reasons and the sun altitude with the twilight label', () => {
    const { rerender } = render(<PassNumbers pass={pass} timeZone={null} />);
    const field = (label: string): string => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? '';
    expect(field('Duration')).toBe('48 s');
    expect(field('Magnitude')).toBe('+0.5, like a bright star');
    expect(field('Range at peak')).toBe('1 505 km');
    expect(field('Starts when it')).toBe('appears');
    expect(field('Ends when it')).toBe('drops below the horizon');
    expect(field('Sun at peak')).toBe('−10.6° (sky still bright)');

    rerender(<PassNumbers pass={{ ...pass, startReason: 'shadow', endReason: 'shadow', twilight: false }} timeZone={null} />);
    expect(field('Starts when it')).toBe("emerges from Earth's shadow");
    expect(field('Ends when it')).toBe("disappears into Earth's shadow");
    expect(field('Sun at peak')).toBe('−10.6°');
  });

  it('has no axe violations', async () => {
    const { container } = render(<PassNumbers pass={pass} timeZone={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
