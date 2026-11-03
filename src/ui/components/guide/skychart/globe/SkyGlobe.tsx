import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { starCatalog } from '../../../../../data/stars/catalog';
import { loadDeepChunk } from '../../../../../data/stars/deepChunk';
import type { EpochMs, Locale, Observer } from '../../../../../model';
import { STAR_LABEL_HOLD_S } from '../../../../screens/stars/field';
import { CATALOGS } from '../../../../../i18n/useT';
import { TextButton } from '../../../primitives/TextButton';
import { HIT_RADIUS_PX } from '../window/starGlyphs';
import { GLOBE_KEY_STEP_DEG, GLOBE_ZOOM_MAX, GLOBE_ZOOM_MIN, GLOBE_ZOOM_STEP } from './constants';
import { frameFor, GlobeRenderer, projectorFor, readoutLine, sameTarget, type GlobeLayers, type GlobeTarget, type Turn } from './GlobeRenderer';
import { PLANETS } from '../../../../../lib/skyStars';
import { coordsIn, dragTurn, EQUATORIAL, openView } from './projection';
import { globeSky } from './scene';
import styles from './SkyGlobe.module.css';

/**
 * R169 (FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-9, FR-GLOBE-10, FR-GLOBE-11,
 * FR-GLOBE-15; PLAN D-744, D-751, D-1034, D-1038, D-1040): the celestial
 * globe as the stars page mounts it on wide — `GlobeRenderer`'s host, the
 * box's measure, the hand, the wheel and the pinch, the keys, the frame
 * switch, the naming and the readout line. The default export, so `Stars.tsx`
 * can `React.lazy` it and Rollup names the chunk `SkyGlobe-*.js`
 * (FR-GLOBE-15; R170 mounts it).
 *
 * **The view is a ref, not state.** A drag, a wheel, a pinch and a key write
 * `viewRef` and hand it to the renderer, which draws it on its own animation
 * frame; React renders this component only when a prop, the named object or
 * the dragging flag changes (D-744, D-751). A drag is one write per animation
 * frame with the pointer captured: the moves since the last frame fold into one
 * `dragTurn` from the last applied point to the latest, so the point grabbed
 * stays under the hand.
 *
 * **The frame switch keeps the centre.** When `turn` changes, the view
 * centre is carried from the old frame into the new by `coordsIn`, so nothing
 * jumps (FR-GLOBE-5). A new `place` while turning with you re-opens the
 * opening view for it; turning with the stars, the view is kept (FR-GLOBE-9,
 * D-1040). `Home` returns to the opening view at zoom 1 and touches neither
 * the time nor the place.
 *
 * **Naming.** A hover (a mouse) or a tap or a click names what is under the
 * pointer (`targetAt`, FR-STAR-7's rule: a mark within the hit distance, else
 * a figure's line); the label stands beside the mark and the readout line
 * carries the words. A second press on the same, a press elsewhere or
 * `STAR_LABEL_HOLD_S` clears a pressed name; a hover's name goes with the
 * pointer.
 *
 * **The faint stars.** `faint` on asks `deepChunk.ts` for the deep catalogue
 * once and hands it to the renderer, which appends the stars to its dot
 * buckets (no node); a failed load calls `onFaintFailed`, so the page
 * unpresses the toggle and the next press fetches again (FR-GLOBE-10).
 */

export interface SkyGlobeProps {
  place: Observer;
  /** FR-GLOBE-7: the globe's own instant, the page's second playback. */
  instant: EpochMs;
  /** FR-GLOBE-5: turning with you (`you`) or with the stars (`stars`). */
  turn: Turn;
  layers: GlobeLayers;
  /** FR-GLOBE-10: the deep stars on. */
  faint: boolean;
  language: Locale;
  /** FR-GLOBE-10: the deep chunk would not load; the page unpresses `faint`. */
  onFaintFailed?: () => void;
  /**
   * FR-GLOBE-12 (FR-LEG-4's rule): the `Up from <place>` row the page has named, by `upList`'s index — a star's
   * catalogue index, or a planet's past the catalogue's length (D-750). A hover or a press on the globe comes first.
   */
  named?: number | null;
  className?: string;
}

