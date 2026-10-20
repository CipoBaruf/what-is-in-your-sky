import type { ComponentProps, ReactNode } from 'react';
import styles from './OptionToggle.module.css';

/**
 * R13, moved and re-cut by R104 (FR-DS-4 item 3; D-703, D-705): one
 * `[ ] option` / `[x] option` — a pressed-state text button whose state is in
 * the characters as well as the colour (FR-X-5, D-49). `ToggleGroup` renders a
 * row of them under a group name; alone it is the live page's hidden-objects
 * toggle (FR-LIVE-6). Pure display: the parent owns the state, and `onPress`
 * is whatever the parent wants a press to mean (a group passes nothing for the
 * option already pressed, so a click on it reports nothing). In a `radiogroup`
 * the parent passes `role="radio"` and the state is `aria-checked`.
 */
export interface OptionToggleOwnProps {
  /** The option's words, after the `[x] ` mark. */
  label: ReactNode;
  pressed: boolean;
  onPress?: () => void;
  /** R66 (FR-FSC-2, D-351): the option's value as `data-option`, so a caller can find it in its group again (the chart focuses "window" when the sky screen closes). */
  value?: string;
  /** An option standing alone (the hidden-objects toggle) has no trailing cell: that cell is what separates it from the next option in a group. */
  alone?: boolean;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string;
}

export type OptionToggleProps = OptionToggleOwnProps & Omit<ComponentProps<'button'>, keyof OptionToggleOwnProps | 'children' | 'style' | 'type' | 'onClick'>;

export function OptionToggle({ label, pressed, onPress, value, alone = false, className, ...rest }: OptionToggleProps) {
  const classes = [styles.option, alone ? styles.alone : undefined, className].filter(Boolean).join(' ');
  const state = rest.role === 'radio' ? { 'aria-checked': pressed } : { 'aria-pressed': pressed };
  return (
    <button type="button" className={classes} {...state} {...(value === undefined ? {} : { 'data-option': value })} onClick={onPress} {...rest}>
      {label}
    </button>
  );
}
