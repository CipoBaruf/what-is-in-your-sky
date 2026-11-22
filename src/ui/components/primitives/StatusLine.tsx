import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Line, type LineOwnProps } from './Line';
import styles from './StatusLine.module.css';

/**
 * R209 (FR-CTRL-17, FR-CTRL-4; D-1228): the one feedback line under or after a control — progress and an empty
 * list dim, a failure in `--danger`, success in `--ok`. It composes `Line` and owns the role: `alert` for a
 * failure, `status` for the rest. A host that announces progress mounts it before the words arrive.
 */
type StatusTone = 'progress' | 'failure' | 'ok' | 'empty';

export interface StatusLineOwnProps {
  /** What the line reports; it picks the ink and the role. */
  tone: StatusTone;
  /** The sentence. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type StatusLineProps = StatusLineOwnProps & Omit<ComponentPropsWithoutRef<'p'>, keyof StatusLineOwnProps | 'role' | 'style'>;

const DIM = { tone: 'status', ink: 'dim' } as const;
const LOOK: Record<StatusTone, Pick<LineOwnProps, 'tone' | 'ink'>> = { progress: DIM, empty: DIM, failure: { tone: 'failure', ink: 'tone' }, ok: { tone: 'ok', ink: 'tone' } };

export function StatusLine({ tone, children, className, ...rest }: StatusLineProps) {
  return (
    <Line {...LOOK[tone]} role={tone === 'failure' ? 'alert' : 'status'} className={[styles.statusLine, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Line>
  );
}