interface View {
  lon: number;
  lat: number;
  zoom: number;
}

const clampZoom = (zoom: number): number => Math.max(GLOBE_ZOOM_MIN, Math.min(GLOBE_ZOOM_MAX, zoom));
const clampLat = (lat: number): number => Math.max(-90, Math.min(90, lat));
/** The keys ctrl or cmd makes the browser's own zoom, left to it (as the window leaves them). */
const ZOOM_KEYS = new Set(['+', '=', '-']);
/** FR-GLOBE-6: one wheel notch, in pixels (a mouse's notch is about 100 in Chromium and Safari, 3 lines in Firefox); a trackpad's small deltas zoom their share of a step. */
const WHEEL_NOTCH_PX = 100;
const WHEEL_LINE_PX = WHEEL_NOTCH_PX / 3;

/** The wheel's delta in notches, by its `deltaMode` (pixels, lines or pages), at most one notch an event. */
function wheelNotches(event: WheelEvent, pagePx: number): number {
  const px = event.deltaMode === 1 ? event.deltaY * WHEEL_LINE_PX : event.deltaMode === 2 ? event.deltaY * pagePx : event.deltaY;
  return Math.max(-1, Math.min(1, px / WHEEL_NOTCH_PX));
}

/** FR-GLOBE-5, D-1036: the opening view in `turn`'s frame — the local frame's opening view, carried into the equatorial one when turning with the stars. */
function openingView(turn: Turn, place: Observer, t: EpochMs): View {
  const sky = globeSky(place, t);
  const view = openView(sky);
  const inFrame = turn === 'stars' ? coordsIn(EQUATORIAL, sky.frame, view.lon, view.lat) : view;
  return { lon: inFrame.lon, lat: inFrame.lat, zoom: 1 };
}

/** A ref filled once, on the first render: `openingView` runs `globeSky`, which a render under the lapse should not pay for again. */
function useViewRef(init: () => View): { current: View } {
  const ref = useRef<View | null>(null);
  if (ref.current === null) ref.current = init();
  return ref as { current: View };
}

function measure(box: HTMLElement): { width: number; height: number } {
  const rect = box.getBoundingClientRect();
  return { width: Math.round(rect.width), height: Math.round(rect.height) };
}

/** FR-GLOBE-12: a list row's index as the globe's target — a star's, else the planet `PLANETS` holds past the catalogue. */
function listTarget(index: number | null, size: number): GlobeTarget | null {
  if (index === null) return null;
  if (index < size) return { kind: 'star', index };
  const body = PLANETS[index - size];
  return body === undefined ? null : { kind: 'planet', body };
}

