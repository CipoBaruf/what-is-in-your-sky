import { describe, expect, it } from 'vitest';
import { starCatalog } from '../../../../../data/stars/catalog';
import type { Observer } from '../../../../../model';
import { GLOBE_OPEN_ALT_DEG } from './constants';
import {
  coordsIn,
  cross,
  dot,
  dragTurn,
  ECLIPTIC_POLE,
  EQUATORIAL,
  greatCircle,
  groundPath,
  localFrame,
  meridian,
  normalize,
  openView,
  parallel,
  pathOf,
  project,
  projector,
  radec,
  scale,
  unproject,
  viewAxes,
  type Frame,
  type GlobeView,
  type Vec3,
} from './projection';
import { globeSky } from './scene';

/**
 * R167 (FR-GLOBE-2, FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-17; PLAN §9.14, D-1036):
 * the globe's projection by numbers — the centre and the rim, the far side, the
 * mirror's sign, a frame switch keeping the centre, a drag keeping the grabbed
 * point and the ±90° clamp, the opening view north and south of the equator.
 */

const CX = 400;
const CY = 300;
const R = 240;

const place = (lat: number, lon: number): Observer => ({ lat, lon, altM: 0, label: `${lat}, ${lon}`, source: 'coords', timeZone: null });
const BUENOS_AIRES = place(-34.6, -58.38);
const LONDON = place(51.51, -0.13);
const QUITO = place(-0.18, -78.47);
const T = Date.parse('2026-11-04T01:00:00Z');
const HOUR = 3_600_000;

const angleDeg = (a: Vec3, b: Vec3): number => (Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))) * 180) / Math.PI;

