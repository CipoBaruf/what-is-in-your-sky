import { legendKeys, legendRows, SERIES_COUNT } from '../../../../../lib/legend';
import type { EpochMs, Pass } from '../../../../../model';
import { arcGuides, globeArcs, type ArcMark, type GlobeArc } from './arcs';
import { project, type Projector } from './projection';
import type { GlobeSky } from './scene';

/**
 * R184 (FR-WIDE-3, FR-WIDE-7; PLAN D-1099, D-1038): the passes' nodes on the globe, made once — one path per series
 * (`SERIES_COUNT`) holding its passes' near-side polylines, markers and rise points, one key `<text>` per series, the
 * highlighted pass's ticks and its arrow one path each — and written per frame by ref. The geometry is `arcs.ts`'s,
 * kept while the sky, the passes and the instant hold, so a drag only projects. A series' second pass (a seventh
 * pass and on) shares its path's state and key node: the live page lists fewer.
 */

export type ArcColorBy = 'pass' | 'highlight';

/** What the layer draws: the passes, the arcs' instant, the emphasised pass, the colouring, and the legend's keys where the page has them. */
export interface ArcInput {
  passes: readonly Pass[];
  t: EpochMs;
  highlightedPassId: string | null;
  colorBy: ArcColorBy;
  keys: Readonly<Record<string, string>> | null;
}

const fmt = (n: number): string => n.toFixed(1);
/** A marker's ring and the rise point's dot, px of the drawing. */
const MARKER_R = 4;
const RISE_R = 2;
/** Half a tick across the line, and the arrow's length and half-width, px. */
const TICK_HALF = 4;
const ARROW_LEN = 9;
const ARROW_HALF = 4.5;
/** A key stands this far right of its marker, px. */
const KEY_DX = 9;
/** FR-WIDE-7: an arc is under the pointer within this distance of its drawn line, px. */
export const ARC_HIT_PX = 8;

const ring = (x: number, y: number, r: number): string => `M${fmt(x - r)} ${fmt(y)}a${String(r)} ${String(r)} 0 1 0 ${String(2 * r)} 0a${String(r)} ${String(r)} 0 1 0 ${String(-2 * r)} 0`;

function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const k = len > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - x1 - k * dx, py - y1 - k * dy);
}

export class GlobeArcLayer {
  private readonly series: SVGPathElement[] = [];
  private readonly keys: SVGTextElement[] = [];
  private readonly ticks: SVGPathElement;
  private readonly arrow: SVGPathElement;
  /** Each drawn pass's projected polylines, flat `[x0, y0, x1, y1, …]` per near-side run, for `passAt`. */
  private readonly drawn = new Map<string, number[][]>();
  private memo: { sky: GlobeSky; input: ArcInput; arcs: GlobeArc[]; keys: Readonly<Record<string, string>> } | null = null;

  constructor(parent: Element, make: (tag: 'path' | 'text', attrs: Record<string, string | number>, parent: Element) => SVGElement, cls: (name: string) => string) {
    for (let k = 1; k <= SERIES_COUNT; k += 1) this.series.push(make('path', { class: cls('arc'), 'data-arc-series': k, 'data-pass-ids': '' }, parent) as SVGPathElement);
    this.ticks = make('path', { class: cls('arcTicks'), 'data-arc-ticks': '' }, parent) as SVGPathElement;
    this.arrow = make('path', { class: cls('arcArrow'), 'data-arc-arrow': '' }, parent) as SVGPathElement;
    for (let k = 1; k <= SERIES_COUNT; k += 1) this.keys.push(make('text', { class: cls('arcKey'), 'data-arc-key': k, visibility: 'hidden' }, parent) as SVGTextElement);
  }

  /** `arcs.ts`'s geometry and the keys for this sky and input, made again only when one of them changed. */
  private geometry(sky: GlobeSky, input: ArcInput): { arcs: GlobeArc[]; keys: Readonly<Record<string, string>> } {
    const m = this.memo;
    if (m && m.sky === sky && m.input.passes === input.passes && m.input.t === input.t && m.input.keys === input.keys && m.input.highlightedPassId === input.highlightedPassId) return m;
    const arcs = globeArcs(sky, input.passes, input.t);
    const keys = input.keys ?? legendKeys(legendRows({ passes: input.passes.map((pass) => ({ ...pass, arc: arcs.find((a) => a.id === pass.id)?.state ?? 'hidden' })), highlightedPassId: input.highlightedPassId, now: input.t }));
    this.memo = { sky, input, arcs, keys };
    return this.memo;
  }

