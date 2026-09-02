import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoordsInput, coordsLabel, parseCoords } from './CoordsInput';

describe('parseCoords', () => {
  it('accepts "lat, lon" decimals with optional sign and spaces', () => {
    expect(parseCoords('-38.93, -67.99')).toEqual({ ok: true, lat: -38.93, lon: -67.99 });
    expect(parseCoords(' 51.5 ,0.1 ')).toEqual({ ok: true, lat: 51.5, lon: 0.1 });
    expect(parseCoords('+90,-180')).toEqual({ ok: true, lat: 90, lon: -180 });
  });

  it('rejects malformed text', () => {
    expect(parseCoords('Neuquén')).toMatchObject({ ok: false });
    expect(parseCoords('-38.93')).toMatchObject({ ok: false });
    expect(parseCoords('-38.93, -67.99, 0')).toMatchObject({ ok: false });
  });

  it('rejects out-of-range values with a specific message', () => {
    expect(parseCoords('91, 0')).toMatchObject({ ok: false, error: /Latitude/ });
    expect(parseCoords('0, 180.5')).toMatchObject({ ok: false, error: /Longitude/ });
  });
});

describe('coordsLabel', () => {
  it('rounds to two decimals with a real minus sign', () => {
    expect(coordsLabel(-38.9312, -67.9901)).toBe('−38.93, −67.99');
  });
});

describe('<CoordsInput>', () => {
  it('emits an observer for valid input and null when cleared', async () => {
    const onObserver = vi.fn();
    const user = userEvent.setup();
    render(<CoordsInput onObserver={onObserver} />);
    const input = screen.getByLabelText('Coordinates (lat, lon)');
    await user.type(input, '-38.93, -67.99');
    expect(onObserver).toHaveBeenLastCalledWith({
      lat: -38.93,
      lon: -67.99,
      altM: 0,
      label: '−38.93, −67.99',
      source: 'coords',
      timeZone: null,
    });
    expect(screen.queryByRole('alert')).toBeNull();
    await user.clear(input);
    expect(onObserver).toHaveBeenLastCalledWith(null);
  });

  it('shows a range error and emits null for invalid input', async () => {
    const onObserver = vi.fn();
    const user = userEvent.setup();
    render(<CoordsInput onObserver={onObserver} />);
    const input = screen.getByLabelText('Coordinates (lat, lon)');
    await user.type(input, '95, 10');
    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be between -90 and 90');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onObserver).toHaveBeenLastCalledWith(null);
  });
});
