import { useId, type ComponentProps, type ReactNode } from 'react';
import optionStyles from './OptionToggle.module.css';
import styles from './TextButton.module.css';

/**
 * R104 (FR-DS-4 item 1, US-37 AC2; D-703, D-704), R206 (FR-CTRL-1; D-1226):
 * the text button — the one place the app's text control is drawn. The button
 * is the hit box and the outlined box is the span inside it; the reset that
 * takes the sheet's border off a `<button>` is written here once; and every
 * form a control takes in the app is a prop, never a class a feature module
 * adds (D-704: a feature module may place a primitive and may not restyle it).
 *
 * `inline` is a control hung off a line of prose (global.css `inline-control`);
 * `pressed` is an option (FR-CTRL-2), drawn on `OptionToggle`'s box; `bare`
 * the words without a box (the taps row's play glyph); `padded` a cell outside
 * the box (the guide panel's close); `box="accent"` the screen's one primary
 * action, with `fill` for the column's width, `tall` for a taller foot and
 * `note` for the line under its label (FR-FIRST-2), in the group's two looks;
 * `wrap` lets a label that is a place name break; `as="summary"` draws the
 * error page's disclosure (FR-FAIL-5) as the same control. A primitive is a
 * leaf: no copy, no store, only props (D-703).
 */
type TextButtonTone = 'accent' | 'dim' | 'danger';

export interface TextButtonOwnProps {
  /** The control's words. */
  label: ReactNode;
  onClick?: ComponentProps<'button'>['onClick'];
  /** A disabled control reads in the dim ink (global.css `button:disabled`). */
  disabled?: boolean;
  /** The words' ink, `--fg` left out (FR-CTRL-1): the accent, the dim ink (a secondary action, the saved place's `×`), or the danger ink. */
  tone?: TextButtonTone;
  /** An option (`aria-pressed`): the dim word when off, `--bg` on a block of `--fg` when on (FR-CTRL-2, FR-X-5). */
  pressed?: boolean;
  /** Hung off a line of prose: the 48 px box as padding and a matching negative margin (global.css `inline-control`), so the line does not grow. */
  inline?: boolean;
  /** The words without a box, for a glyph that stands in a cell of its own (the compact taps row's play, D-911). */
  bare?: boolean;
  /** A cell outside the box at each side and a `--tap` floor on the width: a control standing clear of a heading beside it. */
  padded?: boolean;
  /** The box's edge: `plain` is `--control-edge` (left out, the same), `accent` the primary form, one per screen at most (FR-CTRL-1). */
  box?: 'plain' | 'accent';
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
  /** The element: a `<button>`, or the `<summary>` of a `<details>` drawn as the same control (the error page's details). */
  as?: 'button' | 'summary';
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type TextButtonProps = TextButtonOwnProps & Omit<ComponentProps<'button'>, keyof TextButtonOwnProps | 'children' | 'style' | 'type'>;

const TONE: Record<TextButtonTone, string | undefined> = { accent: styles.inkAccent, dim: styles.dim, danger: styles.danger };

export function TextButton({ label, tone, pressed, inline = false, bare = false, padded = false, box = 'plain', fill = false, tall = false, note, look = 'boxed', wrap = false, as = 'button', className, ...rest }: TextButtonProps) {
  const noteId = useId();
  const hasNote = note !== undefined;
  // One root class per form: an element carries exactly one of them, and only the boxed ones have a span inside.
  const root = pressed !== undefined ? styles.toggle : hasNote ? styles.boxedNote : bare ? styles.bare : styles.textButton;
  const boxClass = pressed !== undefined ? optionStyles.optionBox : bare ? undefined : styles.buttonBox;
  const classes = [
    root,
    tone === undefined ? undefined : TONE[tone],
    inline ? 'inline-control' : undefined,
    inline ? styles.inline : undefined,
    padded ? styles.padded : undefined,
    box === 'accent' ? styles.accent : undefined,
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
      <span>{label}</span>
      <span id={noteId} className={styles.note}>
        {note}
      </span>
    </>
  ) : boxClass === undefined ? (
    label
  ) : (
    <span className={boxClass}>{label}</span>
  );
  if (as === 'summary') {
    // A `<summary>` has no disabled state: the attribute would do nothing and the control would still open (review of #173).
    const { disabled: _disabled, ...summaryRest } = rest;
    void _disabled;
    return (
      <summary className={classes} {...(summaryRest as Omit<ComponentProps<'summary'>, 'children'>)}>
        {content}
      </summary>
    );
  }
  // A radio in a `radiogroup` (ToggleGroup) carries its state as `aria-checked`; everything else is a pressed button.
  const state = pressed === undefined ? {} : rest.role === 'radio' ? { 'aria-checked': pressed } : { 'aria-pressed': pressed };
  return (
    <button type="button" className={classes} {...state} {...rest} {...(hasNote ? { 'aria-describedby': [rest['aria-describedby'], noteId].filter(Boolean).join(' ') } : {})}>
      {content}
    </button>
  );
}