describe('the projection (FR-GLOBE-2)', () => {
  const view: GlobeView = { frame: EQUATORIAL, lon: 83, lat: 10 };
  const p = projector(view, CX, CY, R);

  it('puts the view’s centre at the box’s centre, a direction 90° off on the rim, and one behind on the far side', () => {
    const [x, y, depth] = project(p, p.axes.c);
    expect(x).toBeCloseTo(CX, 9);
    expect(y).toBeCloseTo(CY, 9);
    expect(depth).toBeCloseTo(1, 12);
    // Every direction 90° from the centre lands on the rim at depth 0.
    for (const s of greatCircle(p.axes.c, 36)) {
      const [rx, ry, rz] = project(p, s);
      expect(Math.hypot(rx - CX, ry - CY)).toBeCloseTo(R, 6);
      expect(rz).toBeCloseTo(0, 9);
    }
    // Behind: negative depth, and a polyline there draws nothing.
    expect(project(p, [-p.axes.c[0], -p.axes.c[1], -p.axes.c[2]])[2]).toBeCloseTo(-1, 12);
    expect(pathOf(p, greatCircle(p.axes.c, 36).map((s) => normalize([s[0] - p.axes.c[0], s[1] - p.axes.c[1], s[2] - p.axes.c[2]])))).toBe('');
  });

  it('draws a polyline’s near side only, one pen stroke per near run', () => {
    // The meridian through the centre's far side and back: its near half is one run.
    const ring = greatCircle(p.axes.r, 72);
    const d = pathOf(p, ring);
    expect(d.match(/M/g)?.length ?? 0).toBeLessThanOrEqual(2);
    expect(d.length).toBeGreaterThan(0);
    for (const m of d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) expect(Math.hypot(Number(m[1]) - CX, Number(m[2]) - CY)).toBeLessThanOrEqual(R + 0.1);
  });

  it('screen up is the frame’s pole, screen right growing longitude, and the axes are orthonormal at every latitude', () => {
    for (const lat of [-90, -89.99, -45, 0, 30, 89.99, 90]) {
      const { r, u, c } = viewAxes(EQUATORIAL, 120, lat);
      expect(dot(r, r)).toBeCloseTo(1, 12);
      expect(dot(u, u)).toBeCloseTo(1, 12);
      expect(dot(c, c)).toBeCloseTo(1, 12);
      expect(dot(r, u)).toBeCloseTo(0, 12);
      expect(dot(r, c)).toBeCloseTo(0, 12);
      expect(dot(u, c)).toBeCloseTo(0, 12);
      // Right-handed as the spike's: r = u × c.
      const rc = cross(u, c);
      expect(angleDeg(rc, r)).toBeLessThan(1e-6);
      if (Math.abs(lat) < 90) expect(dot(u, EQUATORIAL.pole)).toBeGreaterThan(0);
    }
    const flat = projector({ frame: EQUATORIAL, lon: 0, lat: 0 }, CX, CY, R);
    expect(project(flat, radec(0, 90))[1]).toBeCloseTo(CY - R, 9); // the north celestial pole straight up
    expect(project(flat, radec(90, 0))[0]).toBeCloseTo(CX + R, 9); // RA 6 h to the right
  });

  it('mirrors the figures as a globe does: facing Orion from outside, Betelgeuse is right of Rigel’s meridian (V212-3)', () => {
    const catalog = starCatalog();
    const betelgeuse = catalog.name.indexOf('Betelgeuse');
    const rigel = catalog.name.indexOf('Rigel');
    const dirOf = (i: number): Vec3 => radec(catalog.ra[i] ?? 0, catalog.dec[i] ?? 0);
    const orion = projector({ frame: EQUATORIAL, lon: 83.8, lat: 0 }, CX, CY, R);
    const [bx, by] = project(orion, dirOf(betelgeuse));
    const [rx, ry] = project(orion, dirOf(rigel));
    expect(by).toBeLessThan(ry); // Betelgeuse above Rigel, as everywhere
    expect(bx).toBeGreaterThan(rx);
    // Right of the meridian of Rigel's right ascension at Betelgeuse's declination, not only of Rigel itself.
    const onMeridian = project(orion, radec(catalog.ra[rigel] ?? 0, catalog.dec[betelgeuse] ?? 0));
    expect(bx).toBeGreaterThan(onMeridian[0]);
    // From the ground, facing south at Orion's transit, Betelgeuse (east of Rigel) is on the left: the globe is the mirror of that.
    const along = (catalog.ra[betelgeuse] ?? 0) - (catalog.ra[rigel] ?? 0);
    expect(along).toBeGreaterThan(0);
  });

  it('the helpers: great circles, parallels and meridians lie where they say, the ecliptic’s pole at its obliquity', () => {
    const pole = radec(40, 20);
    for (const s of greatCircle(pole, 24)) expect(dot(s, pole)).toBeCloseTo(0, 12);
    for (const s of parallel(30, 24)) expect(s[2]).toBeCloseTo(Math.sin(Math.PI / 6), 12);
    const m = meridian(45, 10);
    expect(m[0]?.[2]).toBeCloseTo(-1, 12);
    expect(m.at(-1)?.[2]).toBeCloseTo(1, 12);
    expect(angleDeg(ECLIPTIC_POLE, [0, 0, 1])).toBeCloseTo(23.4393, 6);
    // The equinox is on the ecliptic.
    expect(dot(ECLIPTIC_POLE, [1, 0, 0])).toBeCloseTo(0, 12);
  });
});

describe('the ground’s region (FR-GLOBE-3)', () => {
  it('is empty when the zenith faces the viewer, the whole disc when it faces away, and a closed half-lens otherwise', () => {
    const p = projector({ frame: EQUATORIAL, lon: 10, lat: 20 }, CX, CY, R);
    const c = p.axes.c;
    expect(groundPath(p, c)).toBe('');
    expect(groundPath(p, [-c[0], -c[1], -c[2]])).toMatch(/^M.*a.*a.*Z$/);
    const d = groundPath(p, p.axes.u, 8);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // Zenith straight up: the ground is the lower half, every vertex at or below the centre line.
    for (const m of d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
      expect(Number(m[2])).toBeGreaterThanOrEqual(CY - 0.1);
      expect(Math.hypot(Number(m[1]) - CX, Number(m[2]) - CY)).toBeLessThanOrEqual(R + 0.1);
    }
  });
});