  /** The frame's write: every series path, key, the ticks and the arrow. */
  draw(p: Projector, sky: GlobeSky, input: ArcInput, on: boolean): void {
    const { arcs, keys } = on ? this.geometry(sky, input) : { arcs: [], keys: {} };
    this.drawn.clear();
    const point = (v: readonly [number, number, number]): [number, number] | null => {
      const [x, y, z] = project(p, v);
      return z > 0 ? [x, y] : null;
    };
    const highlighted = input.highlightedPassId;
    this.series.forEach((path, k) => {
      const mine = arcs.filter((a) => a.series === k + 1);
      const first = mine[0];
      let d = '';
      let keyAt: [number, number] | null = null;
      for (const arc of mine) {
        const runs: number[][] = [];
        let run: number[] = [];
        for (const v of arc.points) {
          const xy = point(v);
          if (!xy) {
            if (run.length > 0) runs.push(run);
            run = [];
            continue;
          }
          d += `${run.length === 0 ? 'M' : 'L'}${fmt(xy[0])} ${fmt(xy[1])}`;
          run.push(xy[0], xy[1]);
        }
        if (run.length > 0) runs.push(run);
        this.drawn.set(arc.id, runs);
        const marker = arc.marker ? point(arc.marker) : null;
        const rise = arc.rise ? point(arc.rise) : null;
        if (marker) d += ring(marker[0], marker[1], MARKER_R);
        if (rise) d += ring(rise[0], rise[1], RISE_R);
        // The key beside the marker while up, else beside the drawn part's middle.
        const mid = arc.points[Math.floor(arc.points.length / 2)];
        keyAt ??= marker ?? (mid ? point(mid) : null);
      }
      path.setAttribute('d', d);
      path.setAttribute('data-pass-ids', mine.map((a) => a.id).join(' '));
      if (first) {
        path.setAttribute('data-state', first.state);
        const lit = highlighted === null || mine.some((a) => a.id === highlighted);
        path.setAttribute('data-color', input.colorBy === 'pass' ? `series-${String(k + 1)}` : lit ? 'pass' : 'pass-dim');
        path.setAttribute('data-dim', String(!lit));
      }
      const key = this.keys[k];
      if (!key) return;
      const word = first ? (keys[first.id] ?? '') : '';
      key.setAttribute('visibility', keyAt && word ? 'visible' : 'hidden');
      if (!keyAt || !word) return;
      if (key.textContent !== word) key.textContent = word;
      key.setAttribute('data-color', path.getAttribute('data-color') ?? '');
      key.setAttribute('x', fmt(keyAt[0] + KEY_DX));
      key.setAttribute('y', fmt(keyAt[1]));
    });
    this.drawGuides(p, sky, input, arcs);
  }

  /** FR-WIDE-7: the highlighted pass's ticks across its line and its arrow along its travel, in its series' colour. */
  private drawGuides(p: Projector, sky: GlobeSky, input: ArcInput, arcs: readonly GlobeArc[]): void {
    const arc = arcs.find((a) => a.id === input.highlightedPassId);
    const pass = arc ? input.passes.find((q) => q.id === arc.id) : undefined;
    const guides = arc && pass ? arcGuides(sky, pass, input.t) : { ticks: [], arrow: null };
    const heading = (m: ArcMark): { x: number; y: number; hx: number; hy: number } | null => {
      const [x, y, z] = project(p, m.at);
      if (z <= 0) return null;
      const [bx, by] = project(p, m.back);
      const [ax, ay] = project(p, m.ahead);
      const len = Math.hypot(ax - bx, ay - by);
      return len > 0 ? { x, y, hx: (ax - bx) / len, hy: (ay - by) / len } : null;
    };
    let d = '';
    for (const tick of guides.ticks) {
      const h = heading(tick);
      if (h) d += `M${fmt(h.x - h.hy * TICK_HALF)} ${fmt(h.y + h.hx * TICK_HALF)}L${fmt(h.x + h.hy * TICK_HALF)} ${fmt(h.y - h.hx * TICK_HALF)}`;
    }
    this.ticks.setAttribute('d', d);
    const a = guides.arrow ? heading(guides.arrow) : null;
    this.arrow.setAttribute(
      'd',
      a ? `M${fmt(a.x + a.hx * ARROW_LEN)} ${fmt(a.y + a.hy * ARROW_LEN)}L${fmt(a.x - a.hy * ARROW_HALF)} ${fmt(a.y + a.hx * ARROW_HALF)}L${fmt(a.x + a.hy * ARROW_HALF)} ${fmt(a.y - a.hx * ARROW_HALF)}Z` : '',
    );
    const color = arc ? (this.series[arc.series - 1]?.getAttribute('data-color') ?? '') : '';
    this.ticks.setAttribute('data-color', color);
    this.arrow.setAttribute('data-color', color);
  }

  /** FR-WIDE-7: the pass whose drawn line is nearest a box point within `ARC_HIT_PX`, as last drawn, or `null`. */
  passAt(x: number, y: number): string | null {
    let best: string | null = null;
    let bestD = ARC_HIT_PX;
    for (const [id, runs] of this.drawn) {
      for (const run of runs) {
        for (let k = 0; k + 1 < run.length; k += 2) {
          const x1 = run[k] ?? 0;
          const y1 = run[k + 1] ?? 0;
          const dist = k + 3 < run.length ? segmentDistance(x, y, x1, y1, run[k + 2] ?? 0, run[k + 3] ?? 0) : Math.hypot(x - x1, y - y1);
          if (dist <= bestD) {
            bestD = dist;
            best = id;
          }
        }
      }
    }
    return best;
  }
}
