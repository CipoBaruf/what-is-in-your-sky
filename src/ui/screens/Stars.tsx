import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { starCatalog } from '../../data/stars/catalog';
import type { Messages } from '../../i18n/messages';
import { useStarsPageT } from '../../i18n/starsPageT';
import { useLocale, useT } from '../../i18n/useT';
import { nightClouds, tonightCloud } from '../../lib/nightClouds';
import { hintFitsBeside, SHELL_PADDING_CELLS } from '../../lib/layout';
import { shortcutFor } from '../../lib/shortcuts';
import type { LegendPass } from '../../lib/legend';
import { drawnRungs, starsAt } from '../../lib/skyStars';
import { BODIES_EVERY_MS } from '../../lib/playback';
import { formatShortClock } from '../../lib/timeFormat';
import { LIVE_WINDOW_MS } from '../../lib/livePasses';
import { HOUR_MS, type SkyBand, type Span } from '../../lib/timeStripe';
import { tonightsDark, tonightsStarsFrom } from '../../lib/tonightStripe';
import type { ChartView, EpochMs, Locale, Observer, TonightCloud } from '../../model';
import { favouriteCellKey, mostRecentlyUsed, useActiveObserver, useAppStore } from '../../state';
import { GLOBE_SPAN_DAYS } from '../components/guide/skychart/globe/constants';
import { createHandCamera, handRotation, initialHand, type HandCamera } from '../components/guide/skychart/window/camera';
import { FacingPicker } from '../components/guide/skychart/window/FacingPicker';
import { groundState, type Mat3, type View } from '../components/guide/skychart/window/projection';
import type { SkyScene, StarField } from '../components/guide/skychart/window/scene';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { markSkyHintSeen } from '../components/guide/skychart/useChartHand';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { FollowControl } from '../components/live/FollowControl';
import { useSkyBands } from '../components/live/useSkyBands';
import { usePlayback } from '../components/sky/time/usePlayback';
import { useWallThrottle } from '../components/live/useWallThrottle';
import { useWakeLock } from '../components/live/useWakeLock';
import { OptionToggle } from '../components/primitives/OptionToggle';
import { SectionHeading } from '../components/primitives/SectionHeading';
import { TextButton } from '../components/primitives/TextButton';
import { ToggleGroup } from '../components/primitives/ToggleGroup';
import { VisuallyHidden } from '../components/primitives/VisuallyHidden';
import { ControlsSheet } from '../components/sky/ControlsSheet';
import { FollowToggle } from '../components/sky/FollowToggle';
import { SkyHead } from '../components/sky/SkyHead';
import { SkyHint, useSkyHintLine, useSkyHintShown } from '../components/sky/SkyHint';
import { PICK_SELECTOR, SkyViewChartSlot, SkyViewLayout } from '../components/sky/SkyViewLayout';
import { useFollow } from '../components/sky/useFollow';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import { darkWindowText } from '../components/now/ConditionsTable';
import { close } from '../navigation';
import { nextView, viewFor, WIDE_VIEWS } from './chartViewDefault';
import { requestPlace } from './home/placeRequest';
import { nightWindow } from './home/tonight';
import { FieldList } from './stars/FieldList';
import { loadGlobe, loadGlobeRail, useGlobePrefetch } from './stars/globeChunk';
import { StarsGroup } from './sky/stars/Group';
import { StarsTime } from './sky/stars/Time';
import type { GlobeTurn, PlaceChoice } from './stars/GlobeRail';
import { fieldObjects, sceneCatalog, STAR_LABEL_HOLD_S } from './stars/field';
import styles from './Stars.module.css';

