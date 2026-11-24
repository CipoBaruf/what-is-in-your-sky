import type { ComponentProps, ReactNode } from 'react';
import styles from './SettingRow.module.css';

/**
 * R209 (FR-DS-12; D-1228, D-1258): a labelled row — the label dim in the `--label-col` column and its control,
 * the rows `--gap-row` apart. The label is what the eye reads: the control carries its own name.
 * R225 (FR-DS-12): `data-setting-row` is what `rhythm.spec.ts` measures the rows by.
 */
export interface SettingRowOwnProps {
  /** The row's words, in the label column. */
  label: ReactNode;
  /** The row's control. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type SettingRowProps = SettingRowOwnProps & Omit<ComponentProps<'div'>, keyof SettingRowOwnProps | 'style'>;

export function SettingRow({ label, children, className, ...rest }: SettingRowProps) {
  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')} data-setting-row="" {...rest}>
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>{children}</div>
    </div>
  );
}