describe('the two frames (FR-GLOBE-5)', () => {
  const sky = globeSky(BUENOS_AIRES, T);
  const local = sky.frame;

  it('the local frame is the zenith up and the north point at longitude 0, growing west', () => {
    expect(localFrame(sky.zenith, sky.north)).toEqual(local);
    expect(angleDeg(viewAxes(local, 0, 0).c, sky.north)).toBeLessThan(1e-9);
    expect(angleDeg(viewAxes(local, 180, 0).c, scale(sky.north, -1))).toBeLessThan(1e-5);
    expect(angleDeg(viewAxes(local, -90, 0).c, sky.east)).toBeLessThan(1e-5);
    expect(angleDeg(viewAxes(local, 0, 90).c, sky.zenith)).toBeLessThan(1e-9);
  });

  it('a switch keeps the direction at the view’s centre to 1e-9, both ways', () => {
    const cases: [Frame, Frame][] = [
      [local, EQUATORIAL],
      [EQUATORIAL, local],
    ];
    for (const [from, to] of cases) {
      for (const [lon, lat] of [
        [0, 0],
        [180, 25],
        [-73.4, -61.2],
        [271, 89],
        [33, -89.9],
      ] as const) {
        const before = viewAxes(from, lon, lat).c;
        const there = coordsIn(to, from, lon, lat);
        const after = viewAxes(to, there.lon, there.lat).c;
        for (let k = 0; k < 3; k += 1) expect(Math.abs((after[k] ?? 0) - (before[k] ?? 0))).toBeLessThan(1e-9);
        // And back again.
        const back = coordsIn(from, to, there.lon, there.lat);
        const again = viewAxes(from, back.lon, back.lat).c;
        for (let k = 0; k < 3; k += 1) expect(Math.abs((again[k] ?? 0) - (before[k] ?? 0))).toBeLessThan(1e-9);
      }
    }
  });

  it('with you, the zenith’s screen position holds across an hour; with the stars, a star’s does', () => {
    const later = globeSky(BUENOS_AIRES, T + HOUR);
    const view = { lon: 180, lat: 25 };
    const zNow = project(projector({ frame: sky.frame, ...view }, CX, CY, R), sky.zenith);
    const zLater = project(projector({ frame: later.frame, ...view }, CX, CY, R), later.zenith);
    expect(Math.hypot(zNow[0] - zLater[0], zNow[1] - zLater[1])).toBeLessThan(1e-6);

    const sirius = radec(101.287, -16.716);
    const stars = projector({ frame: EQUATORIAL, ...view }, CX, CY, R);
    expect(project(stars, sirius)).toEqual(project(stars, sirius)); // the frame does not read the instant at all
    // With you, the same star wheels: it moves on the screen across the hour.
    const sNow = project(projector({ frame: sky.frame, ...view }, CX, CY, R), sirius);
    const sLater = project(projector({ frame: later.frame, ...view }, CX, CY, R), sirius);
    expect(Math.hypot(sNow[0] - sLater[0], sNow[1] - sLater[1])).toBeGreaterThan(10);
    // With the stars, the zenith sweeps instead.
    const zs = project(stars, sky.zenith);
    const zsLater = project(stars, later.zenith);
    expect(Math.hypot(zs[0] - zsLater[0], zs[1] - zsLater[1])).toBeGreaterThan(10);
  });
});

