/**
 * R111 (FR-STAR-6, FR-STAR-9): the field, drawn two ways from one `Frame`.
 * `ReactField` takes the rotation as a prop and re-renders every node, as
 * `SkyWindow` draws today; `RefField` renders its nodes once and `draw()`
 * writes their positions and visibility outside render. Every node exists once
 * in both and is toggled by `visibility`, the window's stable-DOM rule.
 */
import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import type { Mat3, View } from '../../src/ui/components/guide/skychart/window/projection';
import type { Catalog } from './catalogData';
import { computeFrame, type Frame, type Label, type Rung } from './frame';
import { discRadius, type AltAz, type PlanetAt } from './sky';

export interface FieldProps {
  catalog: Catalog;
  stars: readonly AltAz[];
  planets: readonly PlanetAt[];
  labels: readonly Label[];
  ladder: readonly Rung[];
  view: View;
  mark: 'glyph' | 'disc';
  options: { mag: number; small: number; collide: number; layers: readonly string[] };
  onDrawn: () => void;
}

const vis = (show: boolean): 'visible' | 'hidden' => (show ? 'visible' : 'hidden');

/** Each figure's first index into `Frame.segments`, once per catalogue, so a render does no counting. */
const offsets = new WeakMap<Catalog, number[]>();
function segmentOffsets(catalog: Catalog): number[] {
  let list = offsets.get(catalog);
  if (!list) {
    list = [];
    let n = 0;
    for (const f of catalog.figures) {
      list.push(n);
      n += f.segments.length;
    }
    offsets.set(catalog, list);
  }
  return list;
}

function Marks({ props, frame }: { props: FieldProps; frame: Frame | null }): ReactElement {
  const { catalog, planets, labels, ladder, mark, options } = props;
  const first = segmentOffsets(catalog);
  return (
    <>
      <path className="horizon" d={frame?.horizon ?? ''} />
      <g className="figures">
        {catalog.figures.flatMap((f, fi) =>
          f.segments.map((_, si) => {
            const k = (first[fi] ?? 0) + si;
            const s = frame?.segments[k];
            return <line key={`${f.id}-${String(si)}`} data-k={k} x1={s?.x1 ?? 0} y1={s?.y1 ?? 0} x2={s?.x2 ?? 0} y2={s?.y2 ?? 0} visibility={vis(s?.show ?? false)} />;
          }),
        )}
      </g>
      <g className="stars">
        {catalog.stars.map((star, i) => {
          const p = frame?.stars[i];
          const g = ladder[i];
          if (mark === 'disc')
            return <circle key={star.hr} data-k={i} className={g?.tone} cx={p?.x ?? 0} cy={p?.y ?? 0} r={discRadius(star.v)} visibility={vis(p?.show ?? false)} />;
          return (
            <text key={star.hr} data-k={i} className={g?.tone} x={p?.x ?? 0} y={p?.y ?? 0} dx={g?.dx} dy={g?.dy} fontSize={g?.px} visibility={vis(p?.show ?? false)}>
              {g?.char}
            </text>
          );
        })}
      </g>
      <g className="planets">
        {planets.map((planet, i) => {
          const p = frame?.planets[i];
          if (mark === 'disc') return <circle key={planet.body} data-k={i} className="planet" cx={p?.x ?? 0} cy={p?.y ?? 0} r={2.6} visibility={vis(p?.show ?? false)} />;
          return (
            <text key={planet.body} data-k={i} className="planet" x={p?.x ?? 0} y={p?.y ?? 0} fontSize={options.small} visibility={vis(p?.show ?? false)}>
              @
            </text>
          );
        })}
      </g>
      <g className="labels">
        {labels.map((label, i) => {
          const p = frame?.labels[i];
          return (
            <text key={`${label.text}-${String(i)}`} data-k={i} x={p?.x ?? 0} y={p?.y ?? 0} fontSize={options.small} visibility={vis(p?.show ?? false)}>
              {label.text}
            </text>
          );
        })}
      </g>
    </>
  );
}

/** Positions through React: a new rotation is a render of every node. */
export const ReactField = memo(function ReactField(props: FieldProps & { rotation: Mat3 }): ReactElement {
  const { catalog, stars, planets, labels, rotation, view, options, onDrawn } = props;
  const frame = useMemo(() => computeFrame(catalog, stars, planets, labels, rotation, view, options), [catalog, stars, planets, labels, rotation, view, options]);
  useLayoutEffect(() => {
    onDrawn();
  }, [frame, onDrawn]);
  return (
    <svg className="field" width={view.width} height={view.height} aria-hidden="true">
      <Marks props={props} frame={frame} />
    </svg>
  );
});

export interface RefFieldHandle {
  draw: (rotation: Mat3) => void;
}

/** Positions by ref: React renders the nodes once; `draw` writes `x`/`y`/`visibility` to them. */
export const RefField = memo(
  forwardRef<RefFieldHandle, FieldProps>(function RefField(props, handle): ReactElement {
    const svg = useRef<SVGSVGElement>(null);
    const nodes = useRef<{ horizon: SVGPathElement; lines: SVGLineElement[]; stars: SVGElement[]; planets: SVGElement[]; labels: SVGTextElement[] } | null>(null);
    const latest = useRef(props);
    useLayoutEffect(() => {
      latest.current = props;
    });
    useImperativeHandle(
      handle,
      () => ({
        draw(rotation: Mat3) {
          const root = svg.current;
          if (!root) return;
          const p = latest.current;
          const frame = computeFrame(p.catalog, p.stars, p.planets, p.labels, rotation, p.view, p.options);
          const xy = p.mark === 'disc' ? (['cx', 'cy'] as const) : (['x', 'y'] as const);
          nodes.current ??= {
            horizon: root.querySelector('path.horizon') as SVGPathElement,
            lines: [...root.querySelectorAll<SVGLineElement>('g.figures > line')],
            stars: [...root.querySelectorAll<SVGElement>('g.stars > *')],
            planets: [...root.querySelectorAll<SVGElement>('g.planets > *')],
            labels: [...root.querySelectorAll<SVGTextElement>('g.labels > text')],
          };
          const n = nodes.current;
          n.horizon.setAttribute('d', frame.horizon);
          n.lines.forEach((node, k) => {
            const s = frame.segments[k];
            if (!s) return;
            node.setAttribute('visibility', vis(s.show));
            if (!s.show) return;
            node.setAttribute('x1', s.x1.toFixed(1));
            node.setAttribute('y1', s.y1.toFixed(1));
            node.setAttribute('x2', s.x2.toFixed(1));
            node.setAttribute('y2', s.y2.toFixed(1));
          });
          const write = (list: SVGElement[], points: Frame['stars'], a: string, b: string): void => {
            list.forEach((node, k) => {
              const q = points[k];
              if (!q) return;
              node.setAttribute('visibility', vis(q.show));
              if (!q.show) return;
              node.setAttribute(a, q.x.toFixed(1));
              node.setAttribute(b, q.y.toFixed(1));
            });
          };
          write(n.stars, frame.stars, xy[0], xy[1]);
          write(n.planets, frame.planets, xy[0], xy[1]);
          write(n.labels, frame.labels, 'x', 'y');
          p.onDrawn();
        },
      }),
      [],
    );
    const { view } = props;
    return (
      <svg ref={svg} className="field" width={view.width} height={view.height} aria-hidden="true">
        <Marks props={props} frame={null} />
      </svg>
    );
  }),
);
