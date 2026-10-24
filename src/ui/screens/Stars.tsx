import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { starCatalog } from '../../data/stars/catalog';
import { useStarsPageT } from '../../i18n/starsPageT';
import { useT } from '../../i18n/useT';
import { normalizeAzimuthDeg, type CompassPoint } from '../../lib/compass';
import { fitBox, RAIL_MIN_CELLS } from '../../lib/layout';
import { starsAt } from '../../lib/skyStars';
import type { Observer } from '../../model';
import { useActiveObserver } from '../../state';
import { bearingOf, createHandCamera, handRotation, initialHand, STARS_TILT_MAX_DEG, type HandCamera } from '../components/guide/skychart/window/camera';
import { groundState, WINDOW_FOV, type View } from '../components/guide/skychart/window/projection';
import type { SkyScene, StarField } from '../components/guide/skychart/window/scene';
import { SkyWindow } from '../components/guide/skychart/window/SkyWindow';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { OptionToggle } from '../components/primitives/OptionToggle';
import { SectionHeading } from '../components/primitives/SectionHeading';
import { TextButton } from '../components/primitives/TextButton';
import { ToggleGroup } from '../components/primitives/ToggleGroup';
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
 * reads it with `useSyncExternalStore` for the picker's pressed point and the
 * list — through `useDeferredValue`, so a drag's frame is the window's alone
 * and the list follows when React has the time. Every open starts at the pole
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
 * says, by `Stars.module.css` through the frame's own test ids — the frame's
 * cells, not its look.
 *
 * Now and offline (FR-STAR-8): the instant is the clock, re-read every
 * `STARS_TICK_MS` as the live page's watching state ticks; the catalogue is
 * in this chunk, so a precached chunk and a saved observer are the whole page.
 * With no observer it is FR-LIVE-1's inert line and `[ set a place ]`.
 */
export interface StarsPageProps {
  /** Leaves the page: what `Esc` does (`App`), passed for the page's own use. */
  onLeave?: () => void;
}

/** FR-STAR-8: the live page's real-time tick (`Live.tsx`'s `TICK_MS`), not imported so the live chunk stays out of this one. */
const STARS_TICK_MS = 10_000;

const ALL_LAYERS: StarField['layers'] = { stars: true, figures: true, planets: true, names: true };

/** FR-STAR-3: the picker's eight points, then the zenith. */
const FACING_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const satisfies readonly CompassPoint[];
type Facing = (typeof FACING_POINTS)[number] | 'up';

/** The picker's pressed option: the zenith, a point the hand is exactly at, or none after a drag. */
function facingOf(azDeg: number, altDeg: number): Facing | '' {
  if (altDeg >= STARS_TILT_MAX_DEG) return 'up';
  return FACING_POINTS.find((point) => Math.abs(normalizeAzimuthDeg(azDeg - bearingOf(point) + 180) - 180) < 1e-6) ?? '';
}

const UNMEASURED = { width: 0, height: 0 };

/** The rail's minimum, from `lib/layout.ts`, as the stylesheet's one input in cells (the probe and the grid read it). */
const RAIL_STYLE = { ['--rail-min-cells' as string]: String(RAIL_MIN_CELLS) } as CSSProperties;

export function StarsPage(props: StarsPageProps) {
  const t = useT();
  const p = useStarsPageT();
  const observer = useActiveObserver();
  if (observer === null) {
    return (
      <>
        <VisuallyHidden as="h1">{t.stars.heading}</VisuallyHidden>
        <div className={styles.inert} data-testid="stars-inert">
          <p>{p.noPlace}</p>
          <TextButton label={p.setPlace} data-testid="stars-set-place" onClick={requestPlace} />
        </div>
      </>
    );
  }
  // A new place is a new sky and a new pole side: the camera starts again for it.
  return <StarsSky key={`${String(observer.lat)},${String(observer.lon)}`} observer={observer} {...props} />;
}