export default function SkyGlobe({ place, instant, turn, layers, faint, language, onFaintFailed, named: listNamed = null, className }: SkyGlobeProps) {
  const catalog = useMemo(() => starCatalog(), []);
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<GlobeRenderer | null>(null);
  const viewRef = useViewRef(() => openingView(turn, place, instant));
  const [named, setNamed] = useState<GlobeTarget | null>(null);
  const [hovered, setHovered] = useState<GlobeTarget | null>(null);
  const listed = useMemo(() => listTarget(listNamed, catalog.size), [listNamed, catalog]);
  const [dragging, setDragging] = useState(false);
  /** FR-GLOBE-6 as amended (V212-12, D-1055): which end of the zoom's range the view is at, for the buttons; a state that changes only at an end. */
  const [zoomEnd, setZoomEnd] = useState<'min' | 'max' | null>(null);
  const readoutId = `${useId()}-readout`;

  // The renderer, once: React renders the empty `<svg>`, the renderer fills it and writes it until unmount. The box is measured here and by the observer.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const svg = svgRef.current;
    if (!box || !svg) return;
    const view = viewRef.current;
    const renderer = new GlobeRenderer(svg, catalog, { place, t: instant, turn, lon: view.lon, lat: view.lat, zoom: view.zoom, layers, faint, lang: language, ...measure(box), named: null });
    rendererRef.current = renderer;
    // FR-A11Y-1..3 with V212-11 (D-1054): a desk opens on the globe, so its box takes the page's focus as the window's does — unless the reader has put it somewhere already.
    const active = document.activeElement;
    if (active === null || active === document.body) box.focus({ preventScroll: true });
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect && rect.width > 0 && rect.height > 0) renderer.set({ width: Math.round(rect.width), height: Math.round(rect.height) });
      });
      observer.observe(box);
    }
    return () => {
      observer?.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
    // The renderer is made once; every later change reaches it through `set` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  // FR-GLOBE-5: a turn switch carries the view centre into the new frame; FR-GLOBE-9: a new place re-opens the view while turning with you.
  // The source frame is the one last drawn — the previous turn at the previous place and instant — so a place or a time that changes with the switch does not move the centre.
  const turnRef = useRef(turn);
  const placeRef = useRef(place);
  const instantRef = useRef(instant);
  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    const view = viewRef.current;
    if (turnRef.current !== turn) {
      const from = frameFor(turnRef.current, placeRef.current, instantRef.current);
      const to = frameFor(turn, place, instant);
      const moved = coordsIn(to, from, view.lon, view.lat);
      view.lon = moved.lon;
      view.lat = moved.lat;
      turnRef.current = turn;
    }
    instantRef.current = instant;
    const was = placeRef.current;
    if (was.lat !== place.lat || was.lon !== place.lon || was.altM !== place.altM) {
      placeRef.current = place;
      if (turn === 'you') {
        const opened = openingView(turn, place, instant);
        view.lon = opened.lon;
        view.lat = opened.lat;
      }
    }
    renderer?.set({ place, t: instant, turn, lon: view.lon, lat: view.lat, zoom: view.zoom, layers, faint, lang: language, named: hovered ?? named ?? listed });
  }, [place, instant, turn, layers, faint, language, hovered, named, listed, viewRef]);

  // FR-GLOBE-10: the deep chunk, once, the first time `faint` is on; a failure tells the page. The callback is read through a ref, so a new one does not re-run the load.
  const askedRef = useRef(false);
  const onFaintFailedRef = useRef(onFaintFailed);
  useEffect(() => {
    onFaintFailedRef.current = onFaintFailed;
  }, [onFaintFailed]);
  useEffect(() => {
    if (!faint || askedRef.current) return;
    askedRef.current = true;
    let live = true;
    let settled = false;
    loadDeepChunk().then(
      (deep) => {
        settled = true;
        if (live) rendererRef.current?.setDeep(deep);
      },
      () => {
        settled = true;
        if (!live) return;
        askedRef.current = false;
        onFaintFailedRef.current?.();
      },
    );
    return () => {
      live = false;
      // A load cut short (faint off and on again before it came back) is asked for again on the next run, not dropped.
      if (!settled) askedRef.current = false;
    };
  }, [faint]);

  // FR-GLOBE-11: a pressed name holds for `STAR_LABEL_HOLD_S`, as the window's own does.
  useEffect(() => {
    if (named === null) return;
    const id = window.setTimeout(() => {
      setNamed(null);
    }, STAR_LABEL_HOLD_S * 1000);
    return () => {
      window.clearTimeout(id);
    };
  }, [named]);

  /** The view written to the renderer: the one write a frame, a key or a wheel makes. */
  const writeView = useCallback((change: Partial<View>): void => {
    const view = viewRef.current;
    if (change.lon !== undefined) view.lon = change.lon;
    if (change.lat !== undefined) view.lat = clampLat(change.lat);
    if (change.zoom !== undefined) {
      view.zoom = clampZoom(change.zoom);
      setZoomEnd(view.zoom <= GLOBE_ZOOM_MIN ? 'min' : view.zoom >= GLOBE_ZOOM_MAX ? 'max' : null);
    }
    rendererRef.current?.set({ lon: view.lon, lat: view.lat, zoom: view.zoom });
  }, [viewRef]);

  const zoomBy = useCallback(
    (factor: number): void => {
      if (!(factor > 0) || !Number.isFinite(factor) || factor === 1) return;
      writeView({ zoom: viewRef.current.zoom * factor });
    },
    [writeView, viewRef],
  );

  // FR-GLOBE-6: the wheel zooms about the box's centre by `GLOBE_ZOOM_STEP` per notch, a trackpad's small deltas by their share of one. A native listener with `passive: false`, so the page does not scroll under the globe; ctrl or cmd + wheel stays the browser's zoom, as ctrl or cmd + `+`/`-` do.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const notches = wheelNotches(event, box.clientHeight || WHEEL_NOTCH_PX);
      if (notches === 0) return;
      zoomBy(GLOBE_ZOOM_STEP ** -notches);
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      box.removeEventListener('wheel', onWheel);
    };
  }, [zoomBy]);

  /*
   * The hand (FR-GLOBE-6): the pointers on the box. The first is the drag's; a second makes the two a pinch (the drag
   * ends there); a third is nothing. The drag's moves since the last frame fold into one `dragTurn` on the next
   * animation frame, from the last point applied to the latest, against the projector the view now stands at.
   */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ pointerId: number; x: number; y: number; x0: number; y0: number; travel: number; applied: readonly [number, number] } | null>(null);
  const pinchRef = useRef<{ a: number; b: number; distance: number } | null>(null);
  const frameRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);
  const boxPoint = (clientX: number, clientY: number): readonly [number, number] => {
    const rect = boxRef.current?.getBoundingClientRect();
    return [clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0)];
  };
  const flush = (): void => {
    frameRef.current = 0;
    const drag = dragRef.current;
    const renderer = rendererRef.current;
    if (!drag || !renderer) return;
    const to = boxPoint(drag.x, drag.y);
    if (to[0] === drag.applied[0] && to[1] === drag.applied[1]) return;
    const view = viewRef.current;
    const p = projectorFor({ ...renderer.state, lon: view.lon, lat: view.lat, zoom: view.zoom });
    if (!(p.radius > 0)) return;
    const turned = dragTurn(p, drag.applied, to);
    drag.applied = to;
    writeView(turned);
  };
  const scheduleFlush = (): void => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(flush);
  };
  const forget = (pointerId: number): void => {
    pointersRef.current.delete(pointerId);
    const pinch = pinchRef.current;
    if (pinch && (pinch.a === pointerId || pinch.b === pointerId)) pinchRef.current = null;
  };
  /** The drag is over (an up, a cancel, a lost capture, a pinch or a new contact). */
  const stopDrag = (): void => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
  };
  /** `pointerId` is gone: forgotten, and its drag stopped if it had one. */
  const dropPointer = (pointerId: number): void => {
    forget(pointerId);
    if (dragRef.current?.pointerId === pointerId) stopDrag();
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // jsdom and old browsers: the drag still works while the pointer stays over the box.
    }
    dropPointer(event.pointerId);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const pointers = pointersRef.current;
    if (event.isPrimary) {
      // A primary pointer starts a new contact: whatever was left over from a capture that failed is forgotten.
      for (const id of [...pointers.keys()]) forget(id);
      stopDrag();
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // see releasePointerCapture
    }
    if (pointers.size === 2 && pinchRef.current === null) {
      const [first, second] = [...pointers.entries()] as [[number, { x: number; y: number }], [number, { x: number; y: number }]];
      pinchRef.current = { a: first[0], b: second[0], distance: Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y) };
      stopDrag();
      return;
    }
    if (pointers.size !== 1 || pinchRef.current !== null || dragRef.current) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, travel: 0, applied: boxPoint(event.clientX, event.clientY) };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const tracked = pointersRef.current.get(event.pointerId);
    if (tracked) {
      tracked.x = event.clientX;
      tracked.y = event.clientY;
    }
    const pinch = pinchRef.current;
    if (pinch !== null) {
      if (event.pointerId !== pinch.a && event.pointerId !== pinch.b) return;
      const a = pointersRef.current.get(pinch.a);
      const b = pointersRef.current.get(pinch.b);
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.distance === 0) {
        pinch.distance = distance;
        return;
      }
      if (distance > 0 && distance !== pinch.distance) {
        // Fingers apart grow the globe, as they grow a map.
        zoomBy(distance / pinch.distance);
        pinch.distance = distance;
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) {
      // FR-GLOBE-11: a mouse over a mark names it while it is there.
      if (event.pointerType === 'mouse') {
        const [x, y] = boxPoint(event.clientX, event.clientY);
        const over = rendererRef.current?.targetAt(x, y) ?? null;
        if (!sameTarget(over, hovered)) setHovered(over);
      }
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    drag.travel += Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
    // A press that may still be a tap holds the globe still, so the marks a tap is tested against are the ones under the press.
    if (drag.travel < HIT_RADIUS_PX) return;
    scheduleFlush();
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    const tapped = drag?.pointerId === event.pointerId && drag.travel < HIT_RADIUS_PX;
    endDrag(event);
    if (!tapped || !drag) return;
    const [x, y] = boxPoint(drag.x0, drag.y0);
    const hit = rendererRef.current?.targetAt(x, y) ?? null;
    setNamed(sameTarget(hit, named) ? null : hit);
    if (event.pointerType === 'mouse' && hovered !== null) setHovered(null);
  };
  const onPointerLeave = (event: PointerEvent<HTMLDivElement>): void => {
    if (hovered !== null) setHovered(null);
    // A pointer the box could not capture is gone once it leaves: no up for it will reach the box.
    const captured = typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId);
    if (pointersRef.current.has(event.pointerId) && !captured) endDrag(event);
  };
  const onLostPointerCapture = (event: PointerEvent<HTMLDivElement>): void => {
    dropPointer(event.pointerId);
  };

  // FR-GLOBE-6: the keys while the box has focus; none of them is a page shortcut (FR-DESK-4's list is letters, Enter and Escape).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if ((event.ctrlKey || event.metaKey) && ZOOM_KEYS.has(event.key)) return;
    const view = viewRef.current;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => {
        writeView({ lon: view.lon - GLOBE_KEY_STEP_DEG });
      },
      ArrowRight: () => {
        writeView({ lon: view.lon + GLOBE_KEY_STEP_DEG });
      },
      ArrowUp: () => {
        writeView({ lat: view.lat + GLOBE_KEY_STEP_DEG });
      },
      ArrowDown: () => {
        writeView({ lat: view.lat - GLOBE_KEY_STEP_DEG });
      },
      '+': () => {
        zoomBy(GLOBE_ZOOM_STEP);
      },
      '=': () => {
        zoomBy(GLOBE_ZOOM_STEP);
      },
      '-': () => {
        zoomBy(1 / GLOBE_ZOOM_STEP);
      },
      Home: () => {
        writeView(openingView(turn, place, instant));
      },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  const shown = hovered ?? named ?? listed;
  const words = CATALOGS[language].chart.globe;
  const line = shown === null ? null : readoutLine(catalog, { place, t: instant, lang: language }, shown);
  return (
    <>
      <div
        ref={boxRef}
        className={[styles.box, className].filter(Boolean).join(' ')}
        data-testid="globe-box"
        tabIndex={0}
        aria-describedby={readoutId}
        data-dragging={dragging}
        data-turn={turn}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        onLostPointerCapture={onLostPointerCapture}
        onKeyDown={onKeyDown}
      >
        {/* FR-GLOBE-14: one SVG, its children the renderer's by ref (never React's), its label the renderer's words. */}
        <svg ref={svgRef} className={styles.svg} role="img" data-globe="" />
      </div>
      {/* D-1055: the row under the box keeps its height named or not — the readout one ellipsised line, the zoom buttons beside it — so a hover never re-measures the box. */}
      <div className={styles.foot}>
        <p className={styles.readout} id={readoutId} data-testid="globe-readout">
          {line !== null && (
            <span className={styles.named} data-testid="globe-named">
              {line}
            </span>
          )}
        </p>
        <TextButton label="+" aria-label={words.zoomIn} disabled={zoomEnd === 'max'} onClick={() => { zoomBy(GLOBE_ZOOM_STEP); }} data-testid="globe-zoom-in" />
        <TextButton label="−" aria-label={words.zoomOut} disabled={zoomEnd === 'min'} onClick={() => { zoomBy(1 / GLOBE_ZOOM_STEP); }} data-testid="globe-zoom-out" />
      </div>
    </>
  );
}
