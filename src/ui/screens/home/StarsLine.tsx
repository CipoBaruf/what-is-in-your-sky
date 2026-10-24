import { useT } from '../../../i18n/useT';
import { STARS_HASH } from '../../../lib/shareLinks';
import { BracketLink } from '../../components/primitives/BracketLink';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { loadStarsChunk } from '../starsChunk';
import styles from './StarsLine.module.css';

/**
 * R115 (FR-STAR-3, V24-10; D-756): the phone's way into the stars page — the
 * first line of the When pane, "Stars tonight · [ look up ]". The compact
 * header holds 34 of its 36 cells and the live page's actions rows 32 and 33
 * (FR-COMP-1, FR-COMP-7), so neither can take the word; on wide the header's
 * `[ stars ]` is the way in and this line is not drawn. It is set at
 * `--small`, where the Spanish line's 38 characters are inside a 390 px row
 * (`controlRows.test.ts`). The link fetches the chunk ahead of the tap.
 */
export function StarsLine() {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  if (!compact) return null;
  const prefetch = (): void => void loadStarsChunk().catch(() => undefined);
  return (
    <p className={styles.line} data-testid="stars-line">
      {t.stars.tonight}
      <span aria-hidden="true"> · </span>
      <BracketLink href={STARS_HASH} label={t.stars.lookUp} data-testid="stars-look-up" onPointerEnter={prefetch} onFocus={prefetch} />
    </p>
  );
}
