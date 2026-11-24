import type { Ref } from 'react';
import type { HeaderPage } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { firstPassFor } from '../../../lib/livePasses';
import { LIVE_HASH, PASS_PAGE_HASH, passIdHash, SETTINGS_HASH } from '../../../lib/shareLinks';
import { useAppStore, type AppState } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { loadSettingsChunk } from '../../screens/settingsChunk';
import { useShownClock, useShownPasses } from '../../screens/home/shownPasses';
import { Mark } from '../mark/Mark';
import { MARK_HEADER_PX } from '../mark/tiers';
import { BracketLink } from '../primitives/BracketLink';
import { Rule } from '../primitives/Rule';
import { TextButton } from '../primitives/TextButton';
import styles from './Header.module.css';
import { PlaceLine, useHeaderPlace, type HeaderPlace } from './PlaceLine';

/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, D-184): the app's header, in the two
 * shapes the two layouts ask for. One component rather than two, because the
 * two rows are the same few things arranged differently, and the thing that
 * decides is `useLayoutMode` — the same `matchMedia` the stylesheet asks
 * (D-72), so the shape and the grid it lands in cannot disagree.
 *
 * R215 (FR-LAND-6, FR-CTRL-5; V30-7, V30-16): the page links are `live satellites settings` at both widths, as tabs —
 * the words in `--fg-dim`, the current page a span in `--fg` over a 2 px accent rule (`BracketLink`'s `tab` form);
 * `← back` is bare words in `--fg-dim`, where a page has one (never live, the first page, D-1230).
 *
 * **Compact.** A tab — live, the satellites' list (R212, D-1231) — is one row of at most 36 cells (FR-COMP-1): the
 * mark and the three links. The place line is not on it: it heads the satellites list and the controls sheet
 * (FR-LAND-4, V30-32). The other page, settings, is `← back`, the page's name in the accent and the
 * context in `--fg-dim`, cut with an ellipsis where the row's cells run out; on settings the name is the page's `h1`.
 * The compact live page has no header row since v2.8: its head is `SkyHead` over the sky (FR-FULL-2), and this row is
 * drawn there only while there is no sky to draw (the inert page).
 *
 * **Wide.** One row on every page: `← back` where a page has one, the mark and the title at the left; the place line
 * (R215, FR-LAND-4, D-1238) centred in the row; the three links at the right. The language and theme switches are the
 * settings page's alone (FR-COMP-2, V26-10).
 *
 * R74 (FR-MARK-4 a, b; D-441): the mark stands before the title at `MARK_HEADER_PX` — one `--row`. On live and the
 * satellites page its bead runs while the app is still working out what to show (FR-MARK-5 a), and wherever it is
 * drawn while the settings chunk is on its way (`busy`, D-545).
 *
 * `landmark={false}` renders the row as a `div`, for a page that holds the header inside a landmark of its own (the
 * live page's grid, D-529) or inside a dialog, where a second `<header>` would be a second `banner`.
 */
export interface HeaderProps {
  /** Which page this header stands on (D-845). */
  page: HeaderPage;
  /** R215 (D-1238): the wide row's place line; left out, the place the pages open for (`useHeaderPlace`). */
  place?: HeaderPlace | null;
  /** What the place line's `change` does; left out, the place dialog (`requestPlace`). */
  onChangePlace?: () => void;
  /** The compact row's context (the place): after a sub-page's name, under a tab's row; the wide row draws `place` instead. */
  context?: string | null;
  /** The page's `← back`, where it has one: leaves the page. */
  onBack?: () => void;
  /** The `← back` element, for a page that places the focus on it when it is entered (the settings page). */
  backRef?: Ref<HTMLButtonElement>;
  /** A class of the page's own on `← back`, for a rule only that page's layout needs (the live page's grid, F-100). */
  backClassName?: string | undefined;
  /** `false`: a `div`, inside a landmark or a dialog the page renders itself. */
  landmark?: boolean;
  /** R6/R35: made inert with the rest of the shell while the compact sheet or the shortcuts overlay is up. */
  inert?: boolean;
  /** R93 (D-545): the page under this header is still on its way (the settings chunk), so the bead runs. */
  busy?: boolean;
}

/** FR-LAND-6: the header's page links, in order, at both widths. */
const TABS = ['live', 'pass', 'settings'] as const satisfies readonly HeaderPage[];

/**
 * D-1134: `satellites`'s href — `#pass=<id>` of the pass up now, else the span's next (`firstPassFor`, over the
 * passes the list shows on its clock), and `#pass` with no id when the span holds none (the page's empty line).
 */
function usePassPageHref(): string {
  const passes = useShownPasses();
  const clock = useShownClock();
  const first = firstPassFor(passes, clock);
  return first === null ? PASS_PAGE_HASH : passIdHash(first.id);
}

/** R134 (FR-FLOW-11, D-851): the header's links and back are 44 px targets at least (`ui/styles/primitives.css`). */
const TARGET = 'target';

export function Header({ page, place, onChangePlace, context = null, onBack, backRef, backClassName, landmark = true, inert = false, busy = false }: HeaderProps) {
  const t = useT();
  const mode = useLayoutMode();
  const loading = (useAppStore(isLoading) && (page === 'live' || page === 'pass')) || busy;
  const passHref = usePassPageHref();
  const pagePlace = useHeaderPlace();
  const shownPlace = place === undefined ? pagePlace : place;
  const mark = <Mark tier="header32" sizePx={MARK_HEADER_PX} running={loading} />;
  // R93 (D-545): the settings chunk is fetched as the pointer or the focus reaches its link, ahead of the tap.
  // Best effort: a prefetch that fails is dropped by `loadSettingsChunk`, and the tap will ask again.
  const prefetch = (): void => void loadSettingsChunk().catch(() => undefined);
  const Root = landmark ? 'header' : 'div';
  const rootClass = (shape: string | undefined): string => [styles.header, shape, landmark ? styles.landmark : undefined].filter(Boolean).join(' ');

  const back = page !== 'live' && onBack !== undefined && (
    <TextButton bare inline tone="dim" label={t.header.backWords} aria-label={t.header.backName} className={[styles.back, TARGET, backClassName].filter(Boolean).join(' ')} onClick={onBack} ref={backRef} data-testid={`${page}-back`} />
  );

  const tab = (target: (typeof TABS)[number]) => {
    const label = t.header.pages[target];
    const href = target === 'pass' ? passHref : target === 'live' ? LIVE_HASH : SETTINGS_HASH;
    // The current page is not a control, so it carries no target floor: a flex item, the floor would make it a 44 px block and the row 20 px taller.
    if (target === page) return <BracketLink key={target} tab href={href} label={label} current data-testid={`${target}-link`} />;
    return <BracketLink key={target} tab href={href} label={label} className={TARGET} data-testid={`${target}-link`} {...(target === 'settings' ? { onPointerEnter: prefetch, onFocus: prefetch } : {})} />;
  };
  // R92 (FR-A11Y-1, D-529): the header's links are its navigation, one name on both widths (`t.header.nav`).
  const nav = (
    <nav className={styles.nav} aria-label={t.header.nav}>
      {TABS.map(tab)}
    </nav>
  );

  const contextText =
    context !== null && context !== '' ? (
      <span className={styles.context} data-testid={`${page}-place`}>
        {context}
      </span>
    ) : null;

  if (mode === 'compact') {
    if (page === 'settings') {
      const Name = 'h1';
      return (
        <Root inert={inert} className={rootClass(`${styles.compact} ${styles.sub}`)} data-testid="header" data-page={page}>
          {back}
          <Name className={styles.pageName} data-testid="header-page">
            {t.header.pages[page]}
          </Name>
          {contextText}
        </Root>
      );
    }
    // A tab's row: the mark and the three links, in FR-COMP-1's cells, and under it the context where the page has one
    // (the live page before it can draw, R212). The page's `h1` is the page's own.
    return (
      <Root inert={inert} className={rootClass(styles.compact)} data-testid="header" data-page={page}>
        <div className={styles.brand}>{mark}</div>
        {nav}
        {contextText}
      </Root>
    );
  }

  // The settings page has no `h1` of its own on wide; the other pages do (FR-A11Y-1).
  const Title = page === 'settings' ? 'h1' : 'p';
  return (
    <Root inert={inert} className={rootClass(styles.wide)} data-testid="header" data-page={page}>
      <div className={styles.row}>
        <div className={styles.start}>
          {back}
          <div className={styles.brand}>
            {mark}
            <Title className={styles.title}>{t.app.title}</Title>
          </div>
        </div>
        <PlaceLine place={shownPlace} {...(onChangePlace ? { onChangePlace } : {})} className={styles.place} />
        <div className={styles.end}>{nav}</div>
      </div>
      {/* R105 (D-720): the wide header's rule under its last line (R23, FR-DESK-2). The live page's own grid draws its
          rows (D-855): there the header is the top row, one text row on a short window (FR-SHP-3), and carries no rule. */}
      {landmark && <Rule className={styles.rule} />}
    </Root>
  );
}

/**
 * FR-MARK-5 (a): the bead runs while the page is still assembling what it
 * will show — the elements are being fetched, or the worker is computing the
 * run — and stands still once the list is there.
 */
const isLoading = (state: AppState): boolean => state.elements.status === 'loading' || state.passes.status === 'computing';
