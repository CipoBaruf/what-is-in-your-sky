import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { I18nProvider, useLocale, useT } from '../i18n/useT';
import { observerFromLink, resolvePassLink } from '../lib/shareLinks';
import type { ShortcutActions } from '../lib/shortcuts';
import { formatClock, formatDate } from '../lib/timeFormat';
import { catalogName, searchPlaces, useAppStore } from '../state';
import styles from './App.module.css';
import { applyTheme } from './styles/theme';
import { Banner } from './components/common/Banner';
import { Footer } from './components/common/Footer';
import { InstallHint } from './components/common/InstallHint';
import { LanguageToggle } from './components/common/LanguageToggle';
import { ReadinessLine } from './components/common/ReadinessLine';
import { ShortcutsOverlay } from './components/common/ShortcutsOverlay';
import { UpdateBanner } from './components/common/UpdateBanner';
import { ThemeToggle } from './components/common/ThemeToggle';
import { ElementsBanners } from './components/elements/ElementsBanners';
import { useLayoutMode } from './hooks/useLayoutMode';
import { useShortcuts } from './hooks/useShortcuts';
import { LocationInput } from './components/location/LocationInput';
import { MoonLore } from './components/moon/MoonLore';
import { NowPanel } from './components/now/NowPanel';
import { PassList } from './components/passes/PassList';
import { moveCursor, passIdAtCursor } from './components/passes/passCursor';
import { useLiveRoute } from './screens/LiveRoute';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection } from './screens/passSelection';

/**
 * R32 (FR-LIVE-1, PLAN §11): the live page is its own lazy chunk, fetched the
 * first time `#live` is opened, so the home page pays nothing for it. The
 * route is read from the hash beside the pass selection (D-13).
 */
const LivePage = lazy(() => import('./screens/Live').then((module) => ({ default: module.LivePage })));

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
  const selected = useMemo(() => (resolution === null ? findSelectedPass(passes, selectedId) : resolution.pass), [resolution, passes, selectedId]);
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
  const mode = useLayoutMode();
  const live = useLiveRoute();
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
      open(passId);
      return true;
    },
    // The overlay first: it is what is on top, and it is where the reader just
    // read that Esc closes the guide.
    close: () => {
      if (helpOpen) {
        setHelpOpen(false);
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
  const inert = helpOpen || (selected !== null && mode === 'compact');
  if (live.active) {
    return (
      <Suspense fallback={<p className={styles.liveLoading}>{t.live.loading}</p>}>
        <LivePage link={live.link} onLeave={live.leave} />
      </Suspense>
    );
  }
  return (
    <>
      <header inert={inert} className={styles.header}>
        <div className={styles.titles}>
          <h1>{t.app.title}</h1>
          <p className={styles.tagline}>{t.app.tagline}</p>
        </div>
        <div className={styles.controls}>
          <a href="#live" className={styles.liveLink} data-testid="live-link">
            {t.live.open}
          </a>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main inert={inert} className={styles.main}>
        <div className={`${styles.column} ${styles.leftColumn}`} data-testid="col-left">
          {/* R28 (D-154): both offers sit above everything, inside the region the
              open sheet makes inert and outside the live route, so neither can
              be acted on while a pass or the live sky is up. */}
          <UpdateBanner />
          <InstallHint />
          <LocationInput observer={observer} onObserver={setObserver} onClear={clearSavedObserver} search={searchPlaces} />
          <ReadinessLine />
          <ElementsBanners />
          <NowPanel />
          {moon && observer && <MoonLore moon={moon} timeZone={observer.timeZone} />}
        </div>
        <div className={styles.column} data-testid="col-right" data-guide={selected !== null ? 'open' : 'closed'}>
          <div className={styles.listColumn} data-testid="list-column">
            {shareNotice && (
              <Banner variant="info" testId="share-fallback">
                {shareNotice}
              </Banner>
            )}
            {/* The resolved pass, not the hash: the id in the hash can be a second out (D-33) and would highlight nothing. */}
            <PassList onOpenPass={open} selectedPassId={selected ? selected.id : null} />
          </div>
          {selected && observer && <PassDetail pass={selected} observer={observer} onClose={close} />}
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
