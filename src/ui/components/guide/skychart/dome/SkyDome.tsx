import { GlyphHotspot, GlyphMesh, GlyphOrthographicCamera, GlyphScene } from '@glyphcss/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { degrees } from '../../../../../lib/format';
import { formatClock } from '../../../../../lib/timeFormat';
import type { Pass } from '../../../../../model';
import type { SkyChartProps } from '../SkyChart.types';
import { drag, gridFor, initialFor, PITCH_STEP_DEG, readout, tilt, toRotY, turn, YAW_STEP_DEG, type CameraState, type Grid } from './camera';
import { compassAnchors, gridPolygons, nowMarker, nowPoint, passAnchors, passMarkers, passStrip, screenSide, type Tuple3 } from './domeGeometry';
import styles from './SkyDome.module.css';

/**
 * FR-GUIDE-2, FR-GUIDE-4..7 (R15): the 3D ASCII sky dome, `SkyChartProps`
 * rendered with `@glyphcss/react` (D-16; this directory is the only importer).
 * One `<pre>` of braille cells (D-59), monochrome (D-61), an external
 * orthographic camera (D-17, D-60) facing the pass's rise azimuth. The
 * camera is two numbers of component state, the facing azimuth and the
 * tilt, driven by a pointer drag on the drawing and by the arrow keys on the
 * focusable wrapper (15° yaw, 5° tilt), clamped to [5°, 80°] of tilt; the
 * readout under the drawing says where the view faces (FR-GUIDE-4). The
 * drawing is `aria-hidden` (FR-GUIDE-7): the caption and the numbers carry
 * the facts. Labels are hotspots outside the dome, with the polar view's
 * data attributes (D-56) so the contract test reads both views alike.
 */
const CELL_ASPECT = 2;

interface LabelProps {
  anchor: { id: string; at: Tuple3 };
  rotY: number;
  className?: string | undefined;
  dataAnchor?: string | undefined;
  children: string;
}

/** A hotspot label that runs away from the drawing's edge: left-aligned on the left half, right-aligned on the right half. */
function Label({ anchor, rotY, className, dataAnchor, children }: LabelProps) {
  const side = screenSide(anchor.at, rotY);
  const dataSide = side > 0.05 ? 'right' : side < -0.05 ? 'left' : 'centre';
  return (
    <GlyphHotspot id={anchor.id} at={anchor.at} size={[1, 1]}>
      <span className={[styles.label, className].filter(Boolean).join(' ')} data-side={dataSide} {...(dataAnchor ? { 'data-anchor': dataAnchor } : {})}>
        {children}
      </span>
    </GlyphHotspot>
  );
}

interface DomePassProps {
  pass: Pass;
  highlighted: boolean;
  timeZone: string | null;
  now: number | undefined;
  rotY: number;
  onSelect: ((passId: string) => void) | undefined;
}

function DomePass({ pass, highlighted, timeZone, now, rotY, onSelect }: DomePassProps) {
  const strip = useMemo(() => passStrip(pass, { highlighted }), [pass, highlighted]);
  const markers = useMemo(() => passMarkers(pass), [pass]);
  const current = nowPoint(pass, now);
  const marker = useMemo(() => (current ? nowMarker(current) : []), [current]);
  const anchors = useMemo(() => passAnchors(pass), [pass]);
  const labelClass = highlighted ? styles.passLabel : styles.passLabelDim;
  const select = useCallback(() => onSelect?.(pass.id), [onSelect, pass.id]);
  return (
    <>
      <GlyphMesh id={`pass-${pass.id}`} polygons={strip} />
      <GlyphMesh id={`markers-${pass.id}`} polygons={markers} />
      {marker.length > 0 && <GlyphMesh id={`now-${pass.id}`} polygons={marker} />}
      <GlyphHotspot id={anchors.rise.id} at={anchors.rise.at} size={[1, 1]} onClick={select}>
        <span className={[styles.label, styles.raised, labelClass].join(' ')} data-side={screenSide(anchors.rise.at, rotY) > 0.05 ? 'right' : screenSide(anchors.rise.at, rotY) < -0.05 ? 'left' : 'centre'} data-pass-id={pass.id} onClick={select}>
          <span data-anchor="pass">
            {pass.name} {formatClock(pass.start.t, timeZone)}
          </span>
        </span>
      </GlyphHotspot>
      <Label anchor={anchors.peak} rotY={rotY} className={labelClass} dataAnchor="peak">
        {`max ${degrees(pass.peak.elDeg)}`}
      </Label>
      <Label anchor={anchors.end} rotY={rotY} className={labelClass}>
        →
      </Label>
    </>
  );
}

