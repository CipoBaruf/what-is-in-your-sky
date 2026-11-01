import { MOON_DISC_PX } from '../../../../../data/stars/constants';
import type { MoonState } from '../../../../../model';
import { project, skyVector, type Mat3, type SkyPoint, type View } from './projection';
import styles from './SkyWindow.module.css';

/**
 * R155 (FR-LOOK-7, FR-DOME-6 as amended; V210-7; PLAN D-974): the Moon with
 * its phase. A disc of `MOON_DISC_PX` in `--chart-moon`: the dark part a
 * circle in `--chart-sky-deep` with a hairline rim, the lit part a path from
 * the illumination fraction the scene carries (FR-MOON-1) and the bright
 * limb's direction — the limb faces the Sun, so the path is built with the
 * Sun at +x and turned to where the Sun's side lies on the drawing, read off
 * the projection of a point a degree from the Moon toward the Sun
 * (`brightLimbPoint`, below); the projection is conformal, so the direction
 * at the Moon is the direction on the plane. A waning crescent at 28 % is a
 * crescent facing the Sun's side. The group keeps `data-body="moon"` and
 * `data-marker="moon"` where the window's tests and the legend's line look
 * for them. The limb point lives here and not in `useSkyBodies.ts`, which
 * D-974 named: that hook is `main`'s, and the sky vector it needs is the
 * window chunk's `projection.ts`, which `main` must not grow by (FR-LOOK-12,
 * D-985).
 */

/** How far from the Moon the limb point is taken, degrees: near enough that the projection is the direction at the Moon. */
const LIMB_STEP_DEG = 1;

/**
 * R155 (FR-LOOK-7, D-974): the bright limb's direction as a point on the sky — a degree from the Moon along the
 * great circle toward the Sun, where the lit side faces. The views project it beside the Moon and read the
 * direction between the two on the plane, so one rule serves the window and the whole sky (R158) whatever their
 * projection. `null` when the two are the same or opposite directions, which never happens.
 */
export function brightLimbPoint(moon: Pick<SkyPoint, 'azDeg' | 'elDeg'>, sun: { azDeg: number; altDeg: number }): SkyPoint | null {
  const m = skyVector(moon.azDeg, moon.elDeg);
  const s = skyVector(sun.azDeg, sun.altDeg);
  const along = m[0] * s[0] + m[1] * s[1] + m[2] * s[2];
  const t: [number, number, number] = [s[0] - along * m[0], s[1] - along * m[1], s[2] - along * m[2]];
  const n = Math.hypot(t[0], t[1], t[2]);
  if (n < 1e-9) return null;
  const rad = (LIMB_STEP_DEG * Math.PI) / 180;
  const c = Math.cos(rad);
  const k = Math.sin(rad) / n;
  const p: [number, number, number] = [c * m[0] + k * t[0], c * m[1] + k * t[1], c * m[2] + k * t[2]];
  const az = (Math.atan2(p[0], p[1]) * 180) / Math.PI;
  return { azDeg: ((az % 360) + 360) % 360, elDeg: (Math.asin(Math.max(-1, Math.min(1, p[2]))) * 180) / Math.PI };
}

const fmt = (n: number): string => n.toFixed(2);

/**
 * The lit part of a disc of radius `r` with the Sun at +x: the limb's semicircle through +x, then the
 * terminator — a half-ellipse of half-width `r × |2f − 1|`, bulging away from the Sun when more than half is lit
 * and toward it when less — back to the start. Full is the whole disc, new is nothing.
 */
export function litPath(fraction: number, r: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  const a = r * Math.abs(2 * f - 1);
  // From the top, clockwise on screen (y down) through +x to the bottom: sweep 1. Back up: the gibbous terminator
  // bulges to −x, which from the bottom is clockwise too (sweep 1); the crescent's bulges to +x (sweep 0).
  const sweep = f >= 0.5 ? 1 : 0;
  return `M0 ${fmt(-r)}A${fmt(r)} ${fmt(r)} 0 0 1 0 ${fmt(r)}A${fmt(a)} ${fmt(r)} 0 0 ${String(sweep)} 0 ${fmt(-r)}Z`;
}

/** The screen angle, degrees clockwise from +x, of the direction from `from` to `to`. */
export function limbAngleDeg(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

export interface MoonDiscProps {
  moon: MoonState;
  /** The point a degree from the Moon toward the Sun, or `null` without a Sun: then the lit side faces up. */
  limb: SkyPoint | null;
  m: Mat3;
  view: View;
}

export function MoonDisc({ moon, limb, m, view }: MoonDiscProps) {
  const at = project(m, moon.azDeg, moon.elDeg, view);
  const toward = limb === null ? null : project(m, limb.azDeg, limb.elDeg, view);
  const angle = toward === null ? -90 : limbAngleDeg(at, toward);
  const r = MOON_DISC_PX / 2;
  const inView = at.front && at.x >= -r && at.x <= view.width + r && at.y >= -r && at.y <= view.height + r;
  return (
    <g data-body="moon" data-phase={moon.phase} data-lit={moon.illuminatedFraction.toFixed(2)} data-limb={Math.round(angle)} transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`} data-in-view={inView} {...(inView ? {} : { visibility: 'hidden' as const })}>
      <circle className={styles.moonDark} data-marker="moon" r={r} />
      <path className={styles.moonLit} data-moon-lit d={litPath(moon.illuminatedFraction, r)} transform={`rotate(${angle.toFixed(1)})`} />
    </g>
  );
}
