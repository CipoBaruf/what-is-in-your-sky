import { memo, useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { starCatalog } from '../../data/stars/catalog';
import { useStarsPageT } from '../../i18n/starsPageT';
import { useT } from '../../i18n/useT';
import { RAIL_MIN_CELLS, windowBox as fitWindowBox } from '../../lib/layout';
import { starsAt } from '../../lib/skyStars';
import type { Observer } from '../../model';
import { useActiveObserver, useAppStore } from '../../state';
import { SkyScreen, type SkyScreenProps } from '../components/screen/SkyScreen';
import { useSkyScreen } from '../components/screen/useSkyScreen';
import { createHandCamera, handRotation, initialHand, type HandCamera } from '../components/guide/skychart/window/camera';
import { FacingPicker } from '../components/guide/skychart/window/FacingPicker';
import { groundState, WINDOW_FOV, type View } from '../components/guide/skychart/window/projection';
import type { SkyScene, StarField } from '../components/guide/skychart/window/scene';
import { SkyWindow } from '../components/guide/skychart/window/SkyWindow';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { OptionToggle } from '../components/primitives/OptionToggle';
import { SectionHeading } from '../components/primitives/SectionHeading';
import { TextButton } from '../components/primitives/TextButton';
import { VisuallyHidden } from '../components/primitives/VisuallyHidden';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import { requestPlace } from './home/placeRequest';
import { FieldList } from './stars/FieldList';
import { fieldObjects, sceneCatalog, STAR_LABEL_HOLD_S } from './stars/field';
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
 * **Wide**: the box at the left, cut to the browser window's shape from what
 * the page leaves beside a rail of at least `RAIL_MIN_CELLS` (`fitBox`, the
 * live page's rule), and the rail — `Facing`, `Layers`, `In this field`. The
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

const UNMEASURED = { width: 0, height: 0 };

/** The rail's minimum, from `lib/layout.ts`, as the stylesheet's one input in cells (the probe and the grid read it). */
const RAIL_STYLE = { ['--rail-min-cells' as string]: String(RAIL_MIN_CELLS) } as CSSProperties;

/** The box `SkyWindow` measures for its projection: the parent of its drawing, the element its `ResizeObserver` reads. */
const windowBox = (sky: HTMLElement): HTMLElement | null => sky.querySelector('svg[data-drawing="window"]')?.parentElement ?? null;

export function StarsPage() {
  const t = useT();
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
        <VisuallyHidden as="h1">{t.stars.heading}</VisuallyHidden>
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
  const facingId = useId();
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
   * On wide the box is cut here — the largest rectangle of the browser window's shape beside the rail's minimum
   * (`fitBox`) — and written as two custom properties the stylesheet sizes it from.
   */
  useEffect(() => {
    const layout = layoutRef.current;
    if (!wide || !layout || typeof ResizeObserver === 'undefined') return;
    const fit = (): void => {
      const { width, height } = layout.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(layout).columnGap) || 0;
      const rail = probeRef.current?.getBoundingClientRect().width ?? 0;
      // R121 (D-789): `windowBox`, the rule the live page's and the pass detail's window share with this page.
      const box = fitWindowBox({ frameWidthPx: width, frameHeightPx: height, aboveHeightPx: 0, belowHeightPx: 0, besideWidthPx: rail + gap, viewportWidthPx: window.innerWidth, viewportHeightPx: window.innerHeight });
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
  }, [wide]);

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

  const view: View = useMemo(() => ({ fovDeg: WINDOW_FOV, width: box.width, height: box.height, screenAngleDeg: 0 }), [box]);

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
  const layer = (key: keyof StarField['layers'], alone = false) => <OptionToggle key={key} label={p.layers[key]} pressed={layers[key]} onPress={toggle(key)} data-layer={key} alone={alone} />;

  return (
    <>
      <VisuallyHidden as="h1">{t.stars.heading}</VisuallyHidden>
      {/* FR-FSC-1 (D-321): under the layer the page is out of reach — `inert` for Tab and a tap past it, `aria-hidden`
          for the accessible tree, as the live page's top row — and held at its last render, so the tick redraws
          the screen's window and not a second one under it (FR-STAR-9). */}
      <div className={styles.layout} data-layout={mode} ref={layoutRef} data-testid="stars-page" style={RAIL_STYLE} {...(screenOpen ? { inert: true, 'aria-hidden': true } : {})}>
        <Held held={screenOpen}>
        {wide && <span className={styles.railProbe} ref={probeRef} aria-hidden="true" />}
        <div className={styles.sky} ref={skyRef} role="group" aria-label={p.drawing} data-testid="stars-sky">
          <SkyWindow passes={[]} observer={observer} highlightedPassId={null} now={now} sun={sun} moon={moon} fill scene={scene} camera={camera} namedStar={named?.index ?? null} onNameStar={onName} />
        </div>
        <div className={styles.rail} data-testid="stars-rail">
          <section aria-labelledby={facingId} className={styles.block}>
            <SectionHeading id={facingId} visuallyHidden={!wide}>
              {p.facing}
            </SectionHeading>
            {/* R121 (D-789): the window lane's picker, the eight points and the zenith — the row it was here (R115), shared with the chart's window. */}
            <FacingPicker camera={camera} className={styles.row} />
          </section>
          <section aria-labelledby={layersId} className={styles.block}>
            <SectionHeading id={layersId} visuallyHidden={!wide}>
              {p.layersHeading}
            </SectionHeading>
            {/* Four toggles in two rows of two: one row of four is 43 cells in English and 51 in Spanish (FR-COMP-4, D-776). */}
            <div role="group" aria-label={p.layersHeading} className={styles.layers} data-testid="stars-layers">
              <div className={styles.row} data-testid="stars-layers-row">
                {layer('stars')}
                {layer('figures', true)}
              </div>
              <div className={styles.row} data-testid="stars-layers-row">
                {layer('planets')}
                {layer('names', true)}
              </div>
            </div>
          </section>
          {/* FR-STAR-5: one `--tap` row where FR-WIN-4's presence test passes, and FR-LIVE-8's note beside it after a denial or a phone with no north. */}
          {(entry.available || note !== null) && (
            <div className={styles.holdUp} data-testid="stars-hold-up-row">
              {entry.available && <TextButton label={p.holdUp} onClick={holdUp} ref={holdUpRef} data-testid="stars-hold-up" />}
              {note !== null && (
                <p className={styles.note} role="status" data-testid="stars-hold-up-note">
                  {t.window[note]}
                </p>
              )}
            </div>
          )}
          <section aria-labelledby={fieldId} className={styles.block}>
            <SectionHeading id={fieldId}>{p.fieldHeading}</SectionHeading>
            <FieldSection camera={camera} catalog={catalog} positions={positions} view={view} layers={layers} named={named?.index ?? null} onName={onName} labelledBy={fieldId} />
          </section>
        </div>
        </Held>
      </div>
      {/* Portaled to the body as the pass detail's is: a fixed layer, never the child of something that scrolls. The
          sensor drives it from the hand's facing; the page's hand camera stays as it was for the return. */}
      {screenOpen && <StarsScreen camera={camera} scene={scene} observer={observer} now={now} sun={sun} moon={moon} onClose={closeScreen} />}
    </>
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

type StarsScreenProps = Pick<SkyScreenProps, 'observer' | 'now' | 'sun' | 'moon' | 'onClose'> & { camera: HandCamera; scene: SkyScene };

/**
 * The stars inventory's layer, portaled to the body as the pass detail's is. The sensor drives it from the hand's
 * facing, read once as the layer mounts — the open — and not on every render; the page's camera stays as it was
 * for the return.
 */
function StarsScreen({ camera, scene, observer, now, sun, moon, onClose }: StarsScreenProps) {
  const [facingAzDeg] = useState(() => camera.get().azDeg);
  return createPortal(<SkyScreen inventory="stars" scene={scene} observer={observer} now={now} {...(sun === undefined ? {} : { sun })} {...(moon === undefined ? {} : { moon })} initialFacingAzDeg={facingAzDeg} onClose={onClose} />, document.body);
}

interface FieldSectionProps {
  camera: HandCamera;
  catalog: ReturnType<typeof starCatalog>;
  positions: ReturnType<typeof starsAt>;
  view: View;
  layers: StarField['layers'];
  named: number | null;
  onName: (index: number | null) => void;
  labelledBy: string;
}

/**
 * `In this field`, reading the camera through `useDeferredValue`: a drag's frame re-renders this component with the
 * old value, which every memo below answers, and the list follows when React has the time.
 */
function FieldSection({ camera, catalog, positions, view, layers, named, onName, labelledBy }: FieldSectionProps) {
  const hand = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  const settled = useDeferredValue(hand);
  const rotation = useMemo(() => handRotation(settled), [settled]);
  const objects = useMemo(() => fieldObjects({ catalog, positions, rotation, view, layers }), [catalog, positions, rotation, view, layers]);
  const buried = view.width > 0 && groundState(settled.altDeg, view) === 'buried';
  return useMemo(() => <FieldList objects={objects} named={named} onName={onName} buried={buried} labelledBy={labelledBy} />, [objects, named, onName, buried, labelledBy]);
}
