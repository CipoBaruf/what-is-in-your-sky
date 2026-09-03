/**
 * R16: the candidate compositions the findings file compares. Each is a diff
 * against `DEFAULTS`, so `toQuery` prints exactly what makes it different —
 * that string is what the findings table quotes and what the capture script
 * replays.
 */
import { withDefaults, type Params } from './params';

export interface Candidate {
  name: string;
  title: string;
  /** What this candidate is testing, one sentence, printed under its captures. */
  note: string;
  params: Params;
}

export const CANDIDATES: readonly Candidate[] = [
  {
    name: 'mono',
    title: 'A — mono, one scene (the R15 control)',
    note: 'The MVP reading with the v1 furniture: no base scene, no colour, ticks and time labels on. Every other candidate has to beat this one to be worth the work.',
    params: withDefaults({ base: false, colors: false, colorSet: 'mono', meridians: 'eight', tilt: 45, passDensity: 1, pulse: false }),
  },
  {
    name: 'lean',
    title: 'B — lean: colour, one scene',
    note: 'FR-DOME-2 colours in the line layer only; the ground and the sky bowl are dropped, so there is one rasterisation per frame. Cardinal meridians only, so the arcs own the drawing.',
    params: withDefaults({ base: false, colors: true, colorSet: 'cool', meridians: 'cardinal', tilt: 40, passDensity: 1, pulse: true }),
  },
  {
    name: 'layered',
    title: 'C — layered: the PLAN §8.7 proposal in full',
    note: 'Both scenes, the sky bowl lit from the Sun (FR-DOME-8a), eight meridians, the highlighted pass at double density (FR-DOME-8c), the pulse on the live marker (FR-DOME-8d).',
    params: withDefaults({ base: true, bowl: true, ground: true, colors: true, colorSet: 'cool', meridians: 'eight', tilt: 45, passDensity: 2, pulse: true }),
  },
  {
    name: 'layered-coarse',
    title: 'D — layered with the fallbacks on',
    note: 'C with the three PLAN fallbacks applied at once: base layer at a third of the line grid, `colorTolerance` 128, `interactiveDownscale` 2 through `setInteracting`, and the base layer dropped while dragging.',
    params: withDefaults({ base: true, bowl: true, ground: true, colors: true, colorSet: 'cool', meridians: 'eight', tilt: 50, passDensity: 2, pulse: true, baseRatio: 0.34, tol: 128, downscale: 2, dropBaseOnDrag: true }),
  },
  {
    name: 'ground-only',
    title: 'E — ground only, warm set',
    note: 'The base scene carries the ground disc and the Sun glow but no sky bowl, so the sky stays black and the second raster is nearly empty. Warm colour set, tilt at the low end of the FR-DOME-8 range.',
    params: withDefaults({ base: true, bowl: false, ground: true, colors: true, colorSet: 'warm', meridians: 'eight', tilt: 35, passDensity: 2, pulse: true }),
  },
];

export const candidate = (name: string): Candidate | undefined => CANDIDATES.find((c) => c.name === name);