export function SkyDome({ passes, observer, highlightedPassId, onSelectPass, now, initialFacingAzDeg, className }: SkyChartProps) {
  const highlighted = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  const [camera, setCamera] = useState<CameraState>(() => initialFor(highlighted, initialFacingAzDeg));
  const [grid, setGrid] = useState<Grid>(() => gridFor(null));
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const pendingRef = useRef<{ dx: number; dy: number } | null>(null);
  const frameRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const readoutId = useId();

  // D-59: 60 columns at 390 px, more on a wider host (measured; jsdom and old browsers keep the default).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observerRO = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? null;
      setGrid((previous) => {
        const next = gridFor(width);
        return next.cols === previous.cols ? previous : next;
      });
    });
    observerRO.observe(stage);
    return () => {
      observerRO.disconnect();
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Drag: the dome follows the pointer; moves are folded into one camera update per animation frame.
  const flush = useCallback(() => {
    frameRef.current = 0;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) setCamera((state) => drag(state, pending.dx, pending.dy));
  }, []);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and old browsers: the drag still works while the pointer stays over the stage.
    }
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.x = event.clientX;
    active.y = event.clientY;
    const pending = pendingRef.current ?? { dx: 0, dy: 0 };
    pendingRef.current = { dx: pending.dx + dx, dy: pending.dy + dy };
    if (!frameRef.current) frameRef.current = requestAnimationFrame(flush);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // see setPointerCapture
    }
    setDragging(false);
  };

  // Keyboard (FR-GUIDE-2): arrows turn by 15° and tilt by 5°, independent of the library.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, (state: CameraState) => CameraState> = {
      ArrowLeft: (state) => turn(state, -YAW_STEP_DEG),
      ArrowRight: (state) => turn(state, YAW_STEP_DEG),
      ArrowUp: (state) => tilt(state, PITCH_STEP_DEG),
      ArrowDown: (state) => tilt(state, -PITCH_STEP_DEG),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setCamera(move);
  };

  const rotY = toRotY(camera.facingAzDeg);
  const gridMesh = useMemo(() => gridPolygons(), []);
  const compass = useMemo(() => compassAnchors(), []);

  return (
    <div className={[styles.dome, className].filter(Boolean).join(' ')} data-facing-az={Math.round(camera.facingAzDeg)} data-tilt={Math.round(camera.tiltDeg)}>
      <div
        role="group"
        aria-label="Sky dome"
        aria-describedby={readoutId}
        tabIndex={0}
        className={styles.stage}
        ref={stageRef}
        data-dragging={dragging}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div aria-hidden="true" data-drawing="dome">
          {/* D-61: glyphcss injects a <style id="glyph-styles"> at mount unless an element with that id exists; the CSP would block the
              element and report a violation. The rules are shipped in SkyDome.module.css instead, and this sentinel keeps the injection off. */}
          <span id="glyph-styles" hidden />
          <GlyphOrthographicCamera rotX={camera.tiltDeg} rotY={rotY} zoom={grid.zoom}>
            <GlyphScene mode="wireframe" useColors={false} glyphPalette="ascii" charMode="braille" cellAspect={CELL_ASPECT} cols={grid.cols} rows={grid.rows}>
              <GlyphMesh id="grid" polygons={gridMesh} />
              {passes.map((pass) => (
                <DomePass key={pass.id} pass={pass} highlighted={highlightedPassId === null || highlightedPassId === pass.id} timeZone={observer.timeZone} now={now} rotY={rotY} onSelect={onSelectPass} />
              ))}
              {compass.map((anchor) => (
                <Label key={anchor.id} anchor={anchor} rotY={rotY} className={styles.compass} dataAnchor={anchor.label}>
                  {anchor.label}
                </Label>
              ))}
            </GlyphScene>
          </GlyphOrthographicCamera>
        </div>
      </div>
      <p className={styles.readout} id={readoutId} data-testid="dome-readout">
        {readout(camera)}
      </p>
      <p className={styles.hint}>Drag the dome, or use the arrow keys, to look around.</p>
    </div>
  );
}
