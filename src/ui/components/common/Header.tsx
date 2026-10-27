import type { MouseEvent, ReactNode } from 'react';
import type { HeaderPage } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { SETTINGS_HASH, STARS_HASH } from '../../../lib/shareLinks';
import { useAppStore, type AppState } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { home } from '../../navigation';
import { loadSettingsChunk } from '../../screens/settingsChunk';
import { loadStarsChunk } from '../../screens/starsChunk';
import { Mark } from '../mark/Mark';
import { MARK_HEADER_PX } from '../mark/tiers';
import { BracketLink } from '../primitives/BracketLink';
import { Rule } from '../primitives/Rule';
import { TextButton } from '../primitives/TextButton';
import styles from './Header.module.css';

/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, D-184): the app's header, in the two
 * shapes the two layouts ask for. One component rather than two, because the
 * two rows are the same few things arranged differently, and the thing that
 * decides is `useLayoutMode` — the same `matchMedia` the stylesheet asks
 * (D-72), so the shape and the grid it lands in cannot disagree.
 *
 * R129 (FR-FLOW-3, D-845; F7, D3, D4): the header is told its `page` and an
 * optional `context` — the place, or the pass's date — and is the one header of
 * every page, so it says where the reader is.
 *
 * **Compact.** The home keeps its row of at most 36 cells (FR-COMP-1): the
 * mark, the short title, `[ live ]` and `[ settings ]`, and no tagline. Every
 * other page — live, stars, the pass detail, settings — has `[ ← ]`
 * (FR-COMP-7's control: the arrow drawn, "Back" / "Volver" its name), the
 * page's name in the accent, and the context in `--fg-dim`, cut with an
 * ellipsis where the row's cells run out. On the live page the state indicator
 * (FR-WATCH-2) stands in the name's place, `status`: watching, its word is the
 * page's name, and drawn beside it the name would take the cells FR-COMP-7
 * keeps for a whole coordinate pair at 360 px. On settings the name is the
 * page's `h1`, which has no other.
 *
 * **Wide.** One row on every page: `[ ← ]` on a sub-page, the mark and the
 * title, the page links `home`, `live`, `stars` — the current one drawn in
 * `--fg` with a 2 px accent rule under it and `aria-current="page"` (a dim link
 * read as a disabled one, D4) — the context on a sub-page, and `[ settings ]`
 * at the row's right end. The tagline is the home's only, under the row. The
 * language and theme switches are the settings page's alone (FR-COMP-2,
 * V26-10), on both widths.
 *
 * R74 (FR-MARK-4 a, b; D-441): the mark stands before the title at
 * `MARK_HEADER_PX` — one `--row`. On the home page its bead runs while the app
 * is still working out what to show (FR-MARK-5 a), and wherever it is drawn
 * while the settings chunk is on its way (`busy`, D-545).
 *
 * R93 (FR-HOME-1, D-546, D-605; F-76): the tagline is one line or none — the
 * stylesheet hides it under the width its line needs, one pixel literal per
 * language that `tests/styles/controlRows.test.ts` recomputes from the catalog.
 * The title row needs no fold since R129: without the switches it fits the
 * wide breakpoint in both languages, and its context is what gives.
 *
 * `landmark={false}` renders the row as a `div`, for a page that holds the
 * header inside a landmark of its own (the live page's grid, D-529) or inside a
 * dialog (the compact pass sheet), where a second `<header>` would be a second
 * `banner`.
 */
export interface HeaderProps {
  /** Which page this header stands on (D-845). */
  page?: HeaderPage;
  /** A sub-page's place, or the pass's date on the pass detail; drawn after the name, cut with an ellipsis. */
  context?: string | null;
  /** A sub-page's `[ ← ]`: leaves the page. */
  onBack?: () => void;
  /** The live page's state indicator, drawn in the compact name's place (FR-WATCH-2). */
  status?: ReactNode;
  /** `false`: a `div`, inside a landmark or a dialog the page renders itself. */
  landmark?: boolean;
  /** R6/R35: made inert with the rest of the shell while the compact sheet or the shortcuts overlay is up. */
  inert?: boolean;
  /** R93 (D-545): the page under this header is still on its way (the settings chunk), so the bead runs. */
  busy?: boolean;
}

/** The wide row's page links, in order (FR-FLOW-3). */
const NAV_PAGES = ['home', 'live', 'stars'] as const satisfies readonly HeaderPage[];
const NAV_HREF: Record<(typeof NAV_PAGES)[number], string> = { home: '#', live: '#live', stars: STARS_HASH };

/** The context's test id: the place on most pages, as the live page's was (`live-place`), and the date on the pass. */
const contextTestId = (page: HeaderPage): string => (page === 'pass' ? 'pass-date' : `${page}-place`);

export function Header({ page = 'home', context = null, onBack, status, landmark = true, inert = false, busy = false }: HeaderProps) {
  const t = useT();
  const mode = useLayoutMode();
  const loading = (useAppStore(isLoading) && page === 'home') || busy;
  const mark = <Mark tier="header32" sizePx={MARK_HEADER_PX} running={loading} />;
  // R93 (D-545): the settings chunk is fetched as the pointer or the focus reaches its link, ahead of the tap.
  // Best effort: a prefetch that fails is dropped by `loadSettingsChunk`, and the tap will ask again.
  const prefetch = (): void => void loadSettingsChunk().catch(() => undefined);
  // R115 (D-756): the same for the stars chunk, from its own link.
  const prefetchStars = (): void => void loadStarsChunk().catch(() => undefined);
  const Root = landmark ? 'header' : 'div';
  const sub = page !== 'home';
  const rootClass = (shape: string): string => [styles.header, shape, landmark ? styles.landmark : undefined].filter(Boolean).join(' ');

  const back = sub && (
    <TextButton inline label={t.header.back} aria-label={t.header.backName} className={styles.back} onClick={onBack} data-testid={`${page}-back`} />
  );
  const contextText =
    sub && context !== null && context !== '' ? (
      <span className={styles.context} data-testid={contextTestId(page)}>
        {context}
      </span>
    ) : null;
  const settings =
    page === 'settings' ? (
      <BracketLink href={SETTINGS_HASH} label={t.settings.open} current className={styles.settings} data-testid="settings-link" />
    ) : (
      <BracketLink href={SETTINGS_HASH} label={t.settings.open} className={styles.settings} data-testid="settings-link" onPointerEnter={prefetch} onFocus={prefetch} />
    );

  if (mode === 'compact') {
    if (sub) {
      const Name = page === 'settings' ? 'h1' : 'span';
      return (
        <Root inert={inert} className={rootClass(`${styles.compact} ${styles.sub}`)} data-testid="header" data-page={page}>
          {back}
          {status ?? (
            <Name className={styles.pageName} data-testid="header-page">
              {t.header.pages[page]}
            </Name>
          )}
          {contextText}
        </Root>
      );
    }
    return (
      <Root inert={inert} className={rootClass(styles.compact)} data-testid="header" data-page={page}>
        <div className={styles.brand}>
          {mark}
          <h1 className={styles.shortTitle}>{t.app.shortTitle}</h1>
        </div>
        <nav className={styles.links} aria-label={t.app.title}>
          <BracketLink href="#live" label={t.live.openShort} data-testid="live-link" />
          {settings}
        </nav>
      </Root>
    );
  }

  // The home and settings pages have no `h1` of their own on wide; the live and stars pages do (FR-A11Y-1).
  const Title = page === 'home' || page === 'settings' ? 'h1' : 'p';
  const navLink = (target: (typeof NAV_PAGES)[number]): ReactNode => {
    const label = t.header.pages[target];
    if (target === page) {
      return (
        <span key={target} className={styles.navCurrent} aria-current="page" data-testid={`${target}-link`}>
          {label}
        </span>
      );
    }
    return (
      <a
        key={target}
        href={NAV_HREF[target]}
        className={styles.navLink}
        data-testid={`${target}-link`}
        {...(target === 'home'
          ? {
              onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                event.preventDefault();
                home();
              },
            }
          : target === 'stars'
            ? { onPointerEnter: prefetchStars, onFocus: prefetchStars }
            : {})}
      >
        {label}
      </a>
    );
  };

  return (
    <Root inert={inert} className={rootClass(styles.wide)} data-testid="header" data-page={page}>
      <div className={styles.row}>
        {back}
        <div className={styles.brand}>
          {mark}
          <Title className={styles.title}>{t.app.title}</Title>
        </div>
        {/* R92 (FR-A11Y-1, D-529): the header's links are its navigation. */}
        <nav className={styles.nav} aria-label={t.header.nav}>
          {NAV_PAGES.map(navLink)}
        </nav>
        {contextText}
        {settings}
      </div>
      {page === 'home' && <p className={styles.tagline}>{t.app.tagline}</p>}
      {/* R105 (D-720): the wide header's rule under its last line (R23, FR-DESK-2). */}
      <Rule className={styles.rule} />
    </Root>
  );
}

/**
 * FR-MARK-5 (a): the bead runs while the home page is still assembling what it
 * will show — the elements are being fetched, or the worker is computing the
 * run — and stands still once the list is there.
 */
const isLoading = (state: AppState): boolean => state.elements.status === 'loading' || state.passes.status === 'computing';
