import { useT } from '../../../i18n/useT';
import { Mark } from '../mark/Mark';
import styles from './StateIndicator.module.css';

/** FR-WATCH-2: the mark at the `header32` tier, one text row tall. */
export const INDICATOR_MARK_PX = 24;

/**
 * R77 (FR-WATCH-2, FR-MARK-5 b and c, US-27 AC4): the live page's state
 * indicator — the mark and the word beside it. Watching, the bead runs in
 * `--accent` and the word is `live`; scrubbing, it stands still in `--warn`
 * and the word is `held`. The word is always there, so the state is never
 * colour or motion alone (FR-X-5), and under reduced motion — where the bead
 * never moves — it is what says which state this is. The mark itself is
 * `aria-hidden`; the word is a status, so the change is announced.
 */
export function StateIndicator({ held }: { held: boolean }) {
  const t = useT();
  return (
    <span className={styles.indicator} data-testid="live-indicator" data-state={held ? 'held' : 'live'}>
      <Mark tier="header32" sizePx={INDICATOR_MARK_PX} running={!held} tone={held ? 'warn' : 'accent'} />
      <span role="status" className={styles.word} data-testid="live-state-word">
        {held ? t.live.state.held : t.live.state.live}
      </span>
    </span>
  );
}
