import { useId, type ComponentProps, type ReactNode } from 'react';
import styles from './TextButton.module.css';

/**
 * R104 (FR-DS-4 item 1, US-37 AC2; D-703, D-704): the `[ label ]` button —
 * the one place the app's text control is drawn. The brackets are this
 * module's `::before` / `::after` in the dim ink; the reset that takes the
 * sheet's bordered box off a `<button>` is written here once; and every form a
 * control takes in the app is a prop, never a class a feature module adds
 * (D-704: a feature module may place a primitive and may not restyle it).
 *
 * The forms are the ones the twenty-one modules R104 replaced drew, so that
 * no control moves (FR-DS-5): `inline` is a control hung off a line of prose
 * (global.css `inline-control`); `pressed` is the sort row's and the compact
 * speeds' pressed text control, the pressed option bracketed and the others
 * bare (D-705), `tight` the speeds' `[60×]` without the spaces (D-245);
 * `box` is a bordered control — `edge` the sheet's own box (the detail sheet's
 * `[ close ]`, the share action), `accent` the home's primary actions in the
 * accent's border (board 1B), with `fill` for the column's width, `tall` for
 * the when step's taller foot and `note` for the primary action's line under
 * its label (FR-FIRST-2), in the group's two looks; `wrap` lets a label that
 * is a place name break; `as="summary"` draws the error page's disclosure
 * (FR-FAIL-5) as the same control. A primitive is a leaf: no copy, no store,
 * only props (D-703).
 */
export type TextButtonTone = 'accent' | 'dim' | 'danger';

export interface TextButtonOwnProps {
  /** The words between the brackets. */
  label: ReactNode;
  onClick?: ComponentProps<'button'>['onClick'];
  /** A disabled control reads in the dim ink (global.css `button:disabled`). */
  disabled?: boolean;
  /** The words' ink: the accent (an action), the dim ink (a secondary action, the saved place's `×`), or the danger ink. */
  tone?: TextButtonTone;
  /** A pressed text control (`aria-pressed`): bracketed in the accent when pressed, bare and dim when not — the sort row's and the compact speeds' form (D-705, FR-X-5). */
  pressed?: boolean;
  /** With `pressed`: brackets without their spaces, `[60×]` — the compact speeds' 19-cell row (D-245). */
  tight?: boolean;
  /** Hung off a line of prose: the 48 px box as padding and a matching negative margin (global.css `inline-control`), so the line does not grow. */
  inline?: boolean;
  /** A bordered control: `edge` is the sheet's own box (`--border-control`), `accent` the home's primary action in the accent's border (board 1B). */
  box?: 'edge' | 'accent';
  /** With `box`: the width of the column it stands in. */
  fill?: boolean;
  /** With `box="accent"`: the when step's foot action, 56 px tall (board 1B). */
  tall?: boolean;
  /** With `box="accent"`: a line under the label, part of the same control and its description (`aria-describedby`), never its name (FR-FIRST-2). */
  note?: ReactNode;
  /** With `note`: the input group's two looks — `boxed` on a phone, `plain` in the wide pane (board 1B). */
  look?: 'boxed' | 'plain';
  /** A label that may break anywhere (a saved place's name) rather than widening its row. */
  wrap?: boolean;
  /** The element: a `<button>`, or the `<summary>` of a `<details>` drawn as the same control (the error page's `[ details ]`). */
  as?: 'button' | 'summary';
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string;
}

export type TextButtonProps = TextButtonOwnProps & Omit<ComponentProps<'button'>, keyof TextButtonOwnProps | 'children' | 'style' | 'type'>;

const TONE: Record<TextButtonTone, string | undefined> = { accent: undefined, dim: styles.dim, danger: styles.danger };
const BOX: Record<NonNullable<TextButtonOwnProps['box']>, string | undefined> = { edge: styles.edge, accent: styles.accent };

export function TextButton({ label, tone = 'accent', pressed, tight = false, inline = false, box, fill = false, tall = false, note, look = 'boxed', wrap = false, as = 'button', className, ...rest }: TextButtonProps) {
  const noteId = useId();
  const hasNote = note !== undefined;
  // One root class per form, because `tests/styles/cells.ts` reads the brackets a class draws off this
  // stylesheet by class name and state; an element carries exactly one of them.
  const root = pressed === undefined ? (hasNote ? styles.boxedNote : styles.textButton) : tight ? styles.toggleTight : styles.toggle;
  const classes = [
    root,
    TONE[tone],
    inline ? 'inline-control' : undefined,
    inline ? styles.inline : undefined,
    box === undefined ? undefined : BOX[box],
    fill ? styles.fill : undefined,
    tall ? styles.tall : undefined,
    hasNote && look === 'plain' ? styles.plain : undefined,
    wrap ? styles.wrap : undefined,
    as === 'summary' ? styles.summary : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const content = hasNote ? (
    <>
      <span className={styles.noteLabel}>{label}</span>
      <span id={noteId} className={styles.note}>
        {note}
      </span>
    </>
  ) : (
    label
  );
  if (as === 'summary') {
    return (
      <summary className={classes} {...(rest as Omit<ComponentProps<'summary'>, 'children'>)}>
        {content}
      </summary>
    );
  }
  // A radio in a `radiogroup` (ToggleGroup) carries its state as `aria-checked`; everything else is a pressed button.
  const state = pressed === undefined ? {} : rest.role === 'radio' ? { 'aria-checked': pressed } : { 'aria-pressed': pressed };
  return (
    <button type="button" className={classes} {...state} {...(hasNote ? { 'aria-describedby': noteId } : {})} {...rest}>
      {content}
    </button>
  );
}
