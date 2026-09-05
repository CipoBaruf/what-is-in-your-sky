import { GlyphHotspot, GlyphMesh, GlyphOrthographicCamera, GlyphScene, useGlyphSceneContext } from '@glyphcss/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale, useT } from '../../../../../i18n/useT';
import { degrees } from '../../../../../lib/format';
import { formatClock } from '../../../../../lib/timeFormat';
import type { MoonState, Pass } from '../../../../../model';
import { moonGlyph } from '../bodies';
import { ChartFrame } from '../ChartFrame';
import type { SkyChartProps } from '../SkyChart.types';
import {
  AMBIENT_INTENSITY,
  baseColsFor,
  BASE_GLYPH_PALETTE,
  CELL_ASPECT,
  DEFAULT_ADVANCE,
  DEFAULT_SUN,
  drag,
  fitLayout,
  initialFor,
  KEY_INTENSITY,
  layoutFor,
  PITCH_STEP_DEG,
  readoutParams,
  tilt,
  toRotY,
  turn,
  YAW_STEP_DEG,
  type CameraState,
  type DomeLayout,
  type GlyphAdvance,
  type RowMetrics,
} from './camera';
import { screenSide, sunDirection, type Tuple3 } from './domeGeometry';
import { domeLayers, type DomeLabel, type PassLabelText } from './domeLayers';
import { useDomePalette } from './palette';
import styles from './SkyDome.module.css';

/**
 * FR-GUIDE-2, FR-GUIDE-4..7 (R15), FR-DOME-1..4 and FR-DOME-8 (R21): the 3D
 * ASCII sky dome, `SkyChartProps` rendered with `@glyphcss/react` (D-16; this
 * directory is the only importer).
 *
 * Two stacked scenes in one box (D-74, FR-DOME-8): a solid-mode *base* of
 * surfaces — the ground disc, the shaded sky bowl, the Sun glow — behind a
 * braille *line* scene carrying the grid, the arcs, the markers and the
 * labels. Both are driven by the one camera state this component holds, and
 * both size themselves from the same box, so they cannot drift: `zoom` is
 * CSS pixels per world unit against the box rather than the cell (D-91), and
 * the base simply draws the same world on half the columns (D-92). The base
 * is `aria-hidden`, `pointer-events: none` and never receives a hotspot.
 *
 * The camera is two numbers of component state, the facing azimuth and the
 * tilt, driven by a pointer drag on the drawing and by the arrow keys on the
 * focusable wrapper (15° yaw, 5° tilt), clamped to [5°, 80°] of tilt; the
 * readout under the drawing says where the view faces (FR-GUIDE-4). The
 * drawing is `aria-hidden` (FR-GUIDE-7): the caption and the numbers carry
 * the facts. Labels are hotspots outside the dome, with the polar view's data
 * attributes (D-56) so the contract test reads both views alike; which label
 * sits where is `domeLayers.domeLabels`, not this file (FR-DOME-3).
 *
 * Colour (FR-DOME-2) is read from the `--chart-*` tokens through a hidden
 * probe (D-75). Where no stylesheet is in force the palette is `null` and the
 * dome falls back to R15's monochrome reading, which FR-X-5 requires to stay
 * legible anyway.
 *
 * Sizing (D-65, FR-DOME-1): the grid follows the box — 60 columns at the
 * phone width, more as the box widens, capped at 120 (D-91) — and the cell
 * follows from it. glyphcss measures its cell once, at mount, from the letter
 * M in the `<pre>`'s font, so a scene is mounted only once the raster font is
 * loaded and the width is measured, and it is remounted if the cell changes.
 */
const PROBE_GLYPHS = 20;
const PROBE_FONT_PX = 100;
/** The raster's font (D-65, `wiys-braille.otf`): braille cells, the space and the letter M at one advance. */
export const DOME_FONT = 'WIYS Braille';
/** The glyphs the two layers are measured with: a full braille cell and a full block. */
const BRAILLE_GLYPH = '⣿';
const BLOCK_GLYPH = '█';
/** `.label` in the stylesheet: the font size and the advance a label is laid out at. */
const LABEL_FONT_PX = 11;
const LABEL_ADVANCE = 0.6;

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

