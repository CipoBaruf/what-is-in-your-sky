import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { I18nProvider, useLocale, useT } from '../i18n/useT';
import { MOON_LORE } from '../lib/flags';
import { observerFromLink, resolvePassLink } from '../lib/shareLinks';
import type { ShortcutActions } from '../lib/shortcuts';
import { formatClock, formatDate } from '../lib/timeFormat';
import { catalogName, searchPlaces, useAppStore } from '../state';
import styles from './App.module.css';
import { applyTheme } from './styles/theme';
import { Banner } from './components/common/Banner';
import { Footer } from './components/common/Footer';
import { Header } from './components/common/Header';
import { InstallHint } from './components/common/InstallHint';
import { LocationSummary } from './components/common/LocationSummary';
import { ReadinessLine } from './components/common/ReadinessLine';
import { ShortcutsOverlay } from './components/common/ShortcutsOverlay';
import { UpdateBanner } from './components/common/UpdateBanner';
import { ElementsBanners } from './components/elements/ElementsBanners';
import { useLayoutMode } from './hooks/useLayoutMode';
import { useShortcuts } from './hooks/useShortcuts';
import { LocationInput } from './components/location/LocationInput';
import { NowPanel } from './components/now/NowPanel';
import { PassList } from './components/passes/PassList';
import { moveCursor, passIdAtCursor, PASS_CARD } from './components/passes/passCursor';
import { useLiveRoute } from './screens/LiveRoute';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection, useSettingsRoute } from './screens/passSelection';
import { SettingsPage } from './screens/Settings';

/**
 * R32 (FR-LIVE-1, PLAN §11): the live page is its own lazy chunk, fetched the
 * first time `#live` is opened, so the home page pays nothing for it. The
 * route is read from the hash beside the pass selection (D-13).
 */
const LivePage = lazy(() => import('./screens/Live').then((module) => ({ default: module.LivePage })));

/**
 * FR-FLAG-1 (D-183): the import lives inside the `if`, not just the render,
 * so with `MOON_LORE` statically `false` Rollup never registers the dynamic
 * import as a chunk boundary — `lore.json` and its component ship in no file
 * of the build, not merely one the app declines to fetch.
 */
const MoonLore = MOON_LORE ? lazy(() => import('./components/moon/MoonLore').then((module) => ({ default: module.MoonLore }))) : undefined;

/**
 * R5: the screen only writes the observer to the store; the effects started
 * by `main.tsx` load the elements and drive the worker (PLAN §3: `src/ui`
 * imports `src/state`, never `src/data` or `src/physics`). R7: the Now panel
 * sits between the input and the pass list. R6: the selected pass lives in
 * the URL hash (D-13) and opens the detail sheet over the list; header, main
 * and footer are made inert while the sheet is up. R9/R10: the location
 * section holds the place picker, the coordinates, the device button and the
 * clear action. R11: the elements banners (epoch age, stale, not cached,
 * objects without elements) sit between the location and the Now panel.
 * R12: the frame is header (title and tagline), main, and the footer with
 * the attributions (FR-X-2). R17: the header also carries the language
 * switch (US-13), and `AppRoot` is what `main.tsx` renders — the store's
 * locale wrapped around the screen, so switching re-renders everything
 * without touching the URL or the state (FR-I18N-5). R20 puts the theme
 * switch beside it (US-19) and `AppRoot` writes `data-theme` from the store.
 * R23 (FR-DESK-2/3): the same elements in two columns from 100 cells up —
 * location, banners and the Now panel in the left one, the passes in the
 * right one, the header spanning both. The guide is rendered inside the
 * right column, where the wide shell wants it; the compact sheet portals
 * itself out to the body from there (D-117), which is why the page can still
 * be made inert around it. With a pass open the wide page is one viewport
 * high and every pane scrolls itself (D-119), which is why the left column
 * carries a class of its own — it is the one that has to stretch to the
 * footer and, on a short screen, scroll. R30 fills the last slot FR-DESK-2
 * names for that column: the Moon's tradition line, below the Now panel whose
 * last line is the Moon's observing facts (FR-MOON-3/4, D-122). R27 puts the
 * readiness line directly under the location, above the elements banners, which
 * is where FR-OFF-4 asks for it and where the other statements about what the
 * app is running on already are. R32: the header's controls gain the link to
 * the live page (FR-LIVE-1), and under `#live` the whole screen is that page
 * instead of this one. R28 puts the update offer and the install hint at the
 * head of the left column (FR-OFF-1, FR-OFF-6): they are page-level statements
 * like the elements banners, and being inside the shell is what keeps them out
 * of reach under an open pass and off the live page altogether (D-154). R35
 * (FR-DESK-4, D-73): this is also where the app's one `keydown` listener is
 * mounted, because this is the component that has the selection, the guide,
 * the route and the preferences in scope at once — every handler in the
 * shortcut table is a line of it.
 */
