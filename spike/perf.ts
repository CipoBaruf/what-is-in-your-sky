/**
 * R14 spike item 3 (FR-GUIDE-6): counts rasterisations and long frames during
 * a drag. A rasterisation is a write to the scene's `<pre>` (glyphcss
 * rewrites the text on every camera change), counted per animation frame; the
 * longest frame is the widest gap between two animation-frame callbacks and,
 * where Chrome supports it, the longest Long Animation Frame entry.
 */
export interface PerfResult {
  seconds: number;
  mutationBatches: number;
  rasterFrames: number;
  totalFrames: number;
  rasterPerSecond: number;
  longestFrameGapMs: number;
  loafMaxMs: number | null;
  loafCount: number;
}

interface Spike {
  start: (target: Element) => void;
  stop: () => PerfResult;
  camera: () => { rotX: number; rotY: number } | null;
  ready: () => boolean;
}

declare global {
  interface Window {
    __spike: Spike;
  }
}

export function installPerf(camera: Spike['camera'], ready: Spike['ready']): void {
  let observer: MutationObserver | null = null;
  let raf = 0;
  let loaf: PerformanceObserver | null = null;
  let mutationBatches = 0;
  let dirty = false;
  let rasterFrames = 0;
  let totalFrames = 0;
  let longestGap = 0;
  let loafMax: number | null = null;
  let loafCount = 0;
  let t0 = 0;
  let last = 0;

  const tick = (t: number) => {
    if (last) longestGap = Math.max(longestGap, t - last);
    last = t;
    totalFrames++;
    if (dirty) {
      rasterFrames++;
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  };

  window.__spike = {
    camera,
    ready,
    start(target) {
      mutationBatches = 0;
      dirty = false;
      rasterFrames = 0;
      totalFrames = 0;
      longestGap = 0;
      loafMax = null;
      loafCount = 0;
      last = 0;
      observer = new MutationObserver(() => {
        mutationBatches++;
        dirty = true;
      });
      observer.observe(target, { characterData: true, childList: true, subtree: true });
      try {
        loaf = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            loafCount++;
            loafMax = Math.max(loafMax ?? 0, entry.duration);
          }
        });
        loaf.observe({ type: 'long-animation-frame', buffered: false });
      } catch {
        loaf = null;
      }
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      const seconds = (performance.now() - t0) / 1000;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      loaf?.disconnect();
      return {
        seconds,
        mutationBatches,
        rasterFrames,
        totalFrames,
        rasterPerSecond: rasterFrames / seconds,
        longestFrameGapMs: longestGap,
        loafMaxMs: loafMax,
        loafCount,
      };
    },
  };
}
