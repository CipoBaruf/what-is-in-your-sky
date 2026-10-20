import type { ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
import { Line } from '../primitives/Line';

/**
 * PLAN §4 `common/Banner.tsx` (R11): one line of plain text the app needs
 * the user to read before trusting the list. `info` is a note (`role="status"`,
 * announced politely); `warning` is something that degrades the predictions
 * (`role="alert"`, announced at once). Both carry a spelled-out prefix so the
 * meaning does not rest on colour (FR-X-5), and the terminal identity (FR-X-6)
 * is a bracketed tag on a dim rule, no icon.
 *
 * R105 (FR-DS-4 item 6, D-718): a boxed `Line` — the prefix is its marker, a
 * note the `status` tone (dim marker, the accent's edge) and a warning the
 * `notice` tone (both in `--warn`); the module this had is gone.
 */
type BannerVariant = 'info' | 'warning';

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
    <Line role={variant === 'warning' ? 'alert' : 'status'} inert={inert} data-variant={variant} box tone={variant === 'warning' ? 'notice' : 'status'} marker={`[${t.banner[variant]}]`} {...(testId ? { 'data-testid': testId } : {})}>
      {children}
    </Line>
  );
}