/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-8, FR-STAR-10; US-39; D-756):
 * the `#stars` page — the `stars` chunk's one export, behind `StarsRoute.ts`.
 *
 * It composes the window the live page already has (R113's
 * `SkyWindow`, the hand camera) with the scene only this page builds: the
 * catalogue (`data/stars/catalog.ts`) and every star and planet where it is
 * at the ticking instant (`lib/skyStars.ts`), with the four layer switches.
 * The camera is a store (`createHandCamera`, D-766): the window drives it from
 * the drag and the arrow keys, the facing picker from its points, and the page
 * reads it with `useSyncExternalStore` in the two parts that show it — the
 * picker's pressed point, and the list through `useDeferredValue` — so a
 * drag's frame is the window's and the list follows when React has the time. Every open starts at the pole
 * side at `STARS_DEFAULT_TILT` (`initialHand`): the camera is not saved.
 *
 * **Wide**: the box at the left, the room the page leaves beside a rail of at
 * least `RAIL_MIN_CELLS` and over the hint's row (`fitBox`, the live page's
 * rule; R133, FR-FLOW-9: down to the hint line, not the browser window's
 * shape), and the rail — the `View` row, `Facing`, `Layers`, `In this field`.
 * The window's facing readout stands in the box's top-left corner on the
 * screen's overlay surface.
 *
 * **Compact (R163: FR-CLEAN-1..4, FR-CLEAN-6, FR-CLEAN-7; US-49 AC1..AC6; D-997,
 * D-999, D-1009..D-1011)**: the page is the layout's `full` form in both shapes,
 * as the live page has been since v2.8 — the box is the screen, and over it
 * only the head (`SkyHead`: `[ ← ]` and the Stars door's dark-window line), the
 * facing readout in the top-right corner while the finger has the sky (with
 * FR-STAR-7's second line under it), `[ follow ]` and `[ controls ]` at the
 * bottom-right, and the hint until the first gesture. `[ controls ]` opens the
 * live page's `ControlsSheet` holding, top to bottom: `[Window] Whole sky`,
 * `[ ] follow the phone` where the sensor is, the facing row (the readout as a
 * button that opens the picker under it; on the whole sky the polar chart's
 * convention line and its looking-up / map toggle), the layer rows and
 * `In this field` open. The `h1` is visually hidden. `Esc` closes the sheet,
 * and with it closed the app's listener leaves the page (D-999). The compact
 * column of R132 and the landscape rail of R136 are gone from this page.
 *
 * The window is placed, not restyled: its frame's controls row (empty under
 * the hand) is not drawn and its status slot is put where this page's layout
 * says, by `Stars.module.css` through the frame's test ids and `data-row` names —
 * the frame's cells, not its look.
 *
 * Now and offline (FR-STAR-8): the instant is the clock, re-read every
 * `STARS_TICK_MS` as the live page's watching state ticks; the catalogue is
 * in this chunk, so a precached chunk and a saved observer are the whole page.
 * With no observer it is FR-LIVE-1's inert line and `[ set a place ]`.
 *
 * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-6; D-943..D-945): where the phone has
 * the sensor, `[ follow the phone ]` lets the page's own window take the
 * sensor; a drag hands it back. R163: the toggle is the sheet's row after the
 * view row, and `[ follow ]` stands in the bottom row (FR-GYRO-1 as amended).
 *
 * R160 (FR-PHONE-7, FR-PHONE-9, FR-PHONE-10; US-46 AC1, AC3, AC4; D-970,
 * D-971, D-990): the whole sky. The page draws `SkyChart` with two views, the
 * window and the polar chart (`views`), and holds the view itself (`view`,
 * never saved: every open is the window, as the camera is not saved). The
 * whole sky draws the page's layers, with the names off by default on compact
 * (a 250-unit disc at 390 px has room for the figures, not their names) and on
 * on wide, until the `[x] names` toggle says otherwise for both views;
 * `In this field` names the whole sky's twelve brightest; the window's field
 * is outlined on it from the page's camera, moving with the phone while
 * following; and a pinch past the window's widest field opens it, a pinch in
 * on it returning to the window facing the spot under the fingers
 * (`SkyChart`'s handoff).
 *
 * R163 (FR-CLEAN-11; D-1004): the `[ passes ]` toggle of R126 is gone with its
 * pass set — the page shows now, when a visible pass is rarely up — so the
 * scene carries no pass and `In this field` lists stars and planets only; the
 * view of both is the live page with `[x] stars`.
 */
/** FR-STAR-8: the live page's real-time tick (`Live.tsx`'s `TICK_MS`), not imported so the live chunk stays out of this one. */
const STARS_TICK_MS = 10_000;

/** R170 (FR-GLOBE-12): the globe's name — the place, the instant to the minute in its zone (held to `BODIES_EVERY_MS`) and the turn. */
function useGlobeLabel(place: Observer, instant: EpochMs, turn: GlobeTurn): string {
  const t = useT();
  const locale = useLocale();
  const at = useWallThrottle(instant, BODIES_EVERY_MS);
  return t.globe.label({ place: place.label, time: formatShortClock(at, place.timeZone, locale, true), turn });
}

/** The three layers the page holds as plain switches; `names` is its own override over a default by view and width (R160, D-990). */
type LayerSwitches = Omit<StarField['layers'], 'names'>;
const ALL_LAYERS: LayerSwitches = { stars: true, figures: true, planets: true };

/**
 * R160 (FR-PHONE-7): on compact the page offers the window and the whole sky (the polar chart), the window first
 * (FR-GYRO-11). R186 (FR-WIDE-2, FR-WIDE-6; D-1095): on wide the row is every desk page's, `Globe Window Dome`; the
 * globe is this page's own drawing, the window and the dome the chart's. The view is the saved `chartView` through
 * `viewFor`, shared with the live page and the pass detail; the page's own `StarsView` state is gone.
 */
const COMPACT_VIEWS: readonly ChartView[] = ['window', 'polar'];
const WIDE_CHART_VIEWS: readonly ChartView[] = ['window', 'dome'];

/** R170 (FR-GLOBE-15): the globe, its own lazy chunk (`SkyGlobe-*.js`), asked for when the wide page first shows it. */
// R186: a promise of its own — two lazies sharing the cached one see it already marked fulfilled and, under `act`, retry
// before their own resolution lands, forever.
const SkyGlobe = lazy(() => loadGlobe().then((module) => module));
/** R170 (FR-GLOBE-15, `GLOBE_STARS_KB`): the globe's rail groups and its list, lazy with the globe so `stars` keeps the wiring alone. */
const GlobeField = lazy(() => loadGlobeRail().then((module) => ({ default: module.GlobeField })));

/** FR-STAR-3 as amended v2.11: the four layer toggles in this order, over two rows. */
const LAYER_KEYS = ['stars', 'figures', 'planets', 'names'] as const satisfies readonly (keyof StarField['layers'])[];

/**
 * FR-COMP-4's 36 cells at 390 px less the two cells of padding each side the sheet shares with the shell (R163): the
 * room a layer row has, 32 cells, the budget the first row is cut to. The 36 of R132 counted the padding as room, and
 * `[x] stars [x] figures [x] planets` (33 cells) stood squeezed on the phone, its third toggle with no cell before it.
 */
const LAYER_ROW_BUDGET = 36 - 2 * SHELL_PADDING_CELLS;

/**
 * R132 (FR-FLOW-8, D-865): how many of the layer toggles the first row holds — as many as fit the budget as `[x] label`
 * cells with a cell between (`tests/styles/cells.ts`'s count), at least one. Two in both languages at 32 cells: three
 * would be 33 in English and 38 in Spanish (R163; FR-CLEAN-11's row reads `[x] stars [x] figures` then `[x] planets
 * [x] names`).
 */
export function firstRowCount(labels: readonly string[], budget: number): number {
  let cells = 0;
  let count = 0;
  for (const label of labels) {
    const next = cells + (count > 0 ? 1 : 0) + 4 + label.length;
    if (next > budget && count > 0) break;
    cells = next;
    count += 1;
  }
  return Math.max(1, Math.min(count, labels.length - 1));
}

const UNMEASURED = { width: 0, height: 0 };
/** R160 (FR-PHONE-7): the whole sky reads no camera and no box — one inert rotation and view, so the list's memos hold still while the camera moves under it. */
const WHOLE_SKY_VIEW: View = { fovDeg: 0, width: 0, height: 0, screenAngleDeg: 0 };
const WHOLE_SKY_ROTATION: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** R163 (FR-CLEAN-11, D-1004): the chart is handed no pass on this page. */
const NO_PASSES: readonly LegendPass[] = [];

/** The box `SkyWindow` measures for its projection: the parent of its drawing, the element its `ResizeObserver` reads. */
const windowBox = (sky: HTMLElement): HTMLElement | null => sky.querySelector('svg[data-drawing="window"]')?.parentElement ?? null;

export function StarsPage() {
  const p = useStarsPageT();
  const observer = useActiveObserver();
  // FR-A11Y-1..3: with no place the page's one control, `[ set a place ]`, takes the focus, as the box does with one.
  const inertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (observer === null) inertRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [observer]);
  if (observer === null) {
    return (
      <>
        <div className={styles.page}>
          <StarsHeading observer={null} now={null} />
        </div>
        <div className={styles.inert} data-testid="stars-inert" ref={inertRef}>
          <p>{p.noPlace}</p>
          <TextButton label={p.setPlace} data-testid="stars-set-place" onClick={requestPlace} />
        </div>
      </>
    );
  }
  // A new place is a new sky and a new pole side: the camera starts again for it.
  return <StarsSky key={`${String(observer.lat)},${String(observer.lon)}`} observer={observer} />;
}

