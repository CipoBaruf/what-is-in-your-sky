import { describe, expect, it } from 'vitest';
import { ARC_LINGER_MS, ARC_LOOKAHEAD_MS } from '../../../../../physics/constants';
import type { Pass, PassPoint } from '../../../../../model';
import { arcGuides, globeArcs, horizonDir } from './arcs';
import { ARC_ARROW_SHARE, ARC_TICK_MIN } from './constants';
import { altAz, globeSky } from './scene';
import type { Vec3 } from './projection';

/** R184 (FR-WIDE-3, FR-WIDE-7, FR-TRAJ-1; D-1099): a fixed pass's polyline, ticks and arrow on the globe. */

const PLACE = { lat: -41.13, lon: -71.31, altM: 0 };
const START = Date.UTC(2026, 10, 4, 23, 30, 0);
/** 6 min 10 s, west to east over the north, 10 s samples: 38 points. */
const DURATION_MS = 370_000;

function trackPoint(ms: number): PassPoint {
  const f = (ms - START) / DURATION_MS;
  return { t: ms, azDeg: 270 + 180 * f > 360 ? 270 + 180 * f - 360 : 270 + 180 * f, elDeg: 10 + 60 * Math.sin(Math.PI * f), rangeKm: 800 };
}

const track = Array.from({ length: DURATION_MS / 10_000 + 1 }, (_, k) => trackPoint(START + k * 10_000));
const pass = (id: string, offsetMs = 0): Pass =>
  ({
    id,
    track: track.map((p) => ({ ...p, t: p.t + offsetMs })),
    start: { ...track[0], t: START + offsetMs },
    peak: track[18],
    end: { ...track[track.length - 1], t: START + DURATION_MS + offsetMs },
  }) as unknown as Pass;

const close = (a: Vec3 | null | undefined, b: Vec3): void => {
  expect(a).not.toBeNull();
  for (let i = 0; i < 3; i += 1) expect(a?.[i]).toBeCloseTo(b[i] ?? 0, 9);
};

describe('globe/arcs (FR-WIDE-3, FR-TRAJ-1)', () => {
  it('FR-WIDE-3: turns a track point into the direction altAz reads back', () => {
    const sky = globeSky(PLACE, START);
    for (const p of [track[0], track[18], track[37]]) {
      if (!p) continue;
      const back = altAz(sky, horizonDir(sky, p.azDeg, p.elDeg));
      expect(back.altDeg).toBeCloseTo(p.elDeg, 9);
      expect(back.azDeg).toBeCloseTo(p.azDeg % 360, 9);
    }
  });

  it('FR-WIDE-3: draws a fixed pass at three instants of FR-TRAJ-1’s states', () => {
    const p = pass('a');
    // Ahead: the whole arc, the rise marked, no marker.
    const tAhead = START - ARC_LOOKAHEAD_MS / 2;
    const [ahead] = globeArcs(globeSky(PLACE, tAhead), [p], tAhead);
    expect(ahead?.state).toBe('ahead');
    expect(ahead?.points).toHaveLength(track.length);
    expect(ahead?.marker).toBeNull();
    close(ahead?.rise, ahead?.points[0] ?? [0, 0, 0]);
    // Live, 2 min 35 s in: the samples to `t` and the interpolated point at it, which is the marker.
    const tLive = START + 155_000;
    const sky = globeSky(PLACE, tLive);
    const [live] = globeArcs(sky, [p], tLive);
    expect(live?.state).toBe('live');
    expect(live?.points).toHaveLength(17);
    const at = trackPoint(tLive);
    const marker = altAz(sky, live?.marker ?? [0, 0, 0]);
    expect(Math.abs(marker.altDeg - at.elDeg)).toBeLessThan(0.05);
    expect(Math.abs(marker.azDeg - at.azDeg)).toBeLessThan(0.1);
    close(live?.marker, live?.points[16] ?? [0, 0, 0]);
    expect(live?.rise).toBeNull();
    // Lingering: the whole arc, no marker; past the linger it is gone.
    const tLinger = START + DURATION_MS + ARC_LINGER_MS / 2;
    const [linger] = globeArcs(globeSky(PLACE, tLinger), [p], tLinger);
    expect(linger?.state).toBe('linger');
    expect(linger?.points).toHaveLength(track.length);
    expect(linger?.marker).toBeNull();
    const tGone = START + DURATION_MS + ARC_LINGER_MS + 1;
    expect(globeArcs(globeSky(PLACE, tGone), [p], tGone)).toEqual([]);
  });

  it('keeps each pass’s series by its index in the list, a hidden one included, cycling past six', () => {
    const far = 24 * 3600_000;
    const passes = [pass('a'), pass('hidden', far), ...Array.from({ length: 6 }, (_, k) => pass(`p${String(k)}`))];
    const arcs = globeArcs(globeSky(PLACE, START + 60_000), passes, START + 60_000);
    expect(arcs.map((a) => [a.id, a.series])).toEqual([['a', 1], ['p0', 3], ['p1', 4], ['p2', 5], ['p3', 6], ['p4', 1], ['p5', 2]]);
  });
});

describe('globe/arcs guides (FR-WIDE-7)', () => {
  it('puts a tick at every whole ARC_TICK_MIN of the drawn part, and the arrow at ARC_ARROW_SHARE of it', () => {
    const p = pass('a');
    const t = START - 60_000;
    const sky = globeSky(PLACE, t);
    const { ticks, arrow } = arcGuides(sky, p, t);
    // 6 min 10 s: ticks at 1..6 min.
    expect(ticks).toHaveLength(Math.floor(DURATION_MS / (ARC_TICK_MIN * 60_000)));
    ticks.forEach((tick, k) => {
      const want = trackPoint(START + (k + 1) * ARC_TICK_MIN * 60_000);
      close(tick.at, horizonDir(sky, want.azDeg, want.elDeg));
      // The heading points along the travel: `ahead` is later on the track than `back`.
      expect(altAz(sky, tick.ahead).azDeg).toBeGreaterThan(altAz(sky, tick.back).azDeg - (k >= 3 ? 360 : 0));
    });
    const mid = trackPoint(START + ARC_ARROW_SHARE * DURATION_MS);
    const arrowAt = altAz(sky, arrow?.at ?? [0, 0, 0]);
    expect(arrowAt.altDeg).toBeCloseTo(mid.elDeg, 1);
    expect(Math.abs(arrowAt.azDeg - mid.azDeg)).toBeLessThan(0.1);
  });

  it('while the pass is up, ticks only the part drawn and puts the arrow at the marker', () => {
    const p = pass('a');
    const t = START + 155_000;
    const sky = globeSky(PLACE, t);
    const { ticks, arrow } = arcGuides(sky, p, t);
    expect(ticks).toHaveLength(2);
    const [live] = globeArcs(sky, [p], t);
    close(arrow?.at, live?.marker ?? [0, 0, 0]);
  });

  it('has none for a pass not drawn', () => {
    const t = START + DURATION_MS + ARC_LINGER_MS + 1;
    expect(arcGuides(globeSky(PLACE, t), pass('a'), t)).toEqual({ ticks: [], arrow: null });
  });
});