describe('a drag (FR-GLOBE-6)', () => {
  // A fixed sequence, so a failure names its case.
  let seed = 167;
  const random = (): number => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const inside = (share: number): [number, number] => {
    const rr = R * share * Math.sqrt(random());
    const th = random() * 2 * Math.PI;
    return [CX + rr * Math.cos(th), CY + rr * Math.sin(th)];
  };

  it('keeps the grabbed point within 0.5 px of the pointer for drags ending inside 0.8 of the radius', () => {
    const frames: Frame[] = [EQUATORIAL, globeSky(LONDON, T).frame];
    let checked = 0;
    for (let n = 0; n < 400; n += 1) {
      const frame = frames[n % 2] ?? EQUATORIAL;
      const p = projector({ frame, lon: random() * 360 - 180, lat: random() * 120 - 60 }, CX, CY, R);
      const from = inside(0.8);
      const to = inside(0.8);
      const grabbed = unproject(p, from[0], from[1]);
      const next = dragTurn(p, from, to);
      if (Math.abs(next.lat) >= 90) continue; // the clamp binds: the next case covers it
      // With the pole kept up, a point at frame latitude φ is never further than cos φ from the screen’s vertical: no turn takes it there.
      if (Math.abs((to[0] - CX) / R) > Math.sqrt(1 - dot(grabbed, frame.pole) ** 2)) continue;
      const [x, y] = project(projector({ frame, ...next }, CX, CY, R), grabbed);
      expect(Math.hypot(x - to[0], y - to[1]), `case ${n}`).toBeLessThan(0.5);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(250);
  });

  it('follows a slow drag step by step, as the pointer writes it once a frame', () => {
    let view: GlobeView = { frame: EQUATORIAL, lon: 30, lat: 0 };
    const from: [number, number] = [CX - 100, CY + 50];
    const grabbed = unproject(projector(view, CX, CY, R), from[0], from[1]);
    let at = from;
    for (let k = 1; k <= 30; k += 1) {
      const to: [number, number] = [from[0] + k * 6, from[1] - k * 3];
      view = { ...view, ...dragTurn(projector(view, CX, CY, R), at, to) };
      at = to;
    }
    const [x, y] = project(projector(view, CX, CY, R), grabbed);
    expect(Math.hypot(x - at[0], y - at[1])).toBeLessThan(0.5);
  });

  it('clamps the latitude to ±90°, so the globe never turns over its pole', () => {
    const p = projector({ frame: EQUATORIAL, lon: 0, lat: 80 }, CX, CY, R);
    // Dragging down hard pulls the north pole toward the viewer and past it.
    const down = dragTurn(p, [CX, CY - 0.7 * R], [CX, CY + 0.7 * R]);
    expect(down.lat).toBe(90);
    const q = projector({ frame: EQUATORIAL, lon: 0, lat: -80 }, CX, CY, R);
    const up = dragTurn(q, [CX, CY + 0.7 * R], [CX, CY - 0.7 * R]);
    expect(up.lat).toBe(-90);
    // A sideways drag turns the longitude and leaves the latitude alone.
    const side = dragTurn(projector({ frame: EQUATORIAL, lon: 0, lat: 0 }, CX, CY, R), [CX, CY], [CX + R / 2, CY]);
    expect(side.lat).toBeCloseTo(0, 9);
    expect(side.lon).toBeCloseTo(-30, 9); // the content follows the hand: the centre's longitude falls behind it
  });

  it('a drag of nothing changes nothing', () => {
    const p = projector({ frame: EQUATORIAL, lon: 123, lat: -45 }, CX, CY, R);
    const same = dragTurn(p, [CX + 40, CY - 70], [CX + 40, CY - 70]);
    expect(same.lon).toBeCloseTo(123, 9);
    expect(same.lat).toBeCloseTo(-45, 9);
  });
});

describe('the opening view (D-1036)', () => {
  it('faces the visible pole, GLOBE_OPEN_ALT_DEG up, north and south of the equator', () => {
    for (const [where, lon, pole] of [
      [BUENOS_AIRES, 180, -1],
      [QUITO, 180, -1],
      [LONDON, 0, 1],
      [place(0, 10), 0, 1],
    ] as const) {
      const sky = globeSky(where, T);
      const view = openView(sky);
      expect(view).toEqual({ frame: sky.frame, lon, lat: GLOBE_OPEN_ALT_DEG });
      const p = projector(view, CX, CY, R);
      // The zenith is straight up, on the near side.
      const [zx, zy, zd] = project(p, sky.zenith);
      expect(zx).toBeCloseTo(CX, 6);
      expect(zy).toBeLessThan(CY);
      expect(zd).toBeGreaterThan(0);
      // The visible celestial pole is on the near side, on the screen's vertical through the centre.
      const [px, , pd] = project(p, [0, 0, pole]);
      expect(pd).toBeGreaterThan(0);
      expect(Math.abs(px - CX)).toBeLessThan(R * 0.01);
    }
  });
});
