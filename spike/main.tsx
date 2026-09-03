/**
 * R14 spike page (PLAN §8.5). Every knob is a URL parameter so the capture
 * script can drive it: view=external|interior|panorama|both, pass=golden|high,
 * cols, rows, auto, colors, char=ascii|braille, junctions, yaw, pitch, zoom,
 * distance, perspective, ds (double-sided), strip, now (fraction of the pass),
 * play. Not part of the production build: `vite build` only bundles the root
 * `index.html`, so `dist/` never contains this page.
 */
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { installPerf } from './perf';
import { PASSES } from './passes';
import { DEFAULT_DOME, SpikeDome, type DomeParams } from './SpikeDome';
import { SpikePanorama } from './SpikePanorama';
import './spike.css';

type View = 'external' | 'interior' | 'panorama' | 'both';

interface PageParams extends DomeParams {
  view: View;
  pass: string;
  now: number;
  play: boolean;
}

function read(): PageParams {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
  const bool = (k: string, d: boolean) => (q.has(k) ? q.get(k) === '1' : d);
  const view = (q.get('view') ?? 'external') as View;
  return {
    ...DEFAULT_DOME,
    view,
    pass: q.get('pass') ?? 'golden',
    camera: view === 'interior' ? 'interior' : 'external',
    cols: num('cols', DEFAULT_DOME.cols),
    rows: num('rows', DEFAULT_DOME.rows),
    autoSize: bool('auto', false),
    colors: bool('colors', false),
    charMode: (q.get('char') ?? DEFAULT_DOME.charMode) as DomeParams['charMode'],
    junctions: bool('junctions', false),
    palette: q.get('palette') ?? DEFAULT_DOME.palette,
    // D-17: with neither `yaw` (raw rotY) nor `face` (an azimuth) given, face the pass's rise azimuth.
    yaw: q.has('face') ? (360 - Number(q.get('face'))) % 360 : num('yaw', (360 - Math.round((PASSES[q.get('pass') ?? 'golden'] ?? PASSES['golden'])?.start.azDeg ?? 0)) % 360),
    pitch: num('pitch', DEFAULT_DOME.pitch),
    zoom: num('zoom', 0),
    distance: num('distance', 0),
    perspective: num('perspective', 32000),
    doubleSided: bool('ds', false),
    strip: num('strip', DEFAULT_DOME.strip),
    grid: num('grid', DEFAULT_DOME.grid),
    dashed: bool('dashed', DEFAULT_DOME.dashed),
    downscale: num('downscale', DEFAULT_DOME.downscale),
    fps: bool('fps', false),
    now: num('now', -1),
    play: bool('play', false),
  };
}

function write(p: PageParams) {
  const q = new URLSearchParams();
  q.set('view', p.view);
  q.set('pass', p.pass);
  q.set('cols', String(p.cols));
  q.set('rows', String(p.rows));
  if (p.autoSize) q.set('auto', '1');
  if (p.colors) q.set('colors', '1');
  if (p.charMode !== DEFAULT_DOME.charMode) q.set('char', p.charMode);
  if (p.junctions) q.set('junctions', '1');
  if (p.palette !== DEFAULT_DOME.palette) q.set('palette', p.palette);
  q.set('yaw', String(p.yaw));
  q.set('pitch', String(p.pitch));
  if (p.zoom) q.set('zoom', String(p.zoom));
  if (p.distance) q.set('distance', String(p.distance));
  if (p.perspective !== 32000) q.set('perspective', String(p.perspective));
  if (p.doubleSided) q.set('ds', '1');
  if (p.strip !== DEFAULT_DOME.strip) q.set('strip', String(p.strip));
  if (p.grid !== DEFAULT_DOME.grid) q.set('grid', String(p.grid));
  if (!p.dashed) q.set('dashed', '0');
  if (p.downscale !== 1) q.set('downscale', String(p.downscale));
  if (p.fps) q.set('fps', '1');
  if (p.now >= 0) q.set('now', p.now.toFixed(3));
  if (p.play) q.set('play', '1');
  window.history.replaceState(null, '', `?${q.toString()}`);
}

const LOOP_MS = 12_000;
const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** PLAN §8.2 (D-58): the camera at rotY faces azimuth 360 − rotY. */
const facingAz = (rotY: number) => (((360 - rotY) % 360) + 360) % 360;
const compass16 = (az: number) => COMPASS_16[Math.round(az / 22.5) % 16] ?? 'N';

