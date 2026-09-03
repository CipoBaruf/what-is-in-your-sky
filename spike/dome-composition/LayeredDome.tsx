/**
 * R16 (PLAN §8.7, D-74): the layered dome — two `GlyphScene`s stacked in one
 * CSS grid cell, sharing the camera state the component holds (D-64).
 *
 *   base   solid mode, coarser grid, ground disc + shaded sky bowl + Sun glow,
 *          `pointer-events: none`
 *   lines  braille wireframe, the grid, the arcs, the markers, the hotspots
 *
 * Alignment (§8.7): both layers cover the same box, so the base layer's cell
 * is the line layer's cell times `cols / baseCols` and both zooms follow the
 * cell. Everything else is a knob from `params.ts`.
 *
 * Throwaway. R21 writes the real `dome/SkyDome.tsx` from the findings.
 */
import { GlyphHotspot, GlyphMesh, GlyphOrthographicCamera, GlyphScene, useGlyphSceneContext } from '@glyphcss/react';
import { useEffect, useMemo, type CSSProperties } from 'react';
import type { CameraState } from '../../src/ui/components/guide/skychart/dome/camera';
import { toRotY } from '../../src/ui/components/guide/skychart/dome/camera';
import { baseLayer, lineLayer, sunDirection, type Anchor } from './geometry';
import { othersFor, passFor } from './fixtures';
import type { DomePalette } from './palette';
import type { Params } from './params';

/** R15's zoom rule (`camera.ts`): 140 CSS px per world unit at a 6.5 px cell, scaling with the cell. */
export const ZOOM_PER_CELL_PX = 140 / 6.5;
/** The advance of one braille cell / one `M` as a fraction of the font size, before anything is measured. */
export const DEFAULT_ADVANCE = 0.6;

export interface LayerLayout {
  cols: number;
  rows: number;
  cellWidthPx: number;
  cellHeightPx: number;
  fontSizePx: number;
  zoom: number;
}

/** The layout of one layer: a square drawing `cols` cells wide inside `widthPx`, at cell aspect 2. */
export function layerLayout(widthPx: number, cols: number, advance: number): LayerLayout {
  const safeCols = Math.max(2, Math.round(cols));
  const cellWidthPx = widthPx / safeCols;
  return {
    cols: safeCols,
    rows: Math.max(2, Math.round(safeCols / 2)),
    cellWidthPx,
    cellHeightPx: cellWidthPx * 2,
    fontSizePx: cellWidthPx / (advance > 0 ? advance : DEFAULT_ADVANCE),
    zoom: ZOOM_PER_CELL_PX * cellWidthPx,
  };
}

const layerStyle = (layout: LayerLayout): CSSProperties =>
  ({
    '--layer-cell-w': `${layout.cellWidthPx.toFixed(3)}px`,
    '--layer-cell-h': `${layout.cellHeightPx.toFixed(3)}px`,
    '--layer-font-size': `${layout.fontSizePx.toFixed(3)}px`,
  }) as CSSProperties;

/**
 * P-OQ-4: `interactiveDownscale` is inert in the React binding — the scene
 * lowers its resolution only between `setInteracting(true)` and `(false)`, and
 * nothing in `@glyphcss/react` 0.1.6 calls that (the vanilla controls do). A
 * camera driven by React state (D-64) has to call it itself, which is what
 * this child does.
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

interface LabelsProps {
  anchors: readonly Anchor[];
  palette: DomePalette;
  colors: boolean;
}

function Labels({ anchors, palette, colors }: LabelsProps) {
  return (
    <>
      {anchors.map((anchor) => (
        <GlyphHotspot key={anchor.id} id={anchor.id} at={anchor.at} size={[Math.max(1, anchor.label.length), 1]}>
          <span className={`label label-${anchor.kind}`} data-label={anchor.id} style={colors ? { color: palette[anchor.meaning] } : undefined}>
            {anchor.label}
          </span>
        </GlyphHotspot>
      ))}
    </>
  );
}

export interface LayeredDomeProps {
  params: Params;
  palette: DomePalette;
  camera: CameraState;
  /** True while a pointer drag is in progress: drives `setInteracting` and the drop-the-base fallback. */
  dragging: boolean;
  /** 0–1, the live marker's pulse phase (FR-DOME-8d). */
  pulse: number;
  /** Measured glyph advances, so both layers land on the same grid. */
  advances: { braille: number; mono: number };
  clock: (t: number) => string;
}

export function LayeredDome({ params, palette, camera, dragging, pulse, advances, clock }: LayeredDomeProps) {
  const highlighted = passFor(params.pass);
  const others = useMemo(() => othersFor(params.others), [params.others]);
  const { meshes, anchors } = useMemo(() => lineLayer({ params, palette, highlighted, others, pulse, clock }), [params, palette, highlighted, others, pulse, clock]);
  const base = useMemo(() => baseLayer({ params, palette }), [params, palette]);

  const lines = layerLayout(params.width, params.cols, advances.braille);
  const baseCols = Math.max(8, Math.round(params.cols * params.baseRatio));
  const baseLayout = layerLayout(params.width, baseCols, advances.mono);
  const rotY = toRotY(camera.facingAzDeg);
  const showBase = params.base && !(dragging && params.dropBaseOnDrag);
  const [sx, sy, sz] = sunDirection(params);

  return (
    <div className="layers" style={{ width: `${String(params.width)}px`, height: `${String(params.width)}px` }}>
      {showBase && (
        <div className="layer layer-base" data-layer="base" style={layerStyle(baseLayout)}>
          <GlyphOrthographicCamera key={`base-${String(baseLayout.cols)}-${baseLayout.cellWidthPx.toFixed(2)}`} rotX={camera.tiltDeg} rotY={rotY} zoom={baseLayout.zoom}>
            <GlyphScene
              mode="solid"
              charMode="ascii"
              glyphPalette="default"
              useColors={params.colors}
              cols={baseLayout.cols}
              rows={baseLayout.rows}
              cellAspect={2}
              colorTolerance={params.tol}
              interactiveDownscale={params.downscale}
              colorEncoding={params.encoding}
              directionalLight={{ direction: [sx, sy, sz], intensity: params.key, color: palette.sun }}
              ambientLight={{ intensity: params.ambient, color: palette.sky }}
              className="base-scene"
            >
              <SceneInteracting active={dragging} />
              <GlyphMesh id="base" polygons={base} />
            </GlyphScene>
          </GlyphOrthographicCamera>
        </div>
      )}
      <div className="layer layer-lines" data-layer="lines" style={layerStyle(lines)}>
        <GlyphOrthographicCamera key={`lines-${String(lines.cols)}-${lines.cellWidthPx.toFixed(2)}`} rotX={camera.tiltDeg} rotY={rotY} zoom={lines.zoom}>
          <GlyphScene
            mode="wireframe"
            charMode="braille"
            glyphPalette="ascii"
            useColors={params.colors}
            cols={lines.cols}
            rows={lines.rows}
            cellAspect={2}
            colorTolerance={params.tol}
            interactiveDownscale={params.downscale}
            colorEncoding={params.encoding}
            className="lines-scene"
          >
            <SceneInteracting active={dragging} />
            {meshes.map((mesh) => (
              <GlyphMesh key={mesh.id} id={mesh.id} polygons={mesh.polygons} {...(mesh.density ? { density: mesh.density } : {})} />
            ))}
            <Labels anchors={anchors} palette={palette} colors={params.colors} />
          </GlyphScene>
        </GlyphOrthographicCamera>
      </div>
    </div>
  );
}