/** The advances of `glyph` and of a space as fractions of the font size; the default where nothing can be measured (jsdom). */
function measureAdvance(stage: HTMLElement, glyph: string): GlyphAdvance {
  const cell = probeWidth(stage, glyph, PROBE_GLYPHS, PROBE_FONT_PX) / PROBE_GLYPHS / PROBE_FONT_PX;
  const space = probeWidth(stage, ' ', PROBE_GLYPHS, PROBE_FONT_PX) / PROBE_GLYPHS / PROBE_FONT_PX;
  return cell > 0 && space > 0 ? { braille: cell, space } : DEFAULT_ADVANCE;
}

/** One row of `glyph` and one of spaces at the size the raster will use: what the platform actually renders, rounding included. */
const rowMetrics =
  (stage: HTMLElement, glyph: string) =>
  (fontSizePx: number, cols: number): RowMetrics => ({ brailleRowPx: probeWidth(stage, glyph, cols, fontSizePx), spaceRowPx: probeWidth(stage, ' ', cols, fontSizePx) });

/** The cell metrics a layer reaches its stylesheet with (through the CSSOM, which `style-src 'self'` allows). */
const layerStyle = (layout: DomeLayout): CSSProperties =>
  ({
    '--dome-cell-w': `${String(layout.cellWidthPx)}px`,
    '--dome-cell-h': `${String(layout.cellHeightPx)}px`,
    '--dome-font-size': `${String(layout.fontSizePx)}px`,
    '--dome-word-spacing': `${String(layout.wordSpacingPx)}px`,
  }) as CSSProperties;

/**
 * P-OQ-4 (R16): `interactiveDownscale` is inert in the React binding — the
 * scene lowers its resolution only between `setInteracting(true)` and
 * `(false)`, and nothing in `@glyphcss/react` 0.1.6 calls that. A camera
 * driven by React state (D-64) has to call it itself, which is this child.
 */
function SceneInteracting({ active }: { active: boolean }) {
  const { sceneRef } = useGlyphSceneContext();
  useEffect(() => {
    const scene = sceneRef.current;
    scene?.setInteracting(active);
    return () => scene?.setInteracting(false);
  }, [active, sceneRef]);
  return null;
}

const sideOf = (at: Tuple3, rotY: number): 'left' | 'right' | 'centre' => {
  const side = screenSide(at, rotY);
  return side > 0.05 ? 'right' : side < -0.05 ? 'left' : 'centre';
};

/** The stylesheet class a label's kind takes; the colour itself comes from the palette (FR-DOME-2). */
const CLASS_FOR: Record<DomeLabel['kind'], string | undefined> = {
  compass: styles.compass,
  peak: undefined,
  rise: styles.raised,
  end: undefined,
  ring: styles.degree,
  tick: styles.degree,
  sun: styles.body,
  moon: styles.body,
};

interface DomeLabelsProps {
  labels: readonly DomeLabel[];
  rotY: number;
  onSelect: ((passId: string) => void) | undefined;
}

/**
 * The labels, already placed by `domeLabels` (FR-DOME-3). A label runs away
 * from the drawing's edge — left-aligned on the left half, right-aligned on
 * the right — and a pass's rise label selects that pass (D-56).
 */
function DomeLabels({ labels, rotY, onSelect }: DomeLabelsProps) {
  return (
    <>
      {labels.map((label) => {
        const passId = label.passId;
        // D-56: exactly one element per pass carries `data-pass-id`, and it is the one a click selects — the rise label, which is the pass's name.
        const selectable = passId !== undefined && label.kind === 'rise';
        const select = selectable && onSelect ? () => onSelect(passId) : undefined;
        const passClass = passId === undefined ? undefined : label.highlighted ? styles.passLabel : styles.passLabelDim;
        return (
          <GlyphHotspot key={label.id} id={label.id} at={label.at} size={[1, 1]} {...(select ? { onClick: select } : {})}>
            <span
              className={[styles.label, CLASS_FOR[label.kind], passClass].filter(Boolean).join(' ')}
              data-side={sideOf(label.at, rotY)}
              {...(label.color ? { style: { color: label.color } } : {})}
              {...(label.anchor && !selectable ? { 'data-anchor': label.anchor } : {})}
              {...(selectable ? { 'data-pass-id': passId } : {})}
              {...(select ? { onClick: select } : {})}
            >
              {/* D-56: the polar view nests the name inside the element carrying `data-pass-id`, so the dome does too and one selector reads both. */}
              {selectable && label.anchor ? <span data-anchor={label.anchor}>{label.text}</span> : label.text}
            </span>
          </GlyphHotspot>
        );
      })}
    </>
  );
}

