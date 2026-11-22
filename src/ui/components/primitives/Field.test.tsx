/**
 * R106 (FR-DS-4 item 7): the field in both themes — a label over an input
 * named by it, the input's attributes and ref passed through, the width in
 * cells as a custom property, the hidden label kept for assistive technology,
 * the unit box measuring the value or the placeholder, the rows under the
 * input in document order before the trailing slot, and the box, the size
 * and the trailing slot as classes and nothing else. R209 (FR-CTRL-7; D-1226):
 * the box is a frame after the input, drawn as a button's.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { readFileSync } from 'node:fs';
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
    const box = input.parentElement as HTMLElement;
    expect(box.className).toMatch(/inputBox/);
    expect(box.className).toMatch(/sized/);
    expect(box.style.getPropertyValue('--field-cells')).toBe('32');
    // FR-CTRL-7, D-1226: the frame follows the input, so its rules can read the input's state.
    expect(input.nextElementSibling?.className).toMatch(/frame/);
    expect(input.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(ref.current).toBe(input);
    fireEvent.change(input, { target: { value: 'Ros' } });
    expect(onChange).toHaveBeenCalledTimes(1);

    const field = box.parentElement;
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
    const inputBox = input.parentElement as HTMLElement;
    expect(inputBox.className).not.toMatch(/sized/);
    expect(inputBox.style.getPropertyValue('--field-cells')).toBe('');
    const field = inputBox.parentElement;
    expect(field?.className).toMatch(/small/);
    expect(field?.className).toMatch(/box/);
  });

  it('keeps a hidden label for assistive technology and draws the unit after the value or the placeholder', async () => {
    themed();
    const { container, rerender } = render(<Field id="alt" label="Altitude (m)" labelHidden unit="m" cells={10} placeholder="0" value="" onChange={vi.fn()} inputMode="decimal" />);
    const input = screen.getByLabelText('Altitude (m)');
    const label = container.querySelector('label');
    expect(label).toHaveAttribute('data-visually-hidden');
    expect(label).toHaveAttribute('for', 'alt');
    const box = input.parentElement;
    expect(box?.tagName).toBe('SPAN');
    expect(box?.className).toMatch(/inputBox/);
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
    const outer = coords.parentElement?.parentElement;
    expect(outer?.className).toMatch(/withTrailing/);
    const order = Array.from(outer?.children ?? []).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`);
    expect(order).toEqual(['label', 'span', 'p#coords-error', 'div']);
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

describe('<Field> box in its stylesheet (R209)', () => {
  const css = readFileSync('src/ui/components/primitives/Field.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string): string => new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

  it('FR-CTRL-7: the frame is FR-CTRL-1’s box — the height, the edge, the corners — and takes no press from the input', () => {
    expect(rule('.frame')).toMatch(/height:\s*var\(--control-h\)/);
    expect(rule('.frame')).toMatch(/border:\s*var\(--control-edge\)/);
    expect(rule('.frame')).toMatch(/border-radius:\s*var\(--control-radius\)/);
    expect(rule('.frame')).toMatch(/pointer-events:\s*none/);
    // D-1226: the hit box keeps global.css's --tap floor.
    expect(rule('.input')).not.toMatch(/height/);
    expect(rule('.input')).toMatch(/border:\s*0/);
  });

  it('FR-CTRL-7: hover draws the edge dim; focus draws it in the mark with a hairline ring of the mark', () => {
    expect(rule('.input:hover:not(:disabled) + .frame')).toMatch(/border-color:\s*var\(--fg-dim\)/);
    const focus = rule('.input:focus-visible:not(:disabled) + .frame');
    expect(focus).toMatch(/border-color:\s*var\(--mark\)/);
    expect(focus).toMatch(/box-shadow:\s*0 0 0 var\(--hairline\) var\(--mark\)/);
  });

  it('FR-CTRL-17: disabled keeps the shape, dim words in the rule’s edge', () => {
    expect(rule('.input:disabled')).toMatch(/color:\s*var\(--fg-dim\)/);
    expect(rule('.input:disabled + .frame')).toMatch(/border-color:\s*var\(--rule\)/);
  });
});
