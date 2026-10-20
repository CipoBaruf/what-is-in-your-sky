/**
 * R106 (FR-DS-4 item 7): the field in both themes — a label over an input
 * named by it, the input's attributes and ref passed through, the width in
 * cells as a custom property, the hidden label kept for assistive technology,
 * the unit box measuring the value or the placeholder, the rows under the
 * input in document order before the trailing slot, and the box, the size
 * and the trailing slot as classes and nothing else.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { Line } from './Line';

const THEMES = ['dark', 'night'] as const;

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe.each(THEMES)('<Field> under data-theme=%s', (theme) => {
  const themed = (): void => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  it('is a label over an input it names, with the input’s attributes, its ref and its width in cells passed through', async () => {
    themed();
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    const { container } = render(
      <Field id="place" label="Place name" cells={32} placeholder="e.g. Cipolletti" value="" onChange={onChange} role="combobox" aria-expanded={false} ref={ref} className="placed" inputMode="text" />,
    );
    const input = screen.getByRole('combobox', { name: 'Place name' });
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('id', 'place');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', 'e.g. Cipolletti');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input.className).toMatch(/input/);
    expect(input.className).toMatch(/sized/);
    expect(input.style.getPropertyValue('--field-cells')).toBe('32');
    expect(ref.current).toBe(input);
    fireEvent.change(input, { target: { value: 'Ros' } });
    expect(onChange).toHaveBeenCalledTimes(1);

    const field = input.parentElement;
    expect(field?.className).toMatch(/field/);
    expect(field?.className).toMatch(/placed/);
    expect(field?.className).not.toMatch(/small|box|withTrailing/);
    expect(field?.firstElementChild?.tagName).toBe('LABEL');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('takes the column’s width without cells, and the small size and the box are classes', () => {
    themed();
    render(<Field id="f" label="Coordinates" size="small" box value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Coordinates');
    expect(input.className).not.toMatch(/sized/);
    expect(input.style.getPropertyValue('--field-cells')).toBe('');
    const field = input.parentElement;
    expect(field?.className).toMatch(/small/);
    expect(field?.className).toMatch(/box/);
  });

  it('keeps a hidden label for assistive technology and draws the unit after the value or the placeholder', async () => {
    themed();
    const { container, rerender } = render(<Field id="alt" label="Altitude (m)" labelHidden unit="m" cells={10} placeholder="0" value="" onChange={vi.fn()} inputMode="decimal" />);
    const input = screen.getByLabelText('Altitude (m)');
    const label = container.querySelector('label');
    expect(label).toHaveClass('sr-only');
    expect(label).toHaveAttribute('for', 'alt');
    const box = input.parentElement;
    expect(box?.tagName).toBe('SPAN');
    expect(box?.className).toMatch(/unitBox/);
    expect(box?.className).toMatch(/sized/);
    expect(box?.style.getPropertyValue('--field-cells')).toBe('10');
    expect(box?.style.getPropertyValue('--value-cells')).toBe('1');
    expect(input.className).toMatch(/inUnit/);
    expect(input.className).not.toMatch(/sized/);
    const unit = box?.lastElementChild;
    expect(unit).toHaveTextContent('m');
    expect(unit).toHaveAttribute('aria-hidden', 'true');
    // The unit is not part of the input's name or value.
    expect(input).toHaveAccessibleName('Altitude (m)');
    expect(input).toHaveValue('');

    rerender(<Field id="alt" label="Altitude (m)" labelHidden unit="m" cells={10} placeholder="0" value="270" onChange={vi.fn()} inputMode="decimal" />);
    expect(box?.style.getPropertyValue('--value-cells')).toBe('3');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('places the rows under the input before the trailing slot, and a trailing field is a field of its own', async () => {
    themed();
    const { container } = render(
      <Field
        id="coords"
        label="Coordinates"
        size="small"
        value="91, 10"
        onChange={vi.fn()}
        aria-invalid
        aria-describedby="coords-error"
        trailing={
          <Field id="alt" label="Altitude (m)" labelHidden unit="m" cells={10} placeholder="0" value="x" onChange={vi.fn()} aria-invalid aria-describedby="alt-error">
            <Line tone="failure" ink="tone" id="alt-error" role="alert">
              Altitude must be a number of metres.
            </Line>
          </Field>
        }
      >
        <Line tone="failure" ink="tone" id="coords-error" role="alert">
          Latitude must be between -90 and 90.
        </Line>
      </Field>,
    );
    const coords = screen.getByLabelText('Coordinates');
    const altitude = screen.getByLabelText('Altitude (m)');
    expect(coords).toHaveAccessibleDescription('Latitude must be between -90 and 90.');
    expect(altitude).toHaveAccessibleDescription('Altitude must be a number of metres.');
    const outer = coords.parentElement;
    expect(outer?.className).toMatch(/withTrailing/);
    const order = Array.from(outer?.children ?? []).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
    expect(order).toEqual(['label', 'input#coords', 'p#coords-error', 'div']);
    const trailing = outer?.lastElementChild;
    expect(trailing?.className).toMatch(/trailing/);
    const inner = trailing?.firstElementChild;
    expect(inner?.className).toMatch(/field/);
    expect(inner?.className).not.toMatch(/withTrailing/);
    expect(inner?.contains(altitude)).toBe(true);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  });
});