export function SkyDome({ passes, observer, highlightedPassId, onSelectPass, now, sun, moon, initialFacingAzDeg, colorBy, fill = false, className }: SkyChartProps) {
  const t = useT();
  const locale = useLocale();
  const highlighted = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  const [camera, setCamera] = useState<CameraState>(() => initialFor(highlighted, initialFacingAzDeg));
  const [lines, setLines] = useState<DomeLayout>(() => layoutFor(null));
  const [base, setBase] = useState<DomeLayout>(() => layoutFor(null, null, DEFAULT_ADVANCE, baseColsFor(layoutFor(null).cols)));
  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const pendingRef = useRef<{ dx: number; dy: number } | null>(null);
  const frameRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [fontReady, setFontReady] = useState(() => typeof document === 'undefined' || !document.fonts);
  const [measured, setMeasured] = useState(() => typeof ResizeObserver === 'undefined');
  const readoutId = useId();
  const palette = useDomePalette(probeRef);

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

  // D-65, FR-DOME-1: the grid and the cell follow the measured box. Both layers are fitted to the same box, the base at half the columns (D-92).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !fontReady || typeof ResizeObserver === 'undefined') return;
    const brailleAdvance = measureAdvance(stage, BRAILLE_GLYPH);
    const blockAdvance = measureAdvance(stage, BLOCK_GLYPH);
    const brailleRows = rowMetrics(stage, BRAILLE_GLYPH);
    const blockRows = rowMetrics(stage, BLOCK_GLYPH);
    const keep = (next: DomeLayout) => (previous: DomeLayout) =>
      Math.abs(next.cellWidthPx - previous.cellWidthPx) < 0.01 && next.fontSizePx === previous.fontSizePx && next.cols === previous.cols && next.rows === previous.rows ? previous : next;
    const observerRO = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      const width = box?.width ?? null;
      const height = box?.height ?? null;
      const nextLines = fitLayout(width, height, brailleAdvance, brailleRows);
      setLines(keep(nextLines));
      setBase(keep(fitLayout(width, height, blockAdvance, blockRows, baseColsFor(nextLines.cols))));
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
  const timeZone = observer.timeZone;

  // FR-I18N-2: the catalogs word every label; this component only places them.
  const labelsFor = useCallback(
    (pass: Pass): PassLabelText => ({
      rise: t.chart.passLabel({ name: pass.name, time: formatClock(pass.start.t, timeZone, locale) }),
      peak: t.chart.peakLabel(degrees(pass.peak.elDeg)),
      end: formatClock(pass.end.t, timeZone, locale),
    }),
    [t, timeZone, locale],
  );

  // A label's size in world units: `zoom` is CSS pixels per world unit (D-91), so this is the same on either layer.
  const measure = useCallback(
    (text: string) => ({ halfWidth: (text.length * LABEL_FONT_PX * LABEL_ADVANCE) / 2 / lines.zoom, halfHeight: LABEL_FONT_PX / 2 / lines.zoom }),
    [lines.zoom],
  );

  // FR-DOME-6: the two bodies' names. Like every other label they are worded
  // by the catalogs (FR-I18N-2); the Moon's glyph is its phase (`../bodies`).
  const bodyLabels = useMemo(() => ({ sun: t.chart.sunLabel, moon: (state: MoonState) => t.chart.moonLabel(moonGlyph(state)) }), [t]);

  const layers = useMemo(
    () =>
      domeLayers({
        passes,
        highlightedPassId,
        palette,
        camera: { rotYDeg: rotY, tiltDeg: camera.tiltDeg },
        labelsFor,
        measure,
        bodyLabels,
        sun,
        moon,
        colorBy,
        ...(now === undefined ? {} : { now }),
      }),
    [passes, highlightedPassId, palette, rotY, camera.tiltDeg, labelsFor, measure, bodyLabels, sun, moon, now, colorBy],
  );

  // FR-DOME-8a: the key light points along the Sun's real direction, so twilight
  // brightens the side of the sky it is really on. Without one (no instant yet,
  // or the astronomy chunk still loading) it is D-111's fixed twilight direction.
  const [lightX, lightY, lightZ] = sunDirection(sun ?? DEFAULT_SUN);
  const colored = palette !== null;
  const ready = fontReady && measured;

  return (
    <div className={[styles.dome, className].filter(Boolean).join(' ')} data-facing-az={Math.round(camera.facingAzDeg)} data-tilt={Math.round(camera.tiltDeg)}>
      <ChartFrame
        fill={fill}
        controls={<p className={styles.hint}>{t.chart.domeHint}</p>}
        status={
          <p className={styles.readout} id={readoutId} data-testid="dome-readout">
            {t.chart.readout(readoutParams(camera))}
          </p>
        }
      >
        <div
          role="group"
          aria-label={t.chart.domeGroup}
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
          {/* D-75: the FR-DOME-2 tokens are read off this probe, so a theme scoped to a container is picked up as well as one on the root. */}
          <span className={styles.probe} ref={probeRef} hidden />
          {/* D-61: glyphcss injects a <style id="glyph-styles"> at mount unless an element with that id exists; the CSP would block the
              element and report a violation. The rules are shipped in SkyDome.module.css instead, and this sentinel keeps the injection off. */}
          <span id="glyph-styles" hidden />
          <div className={styles.layers} aria-hidden="true" data-drawing="dome">
            {ready && layers.base.length > 0 && (
              <div className={styles.layer} data-layer="base" style={layerStyle(base)}>
                <GlyphOrthographicCamera key={`base-${String(base.cols)}`} rotX={camera.tiltDeg} rotY={rotY} zoom={base.zoom}>
                  <GlyphScene
                    mode="solid"
                    charMode="ascii"
                    glyphPalette={BASE_GLYPH_PALETTE}
                    useColors={colored}
                    cols={base.cols}
                    rows={base.rows}
                    cellAspect={CELL_ASPECT}
                    directionalLight={{ direction: [lightX, lightY, lightZ], intensity: KEY_INTENSITY, ...(palette ? { color: palette.sun } : {}) }}
                    ambientLight={{ intensity: AMBIENT_INTENSITY, ...(palette ? { color: palette.sky } : {}) }}
                  >
                    <SceneInteracting active={dragging} />
                    {layers.base.map((mesh) => (
                      <GlyphMesh key={mesh.id} id={mesh.id} polygons={mesh.polygons} />
                    ))}
                  </GlyphScene>
                </GlyphOrthographicCamera>
              </div>
            )}
            {ready && (
              <div className={styles.layer} data-layer="lines" style={layerStyle(lines)}>
                <GlyphOrthographicCamera key={`lines-${String(lines.cols)}`} rotX={camera.tiltDeg} rotY={rotY} zoom={lines.zoom}>
                  <GlyphScene mode="wireframe" charMode="braille" glyphPalette="ascii" useColors={colored} cols={lines.cols} rows={lines.rows} cellAspect={CELL_ASPECT}>
                    <SceneInteracting active={dragging} />
                    {layers.lines.map((mesh) => (
                      <GlyphMesh key={mesh.id} id={mesh.id} polygons={mesh.polygons} />
                    ))}
                    <DomeLabels labels={layers.labels} rotY={rotY} onSelect={onSelectPass} />
                  </GlyphScene>
                </GlyphOrthographicCamera>
              </div>
            )}
          </div>
        </div>
      </ChartFrame>
    </div>
  );
}