export function App() {
  const t = useT();
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const observer = useAppStore((s) => s.observer);
  const passes = useAppStore((s) => s.passes.passes);
  const now = useAppStore((s) => s.now);
  // R30: the tradition line needs a Moon, which arrives with the Now state for
  // this observer; there is nothing to say about the sky before that.
  const moon = now.observer === observer ? (now.state?.moon ?? null) : null;
  const locale = useLocale();
  const passesStatus = useAppStore((s) => s.passes.status);
  const { selectedId, link, open, close } = usePassSelection();
  // R31 (FR-SHARE-3): a shared pass is resolved against this device's own
  // recompute — the same pass, the nearest pass of that object, or none — and
  // a local selection is still just an id (D-33).
  const resolution = useMemo(() => (link === null ? null : resolvePassLink(passes, link)), [passes, link]);
  /*
   * R51 (F-18): the substitute pass waits for the recompute to finish. The
   * cards stream in (D-5), so until `passes.status === 'done'` the "nearest
   * pass of that object" is only the nearest one computed *so far* — the
   * guide opened on it silently, and the FR-SHARE-3 sentence that explains
   * why this is not the pass the link named appears next to it a second
   * later, by which time the pass underneath may have changed. The link's own
   * pass (`same`) is an exact match within the D-33 tolerance and needs no
   * explanation, so it opens as soon as it is computed.
   */
  const selected = useMemo(() => {
    if (resolution === null) return findSelectedPass(passes, selectedId);
    if (resolution.kind !== 'same' && passesStatus !== 'done') return null;
    return resolution.pass;
  }, [resolution, passes, selectedId, passesStatus]);
  const timeZone = observer?.timeZone ?? null;
  /*
   * The message the recipient of a stale link reads, in both of FR-SHARE-3's
   * branches: it names the satellite and the instant the link was made for,
   * which is all the link itself said. It waits for the recompute to finish —
   * before that, "no pass" would only mean "not yet".
   */
  const shareNotice = useMemo(() => {
    if (link === null || resolution === null || resolution.kind === 'same' || passesStatus !== 'done') return null;
    const name = resolution.pass?.name ?? catalogName(link.noradId);
    const time = `${formatDate(link.startT, timeZone, locale)} ${formatClock(link.startT, timeZone, locale)}`;
    return resolution.kind === 'nearest' ? t.share.nearest({ name, time }) : t.share.missing({ name, time });
  }, [link, resolution, passesStatus, timeZone, locale, t]);
  /*
   * R51 (F-17): a share link is consumed once. It arrives authoritative — its
   * observer wins over the saved one (D-135) and its pass is what the screen
   * opens on — but it stayed authoritative for as long as it sat in the hash,
   * so a recipient who typed their own coordinates had the guide torn down by
   * the recompute and put straight back up from the link, on a pass belonging
   * to somebody else's sky, with no way out but editing the URL. Once the
   * observer is no longer the one the link named, the link has been consumed:
   * it is cleared from the hash in place, which closes the guide and leaves
   * the reader on their own list. The comparison is the coordinates alone, as
   * R39's `#live` effect makes it — the label and the zone are filled in later
   * from the forecast and are not what identifies a place.
   */
  useEffect(() => {
    if (link === null || observer === null) return;
    const linked = observerFromLink(link);
    if (observer.lat === linked.lat && observer.lon === linked.lon && observer.altM === linked.altM) return;
    close();
  }, [link, observer, close]);
  const mode = useLayoutMode();
  const live = useLiveRoute();
  // R52 (FR-COMP-2, D-184): the third route, read from the hash beside the other two.
  const settings = useSettingsRoute();
  /*
   * R50 (FR-DESK-3 as amended, F-6, D-253): which of the right column's two
   * tracks the reader asked for. Below `WIDE_SPLIT_MIN_CELLS` only one of them
   * is on the page — the guide when a pass is opened, the list when `[ list ]`
   * is pressed — and above it the stylesheet shows both and this says nothing.
   * The selection is untouched by the swap: the pass stays open and stays in
   * the hash (D-13), which is what makes `[ list ]` different from closing.
   */
  // The pass the reader asked to see the list beside (F-6's `[ list ]`), if
  // any. The view is derived from it rather than stored, so a pass that
  // arrives by any other route — Back, a pasted link, `j` — is a new guide,
  // exactly as one opened from a card is: the list was asked for at *that*
  // pass, and a different pass is a different question.
  const [listFor, setListFor] = useState<string | null>(null);
  const guideView: 'guide' | 'list' = selected !== null && listFor === selected.id ? 'list' : 'guide';
  const openPass = (passId: string): void => {
    setListFor(null);
    open(passId);
  };
  /*
   * The control the reader pressed goes away with the panel, so focus would
   * fall to the body and `j` would start from the top of the list again. It
   * goes to the card of the pass they were reading, which is where the compact
   * sheet's `← Back` leaves them too.
   */
  useEffect(() => {
    if (guideView !== 'list') return;
    const card = document.querySelector<HTMLElement>(`${PASS_CARD}[data-selected]`);
    if (!card) return;
    // A card inside a folded night is in the DOM but not on the page, and
    // `focus()` on it does nothing (`passCursor`): the reader asked for the
    // list at this pass, so its night unfolds first — through the element,
    // so the disclosure's own toggle event keeps the list's memory of it.
    const night = card.closest<HTMLDetailsElement>('details:not([open])');
    if (night) night.open = true;
    card.focus();
  }, [guideView]);
  /*
   * R39 (F-34): `startApp` reads a link's observer once, before the first
   * render (D-135), which covers the arrival — a pasted URL, a reload. A
   * same-document navigation to a shared `#live?lat=…` never reaches it: the
   * route changed, the observer did not, and the page drew this device's sky at
   * the link's instant and offered to share that. The route has already parsed
   * the hash; this applies what it parsed, through the same `setObserver` the
   * link takes on arrival. Coordinates that are already the store's are left
   * alone — on arrival they are, and a fresh observer would restart the whole
   * compute chain for the place it is already showing.
   */
  useEffect(() => {
    if (live.link === null) return;
    const next = observerFromLink(live.link);
    if (observer !== null && observer.lat === next.lat && observer.lon === next.lon && observer.altM === next.altM) return;
    setObserver(next);
  }, [live.link, observer, setObserver]);
  /*
   * R35 (FR-DESK-4, D-73): the shortcut table's handlers, the one place the
   * keys reach the app's state. Each says whether it did something, which is
   * what decides whether the key press was the app's or the browser's.
   *
   * The cursor `j` and `k` move is DOM focus on a pass card, not state here
   * (`components/passes/passCursor.ts`), so the list keeps deciding which
   * cards there are and in what order.
   */
  const [helpOpen, setHelpOpen] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const chartView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const actions: ShortcutActions = {
    next: () => moveCursor(document, 1) !== null,
    previous: () => moveCursor(document, -1) !== null,
    open: () => {
      const passId = passIdAtCursor(document);
      if (passId === null) return false;
      openPass(passId);
      return true;
    },
    // The overlay first: it is what is on top, and it is where the reader just
    // read that Esc closes the guide.
    close: () => {
      if (helpOpen) {
        setHelpOpen(false);
        return true;
      }
      // R52 (US-20 AC4): `Esc` leaves the settings page, through the same one
      // listener and with the same guard as the guide (D-73) — so a press
      // inside the place field or the coordinate field is still that field's.
      if (settings.active) {
        settings.leave();
        return true;
      }
      if (selected === null) return false;
      close();
      return true;
    },
    live: () => {
      setHelpOpen(false);
      window.location.hash = 'live';
      return true;
    },
    view: () => {
      setChartView(chartView === 'dome' ? 'polar' : 'dome');
      return true;
    },
    theme: () => {
      setTheme(theme === 'night' ? 'dark' : 'night');
      return true;
    },
    help: () => {
      setHelpOpen(true);
      return true;
    },
  };
  // Not on the live page: it is a screen of its own with its own keys (R32, R33).
  useShortcuts(actions, !live.active);
  // Only the compact sheet covers the page; the wide panel opens beside the
  // list, which stays live (FR-DESK-3). The shortcuts overlay covers it at
  // every width, so nothing behind it is reachable either.
  //
  // R50 (F-45): this covers the header, the main and the footer, and the
  // compact sheet is in none of them — it portals itself to the body (D-117),
  // which is exactly what lets it stay live while they are inert. With the
  // overlay up the sheet is behind it like everything else, so it is told
  // separately (`inert` on `PassDetail` below).
  const inert = helpOpen || (selected !== null && mode === 'compact');
  /*
   * R49 (F-30): the two offers are under a stricter rule than the rest of the
   * page. D-154 says a reload button cannot be reached while a pass is open,
   * because applying an update swaps the shell under a reader who is in the
   * middle of something; on wide the guide is a panel beside a list that stays
   * live (FR-DESK-3), so `inert` above never reaches them there and the button
   * was one Tab away from a reader following a pass. The rule is the pass, not
   * the width — and the help sheet, as for everything else.
   */
  const offersInert = helpOpen || selected !== null;
  if (live.active) {
    return (
      <Suspense fallback={<p className={styles.liveLoading}>{t.live.loading}</p>}>
        <LivePage link={live.link} onLeave={live.leave} />
      </Suspense>
    );
  }
  /*
   * R52 (FR-COMP-2): the settings page is a screen, like the live one — the
   * whole of it, at every width, with its own header and the shell's footer
   * under it. Rendered after `#live` so a hash that is somehow both is the live
   * page, which is the one with a share link behind it.
   */
  if (settings.active) {
    return (
      <>
        <SettingsPage onLeave={settings.leave} />
        <Footer />
      </>
    );
  }
  return (
    <>
      <Header inert={inert} />
      <main inert={inert} className={styles.main}>
        <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
          {/* R28 (D-154): both offers sit above everything, inside the region the
              open sheet makes inert and outside the live route, so neither can
              be acted on while a pass or the live sky is up. R49 (F-30): on wide
              nothing around them is made inert, so they are told directly. */}
          <UpdateBanner inert={offersInert} />
          <InstallHint inert={offersInert} />
          {/* R52 (FR-COMP-3, US-20 AC3): on compact the form is one tap away and
              its place is taken by the line that names the observer; wide keeps
              the whole of it, where US-14 and FR-DESK-2 put it (US-20 AC5). */}
          {mode === 'wide' ? <LocationInput observer={observer} onObserver={setObserver} onClear={clearSavedObserver} search={searchPlaces} /> : <LocationSummary />}
          <ReadinessLine />
          <ElementsBanners />
          <NowPanel />
          {MoonLore && moon && observer && (
            <Suspense fallback={null}>
              <MoonLore moon={moon} timeZone={observer.timeZone} />
            </Suspense>
          )}
        </div>
        <div className={styles.column} data-testid="col-right" data-guide={selected === null ? 'closed' : guideView === 'list' ? 'list' : 'open'}>
          <div className={styles.listColumn} data-testid="list-column">
            {shareNotice && (
              <Banner variant="info" testId="share-fallback">
                {shareNotice}
              </Banner>
            )}
            {/* The resolved pass, not the hash: the id in the hash can be a second out (D-33) and would highlight nothing. */}
            <PassList onOpenPass={openPass} selectedPassId={selected ? selected.id : null} />
          </div>
          {/* R50 (F-8): keyed by the pass, so opening a second one from the list beside the panel
              is a new guide — its heading takes focus, and closing it returns to the card that
              opened it rather than to the first one's. */}
          {selected && observer && (
            <PassDetail
              key={selected.id}
              pass={selected}
              observer={observer}
              onClose={close}
              onShowList={() => {
                setListFor(selected.id);
              }}
              inert={helpOpen}
            />
          )}
        </div>
      </main>
      <Footer inert={inert} />
      {helpOpen && (
        <ShortcutsOverlay
          onClose={() => {
            setHelpOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * The app as `main.tsx` mounts it: the active language around the screen, and
 * the active theme on the root element (D-70). `main.tsx` applies both once
 * before the first render; this keeps them on every later switch, which is
 * why the effect is here and not in the toggle — the store is the one source
 * of the choice.
 */
export function AppRoot() {
  const locale = useAppStore((s) => s.locale);
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return (
    <I18nProvider locale={locale}>
      <App />
    </I18nProvider>
  );
}
