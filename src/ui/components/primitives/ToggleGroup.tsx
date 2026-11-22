import type { KeyboardEvent } from 'react';
import { OptionToggle } from './OptionToggle';
import styles from './ToggleGroup.module.css';

/**
 * R104 (FR-DS-4 item 3; D-703, D-705): the row of options under one name —
 * the chart's view and orientation controls, the header's language and theme
 * switches, the sort row, the playback speeds. Pure display: the parent owns
 * the value; a click on the pressed option reports nothing.
 *
 * `role` is `group` — pressed buttons, the DOM every row rendered before this
 * primitive, so no test, capture or screen reader hears a change (D-705) —
 * or `radiogroup`, where the options are radios with `aria-checked`, one tab
 * stop, and the arrow keys choose. In both the arrow keys move between the
 * options and wrap.
 *
 * R206 (FR-CTRL-3): every set is FR-CTRL-2's look, an `OptionToggle` each, the
 * options a quarter cell apart; `dense` alone keeps the half cell of hit area
 * each side of a point in its place.
 */
interface ToggleGroupOption<T extends string> {
  value: T;
  label: string;
}

export interface ToggleGroupProps<T extends string> {
  /** The group's accessible name. */
  name: string;
  /** An optional visible prefix, e.g. `View:` (hidden from AT: the group name says it). */
  prefix?: string;
  options: readonly ToggleGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `group` (pressed buttons, the default) or `radiogroup` (radios, one tab stop, arrows choose). */
  role?: 'group' | 'radiogroup';
  /** The marks of before FR-CTRL-3, which draw one look now; callers still name them. */
  mark?: 'check' | 'bracket' | 'tight';
  /** The spacings of before FR-CTRL-3, which are a quarter cell now; callers still name them. */
  gap?: 'cell' | 'none';
  /**
   * R121 (FR-FSC-6 as amended v2.5, D-834): each option's line is one text row with its 48 px box as padding and a
   * matching negative margin (`OptionToggle`'s and `TextButton`'s `inline`), so a group that wraps to two lines
   * stands inside one tap row — the compact chart's view control, three options on the landscape phone's column.
   */
  inline?: boolean;
  /**
   * R134 (FR-FLOW-11, D-851): a row too dense for a 44 px target per option — the facing picker's points. The group is
   * a `.target-row` (primitives.css): each option at least 44 px tall, the cell between options split into their
   * padding so the hit areas meet. Otherwise each option is a `.target`.
   */
  dense?: boolean;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

const STEP: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function ToggleGroup<T extends string>({ name, prefix, options, value, onChange, role = 'group', inline = false, dense = false, className }: ToggleGroupProps<T>) {
  const radio = role === 'radiogroup';
  const choose = (next: T): void => {
    if (next !== value) onChange(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = STEP[event.key];
    const target = event.target;
    if (step === undefined || !(target instanceof HTMLElement)) return;
    const index = options.findIndex((option) => option.value === target.dataset.option);
    if (index < 0) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (next === undefined) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-option]'));
    buttons.find((button) => button.dataset.option === next.value)?.focus();
    if (radio) choose(next.value);
  };
  return (
    <div role={role} aria-label={name} className={[styles.group, dense ? styles.noGap : undefined, dense ? 'target-row' : undefined, className].filter(Boolean).join(' ')} onKeyDown={onKeyDown}>
      {prefix && (
        <span className={styles.prefix} aria-hidden="true">
          {prefix}
        </span>
      )}
      {options.map((option, index) => {
        const pressed = option.value === value;
        // One tab stop in a radiogroup: the chosen option, or the first when `value` matches none (review of #173).
        const stop = pressed || (index === 0 && !options.some((o) => o.value === value));
        const shared = {
          pressed,
          'data-option': option.value,
          ...(radio ? { role: 'radio' as const, tabIndex: stop ? 0 : -1 } : {}),
        };
        return <OptionToggle key={option.value} {...shared} target={!dense} inline={inline} value={option.value} label={option.label} {...(pressed ? {} : { onPress: () => choose(option.value) })} />;
      })}
    </div>
  );
}