function App() {
  const [params, setParams] = useState<PageParams>(read);
  const [camera, setCamera] = useState<{ rotX: number; rotY: number } | null>(null);
  const [played, setPlayed] = useState(0);
  const pass = PASSES[params.pass] ?? PASSES['golden'];
  if (!pass) throw new Error('no pass');
  useEffect(() => write(params), [params]);
  useEffect(() => {
    if (!params.play) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      setPlayed(((t - t0) % LOOP_MS) / LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [params.play]);
  const fraction = params.play ? played : params.now;
  const now = fraction >= 0 ? pass.start.t + fraction * (pass.end.t - pass.start.t) : undefined;
  const riseLabel = `${pass.name} ${new Date(pass.start.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  const set = <K extends keyof PageParams>(k: K, v: PageParams[K]) => setParams((p) => ({ ...p, [k]: v, ...(k === 'view' ? { camera: v === 'interior' ? 'interior' : 'external' } : {}) }));
  const onCamera = useCallback((c: { rotX: number; rotY: number }) => setCamera(c), []);
  const domeStyle = useMemo(() => {
    const w = 390 / params.cols;
    return { '--cell-w': `${w.toFixed(3)}px`, '--cell-h': `${(w * 2).toFixed(3)}px` } as React.CSSProperties;
  }, [params.cols]);
  const showDome = params.view !== 'panorama';
  const showPanorama = params.view === 'panorama' || params.view === 'both';
  const dome = showDome && (
    <div className={`dome${params.autoSize ? ' auto' : ''}`} style={domeStyle} data-spike-dome>
      <SpikeDome pass={pass} params={params} {...(now !== undefined ? { now } : {})} riseLabel={riseLabel} onCamera={onCamera} />
      <p className="readout" data-spike-readout>
        facing {compass16(facingAz(camera?.rotY ?? params.yaw))} · tilt {Math.round(camera?.rotX ?? params.pitch)}° · rotX {(camera?.rotX ?? params.pitch).toFixed(1)} · rotY {(camera?.rotY ?? params.yaw).toFixed(1)} · {params.autoSize ? 'auto' : `${params.cols}×${params.rows}`} · {params.colors ? 'colour' : 'mono'}
      </p>
    </div>
  );
  return (
    <div className="page">
      <div className="controls">
        <label>
          view
          <select value={params.view} onChange={(e) => set('view', e.target.value as View)}>
            <option value="external">dome, external camera</option>
            <option value="interior">dome, interior camera</option>
            <option value="panorama">horizon panorama</option>
            <option value="both">dome + panorama</option>
          </select>
        </label>
        <label>
          pass
          <select value={params.pass} onChange={(e) => set('pass', e.target.value)}>
            <option value="golden">golden (grazing, 10°)</option>
            <option value="high">high (64°, into shadow)</option>
          </select>
        </label>
        <label>
          grid
          <select value={params.autoSize ? 'auto' : `${params.cols}x${params.rows}`} onChange={(e) => {
            const v = e.target.value;
            if (v === 'auto') set('autoSize', true);
            else {
              const [c, r] = v.split('x').map(Number);
              setParams((p) => ({ ...p, autoSize: false, cols: c ?? 60, rows: r ?? 30 }));
            }
          }}>
            <option value="60x30">60×30</option>
            <option value="100x50">100×50</option>
            <option value="auto">auto</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={params.colors} onChange={(e) => set('colors', e.target.checked)} /> colours
        </label>
        <label>
          <input type="checkbox" checked={params.doubleSided} onChange={(e) => set('doubleSided', e.target.checked)} /> double-sided
        </label>
        <label>
          palette
          <select value={params.palette} onChange={(e) => set('palette', e.target.value)}>
            {['lines', 'ascii', 'default', 'dots', 'blocks', 'stars', 'math'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          char
          <select value={params.charMode} onChange={(e) => set('charMode', e.target.value as DomeParams['charMode'])}>
            <option value="ascii">ascii</option>
            <option value="braille">braille</option>
          </select>
        </label>
        <label>
          yaw <input type="number" step={15} value={params.yaw} onChange={(e) => set('yaw', Number(e.target.value))} />
        </label>
        <label>
          pitch <input type="number" step={5} value={params.pitch} onChange={(e) => set('pitch', Number(e.target.value))} />
        </label>
        <label>
          zoom <input type="number" step={10} value={params.zoom} onChange={(e) => set('zoom', Number(e.target.value))} />
        </label>
        <label>
          dist <input type="number" step={0.1} value={params.distance} onChange={(e) => set('distance', Number(e.target.value))} />
        </label>
        <label>
          persp <input type="number" step={1000} value={params.perspective} onChange={(e) => set('perspective', Number(e.target.value))} />
        </label>
        <label>
          grid° <input type="number" step={0.05} value={params.grid} onChange={(e) => set('grid', Number(e.target.value))} />
        </label>
        <label>
          <input type="checkbox" checked={params.dashed} onChange={(e) => set('dashed', e.target.checked)} /> dashed
        </label>
        <label>
          strip° <input type="number" step={0.25} value={params.strip} onChange={(e) => set('strip', Number(e.target.value))} />
        </label>
        <label>
          now <input type="number" step={0.05} min={-1} max={1} value={Number(fraction.toFixed(2))} onChange={(e) => set('now', Number(e.target.value))} />
        </label>
        <button type="button" onClick={() => set('play', !params.play)}>
          {params.play ? 'pause' : 'play'}
        </button>
      </div>
      <div id="stage">
        <div className={params.view === 'both' ? 'both' : 'stage-inner'}>
          {params.view === 'both' && <h2>3D ASCII dome (external camera)</h2>}
          {dome}
          {params.view === 'both' && <h2>Horizon panorama</h2>}
          {showPanorama && <SpikePanorama pass={pass} {...(now !== undefined ? { now } : {})} timeZone="America/Argentina/Salta" />}
        </div>
      </div>
    </div>
  );
}

installPerf(
  () => window.__spikeCamera ?? null,
  () => (document.querySelector('.dome-scene pre')?.textContent ?? '').trim().length > 0,
);

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
