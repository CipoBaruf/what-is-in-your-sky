/**
 * R14 spike: the PLAN §8.3 composition in `@glyphcss/react`, with every knob
 * the six questions need on props (camera model, grid, colours, char mode,
 * winding). Throwaway; R15 writes `skychart/dome/SkyDome.tsx` from the answers.
 */
import { GlyphFirstPersonControls, GlyphHotspot, GlyphMesh, GlyphOrbitControls, GlyphOrthographicCamera, GlyphPerspectiveCamera, GlyphScene, useGlyphCamera } from '@glyphcss/react';
import { useEffect, useMemo, useRef } from 'react';
import type { Pass } from '../src/model';
import { altitudeRing, compassAnchors, diamond, horizonRing, meridian, nowPoint, passAnchors, passStrip, zenithAnchor, type Poly } from './domeGeometry';

export interface DomeParams {
  camera: 'external' | 'interior';
  cols: number;
  rows: number;
  autoSize: boolean;
  colors: boolean;
  charMode: 'ascii' | 'braille';
  junctions: boolean;
  palette: string;
  yaw: number;
  pitch: number;
  zoom: number;
  /** Interior camera only. */
  distance: number;
  perspective: number;
  doubleSided: boolean;
  /** Half the pass strip width in degrees (PLAN §8.3 says 1.5° wide, so 0.75). */
  strip: number;
  /** Half width of rings and meridians; 0.05° collapses a strip to a single stroke (wireframe strokes every quad edge). */
  grid: number;
  /** Dashed 30°/60° rings and intercardinal meridians (every other 5° quad omitted). */
  dashed: boolean;
  /** glyphcss `interactiveDownscale`: render at 1/n resolution while dragging (a configuration fix for item 3). */
  downscale: number;
  /** Interior camera: try glyphcss's first-person controls (perspective camera walking on the ground plane) instead of the orbit controls. */
  fps: boolean;
}

export const DEFAULT_DOME: DomeParams = {
  camera: 'external',
  cols: 60,
  rows: 30,
  autoSize: false,
  colors: false,
  charMode: 'braille',
  junctions: false,
  palette: 'ascii',
  yaw: 0,
  pitch: 25,
  zoom: 0,
  distance: 0,
  perspective: 32000,
  doubleSided: false,
  strip: 0.75,
  grid: 0.05,
  dashed: true,
  downscale: 1,
  fps: false,
};

interface Props {
  pass: Pass;
  params: DomeParams;
  now?: number;
  riseLabel: string;
  onCamera?: (state: { rotX: number; rotY: number }) => void;
}

/** Reads the live camera (the orbit controls mutate it) once per frame and reports changes. */
function CameraProbe({ onCamera }: { onCamera?: Props['onCamera'] }) {
  const { cameraRef } = useGlyphCamera();
  const lastRef = useRef('');
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const cam = cameraRef.current;
      if (cam) {
        const key = `${cam.rotX.toFixed(2)}/${cam.rotY.toFixed(2)}`;
        if (key !== lastRef.current) {
          lastRef.current = key;
          window.__spikeCamera = { rotX: cam.rotX, rotY: cam.rotY };
          onCamera?.({ rotX: cam.rotX, rotY: cam.rotY });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraRef, onCamera]);
  return null;
}

declare global {
  interface Window {
    __spikeCamera?: { rotX: number; rotY: number };
  }
}

const HIGHLIGHT = '#9ad0ff';
const DIM = '#7d8794';

export function SpikeDome({ pass, params, now, riseLabel, onCamera }: Props) {
  const ds = params.doubleSided;
  const scene = useMemo(() => {
    const opt = { doubleSided: ds, halfWidthDeg: params.grid, ...(params.dashed ? {} : { omit: () => false }) };
    const rings: Poly[] = [...horizonRing({ ...opt, color: DIM }), ...altitudeRing(30, { ...opt, color: DIM }), ...altitudeRing(60, { ...opt, color: DIM })];
    const meridians: Poly[] = [0, 45, 90, 135, 180, 225, 270, 315].flatMap((az) => meridian(az, { ...opt, color: DIM }));
    const arc = passStrip(pass, { ...opt, halfWidthDeg: params.strip, color: HIGHLIGHT });
    const markers: Poly[] = [...diamond(pass.peak, 1.5, 1.02, HIGHLIGHT)];
    if (pass.endReason === 'shadow') markers.push(...diamond(pass.end, 1.5, 1.02, HIGHLIGHT));
    return { rings, meridians, arc, markers };
  }, [pass, ds, params.strip, params.grid, params.dashed]);
  const current = nowPoint(pass, now);
  const nowMarker = useMemo(() => (current ? diamond(current, 2, 1.03, HIGHLIGHT) : []), [current]);
  const anchors = useMemo(() => [...compassAnchors(), zenithAnchor(), ...passAnchors(pass, riseLabel)], [pass, riseLabel]);

  const sceneProps = {
    mode: 'wireframe' as const,
    useColors: params.colors,
    glyphPalette: params.palette,
    charMode: params.charMode,
    wireframeJunctions: params.junctions,
    cellAspect: 2,
    interactiveDownscale: params.downscale,
    ...(params.autoSize ? { autoSize: true } : { cols: params.cols, rows: params.rows }),
    className: 'dome-scene',
  };

  const children = (
    <GlyphScene {...sceneProps}>
      {params.camera === 'interior' && params.fps ? <GlyphFirstPersonControls eyeHeight={0} groundZ={0} moveEnabled={false} jumpEnabled={false} crouchEnabled={false} /> : <GlyphOrbitControls drag wheel={false} clampPitch />}
      <GlyphMesh id="rings" polygons={scene.rings} />
      <GlyphMesh id="meridians" polygons={scene.meridians} />
      <GlyphMesh id="arc" polygons={scene.arc} />
      <GlyphMesh id="markers" polygons={scene.markers} />
      {nowMarker.length > 0 && <GlyphMesh id="now" polygons={nowMarker} />}
      {anchors.map((a) => (
        <GlyphHotspot key={a.id} id={a.id} at={a.at} size={[Math.max(1, a.label.length), 1]}>
          <span className="hotspot" data-spike-hotspot={a.label}>
            {a.label}
          </span>
        </GlyphHotspot>
      ))}
    </GlyphScene>
  );

  // glyphcss zoom is CSS px per world unit; the dome has unit radius, so ~140 fills a 390 px grid with room for labels.
  const zoom = params.zoom > 0 ? params.zoom : 140;
  return params.camera === 'interior' ? (
    <GlyphPerspectiveCamera rotX={params.pitch} rotY={params.yaw} distance={params.distance} perspective={params.perspective} {...(zoom !== undefined ? { zoom } : {})}>
      <CameraProbe {...(onCamera ? { onCamera } : {})} />
      {children}
    </GlyphPerspectiveCamera>
  ) : (
    <GlyphOrthographicCamera rotX={params.pitch} rotY={params.yaw} {...(zoom !== undefined ? { zoom } : {})}>
      <CameraProbe {...(onCamera ? { onCamera } : {})} />
      {children}
    </GlyphOrthographicCamera>
  );
}
