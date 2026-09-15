import { useT } from '../../../i18n/useT';
import { SETTINGS_HASH } from '../../../lib/shareLinks';
import { useAppStore, type AppState } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { Mark } from '../mark/Mark';
import { MARK_HEADER_PX } from '../mark/tiers';
import styles from './Header.module.css';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, D-184): the app's header, in the two
 * shapes the two layouts ask for. One component rather than two, because the
 * two rows are the same three or four things arranged differently, and the
 * thing that decides is `useLayoutMode` — the same `matchMedia` the stylesheet
 * asks (D-72), so the shape and the grid it lands in cannot disagree.
 *
 * **Wide** (FR-DESK-2 as amended, V11-8): the full title with the tagline under
 * it, `[ Live sky ]` on the title's own line beside it — it is navigation, not
 * a preference, which is the misalignment the owner's review named — and the
 * language and theme controls at the right of the header on one baseline row.
 * No `[ settings ]`: at this width the settings *are* the page (US-20 AC5), and
 * a link to a screen that holds nothing the reader cannot already see would be
 * a second route to the same controls.
 *
 * **Compact** (FR-COMP-1): one row of at most 36 cells — the short title,
 * `[ live ]` and `[ settings ]` — and no tagline, no language, no theme. The
 * short title is a different name for the same thing, which US-5 AC2 allows and
 * FR-COMP-4 makes necessary: the full one is 29 cells on a row that has 36.
 *
 * The header is one row on both screens the app has at compact, so the current
 * page's own control is marked rather than removed: `aria-current="page"` and
 * the dim colour the mockup gives it. Removing it would move the other control
 * sideways between the two screens, and a header whose contents shift is a
 * header the reader has to re-read.
 *
 * R74 (FR-MARK-4 a, b; D-441): both shapes carry the mark before the title, at
 * `MARK_HEADER_PX` — one `--row`, so neither header grows a line, and three
 * cells of the compact row's 36. On the home page its bead runs while the app
 * is still working out what to show (FR-MARK-5 a).
 */
export interface HeaderProps {
  /** R6/R35: made inert with the rest of the shell while the compact sheet or the shortcuts overlay is up. */
  inert?: boolean;
  /** Which screen this header sits on; the matching control is marked current rather than linked. */
  current?: 'home' | 'settings';
}

export function Header({ inert = false, current = 'home' }: HeaderProps) {
  const t = useT();
  const mode = useLayoutMode();
  const loading = useAppStore(isLoading) && current === 'home';
  const mark = <Mark tier="header32" sizePx={MARK_HEADER_PX} running={loading} />;

  if (mode === 'compact') {
    return (
      <header inert={inert} className={`${styles.header} ${styles.compact}`} data-testid="header">
        <div className={styles.brand}>
          {mark}
          <h1 className={styles.shortTitle}>{t.app.shortTitle}</h1>
        </div>
        <nav className={styles.links} aria-label={t.app.title}>
          <a href="#live" className={styles.link} data-testid="live-link">
            {t.live.openShort}
          </a>
          {current === 'settings' ? (
            <span className={`${styles.link} ${styles.currentLink}`} aria-current="page" data-testid="settings-link">
              {t.settings.open}
            </span>
          ) : (
            <a href={SETTINGS_HASH} className={styles.link} data-testid="settings-link">
              {t.settings.open}
            </a>
          )}
        </nav>
      </header>
    );
  }

  return (
    <header inert={inert} className={`${styles.header} ${styles.wide}`} data-testid="header">
      <div className={styles.titles}>
        <div className={styles.titleRow}>
          <div className={styles.brand}>
            {mark}
            <h1>{t.app.title}</h1>
          </div>
          <a href="#live" className={styles.link} data-testid="live-link">
            {t.live.open}
          </a>
        </div>
        <p className={styles.tagline}>{t.app.tagline}</p>
      </div>
      <div className={styles.controls}>
        <LanguageToggle className={styles.prefsToggle} />
        <ThemeToggle />
      </div>
    </header>
  );
}

/**
 * FR-MARK-5 (a): the bead runs while the home page is still assembling what it
 * will show — the elements are being fetched, or the worker is computing the
 * run — and stands still once the list is there.
 */
const isLoading = (state: AppState): boolean => state.elements.status === 'loading' || state.passes.status === 'computing';