function StarsSky({ observer }: { observer: Observer }) {
  const p = useStarsPageT();
  const t = useT();
  const lang = useLocale();
  const mode = useLayoutMode();
  const wide = mode === 'wide';
  const compact = !wide;
  const layersId = useId();
  const facingId = useId();
  const fieldId = useId();

  /*
   * The camera is read where it is shown and nowhere else, so a drag's frame re-renders no part of this page: the
   * window subscribes for itself, the picker reads its one pressed option (a string, which a drag leaves at '' after
   * its first frame), the list reads it deferred, and the page's `data-look-*` are written by ref.
   */
  const [camera] = useState<HandCamera>(() => createHandCamera(initialHand(observer.lat)));

  const now = useNow(STARS_TICK_MS);
  const catalog = starCatalog();
  const positions = useMemo(() => starsAt(catalog, observer, now), [catalog, observer, now]);
  /*
   * R160 (FR-PHONE-7, D-971): the view — the window or the whole sky — is the page's own, the window on every open and
   * never saved. R160 (FR-PHONE-8, D-968, D-990): the names' default is by view and width — on for the window, and for
   * the whole sky on wide, off for the whole sky on compact — until the `[x] names` toggle is tapped, from when its
   * choice holds for both views; the toggle shows the value in force. FR-GLOBE-1 as amended (V212-11, D-1054): a desk
   * opens on the globe, a phone on the window; the width at the open picks it, nothing is saved.
   */
  // R186 (FR-WIDE-2, D-1095): the saved view as this page offers it at this width — the globe on wide and the window on compact with nothing saved.
  const savedView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  /*
   * R186 (FR-PHONE-10, FR-KEEP-1, FR-KEEP-2): a pinch handoff or following turning on changes the view without the
   * reader choosing it, so it is held here and not saved; a pick from the row or `v` saves and clears the hold.
   */
  const [heldView, setHeldView] = useState<ChartView | null>(null);
  const chartView = heldView ?? viewFor('stars', mode, savedView);
  const onChartView = useCallback(
    (next: ChartView) => {
      setHeldView(null);
      setChartView(next);
    },
    [setChartView],
  );
  // The whole sky: the polar chart on compact, the globe on wide (FR-GLOBE-1); the dome is wide's third value.
  const whole = chartView !== 'window';
  const globeShown = wide && chartView === 'globe';
  const [layers, setLayers] = useState<LayerSwitches>(ALL_LAYERS);
  const [namesChoice, setNamesChoice] = useState<boolean | null>(null);
  const names = namesChoice ?? !(chartView === 'polar');
  const drawnLayers = useMemo<StarField['layers']>(() => ({ ...layers, names }), [layers, names]);
  const scene: SkyScene = useMemo(() => ({ stars: { catalog: sceneCatalog(catalog), positions, layers: drawnLayers } }), [catalog, positions, drawnLayers]);
  const { sun, moon } = useSkyBodies({ observer, now });

  // FR-STAR-7: one named object for the drawing and the list, cleared after the hold; naming it again restarts the hold.
  const [named, setNamed] = useState<{ index: number; at: number } | null>(null);
  const onName = useCallback((index: number | null) => {
    setNamed(index === null ? null : { index, at: performance.now() });
  }, []);
  useEffect(() => {
    if (named === null) return;
    const id = window.setTimeout(() => {
      setNamed(null);
    }, STAR_LABEL_HOLD_S * 1000);
    return () => {
      window.clearTimeout(id);
    };
  }, [named]);

  // FR-GLOBE-5: the turn, the visit's and not saved.
  const [turn, setTurn] = useState<GlobeTurn>('you');
  /*
   * R170 (FR-GLOBE-9, D-1040): the places — the observer, then the saved places by `mostRecentlyUsed` (the observer's
   * own entry not twice), read and never written. The choice is local; a favourite removed meanwhile falls back to the
   * observer.
   */
  const favourites = useAppStore((s) => s.favourites);
  const places = useMemo(() => {
    const own = favouriteCellKey(observer);
    return mostRecentlyUsed(favourites).filter((place) => place.cellKey !== own);
  }, [favourites, observer]);
  const [placeChoice, setPlaceChoice] = useState<PlaceChoice>(null);
  const chosenPlace = placeChoice === null ? undefined : places.find((place) => place.cellKey === placeChoice);
  const shownChoice: PlaceChoice = chosenPlace === undefined ? null : placeChoice;
  const shownPlace = chosenPlace?.observer ?? observer;
  /*
   * R170 (FR-GLOBE-7, FR-GLOBE-8; D-1039) → R187 (FR-WIDE-4, D-1100): the globe's own time — a second `usePlayback`
   * over the live page's span, now to now + 24 h, which a day step past it moves (`shift`, the shown place's noon)
   * up to `GLOBE_SPAN_DAYS` either way. It writes no hash, no pref and no store; the window keeps real time. Held
   * here, so leaving the globe and coming back within the visit keeps the instant; a time-lapse pauses when the globe
   * is left (the page would otherwise re-render per frame under the window).
   */
  const globeBase = useMemo<Span>(() => ({ start: now, end: now + LIVE_WINDOW_MS }), [now]);
  const globeClock = usePlayback({ span: globeBase, realNow: now, initial: null, realFrom: Date.now, shift: { maxDays: GLOBE_SPAN_DAYS, timeZone: shownPlace.timeZone } });
  const { playing: globePlaying, pause: pauseGlobe } = globeClock;
  useEffect(() => {
    if (!globeShown && globePlaying) pauseGlobe();
  }, [globeShown, globePlaying, pauseGlobe]);
  // FR-GLOBE-10: `[ ] faint`, off on every visit and not saved; a failed load unpresses it.
  const [faint, setFaint] = useState(false);
  const onFaintFailed = useCallback(() => {
    setFaint(false);
  }, []);
  useGlobePrefetch(wide);
  const globeLabel = useGlobeLabel(shownPlace, globeClock.t, turn);

  const layoutRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const hintShown = useSkyHintShown(chartView) && !globeShown;

  // Where the camera looks, on the page's root for the tests and the captures, written by ref (no render per frame).
  useLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const write = (): void => {
      const { azDeg, altDeg } = camera.get();
      layout.dataset.lookAz = String(Math.round(azDeg));
      layout.dataset.lookAlt = String(Math.round(altDeg));
    };
    write();
    return camera.subscribe(write);
  }, [camera]);

  /*
   * The list's field is the drawing's own: the page observes the one element `SkyWindow` measures for its projection
   * and reads the same `contentRect`, rounded the same way, so the list names what the box shows. R160: the window
   * is `SkyChart`'s lazy view now, drawn after the page and gone while the whole sky is shown, so the box to observe
   * is found again whenever the drawing's tree changes.
   */
  const [box, setBox] = useState(UNMEASURED);
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky || typeof ResizeObserver === 'undefined') return;
    const sizes = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        setBox((was) => (was.width === width && was.height === height ? was : { width, height }));
      }
    });
    let watched: HTMLElement | null = null;
    const attach = (): void => {
      const drawn = windowBox(sky);
      if (drawn === watched) return;
      if (watched) sizes.unobserve(watched);
      watched = drawn;
      if (drawn) sizes.observe(drawn);
    };
    attach();
    const arrivals = typeof MutationObserver === 'undefined' ? null : new MutationObserver(attach);
    arrivals?.observe(sky, { childList: true, subtree: true });
    return () => {
      sizes.disconnect();
      arrivals?.disconnect();
    };
  }, []);

  // FR-A11Y-1..3: the page's focus target is the drawing's box, which takes the arrow keys (FR-STAR-4). R160: the box
  // arrives with the window's chunk; it takes the focus then, unless the reader has put it somewhere else meanwhile.
  // V212-11 (D-1054): a desk opens on the globe, which focuses its own box on mount by the same rule (`SkyGlobe`).
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky) return;
    const focus = (): boolean => {
      const drawn = windowBox(sky);
      if (!drawn) return false;
      const active = document.activeElement;
      if (active === null || active === document.body || sky.contains(active)) drawn.focus({ preventScroll: true });
      return true;
    };
    if (focus() || typeof MutationObserver === 'undefined') return;
    const arrival = new MutationObserver(() => {
      if (focus()) arrival.disconnect();
    });
    arrival.observe(sky, { childList: true, subtree: true });
    return () => {
      arrival.disconnect();
    };
  }, []);

  /*
   * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-4; D-943, D-944): whether this page's window follows the phone.
   * R159 (FR-PHONE-1, FR-PHONE-2; D-962): the page's `useFollow()` — on at mount where nothing has to be asked, armed by a
   * saved grant so the first touch on the sky asks (`onFirstTouch`), off otherwise. The toggle turns it on after the
   * grant; the window turns it off when a drag or a box key takes the sky back (`onFollowEnd`), the hand camera seeded
   * where the phone last pointed. The controls are drawn only where the sensor is (FR-WIN-4's presence test, asked
   * once at mount): R163 (FR-GYRO-1 as amended, FR-CLEAN-3): on compact the toggle is the sheet's row after the view
   * row and `[ follow ]` stands before `[ controls ]` in the bottom row, the same state both ways; on wide the toggle
   * is the rail's `action` slot.
   */
  const follow = useFollow();
  const following = follow.on;
  const sensor = follow.sensor;
  // R157 (FR-PHONE-6, D-967): the screen stays awake while following; released when it ends or the page hides.
  useWakeLock(following);

  /*
   * R163 (FR-CLEAN-4, FR-CLEAN-6; D-921's rule): the sheet's open state is the page's — `useState`, so every visit
   * opens with it closed, and held here so a turn of the phone, which keeps this page mounted, keeps it. Closing by
   * the page's own way (`Esc`) returns the focus to `[ controls ]`, as the live page does.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    document.querySelector<HTMLElement>('[data-testid="live-controls"]')?.focus();
  }, []);
  /*
   * R163 (FR-CLEAN-6; D-999, D-1011): `Esc` in two steps. The first step is the page's: with the sheet open a capture
   * listener on the window closes it and stops the event there, before the app's one `keydown` listener on the
   * document (D-73) can read it; with the sheet closed the page lets the key through, and that listener leaves the
   * page as it has since R115 (`stars.leave`, §4.37's rule). One listener per page, read through refs so the open
   * state and the width do not rebuild it.
   * R170 (FR-GLOBE-1, FR-DESK-4): the same listener takes `v`, which cycles the page's two views at both widths before
   * the app's listener reads it (which would switch the saved chart view of the other pages); a typing target is left
   * to it, as `shortcutFor`'s guard has it.
   */
  const sheetOpenRef = useRef(sheetOpen);
  const compactRef = useRef(compact);
  const savedRef = useRef<ChartView>(chartView);
  useLayoutEffect(() => {
    sheetOpenRef.current = sheetOpen;
    compactRef.current = compact;
    savedRef.current = chartView;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const closes = event.key === 'Escape' && compactRef.current && sheetOpenRef.current;
      const cycles = !closes && shortcutFor(event)?.id === 'view';
      if (!closes && !cycles) return;
      // The shortcuts overlay over the page makes the page inert (D-73's "overlay first"): the key is the overlay's.
      if (layoutRef.current?.closest('[inert]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (closes) closeSheet();
      else onChartView(nextView('stars', compactRef.current ? 'compact' : 'wide', savedRef.current));
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closeSheet, onChartView]);

  const toggle = (key: keyof StarField['layers']) => () => {
    if (key === 'names') setNamesChoice(!names);
    else setLayers((was) => ({ ...was, [key]: !was[key] }));
  };
  const layer = (key: keyof StarField['layers'], alone = false) => <OptionToggle key={key} label={p.layers[key]} pressed={drawnLayers[key]} onPress={toggle(key)} data-layer={key} alone={alone} />;
  const firstRow = firstRowCount(
    LAYER_KEYS.map((key) => p.layers[key]),
    LAYER_ROW_BUDGET,
  );

  // R160 (FR-PHONE-7, D-971): `[ Window ] Whole sky` — a `ToggleGroup` in the bracket mark, 20 cells in English and 24 in Spanish.
  // R170 (FR-GLOBE-1, D-1035): on wide the second value is `Globe` / `Globo`.
  // R186 (FR-WIDE-2): on wide `[ Globe ] Window Dome`, the row every desk page has.
  const viewOptions = wide ? WIDE_VIEWS.map((id) => ({ value: id, label: t.chart.view[id] })) : COMPACT_VIEWS.map((id) => ({ value: id, label: id === 'polar' ? t.chart.views.wholeSky : t.chart.views.window }));
  const viewRow = (
    <div className={styles.row} data-testid="stars-view-row" {...(compact ? { 'data-rhythm': 'group' } : {})}>
      <ToggleGroup name={t.chart.viewGroup} mark="bracket" options={viewOptions} value={chartView} onChange={onChartView} />
    </div>
  );
  const faintToggle = globeShown ? <OptionToggle key="faint" label={t.globe.faint} pressed={faint} onPress={() => { setFaint(!faint); }} data-layer="faint" alone /> : null;
  const layerRows = (
    <section aria-labelledby={layersId} className={styles.block} data-testid="stars-layer-rows" {...(compact ? { 'data-rhythm': 'group' } : {})}>
      <SectionHeading id={layersId} visuallyHidden={!wide}>
        {p.layersHeading}
      </SectionHeading>
      {/* FR-FLOW-8 → FR-CLEAN-4: one group of two rows `--space-1` apart, the split by the row's room (`firstRowCount`):
          `[x] stars [x] figures` and `[x] planets [x] names` (21 and 23 cells); `[x] estrellas [x] figuras` and
          `[x] planetas [x] nombres` (25 and 24). */}
      <div role="group" aria-label={p.layersHeading} className={styles.layers} data-testid="stars-layers">
        <div className={styles.row} data-testid="stars-layers-row" {...(compact ? { 'data-rhythm': 'row' } : {})}>
          {LAYER_KEYS.slice(0, firstRow).map((key, index) => layer(key, index > 0))}
        </div>
        <div className={styles.row} data-testid="stars-layers-row" {...(compact ? { 'data-rhythm': 'row' } : {})}>
          {/* The last option of a row stands alone (no trailing cell); with `[ ] faint` after them, `names` is not the last. */}
          {LAYER_KEYS.slice(firstRow).map((key, index) => layer(key, index > 0 && faintToggle === null))}
          {faintToggle}
        </div>
      </div>
    </section>
  );
  const field = (
    <section aria-labelledby={fieldId} className={styles.block} data-testid="stars-field" {...(compact ? { 'data-rhythm': 'group' } : {})}>
      <SectionHeading id={fieldId}>{p.fieldHeading}</SectionHeading>
      <FieldSection camera={camera} catalog={catalog} positions={positions} box={box} layers={drawnLayers} whole={whole} named={named?.index ?? null} onName={onName} labelledBy={fieldId} />
    </section>
  );
  // R170 (FR-GLOBE-12, D-1035): on the globe the list is `Up from <place>`, at the globe's place and instant.
  const globeField = (
    <Suspense fallback={null}>
      <GlobeField place={shownPlace} instant={globeClock.t} layers={drawnLayers} faint={faint} named={named?.index ?? null} onName={onName} />
    </Suspense>
  );
  const drawing = (
    // R132 (FR-FLOW-6, D-848): the page's own camera, so no hand slot reports the gesture — a drag, a pinch or a
    // tap all begin with a pointer down in the box, caught here before the window's own handlers.
    // R160 (D-971): the chart with the page's two views; the window takes the page's camera, the whole sky outlines it.
    // R170 (FR-GLOBE-1, FR-GLOBE-12): on wide the whole sky is the globe, in the same box, the group named for its place, instant and turn.
    <div className={styles.sky} ref={skyRef} role="group" aria-label={globeShown ? globeLabel : p.drawing} data-testid="stars-sky" data-view={globeShown ? 'globe' : chartView} onPointerDownCapture={markSkyHintSeen}>
      {globeShown ? (
        <Suspense fallback={null}>
          <SkyGlobe place={shownPlace} instant={globeClock.t} turn={turn} layers={drawnLayers} faint={faint} language={lang} onFaintFailed={onFaintFailed} named={named?.index ?? null} />
        </Suspense>
      ) : (
        <SkyChart passes={NO_PASSES} observer={observer} highlightedPassId={null} now={now} sun={sun} moon={moon} fill scene={scene} camera={camera} namedStar={named?.index ?? null} onNameStar={onName} follow={following} onFollowEnd={follow.onFollowEnd} views={compact ? COMPACT_VIEWS : WIDE_CHART_VIEWS} view={chartView} page="stars" onViewChange={onChartView} onViewHold={setHeldView} />
      )}
    </div>
  );

  /*
   * R163 (FR-CLEAN-2, FR-CLEAN-3, FR-PHONE-4; D-965, D-980): while the finger has the sky — not following — and the
   * sheet is closed, the chart's facing readout stands in the box's top-right corner, with FR-STAR-7's second line
   * under it (`readoutLines`, D-1010); with the sheet open it is the facing row's. The chart portals it into one place,
   * so the two take turns. The polar chart's readout is its convention, not a facing, and stays in the sheet.
   */
  const cornerReadout = compact && !following && !sheetOpen && chartView !== 'polar';
  /*
   * R157's device (D-965): the head's width, written as `--sky-head-w` on the full layout's root, so the corner
   * readout ends in its ellipsis before it meets the head; by a resize observer and no render. Held here and let go
   * when the root is: `SkyViewLayout` calls the page's ref from its own and does not hand back a ref callback's cleanup.
   */
  const headObserver = useRef<ResizeObserver | null>(null);
  const headRoom = useCallback((root: HTMLDivElement | null) => {
    headObserver.current?.disconnect();
    headObserver.current = null;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const head = root.querySelector<HTMLElement>('[data-testid="live-head"]');
    if (!head) return;
    const write = (): void => {
      root.style.setProperty('--sky-head-w', `${String(Math.ceil(head.getBoundingClientRect().width))}px`);
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(head);
    headObserver.current = observer;
  }, []);
  useEffect(
    () => () => {
      headObserver.current?.disconnect();
      headObserver.current = null;
    },
    [],
  );

  /*
   * R163 (FR-CLEAN-4; D-923's row): the facing row in the sheet — the chart's readout as a button that opens the
   * picker under it, the live page's row. On the window the picker is this page's own (`FacingPicker`, the eight
   * points and `up`, on the page's camera); on the whole sky the readout is the polar chart's convention line and the
   * picker its looking-up / map toggle, both portaled by the chart. A pick — one of the row's options — closes the
   * picker, read off the DOM, since a portal's events bubble through the chart's tree and not through this row
   * (D-904); the sheet stays open (FR-CLEAN-6). The listener is the document's, above React's root, so it runs after
   * React has given the pick to its own handler (the point, the orientation): a listener under the root would close
   * the row first, and a browser flushes that render between two listeners of one click, which leaves React a pick
   * on an unmounted row and the camera where it was (D-1011).
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const facingLabelId = useId();
  const facingPickerId = useId();
  const facingPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onPick = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && facingPickerRef.current?.contains(target) && target.closest(PICK_SELECTOR)) setPickerOpen(false);
    };
    document.addEventListener('click', onPick);
    return () => {
      document.removeEventListener('click', onPick);
    };
  }, [pickerOpen]);
  const facing = (
    <div className={styles.facing} data-testid="stars-facing" data-rhythm="group">
      <div className={styles.facingReadout}>
        <div className={styles.facingWords} id={facingLabelId} aria-hidden="true">
          {!cornerReadout && <SkyViewChartSlot name="readout" />}
        </div>
        <button
          type="button"
          className={styles.facingHit}
          data-testid="sky-readout-toggle"
          aria-labelledby={facingLabelId}
          aria-expanded={pickerOpen}
          {...(pickerOpen ? { 'aria-controls': facingPickerId } : {})}
          onClick={() => {
            setPickerOpen(!pickerOpen);
          }}
        />
      </div>
      {pickerOpen && (
        <div className={styles.facingPicker} id={facingPickerId} ref={facingPickerRef} data-testid="stars-facing-picker">
          {chartView === 'window' ? <FacingPicker camera={camera} className={styles.row} /> : <SkyViewChartSlot name="picker" />}
        </div>
      )}
    </div>
  );

  // R148's hint rule (FR-FULL-3, D-924) → R157 (FR-PHONE-3, D-964): the hint's line, for where it stands beside the bottom row's controls.
  const hintLine = useSkyHintLine(chartView);
  const hintBeside = hintLine !== null && hintFitsBeside(hintLine.text, sensor ? [t.sheet.follow, t.sheet.controls] : [t.sheet.controls]);
  const sunUp = drawnRungs(positions.sunAltDeg) === 0;

  if (compact) {
    /*
     * R163 (FR-CLEAN-1..4, FR-CLEAN-6; D-997): the full form — the box is the screen, and over it the overlay (the
     * head with the door's line, the hint until the first gesture; the corner readout is the layout's slot) and the
     * sheet slot (`[ follow ]` and `[ controls ]` at the bottom-right, and the sheet they stand over). The sheet's
     * rows are FR-CLEAN-4's, in order; they stay mounted while the sheet is closed, inert (D-932), so a turn of the
     * phone keeps every state. R159 (D-987): while the refusal's line stands it takes the hint's row, so the hint
     * steps aside until the next press.
     */
    const overlay = (
      <>
        <SkyHead line={<StarsHeadLine observer={observer} now={now} sunUp={sunUp} />} onBack={close} className={styles.head} />
        {hintLine !== null && !follow.refused && (
          <div className={styles.hintArea} data-beside={hintBeside ? 'true' : 'false'}>
            <SkyHint view={chartView} fit />
          </div>
        )}
      </>
    );
    const sheet = (
      <ControlsSheet open={sheetOpen} onOpenChange={setSheetOpen} place={observer.label} beside={sensor ? <FollowControl follow={follow} showRefusal={!sheetOpen} /> : null} className={styles.controls}>
        {viewRow}
        {sensor && (
          <div className={styles.follow} data-testid="stars-follow" data-rhythm="group">
            <FollowToggle follow={follow} />
          </div>
        )}
        {/* R152 (FR-GYRO-5, D-957): while following the facing row is not drawn — its readout is not (nothing describes the
            sensor's view) and a pick by hand would fight the sensor; it is back, where the phone last pointed, when following ends. */}
        {!following && facing}
        {layerRows}
        {field}
      </ControlsSheet>
    );
    return (
      <div className={styles.page} data-layout={mode}>
        <div className={styles.layout} data-layout={mode} ref={layoutRef} data-testid="stars-page">
          {/* FR-CLEAN-2: the page's name stays in the document for the outline (FR-A11Y-2) and assistive technology; the head over the sky carries the door's line. */}
          <VisuallyHidden as="h1">{t.starsHeading}</VisuallyHidden>
          <SkyViewLayout
            ref={headRoom}
            readoutIn="sheet"
            readoutLines={2}
            onFirstTouch={follow.firstTouch}
            className={styles.skyLayout}
            data-testid="stars-layout"
            drawing={drawing}
            overlay={overlay}
            {...(cornerReadout ? { readout: <SkyViewChartSlot name="readout" /> } : {})}
            sheet={sheet}
          />
        </div>
      </div>
    );
  }

  /*
   * R186 (FR-WIDE-1, FR-WIDE-5; D-1098): on wide the page is the desk's one shell — the box at the left with its
   * corners (the readout, the hint, the zoom; the globe and the window place their own), the rail in `SLOT_ORDER`: the
   * `h1` block, `View`, `Time` (the globe's, `sky/stars/Time.tsx`), the page group (`sky/stars/Group.tsx`: `Turn`
   * and `Place` on the globe, `Facing` on the window, `[ follow the phone ]` where the sensor is), the layers, and
   * `Up from <place>` or `In this field`. The box is the room the layout's grid leaves; nothing here measures it.
   */
  const facingGroup =
    chartView === 'window' ? (
      <section aria-labelledby={facingId} data-testid="stars-facing-group">
        <SectionHeading id={facingId}>{t.skyView.facing}</SectionHeading>
        <FacingPicker camera={camera} className={styles.row} />
      </section>
    ) : null;
  const followToggle = sensor ? <FollowToggle follow={follow} className={styles.follow} /> : null;
  const globeChoices = globeShown ? { turn, onTurn: setTurn, observer, places, choice: shownChoice, onChoice: setPlaceChoice } : undefined;
  return (
    <div className={styles.page} data-layout={mode}>
      <div className={styles.layout} data-layout={mode} ref={layoutRef} data-testid="stars-page">
        <SkyViewLayout
          onFirstTouch={follow.firstTouch}
          className={styles.skyLayout}
          data-testid="stars-layout"
          answer={<StarsHeading observer={observer} now={now} />}
          viewRow={viewRow}
          drawing={drawing}
          hint={hintShown && <SkyHint view={chartView} />}
          {...(globeShown ? { timeline: <StarsTime playback={globeClock} place={shownPlace} now={now} /> } : {})}
          action={
            <StarsGroup globe={globeChoices}>
              {facingGroup}
              {followToggle}
            </StarsGroup>
          }
          layers={layerRows}
          list={globeShown ? globeField : field}
        />
      </div>
    </div>
  );
}

/**
 * R129 (FR-FLOW-3; F7, D4): the wide page names itself — a visible `h1`, "Stars tonight", and under it at `--small`
 * the dark window and the cloud word, as the home's What step words them (`useNight`: the stripe's bands and the
 * forecast at the middle of the night). Before the bands are known the line is the cloud word alone; with no place,
 * the heading alone. R132 moves the block into the `answer` slot. R163: wide's alone — compact hides the `h1` and
 * puts the door's line in the head (`StarsHeadLine`).
 */
function StarsHeading({ observer, now }: { observer: Observer | null; now: EpochMs | null }) {
  const t = useT();
  return (
    <div className={styles.intro} data-testid="stars-intro">
      <h1 className={styles.heading}>{t.starsHeading}</h1>
      {observer !== null && now !== null && <TonightLine observer={observer} now={now} />}
    </div>
  );
}

/** `useTonight`'s span: a day back and a day and a half ahead of the hour, so tonight's dark band is in it whole. */
const TONIGHT_BACK_MS = 24 * HOUR_MS;
const TONIGHT_AHEAD_MS = 36 * HOUR_MS;

/**
 * `useNight`'s reading, on the page's own clock: the stars page already ticks (`STARS_TICK_MS`), so the lines take
 * that `now` rather than a second timer, and sample the bands once an hour, when the span moves. The cloud is the
 * forecast's hour by hour across tonight's stretch (`nightWindow`, `nightClouds`, D-1028), as the home's doors word it.
 */
function useStarsNight(observer: Observer, now: EpochMs): { bands: readonly SkyBand[]; span: Span; cloud: TonightCloud } {
  const locale = useLocale();
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const span = useMemo<Span>(() => ({ start: hour - TONIGHT_BACK_MS, end: hour + TONIGHT_AHEAD_MS }), [hour]);
  const bands = useSkyBands(observer, span);
  const weather = useAppStore((s) => s.weather);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const night = bands.length > 0 ? nightWindow(bands, observer, now) : null;
  return { bands, span, cloud: tonightCloud(nightClouds(snapshot, night, now), (at) => formatShortClock(at, observer.timeZone, locale)) };
}

function TonightLine({ observer, now }: { observer: Observer; now: EpochMs }) {
  const t = useT();
  const locale = useLocale();
  const { bands, span, cloud } = useStarsNight(observer, now);
  const known = bands.length > 0;
  const darkBand = known ? tonightsDark(bands, now) : null;
  const dark = !known ? null : darkBand === null ? t.home.noDarkWindow : `${t.home.conditions.dark} ${darkWindowText(darkBand, span.start, observer.timeZone, locale, t)}`;
  return (
    <p className={styles.tonight} data-testid="stars-tonight">
      {[dark, t.weather.tonight(cloud)].filter((piece) => piece !== null).join(' · ')}
    </p>
  );
}

/** What the head's line is worded from (D-1009): the clock, the zone, the bands, the cloud word, and whether the Sun is up. */
export interface StarsHeadLineInput {
  now: EpochMs;
  zone: string | null;
  bands: readonly SkyBand[];
  cloud: TonightCloud;
  /** The twilight step draws nothing (`drawnRungs` 0): the Sun is up, and the stars come later. */
  sunUp: boolean;
}

/**
 * R163 (FR-CLEAN-2; D-1009): the compact head's one line after `[ ← ]`, the Stars door's own words (`doorLines`'s
 * functions in `i18n/{en,es}/home.ts`) in its three forms — "Dark 20:25 → 07:05 · Clear" with tonight's dark band;
 * "No full dark · Clear" with none; and "Stars from 20:25" while the Sun is up and the stars are still to come, the
 * door's second line, since the first would name a window the reader cannot use yet. With no zone the stamps say UTC
 * and there is no forecast, so no cloud word (the door's rule, D-859); before the bands are known the line is the
 * cloud word alone, as the wide line under the `h1` is, or empty with no zone.
 */
export function starsHeadLine(t: Messages, locale: Locale, { now, zone, bands, cloud, sunUp }: StarsHeadLineInput): string {
  const cloudWord = zone === null ? null : cloud;
  if (bands.length === 0) return cloudWord === null ? '' : t.weather.tonight(cloudWord);
  const clock = (at: EpochMs, last = false): string => formatShortClock(at, zone, locale, last && zone === null);
  const starsFrom = tonightsStarsFrom(bands, now);
  if (sunUp && starsFrom !== null && starsFrom.from > now) return t.doors.stars.from(clock(starsFrom.from, true));
  const dark = tonightsDark(bands, now);
  return dark ? t.doors.stars.dark({ from: clock(dark.from), to: clock(dark.to, true), cloud: cloudWord }) : t.doors.stars.noDark(cloudWord);
}

/** The head's line as `SkyHead` wants it: one `<p>` at `--small` in the dim ink that does not wrap (its end is cut by the head). */
function StarsHeadLine({ observer, now, sunUp }: { observer: Observer; now: EpochMs; sunUp: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { bands, cloud } = useStarsNight(observer, now);
  return (
    <p className={styles.headLine} data-testid="stars-head-line">
      {starsHeadLine(t, locale, { now, zone: observer.timeZone, bands, cloud, sunUp })}
    </p>
  );
}

interface FieldSectionProps {
  camera: HandCamera;
  catalog: ReturnType<typeof starCatalog>;
  positions: ReturnType<typeof starsAt>;
  /** The drawing's measured box; the field across it is the camera's (R125, FR-SKY-14). */
  box: { width: number; height: number };
  layers: StarField['layers'];
  /** R160 (FR-PHONE-7): the whole sky is shown — the list names its twelve brightest, whatever the camera and the box. */
  whole: boolean;
  named: number | null;
  onName: (index: number | null) => void;
  labelledBy: string;
}

/**
 * `In this field`, reading the camera through `useDeferredValue`: a drag's frame re-renders this component with the
 * old value, which every memo below answers, and the list follows when React has the time. R125 (FR-SKY-14): the
 * view's field is the camera's `fovDeg`, read the same deferred way, so a zoom lists what the narrowed box shows.
 */
function FieldSection({ camera, catalog, positions, box, layers, whole, named, onName, labelledBy }: FieldSectionProps) {
  const lang = useLocale();
  const hand = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  const settled = useDeferredValue(hand);
  const windowView: View = useMemo(() => ({ fovDeg: settled.fovDeg, width: box.width, height: box.height, screenAngleDeg: 0 }), [settled.fovDeg, box]);
  const windowRotation = useMemo(() => handRotation(settled), [settled]);
  // R160: the whole sky's field is every object above the horizon, so its memos read an inert camera and hold still under the hand.
  const view = whole ? WHOLE_SKY_VIEW : windowView;
  const rotation = whole ? WHOLE_SKY_ROTATION : windowRotation;
  // R126 (D-832): the star names in the reader's language, through `starName`.
  const objects = useMemo(() => fieldObjects({ catalog, positions, rotation, view, layers, lang, whole }), [catalog, positions, rotation, view, layers, lang, whole]);
  const buried = !whole && windowView.width > 0 && groundState(settled.altDeg, windowView) === 'buried';
  return useMemo(() => <FieldList objects={objects} named={named} onName={onName} buried={buried} labelledBy={labelledBy} />, [objects, named, onName, buried, labelledBy]);
}

/** R123 (FR-SKY-3, FR-SKY-10, D-791): the live page's and the pass detail's stars, from this chunk through `starsChunk.ts`. */
export { brightestNow, starSource } from './stars/source';
export { moonNow } from '../../lib/skyStars';
