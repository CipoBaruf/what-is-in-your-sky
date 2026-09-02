import type { ReactNode } from 'react';
import styles from './Banner.module.css';

/**
 * PLAN §4 `common/Banner.tsx` (R11): one line of plain text the app needs
 * the user to read before trusting the list. `info` is a note (`role="status"`,
 * announced politely); `warning` is something that degrades the predictions
 * (`role="alert"`, announced at once). Both carry a spelled-out prefix so the
 * meaning does not rest on colour (FR-X-5), and the terminal identity (FR-X-6)
 * is a bracketed tag on a dim rule, no icon.
 */
export type BannerVariant = 'info' | 'warning';

export interface BannerProps {
  variant: BannerVariant;
  children: ReactNode;
  /** Marks the banner for tests and the e2e; not rendered as text. */
  testId?: string;
}

const PREFIX: Record<BannerVariant, string> = { info: 'Note', warning: 'Warning' };

export function Banner({ variant, children, testId }: BannerProps) {
  return (
    <p role={variant === 'warning' ? 'alert' : 'status'} data-variant={variant} className={`${styles.banner} ${styles[variant] ?? ''}`} {...(testId ? { 'data-testid': testId } : {})}>
      <span className={styles.prefix}>[{PREFIX[variant]}]</span> {children}
    </p>
  );
}
