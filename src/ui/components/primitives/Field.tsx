import type { ComponentProps, ReactNode } from 'react';
import styles from './Field.module.css';

/**
 * R106 (FR-DS-4 item 7; D-703, D-722): the field — a label over an input, an
 * optional trailing slot on the input's row and the rows under it, one grid
 * column whose widths are in cells. `CoordsInput`, `PlacePicker` and, through
 * them, `LocationInput` compose it and keep their names, their copy and their
 * pixels (FR-DS-5): every form below is a form one of them drew, as a prop.
 *
 * The input is this component's: its attributes (`value`, `placeholder`,
 * `role`, `aria-*`, `onChange`, a `ref`) pass through to the `<input>`, its
 * `id` is the label's `htmlFor`, and its width is `cells` or, left out, the
 * column it stands in. `size` is the label's type and the space under it: the
 * body half a row over the input (the settings panel), or `--small` in the dim
 * ink a third of a row over it (the home group, board 1B). `labelHidden`
 * keeps the label for assistive technology and draws nothing. `unit` draws a
 * unit inside the input's box a cell after the value (`0 m`, FR-FIRST-2): the
 * box is the input itself, so its border and its ring are the sheet's.
 * `box` is the phone's ruled box round an alternative (FR-FIRST-2 `boxed`),
 * half a row by a cell inside and a third of a row on a short screen
 * (D-574). `children` are the rows under the input — a validation message as
 * a `Line`, a status, a pick list — a row gap apart. `trailing` is a control
 * or a field on the input's row: a `Field` placed here joins this one's grid,
 * its control in the second column and its rows across both (the altitude
 * beside the coordinates); the rows come before the trailing slot in the
 * document, so a message is read right after its input. A primitive is a
 * leaf: no copy, no store, only props (D-703).
 */
export interface FieldOwnProps {
  /** The input's id, which is the label's `htmlFor`. */
  id: string;
  /** The label's words. */
  label: ReactNode;
  /** The label read by assistive technology and not drawn (the home's altitude, whose unit is in its box). */
  labelHidden?: boolean;
  /** The label's type and the space under it: the body half a row over the input (the default), or `--small` in the dim ink a third of a row over it. */
  size?: 'body' | 'small';
  /** The input's width in cells; left out, the width of the column it stands in. */
  cells?: number;
  /** A unit drawn inside the input's box a cell after the value or the placeholder, `0 m`. */
  unit?: string;
  /** A box ruled in `--rule` round the field, half a row by a cell inside (a third of a row on a screen shorter than 700 px). */
  box?: boolean;
  /** A control or a field on the input's row: a `Field` here joins this one's grid, its control in the second column and its rows across both. */
  trailing?: ReactNode;
  /** The rows under the input: a validation message (a `Line`), a status, a pick list. */
  children?: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type FieldProps = FieldOwnProps & Omit<ComponentProps<'input'>, keyof FieldOwnProps | 'style'>;

const join = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ');

export function Field({ id, label, labelHidden = false, size = 'body', cells, unit, box = false, trailing, children, className, type = 'text', value, placeholder, ...input }: FieldProps) {
  // A slot holding `null` or `false` is an empty slot: no second column, no wrapper.
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== false;
  const classes = join(styles.field, size === 'small' ? styles.small : undefined, box ? styles.box : undefined, hasTrailing ? styles.withTrailing : undefined, className);
  const sized = cells === undefined ? undefined : { className: styles.sized, style: { ['--field-cells' as string]: String(cells) } };
  const control = <input id={id} type={type} value={value} placeholder={placeholder} className={unit === undefined ? join(styles.input, sized?.className) : styles.inUnit} {...(unit === undefined && sized ? { style: sized.style } : {})} {...input} />;
  // The unit sits a cell after the value's last character, or the placeholder's, whichever is longer (CoordsInput, R76).
  const valueCells = unit === undefined ? 0 : Math.max(String(value ?? '').length, String(placeholder ?? '').length);
  return (
    <div className={classes}>
      {/* A hidden label keeps `.label`: the grid rules place it as the label (it takes no cell, `sr-only` is absolute), and the rows' rule never reaches it. */}
      <label htmlFor={id} className={labelHidden ? join('sr-only', styles.label) : styles.label}>
        {label}
      </label>
      {unit === undefined ? (
        control
      ) : (
        <span className={join(styles.unitBox, sized?.className)} style={{ ...sized?.style, ['--value-cells' as string]: String(valueCells) }}>
          {control}
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        </span>
      )}
      {children}
      {hasTrailing && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
}
