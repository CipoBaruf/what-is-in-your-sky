/**
 * TASKS R2 and R10 (US-2, FR-LOC-1 (b)): every accepted coordinate format
 * parses to the same observer; lat 91 and lon −181 show inline errors and
 * emit null; the altitude field defaults to 0, feeds `altM` and is validated
 * inline; `initial` pre-fills without emitting.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoordsInput, coordsLabel, parseAltitude, parseCoords } from './CoordsInput';

describe('parseCoords', () => {
  it('accepts "lat, lon" decimals with optional sign and spaces', () => {
    expect(parseCoords('-38.93, -67.99')).toEqual({ ok: true, lat: -38.93, lon: -67.99 });
    expect(parseCoords(' 51.5 ,0.1 ')).toEqual({ ok: true, lat: 51.5, lon: 0.1 });
    expect(parseCoords('+90,-180')).toEqual({ ok: true, lat: 90, lon: -180 });
  });

  it('accepts the space-separated and N/S/E/W suffix forms (US-2 AC1), all to the same coordinates', () => {
    const forms = ['-38.93, -67.99', '-38.93 -67.99', '-38.93,-67.99', '38.93 S, 67.99 W', '38.93S 67.99W', '38.93 s 67.99 w', '67.99 W, 38.93 S', '38.93° S, 67.99° W', '38.93°S, 67.99°W'];
    for (const form of forms) expect(parseCoords(form), form).toEqual({ ok: true, lat: -38.93, lon: -67.99 });
    expect(parseCoords('48.86 N 2.35 E')).toEqual({ ok: true, lat: 48.86, lon: 2.35 });
    expect(parseCoords('1.29 N, 103.85 E')).toEqual({ ok: true, lat: 1.29, lon: 103.85 });
  });

  it('rejects malformed text and inconsistent suffixes', () => {
    expect(parseCoords('Neuquén')).toMatchObject({ ok: false });
    expect(parseCoords('-38.93')).toMatchObject({ ok: false });
    expect(parseCoords('-38.93, -67.99, 0')).toMatchObject({ ok: false });
    expect(parseCoords('38.93 S, -67.99')).toMatchObject({ ok: false, error: /both values/ });
    expect(parseCoords('-38.93 S, 67.99 W')).toMatchObject({ ok: false, error: /sign or N\/S\/E\/W/ });
    expect(parseCoords('38.93 S, 67.99 N')).toMatchObject({ ok: false, error: /one latitude/ });
  });

  it('rejects out-of-range values with a specific message', () => {
    expect(parseCoords('91, 0')).toMatchObject({ ok: false, error: /Latitude/ });
    expect(parseCoords('0, -181')).toMatchObject({ ok: false, error: /Longitude/ });
    expect(parseCoords('0, 180.5')).toMatchObject({ ok: false, error: /Longitude/ });
    expect(parseCoords('91 S, 10 E')).toMatchObject({ ok: false, error: /Latitude/ });
  });
});

describe('parseAltitude', () => {
  it('defaults to 0, accepts metres, rejects text and absurd values', () => {
    expect(parseAltitude('')).toEqual({ ok: true, altM: 0 });
    expect(parseAltitude(' 270 ')).toEqual({ ok: true, altM: 270 });
    expect(parseAltitude('-400')).toEqual({ ok: true, altM: -400 });
    expect(parseAltitude('abc')).toMatchObject({ ok: false, error: /number of metres/ });
    expect(parseAltitude('27000')).toMatchObject({ ok: false, error: /between -500 and 9000/ });
  });
});

describe('coordsLabel', () => {
  it('rounds to two decimals with a real minus sign', () => {
    expect(coordsLabel(-38.9312, -67.9901)).toBe('−38.93, −67.99');
  });
});

describe('<CoordsInput>', () => {
  const NEUQUEN = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };

  it('emits an observer for valid input and null when cleared', async () => {
    const onObserver = vi.fn();
    const user = userEvent.setup();
    render(<CoordsInput onObserver={onObserver} />);
    const input = screen.getByLabelText('Coordinates (lat, lon)');
    expect(screen.getByLabelText('Altitude (m)')).toHaveValue('0');
    await user.type(input, '-38.93, -67.99');
    expect(onObserver).toHaveBeenLastCalledWith(NEUQUEN);
    expect(screen.queryByRole('alert')).toBeNull();
    await user.clear(input);
    expect(onObserver).toHaveBeenLastCalledWith(null);
  });

  it('every accepted format ends in the same observer', async () => {
    const onObserver = vi.fn();
    const user = userEvent.setup();
    render(<CoordsInput onObserver={onObserver} />);
    const input = screen.getByLabelText('Coordinates (lat, lon)');
    for (const form of ['-38.93 -67.99', '38.93 S, 67.99 W', '67.99W 38.93S']) {
      await user.clear(input);
      await user.type(input, form);
      expect(onObserver, form).toHaveBeenLastCalledWith(NEUQUEN);
      expect(screen.queryByRole('alert')).toBeNull();
    }
  });

  it('lat 91 and lon −181 show inline errors and do not produce an observer', async () => {
    const onObserver = vi.fn();
    const user = userEvent.setup();
    render(<CoordsInput onObserver={onObserver} />);
    const input = screen.getByLabelText('Coordinates (lat, lon)');
    await user.type(input, '91, 10');
    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be between -90 and 90');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Latitude must be between -90 and 90');
    expect(onObserver).toHaveBeenLastCalledWith(null);
    await user.clear(input);
    await user.type(input, '10, -181');
    expect(screen.getByRole('alert')).toHaveTextContent('Longitude must be between -180 and 180');
    expect(onObserver).toHaveBeenLastCalledWith(null);
    // No keystroke along the way produced an out-of-range observer.
    for (const [o] of onObserver.mock.calls as [{ lat: number; lon: number } | null][]) {
      if (o) expect([Math.abs(o.lat) <= 90, Math.abs(o.lon) <= 180]).toEqual([true, true]);
    }
  });

  it('the altitude field feeds altM, defaults to 0 when blanked, and an invalid value blocks the observer', async () => {
    const onObserver = vi.fn();
    const user = userEvent.setup();
    render(<CoordsInput onObserver={onObserver} />);
    await user.type(screen.getByLabelText('Coordinates (lat, lon)'), '-38.93, -67.99');
    const alt = screen.getByLabelText('Altitude (m)');
    await user.clear(alt);
    expect(onObserver).toHaveBeenLastCalledWith(NEUQUEN);
    await user.type(alt, '270');
    expect(onObserver).toHaveBeenLastCalledWith({ ...NEUQUEN, altM: 270 });
    expect(screen.queryByRole('alert')).toBeNull();
    await user.type(alt, 'm');
    expect(screen.getByRole('alert')).toHaveTextContent('Altitude must be a number of metres');
    expect(alt).toHaveAttribute('aria-invalid', 'true');
    expect(onObserver).toHaveBeenLastCalledWith(null);
    await user.clear(alt);
    await user.type(alt, '27000');
    expect(screen.getByRole('alert')).toHaveTextContent('Altitude must be between -500 and 9000 m');
  });

  it('initial pre-fills both fields without emitting (US-8)', () => {
    const onObserver = vi.fn();
    render(<CoordsInput onObserver={onObserver} initial={{ lat: -38.93, lon: -67.99, altM: 270 }} />);
    expect(screen.getByLabelText('Coordinates (lat, lon)')).toHaveValue('-38.93, -67.99');
    expect(screen.getByLabelText('Altitude (m)')).toHaveValue('270');
    expect(onObserver).not.toHaveBeenCalled();
  });
});
