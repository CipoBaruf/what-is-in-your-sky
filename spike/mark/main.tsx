/**
 * R74 (FR-MARK-1, FR-MARK-6, D-438): the page that rasterises the mark.
 *
 * It draws the whole ladder at once — for every tier, the body and all
 * `MARK_ORBIT_FRAMES` bead frames, each its own `GlyphScene` — so one page
 * load produces everything `scripts/build-mark.ts` writes into
 * `src/ui/components/mark/rasters.json`. Two scenes rather than one per
 * picture, because the body and the bead are two layers (D-439): the app
 * writes the body's text once and only ever swaps the bead's.
 *
 * Throwaway, like every page under `spike/`: it is not part of the build, and
 * nothing here is imported by the app.
 */
import { GlyphMesh, GlyphOrthographicCamera, GlyphScene } from '@glyphcss/react';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MARK_GRIDS, MARK_ORBIT_FRAMES, MARK_TIERS, type MarkTier } from '../../src/ui/components/mark/tiers';
import { beadPolygons, bodyPolygons, FILL, MARK_TILT_DEG, TIER_SCENES, type Poly } from './scene';
import './mark.css';

/** The generator's cell, in CSS pixels. The raster is a grid, so this only has to be big enough to sample cleanly. */
const CELL_W = 8;
/** glyphcss's cell aspect: a braille cell is twice as tall as it is wide. */
const CELL_ASPECT = 2;

/**
 * glyphcss's zoom is CSS pixels per world unit, and the mark is two units
 * across (the bezel's diameter). `FILL` keeps the bezel a hair inside the
 * raster's edge, so no tier clips its own rim.
 */
function zoomFor(cols: number): number {
  return (cols * CELL_W * FILL) / 2;
}

interface LayerProps {
  tier: MarkTier;
  layer: 'body' | 'mark';
  frame: number;
  polygons: Poly[];
}

/** One rasterised layer, tagged with what it is so the driver can read it back by name. */
function Layer({ tier, layer, frame, polygons }: LayerProps) {
  const grid = MARK_GRIDS[tier];
  return (
    <div className="scene" data-mark-tier={tier} data-mark-layer={layer} data-mark-frame={String(frame)}>
      <GlyphOrthographicCamera rotX={MARK_TILT_DEG} rotY={0} zoom={zoomFor(grid.cols)}>
        <GlyphScene mode="wireframe" charMode="braille" glyphPalette="ascii" useColors={false} cols={grid.cols} rows={grid.rows} cellAspect={CELL_ASPECT}>
          <GlyphMesh id={`${tier}-${layer}`} polygons={polygons} />
        </GlyphScene>
      </GlyphOrthographicCamera>
    </div>
  );
}

function Tier({ tier }: { tier: MarkTier }) {
  const scene = TIER_SCENES[tier];
  const body = useMemo(() => bodyPolygons(scene), [scene]);
  const frames = useMemo(() => Array.from({ length: MARK_ORBIT_FRAMES }, (_, frame) => beadPolygons(scene, frame, MARK_ORBIT_FRAMES)), [scene]);
  const grid = MARK_GRIDS[tier];
  return (
    <section className="tier">
      <h2>
        {tier} · {grid.cols} × {grid.rows}
      </h2>
      <Layer tier={tier} layer="body" frame={-1} polygons={body} />
      <div className="frames">
        {frames.map((polygons, frame) => (
          <Layer key={frame} tier={tier} layer="mark" frame={frame} polygons={polygons} />
        ))}
      </div>
    </section>
  );
}

/**
 * The scenes are mounted only once the braille font is loaded: glyphcss
 * measures its cell once, at mount, and a scene that measured the fallback
 * font keeps that cell for good (R15's lesson, PLAN §8.1).
 */
function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      await document.fonts.load(`${String(CELL_W / 0.6)}px "WIYS Braille"`);
      await document.fonts.ready;
      setReady(true);
    })();
  }, []);
  if (!ready) return <p>loading the braille font…</p>;
  return (
    <div className="ladder">
      {MARK_TIERS.map((tier) => (
        <Tier key={tier} tier={tier} />
      ))}
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(<App />);
