/**
 * R16 fixtures: the two passes FR-DOME-8 names — the R1 golden grazing pass
 * and R14's synthetic high pass (both from `spike/passes.ts`) — plus dim
 * companion passes, so a candidate is judged with the FR-LIVE-2 load on it
 * and not with one lonely arc.
 */
import type { Pass, PassPoint } from '../../src/model';
import { PASSES } from '../passes';

const rotate = (pass: Pass, byDeg: number, name: string, shiftMs: number): Pass => {
  const move = (p: PassPoint): PassPoint => ({ ...p, t: p.t + shiftMs, azDeg: (((p.azDeg + byDeg) % 360) + 360) % 360 });
  return { ...pass, id: `${pass.id}-${name}`, name, start: move(pass.start), peak: move(pass.peak), end: move(pass.end), track: pass.track.map(move) };
};

const flatten = (pass: Pass, factor: number): Pass => {
  const squash = (p: PassPoint): PassPoint => ({ ...p, elDeg: 10 + (p.elDeg - 10) * factor });
  return { ...pass, start: squash(pass.start), peak: squash(pass.peak), end: squash(pass.end), track: pass.track.map(squash) };
};

const high = PASSES['high'];
const golden = PASSES['golden'];
if (!high || !golden) throw new Error('spike fixtures missing');

/** Companions: the same geometry turned and flattened, so they read as other satellites without new physics. */
export const OTHER_PASSES: readonly Pass[] = [flatten(rotate(high, 140, 'STARLINK-1130', 900_000), 0.55), flatten(rotate(high, 245, 'COSMOS 1408', -1_500_000), 0.35), flatten(rotate(golden, 95, 'TIANGONG', 2_400_000), 1.6)];

export const FIXTURE_PASSES: Record<string, Pass> = { golden, high };

export const passFor = (name: string): Pass => FIXTURE_PASSES[name] ?? golden;

/** The dim companions a composition asks for, at most as many as exist. */
export const othersFor = (count: number): Pass[] => OTHER_PASSES.slice(0, Math.max(0, count));
