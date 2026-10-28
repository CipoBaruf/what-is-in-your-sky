import { memo, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { starCatalog } from '../../data/stars/catalog';
import { useStarsPageT } from '../../i18n/starsPageT';
import { useLocale, useT } from '../../i18n/useT';
import { fitBox, RAIL_MIN_CELLS } from '../../lib/layout';
import { legendKeys, legendRows, type LegendPass, type LegendRow } from '../../lib/legend';
import { livePasses } from '../../lib/livePasses';
import { starsAt } from '../../lib/skyStars';
import type { EpochMs, Observer } from '../../model';
import { useActiveObserver, useAppStore, type PassesState } from '../../state';
import { sameLocation } from '../../state/slices/location';
import { SkyScreen, type SkyScreenProps } from '../components/screen/SkyScreen';
import { useSkyScreen } from '../components/screen/useSkyScreen';
import { createHandCamera, handRotation, initialHand, type HandCamera } from '../components/guide/skychart/window/camera';
import { FacingPicker } from '../components/guide/skychart/window/FacingPicker';
import { groundState, type View } from '../components/guide/skychart/window/projection';
import type { SkyScene, StarField } from '../components/guide/skychart/window/scene';
import { SkyWindow } from '../components/guide/skychart/window/SkyWindow';
import { markSkyHintSeen } from '../components/guide/skychart/useChartHand';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { OptionToggle } from '../components/primitives/OptionToggle';
import { SectionHeading } from '../components/primitives/SectionHeading';
import { TextButton } from '../components/primitives/TextButton';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import { darkWindowText } from '../components/now/ConditionsTable';
import { requestPlace } from './home/placeRequest';
import { nightWindow } from './home/tonight';
import { useSkyBands } from '../components/live/useSkyBands';
import { cloudVerdict } from '../../lib/cloudVerdict';
import { HOUR_MS, type Span } from '../../lib/timeStripe';
import { tonightsDark } from '../../lib/tonightStripe';
import { FieldList } from './stars/FieldList';
import { fieldObjects, fieldPasses, fieldRows, sceneCatalog, STAR_LABEL_HOLD_S } from './stars/field';
import { arcKey, withArcStates } from '../components/live/liveArcs';
import { SkyHint, useSkyHintShown } from '../components/sky/SkyHint';
import { SkyViewChartSlot, SkyViewLayout } from '../components/sky/SkyViewLayout';
import styles from './Stars.module.css';

/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-8, FR-STAR-10; US-39; D-756):
 * the `#stars` page — the `stars` chunk's one export, behind `StarsRoute.ts`.
 *
 * It composes the window the screen and the live page already have (R113's
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
 * shape), and the rail — `Facing`, `Layers`, `In this field`. The
 * window's facing readout stands in the box's top-left corner on the screen's
 * overlay surface. **Compact**: the readout row, the box full-bleed and
 * square, the facing row, the layers' two rows (four `[x]` toggles are 43
 * cells in English, D-776), then the list.
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
 */
/** FR-STAR-8: the live page's real-time tick (`Live.tsx`'s `TICK_MS`), not imported so the live chunk stays out of this one. */
const STARS_TICK_MS = 10_000;

const ALL_LAYERS: StarField['layers'] = { stars: true, figures: true, planets: true, names: true };

/** FR-FLOW-8: the four layer toggles in this order, over two rows; `[ passes ]` ends the second. */
const LAYER_KEYS = ['stars', 'figures', 'planets', 'names'] as const satisfies readonly (keyof StarField['layers'])[];

/** FR-COMP-4: a 390 px viewport at the default cell, the budget the first layer row is cut to. */
const LAYER_ROW_BUDGET = 36;

/**
 * R132 (FR-FLOW-8, D-865): how many of the layer toggles the first row holds — as many as fit the budget as `[x] label`
 * cells with a cell between (`tests/styles/cells.ts`'s count), at least one. Three in English (33 cells); two in Spanish,
 * where the three would be 38.
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

/**
 * R126 (FR-SKY-6): whether the store's run is this sky's and has arrived — the live page's `liveState` rule: this
 * place's run (`sameLocation`), finished, or with passes standing in while a new one computes. A run computing from
 * nothing, one that failed with nothing, or one for another place is not in, and `[ passes ]` then hands the screen
 * no passes rather than an empty night.
 */