function StarsSky({ observer }: StarsPageProps & { observer: Observer }) {
  const t = useT();
  const p = useStarsPageT();
  const mode = useLayoutMode();
  const wide = mode === 'wide';
  const facingId = useId();
  const layersId = useId();
  const fieldId = useId();

  const [camera] = useState<HandCamera>(() => createHandCamera(initialHand(observer.lat)));
  const hand = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  const settled = useDeferredValue(hand);

  const now = useNow(STARS_TICK_MS);
  const catalog = starCatalog();
  const positions = useMemo(() => starsAt(catalog, observer, now), [catalog, observer, now]);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const scene: SkyScene = useMemo(() => ({ stars: { catalog: sceneCatalog(catalog), positions, layers } }), [catalog, positions, layers]);
  const { sun, moon } = useSkyBodies({ observer, now });

  // FR-STAR-7: one named object for the drawing and the list, cleared after the hold; naming it again restarts the hold.
  const [named, setNamed] = useState<{ index: number; at: number } | null>(null);
  const name = useCallback((index: number) => {
    setNamed({ index, at: performance.now() });
  }, []);
  const onNameStar = useCallback((index: number | null) => {
    if (index === null) setNamed(null);
    else setNamed({ index, at: performance.now() });
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

  /*
   * The box, as the window measures it: the list's field is the drawing's own, so the list names what the box
   * shows. On wide the box is also cut here — the largest rectangle of the browser window's shape beside the
   * rail's minimum (`fitBox`) — and written as two custom properties the stylesheet sizes it from.
   */
  const layoutRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState(UNMEASURED);
  useEffect(() => {
    const layout = layoutRef.current;
    const sky = skyRef.current;
    if (!layout || !sky || typeof ResizeObserver === 'undefined') return;
    const drawing = (): Element | null => sky.querySelector('[data-testid="chart-box"]');
    const measure = (): void => {
      if (wide) {
        const { width, height } = layout.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(layout).columnGap) || 0;
        const rail = probeRef.current?.getBoundingClientRect().width ?? 0;
        const aspect = window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 1;
        const fit = fitBox({ frameWidthPx: width, frameHeightPx: height, aboveHeightPx: 0, belowHeightPx: 0, besideWidthPx: rail + gap, aspect });
        const next = { w: `${String(Math.floor(fit.widthPx))}px`, h: `${String(Math.floor(fit.heightPx))}px` };
        if (layout.style.getPropertyValue('--stars-box-w') !== next.w) layout.style.setProperty('--stars-box-w', next.w);
        if (layout.style.getPropertyValue('--stars-box-h') !== next.h) layout.style.setProperty('--stars-box-h', next.h);
      }
      const rect = drawing()?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        setBox((was) => (was.width === width && was.height === height ? was : { width, height }));
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    const drawn = drawing();
    if (drawn) observer.observe(drawn);
    measure();
    return () => {
      observer.disconnect();
      layout.style.removeProperty('--stars-box-w');
      layout.style.removeProperty('--stars-box-h');
    };
  }, [wide]);

  // FR-A11Y-1..3: the page's focus target is the drawing's box, which takes the arrow keys (FR-STAR-4).
  useEffect(() => {
    skyRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
  }, []);

  const view: View = useMemo(() => ({ fovDeg: WINDOW_FOV, width: box.width, height: box.height, screenAngleDeg: 0 }), [box]);
  const rotation = useMemo(() => handRotation(settled), [settled]);
  const objects = useMemo(() => fieldObjects({ catalog, positions, rotation, view, layers }), [catalog, positions, rotation, view, layers]);
  const buried = box.width > 0 && groundState(settled.altDeg, view) === 'buried';

  const facing = facingOf(hand.azDeg, hand.altDeg);
  const facingOptions = useMemo(() => [...FACING_POINTS.map((point) => ({ value: point as Facing, label: point })), { value: 'up' as Facing, label: p.up }], [p.up]);
  const turnTo = (value: Facing): void => {
    if (value === 'up') camera.up();
    else camera.face(value);
  };
  const toggle = (key: keyof StarField['layers']) => () => {
    setLayers((was) => ({ ...was, [key]: !was[key] }));
  };
  const layer = (key: keyof StarField['layers'], alone = false) => <OptionToggle key={key} label={p.layers[key]} pressed={layers[key]} onPress={toggle(key)} data-layer={key} alone={alone} />;

  return (
    <>
      <VisuallyHidden as="h1">{t.stars.heading}</VisuallyHidden>
      <div className={styles.layout} data-layout={mode} ref={layoutRef} data-testid="stars-page" style={RAIL_STYLE} data-look-az={Math.round(hand.azDeg)} data-look-alt={Math.round(hand.altDeg)}>
        {wide && <span className={styles.railProbe} ref={probeRef} aria-hidden="true" />}
        <div className={styles.sky} ref={skyRef} role="group" aria-label={p.drawing} data-testid="stars-sky">
          <SkyWindow passes={[]} observer={observer} highlightedPassId={null} now={now} sun={sun} moon={moon} fill scene={scene} camera={camera} namedStar={named?.index ?? null} onNameStar={onNameStar} />
        </div>
        <div className={styles.rail} data-testid="stars-rail">
          <section aria-labelledby={facingId} className={styles.block}>
            <SectionHeading id={facingId} visuallyHidden={!wide}>
              {p.facing}
            </SectionHeading>
            {/* The compact speeds' form (D-245): `N NE E SE [S] SW W NW up`, each option's reserved brackets its gap — 32 cells in English, 36 in Spanish (FR-COMP-4). */}
            <ToggleGroup<Facing> name={p.facing} mark="tight" gap="none" options={facingOptions} value={facing as Facing} onChange={turnTo} className={styles.row} />
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
          <section aria-labelledby={fieldId} className={styles.block}>
            <SectionHeading id={fieldId}>{p.fieldHeading}</SectionHeading>
            <FieldList objects={objects} named={named?.index ?? null} onName={name} buried={buried} labelledBy={fieldId} />
          </section>
        </div>
      </div>
    </>
  );
}

