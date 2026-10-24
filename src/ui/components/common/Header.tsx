import { useT } from '../../../i18n/useT';
import { SETTINGS_HASH, STARS_HASH } from '../../../lib/shareLinks';
import { useAppStore, type AppState } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { loadSettingsChunk } from '../../screens/settingsChunk';
import { loadStarsChunk } from '../../screens/starsChunk';
import { Mark } from '../mark/Mark';
import { MARK_HEADER_PX } from '../mark/tiers';
import { BracketLink } from '../primitives/BracketLink';
import { Rule } from '../primitives/Rule';
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
 *
 * R93 (FR-HOME-1, D-546, D-605; F-76): the wide header holds at every wide
 * width in both languages — one title line and at most one tagline line. The
 * title row does not wrap; where the row would need more cells than the
 * viewport has, the title takes its short form, and where the tagline would
 * wrap it is not shown. Neither is measured at run time: the row's width in
 * cells is known from the catalog per language, so `Header.module.css` carries
 * one pixel literal per language for each fold, under `:root[lang]`, and
 * `tests/styles/controlRows.test.ts` recomputes them from the catalogs and the
 * stylesheet's own gaps. The short form is the `data-short` attribute drawn by
 * the stylesheet, so the `h1`'s text is the full title at every width and its
 * accessible name is whichever form is drawn.
 *
 * R115 (FR-STAR-3, FR-A11Y-1, D-756): the wide header's links gain
 * `[ stars ]` beside `[ live ]`; the compact row has no room for it (34 of its
 * 36 cells), so a phone reaches the page from the When pane. On the stars page
 * the title is a paragraph and not the `h1`: the page's own name is its
 * heading, one `h1` a route, as the live page's is.
 */
export interface HeaderProps {
  /** R6/R35: made inert with the rest of the shell while the compact sheet or the shortcuts overlay is up. */
  inert?: boolean;
  /** Which screen this header sits on; the matching control is marked current rather than linked. */
  current?: 'home' | 'settings' | 'stars';
  /** R93 (D-545): the page under this header is still on its way (the settings chunk), so the bead runs. */
  busy?: boolean;
}

export function Header({ inert = false, current = 'home', busy = false }: HeaderProps) {
  const t = useT();
  const mode = useLayoutMode();
  const loading = (useAppStore(isLoading) && current === 'home') || busy;
  const mark = <Mark tier="header32" sizePx={MARK_HEADER_PX} running={loading} />;
  // R93 (D-545): the settings chunk is fetched as the pointer or the focus reaches its link, ahead of the tap.
  // Best effort: a prefetch that fails is dropped by `loadSettingsChunk`, and the tap will ask again.
  const prefetch = (): void => void loadSettingsChunk().catch(() => undefined);
  // R115 (D-756): the same for the stars chunk, from its own link.
  const prefetchStars = (): void => void loadStarsChunk().catch(() => undefined);
  const Title = current === 'stars' ? 'p' : 'h1';

  if (mode === 'compact') {
    return (
      <header inert={inert} className={`${styles.header} ${styles.compact}`} data-testid="header">
        <div className={styles.brand}>
          {mark}
          <Title className={styles.shortTitle}>{t.app.shortTitle}</Title>
        </div>
        <nav className={styles.links} aria-label={t.app.title}>
          <BracketLink href="#live" label={t.live.openShort} data-testid="live-link" />
          {/* R104 (D-704): the current page's own control is the primitive's `current` form, a dim `aria-current` span. */}
          {current === 'settings' ? <BracketLink href={SETTINGS_HASH} label={t.settings.open} current data-testid="settings-link" /> : <BracketLink href={SETTINGS_HASH} label={t.settings.open} data-testid="settings-link" onPointerEnter={prefetch} onFocus={prefetch} />}
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
            {/* R93 (FR-HOME-1, D-546, D-605): the full title as text, and the short one (FR-COMP-1's) as an
                attribute the stylesheet draws in its place under the language's own fold width. */}
            <Title className={styles.title} data-short={t.app.shortTitle}>
              <span className={styles.fullTitle}>{t.app.title}</span>
            </Title>
          </div>
          {/* R92 (FR-A11Y-1, D-529): the wide header's one link is its navigation too, in a box of its own that draws none. */}
          <nav className="landmark-contents" aria-label={t.app.title}>
            {/* R115 (D-774): under the title's fold the live link takes its short word too, as the title does, so the
                row with `[ stars ]` on it still fits the wide breakpoint in Spanish. */}
            <BracketLink
              href="#live"
              label={
                <span className={styles.liveLabel} data-short={t.live.openShort}>
                  <span className={styles.fullLabel}>{t.live.open}</span>
                </span>
              }
              data-testid="live-link"
            />
            {current === 'stars' ? (
              <BracketLink href={STARS_HASH} label={t.stars.link} current data-testid="stars-link" />
            ) : (
              <BracketLink href={STARS_HASH} label={t.stars.link} data-testid="stars-link" onPointerEnter={prefetchStars} onFocus={prefetchStars} />
            )}
          </nav>
        </div>
      </div>
      <div className={styles.controls}>
        <LanguageToggle className={styles.prefsToggle} />
        <ThemeToggle />
      </div>
      <p className={styles.tagline}>{t.app.tagline}</p>
      {/* R105 (D-720): the wide header's rule under the tagline, across both columns (R23, FR-DESK-2). */}
      <Rule className={styles.rule} />
    </header>
  );
}

/**
 * FR-MARK-5 (a): the bead runs while the home page is still assembling what it
 * will show — the elements are being fetched, or the worker is computing the
 * run — and stands still once the list is there.
 */
const isLoading = (state: AppState): boolean => state.elements.status === 'loading' || state.passes.status === 'computing';
