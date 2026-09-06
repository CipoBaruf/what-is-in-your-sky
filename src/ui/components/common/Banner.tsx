import type { ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
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
  /**
   * R49 (F-30): out of reach, whatever is around it. A banner that carries an
   * action is made inert by the thing that covers it, and on wide that thing
   * covers this banner without covering its container (FR-DESK-3 keeps the
   * column live), so the flag has to reach the banner itself.
   */
  inert?: boolean;
}

export function Banner({ variant, children, testId, inert = false }: BannerProps) {
  const t = useT();
  return (
    <p role={variant === 'warning' ? 'alert' : 'status'} inert={inert} data-variant={variant} className={`${styles.banner} ${styles[variant] ?? ''}`} {...(testId ? { 'data-testid': testId } : {})}>
      <span className={styles.prefix}>[{t.banner[variant]}]</span> {children}
    </p>
  );
}
