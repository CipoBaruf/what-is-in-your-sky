import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import styles from './Line.module.css';

/**
 * R105 (FR-DS-4 item 6; D-703, D-718): one line that tells the reader
 * something — a status, a note, a failure — as a leading marker, a sentence
 * and trailing actions. `FailureLine`, `ReadinessLine`, `VisitNotice` (and
 * its `LinkNote`), `Banner` and `ElementsLine` render through it and keep
 * their names, their copy and their pixels (FR-DS-5): every form below is
 * the form one of them drew, as a prop.
 *
 * `tone` is the line's ink for what marks it — the marker, and the frame's
 * edge in the `box` form — dim for a status, `--ok`, `--warn` for a notice,
 * `--danger` for a failure. Colour is never the only channel (FR-X-5): the
 * marker is the second, the spelled-out `[Warning]` beside the ink, and a
 * line whose sentence takes the tone (`ink="tone"`, the elements line past
 * five days) says in words what the ink says. `ink` is the sentence's own:
 * the page's `--fg` (a banner's text, a failure's sentence), the dim ink (the
 * readiness line, a link note), or the tone's.
 *
 * `actions` follow the sentence on the same line after a space, or after a
 * middle dot (`dot`: the elements line's `· [ details ]`, the visit notice on
 * a desk); `rows` puts them on the row under it — `text` is a text row with a
 * cell between inline controls and nothing above it (the visit notice on a
 * phone), `controls` a row of `--tap` controls, centred, two cells apart and a
 * quarter row under the sentence (the failure line's `[ retry ]`, FR-FAIL-1).
 * `box` is the banner's frame (R11): the rule all round and the tone's edge
 * half a cell wide at the left. A primitive is a leaf: no copy, no store,
 * only props (D-703) — the words, the marker and the controls are the
 * caller's.
 */
type LineTone = 'status' | 'ok' | 'notice' | 'failure';

export interface LineOwnProps {
  /** The line's ink for its marker and its frame's edge: dim (a status, the default), `--ok`, `--warn` (a notice) or `--danger` (a failure). */
  tone?: LineTone;
  /** The leading marker in the tone's ink — the banner's spelled-out `[Warning]` — the second channel beside the colour (FR-X-5). */
  marker?: ReactNode;
  /** The sentence. */
  children: ReactNode;
  /** The trailing controls, `TextButton`s, after the sentence or on the row under it (`rows`). */
  actions?: ReactNode;
  /** The sentence's ink: the page's `--fg` (the default), the dim ink (a secondary line), or the tone's (the elements line past five days). */
  ink?: 'fg' | 'dim' | 'tone';
  /** The type: the body (the default) or `--small` on its row (the lines of the Where reading, the notices). */
  size?: 'body' | 'small';
  /** The banner's frame: the rule all round and the tone's edge half a cell wide at the left (R11). */
  box?: boolean;
  /** The actions on the row under the sentence: a `text` row of inline controls a cell apart, or a row of `--tap` `controls` centred, two cells apart, a quarter row under. */
  rows?: 'text' | 'controls';
  /** A middle dot between the sentence and the actions, ` · `, in the dim ink. */
  dot?: boolean;
  /** The element: a `p` (the default) or a `div` where the host's line was one. */
  as?: 'p' | 'div';
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type LineProps = LineOwnProps & Omit<ComponentPropsWithoutRef<'p'>, keyof LineOwnProps | 'style'>;

export function Line({ tone = 'status', marker, children, actions, ink = 'fg', size = 'body', box = false, rows, dot = false, as: Tag = 'p', className, ...rest }: LineProps) {
  const classes = [
    styles.line,
    styles[tone],
    ink === 'dim' ? styles.dim : ink === 'tone' ? styles.toned : undefined,
    size === 'small' ? styles.small : undefined,
    box ? styles.box : undefined,
    rows === 'text' ? styles.rowsText : rows === 'controls' ? styles.rowsControls : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} {...rest}>
      {marker !== undefined && (
        <>
          <span className={styles.marker}>{marker}</span>{' '}
        </>
      )}
      <span className={styles.text}>{children}</span>
      {actions !== undefined && (
        <>
          {/* In the `rows` forms the line is a grid, which drops the space; the dot keeps its own (`white-space: pre`). */}
          {dot ? (
            <span className={styles.dot} aria-hidden="true">
              {' · '}
            </span>
          ) : (
            ' '
          )}
          <span className={styles.actions}>{actions}</span>
        </>
      )}
    </Tag>
  );
}