export function passesRunIn(passes: Pick<PassesState, 'observer' | 'status' | 'passes'>, observer: Observer): boolean {
  return sameLocation(passes.observer, observer) && (passes.status === 'done' || passes.passes.length > 0);
}

const NO_PASSES: readonly LegendPass[] = [];
const NO_ROWS: readonly LegendRow[] = [];

/** The rail's minimum, from `lib/layout.ts`, as the stylesheet's one input in cells (the probe and the grid read it). */
const RAIL_STYLE = { ['--rail-min-cells' as string]: String(RAIL_MIN_CELLS) } as CSSProperties;

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
  const t = useT();
  const p = useStarsPageT();
  const mode = useLayoutMode();
  const wide = mode === 'wide';
  const layersId = useId();
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
  const [layers, setLayers] = useState(ALL_LAYERS);
  const scene: SkyScene = useMemo(() => ({ stars: { catalog: sceneCatalog(catalog), positions, layers } }), [catalog, positions, layers]);
  const { sun, moon } = useSkyBodies({ observer, now });

  /*
   * R126 (FR-SKY-6, D-794): `[ passes ]` — page state, off on every open and never saved. With it on the scene
   * carries tonight's passes: the store's run for this place, FR-TRAJ-1's set at now with each arc's state, handed
   * to the window with the legend's keys and series colours as the live page's chart hands them, to the screen,
   * and to `In this field`. A run for another place is not this sky's, so it carries none (FR-OFF-8's rule).
   *
   * The run is "in" as the live page's `liveState` has it: this place's, and finished or standing in with passes.
   * Until it is, `passes` is `null` — the screen is handed none and stays the stars inventory, so no empty-sky chip
   * says "nothing tonight" for a night not yet computed.
   *
   * The set is the live page's (`livePasses`, `src/lib`), and the arcs' states are its `arcKey` / `withArcStates`:
   * the array is remade only when the set or a state changes, not on every 10 s tick. The legend's rows are worked
   * out once here, for the window's keys and the list.
   */
  const [showPasses, setShowPasses] = useState(false);
  const passesState = useAppStore((s) => s.passes);
  const runIn = passesRunIn(passesState, observer);
  const source = showPasses && runIn ? passesState.passes : null;
  const tonightIds = source === null ? null : livePasses(source, now).map((pass) => pass.id).join(' ');
  const tonight = useMemo(() => {
    if (source === null || tonightIds === null) return null;
    const ids = new Set(tonightIds.split(' '));
    return source.filter((pass) => ids.has(pass.id));
  }, [source, tonightIds]);
  const arcs = tonight === null ? null : arcKey(tonight, now);
  const passes = useMemo(() => (tonight === null || arcs === null ? null : withArcStates(tonight, arcs)), [tonight, arcs]);
  const drawnPasses = passes ?? NO_PASSES;
  const rows = useMemo(() => (drawnPasses.length === 0 ? NO_ROWS : legendRows({ passes: drawnPasses, highlightedPassId: null, now, colorBy: 'pass' })), [drawnPasses, now]);
  const keys = useMemo(() => legendKeys(rows), [rows]);

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

  const layoutRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const hintShown = useSkyHintShown('window');
  const probeRef = useRef<HTMLSpanElement>(null);

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
   * On wide the box is cut here — the room beside the rail's minimum and over the hint's row (`fitBox`) — and
   * written as two custom properties the stylesheet sizes it from. R132: the layout's column gap is the one between
   * the box and the rail now (`SkyViewLayout.module.css`, two cells). R133 (FR-FLOW-9, D-850): the box's height is
   * the layout's less the hint's row and its gap, so it runs from under the header to the hint line as the live
   * page's does, and no longer the browser window's shape (R121's `windowBox`, gone); the hint's row is read off
   * the slot, which is text at the box's width and never depends on the box's height, so nothing feeds back. The
   * hint comes and goes with the reader's first drag (FR-FLOW-6), so the fit runs again on that.
   */
  useEffect(() => {
    const layout = layoutRef.current;
    if (!wide || !layout || typeof ResizeObserver === 'undefined') return;
    const fit = (): void => {
      const { width, height } = layout.getBoundingClientRect();
      const skyLayout = layout.querySelector('[data-sky-layout]');
      const gap = skyLayout ? parseFloat(getComputedStyle(skyLayout).columnGap) || 0 : 0;
      // The rail as laid out — the layout's column, 44 to 60 cells — read off a rail slot; the probe is its floor.
      const railSlot = skyLayout?.querySelector('[data-slot="answer"]');
      const rail = Math.max(probeRef.current?.getBoundingClientRect().width ?? 0, railSlot?.getBoundingClientRect().width ?? 0);
      // The hint's row under the box: its height and the gap over it (the slot's own margin, D-851's rhythm).
      const hintSlot = skyLayout?.querySelector('[data-slot="hint"]');
      const hint = hintSlot ? hintSlot.getBoundingClientRect().height + (parseFloat(getComputedStyle(hintSlot).marginTop) || 0) : 0;
      const box = fitBox({ frameWidthPx: width, frameHeightPx: height, aboveHeightPx: 0, belowHeightPx: hint, besideWidthPx: rail + gap });
      const next = { w: `${String(box.widthPx)}px`, h: `${String(box.heightPx)}px` };
      if (layout.style.getPropertyValue('--stars-box-w') !== next.w) layout.style.setProperty('--stars-box-w', next.w);
      if (layout.style.getPropertyValue('--stars-box-h') !== next.h) layout.style.setProperty('--stars-box-h', next.h);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(layout);
    fit();
    return () => {
      observer.disconnect();
      layout.style.removeProperty('--stars-box-w');
      layout.style.removeProperty('--stars-box-h');
    };
  }, [wide, hintShown]);

  /*
   * The list's field is the drawing's own: the page observes the one element `SkyWindow` measures for its projection
   * and reads the same `contentRect`, rounded the same way, so the list names what the box shows.
   */
  const [box, setBox] = useState(UNMEASURED);
  useEffect(() => {
    const drawn = skyRef.current && windowBox(skyRef.current);
    if (!drawn || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        setBox((was) => (was.width === width && was.height === height ? was : { width, height }));
      }
    });
    observer.observe(drawn);
    return () => {
      observer.disconnect();
    };
  }, []);

  // FR-A11Y-1..3: the page's focus target is the drawing's box, which takes the arrow keys (FR-STAR-4).
  useEffect(() => {
    if (skyRef.current) windowBox(skyRef.current)?.focus({ preventScroll: true });
  }, []);

  /*
   * FR-STAR-5 (R117, D-756): the way into the sky screen's stars inventory. The tap is FR-WIN-4's — the permission
   * inside it, one reading with a north before the layer (`useSkyScreen`) — and the store's flag is what says the
   * layer is up, as on the live page and the pass detail; this page renders it over itself with its own scene, so
   * the screen carries the layers as the toggles have them and the instant the page is showing (FR-FSC-8).
   */
  const entry = useSkyScreen();
  const screenOpen = useAppStore((s) => s.skyScreen);
  const closeScreen = useAppStore((s) => s.closeSkyScreen);
  const windowRefocused = useAppStore((s) => s.windowRefocused);
  const setWindowNote = useAppStore((s) => s.setWindowNote);
  /*
   * FR-FOL-2, FR-WIN-4: the note is the store's one line, which the live page's and the pass detail's taps set too;
   * this row shows it only after this page's own tap, and leaving takes this page's note with it.
   */
  const [asked, setAsked] = useState(false);
  const storeNote = useAppStore((s) => s.windowNote);
  const note = asked ? storeNote : null;
  const { open: openScreen } = entry;
  const holdUp = useCallback(() => {
    setAsked(true);
    openScreen();
  }, [openScreen]);
  const holdUpRef = useRef<HTMLButtonElement>(null);
  /*
   * FR-FSC-2: `Esc` closes the screen and stops there, before the app's one `keydown` listener (`lib/shortcuts.ts`)
   * reads the same press as "leave the page" — capture, and `stopPropagation`, as the pass detail does.
   */
  useEffect(() => {
    if (!screenOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeScreen();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [screenOpen, closeScreen]);
  /*
   * FR-FSC-2: leaving the page by any route closes the screen (the shell closes it first on a hash change). The
   * close's one-shot refocus is this page's to spend and the page is going, so it is spent here rather than left
   * for the next page to read as its own close; this page's note goes the same way.
   */
  const openRef = useRef(screenOpen);
  const askedRef = useRef(asked);
  useEffect(() => {
    openRef.current = screenOpen;
    askedRef.current = asked;
  }, [screenOpen, asked]);
  useEffect(
    () => () => {
      if (openRef.current) {
        closeScreen();
        windowRefocused();
      }
      if (askedRef.current) setWindowNote(null);
    },
    [closeScreen, windowRefocused, setWindowNote],
  );
  /*
   * FR-FSC-9: the compact page scrolls the document, so the document is held still under the layer; a drag on the
   * screen that the layer does not consume moves nothing behind it. The place comes back on this page's own close
   * (below), not on an unmount, so a route change does not carry this page's offset to the next one.
   */
  const heldTop = useRef(0);
  useEffect(() => {
    if (!screenOpen) return;
    const root = document.documentElement;
    heldTop.current = window.scrollY;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [screenOpen]);
  /*
   * FR-FSC-2 (D-351): a close of the screen this page opened gives the document its place back and the focus to the
   * control that opened it — or, where the phone has just lost the window (FR-WIN-4), to the box, so focus never
   * falls to the body. A close somewhere else (the store's flag is global) is not this page's to answer.
   */
  const openedHere = useRef(false);
  useEffect(() => {
    if (screenOpen) {
      openedHere.current = true;
      return;
    }
    if (!openedHere.current) return;
    openedHere.current = false;
    window.scrollTo({ top: heldTop.current, behavior: 'instant' });
    const target = holdUpRef.current ?? (skyRef.current && windowBox(skyRef.current));
    target?.focus({ preventScroll: true });
    windowRefocused();
  }, [screenOpen, windowRefocused]);

  const toggle = (key: keyof StarField['layers']) => () => {
    setLayers((was) => ({ ...was, [key]: !was[key] }));
  };
  const togglePasses = (): void => {
    setShowPasses((was) => !was);
  };
  const layer = (key: keyof StarField['layers'], alone = false) => <OptionToggle key={key} label={p.layers[key]} pressed={layers[key]} onPress={toggle(key)} data-layer={key} alone={alone} />;
  const firstRow = firstRowCount(
    LAYER_KEYS.map((key) => p.layers[key]),
    LAYER_ROW_BUDGET,
  );

  /*
   * R132 (FR-FLOW-4, FR-FLOW-8; D-842): the page is `SkyViewLayout`'s slots — the `h1` block as `answer`, the
   * window's readout in `readout` (placed by the window itself), the drawing, this page's own facing picker, the
   * hint, `[ hold up to the sky ]` full width right after it, the layer toggles as one group of two rows, then
   * `In this field`. On wide the layout is the box and the rail, in the same order; the box is cut here, as
   * before, and written on the layout's root.
   */
  const action =
    entry.available || note !== null ? (
      <div className={styles.holdUp} data-testid="stars-hold-up-row">
        {/* FR-STAR-5, FR-FLOW-8: one full-width button at least 48 px tall, and FR-LIVE-8's note under it after a denial or a phone with no north. */}
        {entry.available && <TextButton label={p.holdUp} onClick={holdUp} ref={holdUpRef} data-testid="stars-hold-up" box="accent" fill className={styles.holdUpButton} />}
        {note !== null && (
          <p className={styles.note} role="status" data-testid="stars-hold-up-note">
            {t.window[note]}
          </p>
        )}
      </div>
    ) : null;
  const layerRows = (
    <section aria-labelledby={layersId} className={styles.block}>
      <SectionHeading id={layersId} visuallyHidden={!wide}>
        {p.layersHeading}
      </SectionHeading>
      {/* FR-FLOW-8: one group of two rows `--space-1` apart — `[x] stars [x] figures [x] planets` and `[x] names [ ] passes`,
          33 and 19 cells in English. In Spanish the first three are 38 cells, two past FR-COMP-4's 36, so the split is by the
          budget (`firstRowCount`): `[x] estrellas [x] figuras` and `[x] planetas [x] nombres [ ] pases` (25 and 34). */}
      <div role="group" aria-label={p.layersHeading} className={styles.layers} data-testid="stars-layers">
        <div className={styles.row} data-testid="stars-layers-row">
          {LAYER_KEYS.slice(0, firstRow).map((key, index) => layer(key, index > 0))}
        </div>
        <div className={styles.row} data-testid="stars-layers-row">
          {LAYER_KEYS.slice(firstRow).map((key, index) => layer(key, index > 0))}
          <OptionToggle label={p.passesLayer} pressed={showPasses} onPress={togglePasses} data-layer="passes" alone />
        </div>
      </div>
    </section>
  );
  const field = (
    <section aria-labelledby={fieldId} className={styles.block}>
      <SectionHeading id={fieldId}>{p.fieldHeading}</SectionHeading>
      <FieldSection camera={camera} catalog={catalog} positions={positions} passes={drawnPasses} rows={rows} now={now} box={box} layers={layers} named={named?.index ?? null} onName={onName} labelledBy={fieldId} />
    </section>
  );

  return (
    <div className={styles.page} data-layout={mode}>
      {/* FR-FSC-1 (D-321): under the layer the page is out of reach — `inert` for Tab and a tap past it, `aria-hidden`
          for the accessible tree, as the live page's top row — and held at its last render, so the tick redraws
          the screen's window and not a second one under it (FR-STAR-9). */}
      <div className={styles.layout} data-layout={mode} ref={layoutRef} data-testid="stars-page" style={RAIL_STYLE} {...(screenOpen ? { inert: true, 'aria-hidden': true } : {})}>
        <Held held={screenOpen}>
          {wide && <span className={styles.railProbe} ref={probeRef} aria-hidden="true" />}
          <SkyViewLayout
            className={styles.skyLayout}
            data-testid="stars-layout"
            answer={<StarsHeading observer={observer} now={now} />}
            readout={<SkyViewChartSlot name="readout" />}
            drawing={
              // R132 (FR-FLOW-6, D-848): the page's own camera, so no hand slot reports the gesture — a drag, a pinch or a
              // tap all begin with a pointer down in the box, caught here before the window's own handlers.
              <div className={styles.sky} ref={skyRef} role="group" aria-label={p.drawing} data-testid="stars-sky" onPointerDownCapture={markSkyHintSeen}>
                <SkyWindow passes={drawnPasses} observer={observer} highlightedPassId={null} now={now} sun={sun} moon={moon} fill scene={scene} camera={camera} colorBy="pass" legendKeys={keys} namedStar={named?.index ?? null} onNameStar={onName} />
              </div>
            }
            // R121 (D-789): the window lane's picker, the eight points and the zenith — the row it was here (R115), shared with the
            // chart's window. It names itself (`Facing`); on wide the layout labels its row (D-846).
            picker={<FacingPicker camera={camera} className={styles.row} />}
            hint={hintShown && <SkyHint view="window" />}
            {...(action === null ? {} : { action })}
            layers={layerRows}
            list={field}
          />
        </Held>
      </div>
      {/* Portaled to the body as the pass detail's is: a fixed layer, never the child of something that scrolls. The
          sensor drives it from the hand's facing; the page's hand camera stays as it was for the return. */}
      {screenOpen && <StarsScreen camera={camera} scene={scene} passes={passes ?? undefined} observer={observer} now={now} sun={sun} moon={moon} onClose={closeScreen} />}
    </div>
  );
}

/**
 * R129 (FR-FLOW-3; F7, D4): the page names itself — a visible `h1`, "Stars tonight", and under it at `--small` the
 * dark window and the cloud word, as the home's What step words them (`useNight`: the stripe's bands and the
 * forecast at the middle of the night). Before the bands are known the line is the cloud word alone; with no place,
 * the heading alone. R132 moves the block into the `answer` slot.
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
 * `useNight`'s reading, on the page's own clock: the stars page already ticks (`STARS_TICK_MS`), so the line takes
 * that `now` rather than a second timer, and samples the bands once an hour, when the span moves.
 */
function TonightLine({ observer, now }: { observer: Observer; now: EpochMs }) {
  const t = useT();
  const locale = useLocale();
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const span = useMemo<Span>(() => ({ start: hour - TONIGHT_BACK_MS, end: hour + TONIGHT_AHEAD_MS }), [hour]);
  const bands = useSkyBands(observer, span);
  const weather = useAppStore((s) => s.weather);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const known = bands.length > 0;
  const night = known ? nightWindow(bands, observer, now) : null;
  const darkBand = known ? tonightsDark(bands, now) : null;
  const clouds = cloudVerdict(snapshot, night ? (night.start + night.end) / 2 : now);
  const dark = !known ? null : darkBand === null ? t.home.noDarkWindow : `${t.home.conditions.dark} ${darkWindowText(darkBand, span.start, observer.timeZone, locale, t)}`;
  return (
    <p className={styles.tonight} data-testid="stars-tonight">
      {[dark, t.weather.state[clouds.state]].filter((piece) => piece !== null).join(' · ')}
    </p>
  );
}

/**
 * The page's own parts while the screen covers them: a `memo` that keeps its last render for as long as `held`, so a
 * tick re-renders the layer's window and leaves this one, the picker and the list as they were until the close.
 */
const Held = memo(
  function Held({ children }: { held: boolean; children: ReactNode }) {
    return children;
  },
  (_previous, next) => next.held,
);

type StarsScreenProps = Pick<SkyScreenProps, 'observer' | 'now' | 'sun' | 'moon' | 'onClose'> & { camera: HandCamera; scene: SkyScene; passes: readonly LegendPass[] | undefined };

/**
 * The stars inventory's layer, portaled to the body as the pass detail's is. The sensor drives it from the hand's
 * facing, read once as the layer mounts — the open — and not on every render; the page's camera stays as it was
 * for the return. R126 (FR-SKY-6, D-794): with `[ passes ]` on it is handed the scene's passes — an empty set too,
 * which is a night with nothing to name and still the live page's screen — and with it off none at all.
 */
function StarsScreen({ camera, scene, passes, observer, now, sun, moon, onClose }: StarsScreenProps) {
  const [facingAzDeg] = useState(() => camera.get().azDeg);
  return createPortal(
    <SkyScreen inventory="stars" scene={scene} {...(passes === undefined ? {} : { passes })} observer={observer} now={now} {...(sun === undefined ? {} : { sun })} {...(moon === undefined ? {} : { moon })} initialFacingAzDeg={facingAzDeg} onClose={onClose} />,
    document.body,
  );
}

interface FieldSectionProps {
  camera: HandCamera;
  catalog: ReturnType<typeof starCatalog>;
  positions: ReturnType<typeof starsAt>;
  /** R126 (FR-SKY-6): the scene's passes, empty with `[ passes ]` off, at the page's instant. */
  passes: readonly LegendPass[];
  /** The legend's rows over `passes`, the page's one computation of them (the window's keys come from the same rows). */
  rows: readonly LegendRow[];
  now: EpochMs;
  /** The drawing's measured box; the field across it is the camera's (R125, FR-SKY-14). */
  box: { width: number; height: number };
  layers: StarField['layers'];
  named: number | null;
  onName: (index: number | null) => void;
  labelledBy: string;
}

/**
 * `In this field`, reading the camera through `useDeferredValue`: a drag's frame re-renders this component with the
 * old value, which every memo below answers, and the list follows when React has the time. R125 (FR-SKY-14): the
 * view's field is the camera's `fovDeg`, read the same deferred way, so a zoom lists what the narrowed box shows.
 */
function FieldSection({ camera, catalog, positions, passes, rows, now, box, layers, named, onName, labelledBy }: FieldSectionProps) {
  const lang = useLocale();
  const hand = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  const settled = useDeferredValue(hand);
  const view: View = useMemo(() => ({ fovDeg: settled.fovDeg, width: box.width, height: box.height, screenAngleDeg: 0 }), [settled.fovDeg, box]);
  const rotation = useMemo(() => handRotation(settled), [settled]);
  // R126 (D-832): the star names in the reader's language, through `starName`.
  const objects = useMemo(() => fieldObjects({ catalog, positions, rotation, view, layers, lang }), [catalog, positions, rotation, view, layers, lang]);
  // R126 (FR-SKY-6, D-794): the passes drawn in the field, ahead of the stars.
  // R126 (FR-STAR-7, D-825): with the passes first, the list is still at most `FIELD_LIST_MAX` rows.
  const listed = useMemo(() => fieldRows(passes.length === 0 ? [] : fieldPasses({ passes, rows, rotation, view, now }), objects), [passes, rows, rotation, view, now, objects]);
  const buried = view.width > 0 && groundState(settled.altDeg, view) === 'buried';
  return useMemo(() => <FieldList objects={listed.objects} passes={listed.passes} named={named} onName={onName} buried={buried} labelledBy={labelledBy} />, [listed, named, onName, buried, labelledBy]);
}

/** R123 (FR-SKY-3, FR-SKY-10, D-791): the live page's and the pass detail's stars, from this chunk through `starsChunk.ts`. */
export { brightestNow, starSource } from './stars/source';
export { moonNow } from '../../lib/skyStars';
