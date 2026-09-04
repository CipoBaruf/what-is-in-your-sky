import styles from './OptionToggle.module.css';

/**
 * R13: a labelled group of pressed-state text buttons, the pressed one
 * marked `[x]` in text as well as colour (FR-X-5, D-49), the others `[ ]`.
 * Pure display: the parent owns the value; a click on the pressed option
 * reports nothing. Used by the sky chart's view and orientation toggles
 * (`SortToggle` predates it and keeps its own copy).
 */
export interface OptionToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface OptionToggleProps<T extends string> {
  /** The group's accessible name. */
  name: string;
  /** An optional visible prefix, e.g. `View:` (hidden from AT: the group name says it). */
  prefix?: string;
  options: readonly OptionToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** An extra class on the group, for a caller that places it (the header's language switch). */
  className?: string | undefined;
}

export function OptionToggle<T extends string>({ name, prefix, options, value, onChange, className }: OptionToggleProps<T>) {
  return (
    <div role="group" aria-label={name} className={[styles.group, className].filter(Boolean).join(' ')}>
      {prefix && (
        <span className={styles.prefix} aria-hidden="true">
          {prefix}
        </span>
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={styles.option}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
