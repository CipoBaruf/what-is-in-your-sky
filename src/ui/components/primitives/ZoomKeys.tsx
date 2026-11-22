import styles from './ZoomKeys.module.css';

/**
 * R214 (FR-CTRL-9; D-1228, D-1271): the zoom keys — `−`, `+` and `⟲` in one box with hairline dividers.
 * A primitive imports no copy (D-703), so the host names the three; it says which end the zoom is at.
 */
export interface ZoomKeysOwnProps {
  onIn: () => void;
  onOut: () => void;
  onReset: () => void;
  /** The three keys' names, in the host's language. */
  names: { in: string; out: string; reset: string };
  /** The end of the range the zoom stands at, whose key then takes no press. */
  end?: 'in' | 'out' | null;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type ZoomKeysProps = ZoomKeysOwnProps;

export function ZoomKeys({ onIn, onOut, onReset, names, end = null, className }: ZoomKeysProps) {
  const keys = [
    { id: 'out', glyph: '−', press: onOut },
    { id: 'in', glyph: '+', press: onIn },
    { id: 'reset', glyph: '⟲', press: onReset },
  ] as const;
  return (
    <span className={[styles.keys, className].filter(Boolean).join(' ')}>
      {keys.map(({ id, glyph, press }) => (
        <button key={id} type="button" className={styles.key} data-zoom={id} aria-label={names[id]} disabled={end === id} onClick={() => press()}>
          <span className={styles.face} aria-hidden="true">
            {glyph}
          </span>
        </button>
      ))}
    </span>
  );
}
