import { GlyphHotspot, GlyphMesh, GlyphOrthographicCamera, GlyphScene } from '@glyphcss/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { degrees } from '../../../../../lib/format';
import { formatClock } from '../../../../../lib/timeFormat';
import type { Pass } from '../../../../../model';
import { ChartFrame } from '../ChartFrame';
import type { SkyChartProps } from '../SkyChart.types';
import { CELL_ASPECT, DEFAULT_ADVANCE, drag, fitLayout, GRID_COLS, GRID_ROWS, initialFor, layoutFor, PITCH_STEP_DEG, readout, tilt, toRotY, turn, YAW_STEP_DEG, type CameraState, type DomeLayout, type GlyphAdvance, type RowMetrics } from './camera';
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
 * data attributes (D-56) so the contract test reads both views alike. The
 * view sits in the shared `ChartFrame` (R15 review): the hint in the
 * controls row, the drawing in the square box, the readout in the status row.
 *
 * Sizing (D-65): the grid is always 60 × 30 and the cell follows the box's
 * width. glyphcss measures its cell once, at mount, from the letter M in the
 * `<pre>`'s font, so the scene is mounted only once the raster font is loaded
 * and the width is measured, and it is remounted if the cell changes.
 */
const PROBE_GLYPHS = 20;
const PROBE_FONT_PX = 100;
/** The raster's font (D-65, `wiys-braille.otf`): braille cells, the space and the letter M at one advance. */
export const DOME_FONT = 'WIYS Braille';

function domeFontReady(): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return Promise.resolve();
  return fonts.load(`12px "${DOME_FONT}"`).then(
    () => undefined,
    () => undefined,
  );
}

/** The rendered width of `glyph` repeated `count` times at `fontSizePx`, in the raster's font, measured in the stage. */
function probeWidth(stage: HTMLElement, glyph: string, count: number, fontSizePx: number): number {
  const family = `"${DOME_FONT}", ${stage.ownerDocument.defaultView?.getComputedStyle(stage).fontFamily ?? 'monospace'}`;
  const probe = stage.ownerDocument.createElement('span');
  probe.textContent = glyph.repeat(count);
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'pre';
  probe.style.fontFamily = family;
  probe.style.fontSize = `${String(fontSizePx)}px`;
  stage.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/** The advances of a braille cell and of a space as fractions of the font size; the default where nothing can be measured (jsdom). */
function measureAdvance(stage: HTMLElement): GlyphAdvance {
  const braille = probeWidth(stage, '⣿', PROBE_GLYPHS, PROBE_FONT_PX) / PROBE_GLYPHS / PROBE_FONT_PX;
  const space = probeWidth(stage, ' ', PROBE_GLYPHS, PROBE_FONT_PX) / PROBE_GLYPHS / PROBE_FONT_PX;
  return braille > 0 && space > 0 ? { braille, space } : DEFAULT_ADVANCE;
}

/** One 60-cell row of braille and one of spaces at the size the raster will use: what the platform actually renders, rounding included. */
const rowMetrics =
  (stage: HTMLElement) =>
  (fontSizePx: number): RowMetrics => ({ brailleRowPx: probeWidth(stage, '⣿', GRID_COLS, fontSizePx), spaceRowPx: probeWidth(stage, ' ', GRID_COLS, fontSizePx) });

interface LabelProps {
  anchor: { id: string; at: Tuple3 };
  rotY: number;
  className?: string | undefined;
  dataAnchor?: string | undefined;
  children: string;
}

const sideOf = (at: Tuple3, rotY: number): 'left' | 'right' | 'centre' => {
  const side = screenSide(at, rotY);
  return side > 0.05 ? 'right' : side < -0.05 ? 'left' : 'centre';
};

/** A hotspot label that runs away from the drawing's edge: left-aligned on the left half, right-aligned on the right half. */
function Label({ anchor, rotY, className, dataAnchor, children }: LabelProps) {
  return (
    <GlyphHotspot id={anchor.id} at={anchor.at} size={[1, 1]}>
      <span className={[styles.label, className].filter(Boolean).join(' ')} data-side={sideOf(anchor.at, rotY)} {...(dataAnchor ? { 'data-anchor': dataAnchor } : {})}>
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
        <span className={[styles.label, styles.raised, labelClass].join(' ')} data-side={sideOf(anchors.rise.at, rotY)} data-pass-id={pass.id} onClick={select}>
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
  const [layout, setLayout] = useState<DomeLayout>(() => layoutFor(null));
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const pendingRef = useRef<{ dx: number; dy: number } | null>(null);
  const frameRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [fontReady, setFontReady] = useState(() => typeof document === 'undefined' || !document.fonts);
  const [measured, setMeasured] = useState(() => typeof ResizeObserver === 'undefined');
  const readoutId = useId();

  // D-65: the scene waits for the raster font; without a font API (jsdom) it is ready at once.
  useEffect(() => {
    if (fontReady) return;
    let cancelled = false;
    void domeFontReady().then(() => {
      if (!cancelled) setFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fontReady]);

  // D-65: the cell follows the measured width; jsdom and old browsers keep the default. The advances are measured once, in the raster's font.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !fontReady || typeof ResizeObserver === 'undefined') return;
    const advance = measureAdvance(stage);
    const observerRO = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? null;
      const next = fitLayout(width, advance, rowMetrics(stage));
      setLayout((previous) => (Math.abs(next.cellWidthPx - previous.cellWidthPx) < 0.01 && next.fontSizePx === previous.fontSizePx ? previous : next));
      setMeasured(true);
    });
    observerRO.observe(stage);
    return () => {
      observerRO.disconnect();
    };
  }, [fontReady]);

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

  // The cell size reaches the stylesheet as custom properties set through the CSSOM (allowed under `style-src 'self'`, unlike a style attribute).
  const cellStyle = {
    '--dome-cell-w': `${String(layout.cellWidthPx)}px`,
    '--dome-cell-h': `${String(layout.cellHeightPx)}px`,
    '--dome-font-size': `${String(layout.fontSizePx)}px`,
    '--dome-word-spacing': `${String(layout.wordSpacingPx)}px`,
  } as CSSProperties;

  return (
    <div className={[styles.dome, className].filter(Boolean).join(' ')} data-facing-az={Math.round(camera.facingAzDeg)} data-tilt={Math.round(camera.tiltDeg)}>
      <ChartFrame
        controls={<p className={styles.hint}>Drag the dome, or use the arrow keys, to look around.</p>}
        status={
          <p className={styles.readout} id={readoutId} data-testid="dome-readout">
            {readout(camera)}
          </p>
        }
      >
        <div
          role="group"
          aria-label="Sky dome"
          aria-describedby={readoutId}
          tabIndex={0}
          className={styles.stage}
          style={cellStyle}
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
            {fontReady && measured && (
              <GlyphOrthographicCamera key={layout.cellWidthPx} rotX={camera.tiltDeg} rotY={rotY} zoom={layout.zoom}>
                <GlyphScene mode="wireframe" useColors={false} glyphPalette="ascii" charMode="braille" cellAspect={CELL_ASPECT} cols={GRID_COLS} rows={GRID_ROWS}>
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
            )}
          </div>
        </div>
      </ChartFrame>
    </div>
  );
}
