/**
 * D-1027: the following window held still, measured. A synthetic iPhone — the W3C Euler angles of a true pose with
 * hand tremor, alpha relative to where the page loaded, a noisy `webkitCompassHeading` — is fed through the sensor
 * path at iOS Chrome's 10 readings a second (Safari's 60 too), drawn at 60 frames a second, and the drawn look's
 * wobble is read off.
 */
import { describe, expect, it } from 'vitest';
import { alphaFor, calibrationSample, converged, followLiftRotation, lookDirection, OffsetEstimate, RotationFilter, rotationMatrix, smoothRotation, uprightRotation, WINDOW_SMOOTHING, type Mat3, type WindowReading } from './projection';
import { quarterTurnFor, type Quarter } from './screenTurn';

const RAD = Math.PI / 180;

/** A seeded generator, so every run reads the same hand. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(next: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(next() || 1e-12)) * Math.cos(2 * Math.PI * next());
}

/** The W3C decomposition (Z-X'-Y'', beta in [−180, 180), gamma in [−90, 90)), as a platform reports it. */
function eulerOf(m: Mat3): { alpha: number; beta: number; gamma: number } {
  const r20 = m[2][0];
  const r22 = m[2][2];
  let gamma = Math.abs(r22) < 1e-12 ? -Math.sign(r20) * 90 : Math.atan(-r20 / r22) / RAD;
  if (gamma >= 90) gamma -= 180;
  const g = gamma * RAD;
  const cB = Math.abs(Math.cos(g)) > 1e-6 ? r22 / Math.cos(g) : -r20 / Math.sin(g);
  const beta = Math.atan2(m[2][1], cB) / RAD;
  const s = cB < 0 ? -1 : 1;
  const alpha = (((Math.atan2(-m[0][1] * s, m[1][1] * s) / RAD) % 360) + 360) % 360;
  return { alpha, beta, gamma };
}

/** The phone's own roll about the look: a turn about device Z, applied on the device side. */
function rolled(m: Mat3, rollDeg: number): Mat3 {
  const c = Math.cos(rollDeg * RAD);
  const s = Math.sin(rollDeg * RAD);
  const row = (r: readonly [number, number, number]): [number, number, number] => [r[0] * c + r[1] * s, -r[0] * s + r[1] * c, r[2]];
  return [row(m[0]), row(m[1]), row(m[2])];
}

interface Pipeline {
  reading(r: WindowReading): void;
  frame(tMs: number): Mat3 | null;
}

/**
 * The sensor path before D-1027, as `useDeviceOrientation` ran it: the calibration as `360 − heading − alpha` while beta
 * was in [45, 135], a running mean at 0.1 a sample for ever, and `WINDOW_SMOOTHING` a frame.
 */
function before(): Pipeline {
  let x = 0;
  let y = 0;
  let count = 0;
  let latest: WindowReading | null = null;
  let smoothed: Mat3 | null = null;
  return {
    reading(r) {
      const { alpha, beta, webkitCompassHeading: webkit } = r;
      if (alpha !== null && beta !== null && webkit !== null && beta >= 45 && beta <= 135) {
        const sample = (360 - webkit - alpha) * RAD;
        const w = count === 0 ? 1 : 0.1;
        x = (1 - w) * x + w * Math.cos(sample);
        y = (1 - w) * y + w * Math.sin(sample);
        count += 1;
      }
      latest = r;
    },
    frame() {
      if (!latest) return smoothed;
      const alpha = alphaFor(latest, count === 0 ? null : Math.atan2(y, x) / RAD, 0);
      if (alpha === null || latest.beta === null || latest.gamma === null) return smoothed;
      const target = rotationMatrix(alpha, latest.beta, latest.gamma);
      if (smoothed && converged(smoothed, target)) return smoothed;
      smoothed = smoothRotation(smoothed, target, WINDOW_SMOOTHING);
      return smoothed;
    },
  };
}

/** The sensor path after D-1027, as `useDeviceOrientation` runs it. */
function after(filter = new RotationFilter()): Pipeline {
  const offset = new OffsetEstimate();
  let latest: WindowReading | null = null;
  let smoothed: Mat3 | null = null;
  return {
    reading(r) {
      const sample = calibrationSample(r);
      if (sample !== null) offset.add(sample);
      latest = r;
    },
    frame(tMs) {
      if (!latest) return smoothed;
      const alpha = alphaFor(latest, offset.get(), 0);
      if (alpha === null || latest.beta === null || latest.gamma === null) return smoothed;
      const target = rotationMatrix(alpha, latest.beta, latest.gamma);
      if (smoothed && converged(smoothed, target)) {
        filter.rest();
        return smoothed;
      }
      smoothed = filter.step(target, tMs);
      return smoothed;
    },
  };
}

interface Scene {
  /** Where the hand aims, before the tremor. */
  azDeg: number;
  altDeg: number;
  /** Degrees per second the aim turns round the horizon (0 held still). */
  panDegS?: number;
  /** Tremor amplitude, degrees, on each of yaw, pitch and roll. */
  tremorDeg: number;
  /** The compass's noise, one sigma, degrees. */
  compassSigmaDeg: number;
  hz: number;
  seconds: number;
}

interface Measure {
  /** Standard deviation of the drawn look about its own mean, after settling, degrees. */
  azStd: number;
  altStd: number;
  /** The truth's own (the hand's tremor), for comparison. */
  trueAzStd: number;
  /** Mean drawn azimuth minus the hand's aim, degrees. */
  azBias: number;
  /** RMS of the frame-to-frame change of the change (a picture's jerk), px at 10 px a degree (the portrait field). */
  jerkPx: number;
  /** Largest frame-to-frame step, degrees. */
  maxStepDeg: number;
  /** Lag behind a pan, degrees (mean aim − drawn). */
  lagDeg: number;
}

const wrap = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

function run(make: () => Pipeline, scene: Scene, seed = 7): Measure {
  const next = random(seed);
  const noise = gaussian(next);
  // Tremor: three sines a hand makes (sway at 0.7 and 1.9 Hz, physiological at 8.3 Hz) and a little white noise.
  const phases = Array.from({ length: 9 }, () => next() * 2 * Math.PI);
  const tremor = (axis: number, t: number): number => {
    const p = (k: number): number => phases[axis * 3 + k] ?? 0;
    return scene.tremorDeg * (0.55 * Math.sin(2 * Math.PI * 0.7 * t + p(0)) + 0.3 * Math.sin(2 * Math.PI * 1.9 * t + p(1)) + 0.15 * Math.sin(2 * Math.PI * 8.3 * t + p(2)) + 0.1 * noise());
  };
  const pipeline = make();
  const relative = 123.4; // where the page loaded: iOS's alpha is the true one less this
  const frameMs = 1000 / 60;
  const readingMs = 1000 / scene.hz;
  let nextReading = 0;
  const az: number[] = [];
  const alt: number[] = [];
  const aim: number[] = [];
  const trueAz: number[] = [];
  for (let t = 0; t <= scene.seconds * 1000; t += frameMs) {
    while (nextReading <= t) {
      const s = nextReading / 1000;
      const aimAz = scene.azDeg + (scene.panDegS ?? 0) * s;
      const truth = rolled(uprightRotation(aimAz + tremor(0, s), scene.altDeg + tremor(1, s)), tremor(2, s));
      const e = eulerOf(truth);
      const look = lookDirection(truth);
      pipeline.reading({
        alpha: (((e.alpha - relative) % 360) + 360) % 360,
        beta: e.beta,
        gamma: e.gamma,
        absolute: undefined,
        webkitCompassHeading: (((look.azDeg + scene.compassSigmaDeg * noise()) % 360) + 360) % 360,
        webkitCompassAccuracy: 17,
      });
      nextReading += readingMs;
    }
    const m = pipeline.frame(t);
    if (!m || t < 5000) continue;
    const drawn = lookDirection(followLiftRotation(m));
    const truthNow = lookDirection(uprightRotation(scene.azDeg + (scene.panDegS ?? 0) * (t / 1000) + tremor(0, t / 1000), scene.altDeg));
    az.push(drawn.azDeg);
    alt.push(drawn.altDeg);
    aim.push(scene.azDeg + (scene.panDegS ?? 0) * (t / 1000));
    trueAz.push(truthNow.azDeg);
  }
  // Azimuths unwrapped against the aim so the statistics are not torn at 0/360.
  const azRel = az.map((a, i) => wrap(a - (aim[i] ?? 0)));
  const trueRel = trueAz.map((a, i) => wrap(a - (aim[i] ?? 0)));
  const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  const std = (xs: number[]): number => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  };
  let jerk = 0;
  let maxStep = 0;
  for (let i = 2; i < az.length; i += 1) {
    const d1 = wrap((az[i] ?? 0) - (az[i - 1] ?? 0));
    const d0 = wrap((az[i - 1] ?? 0) - (az[i - 2] ?? 0));
    const e1 = (alt[i] ?? 0) - (alt[i - 1] ?? 0);
    const e0 = (alt[i - 1] ?? 0) - (alt[i - 2] ?? 0);
    jerk += (d1 - d0) ** 2 + (e1 - e0) ** 2;
    maxStep = Math.max(maxStep, Math.hypot(d1, e1));
  }
  return {
    azStd: std(azRel),
    altStd: std(alt),
    trueAzStd: std(trueRel),
    azBias: mean(azRel),
    jerkPx: 10 * Math.sqrt(jerk / Math.max(1, az.length - 2)),
    maxStepDeg: maxStep,
    lagDeg: -mean(azRel),
  };
}

const upright: Scene = { azDeg: 305, altDeg: 0, tremorDeg: 1.5, compassSigmaDeg: 3, hz: 10, seconds: 20 };
const tilted: Scene = { ...upright, altDeg: -20 };

describe('the following window held still (D-1027)', () => {
  it('reproduces the owner’s report: before, upright at the horizon the facing wandered by tens of degrees; tilted it did not', () => {
    // Measured: 16.6° (10/s) and 23.8° (60/s) against 1.1° tilted 20° down, with a hand that moves 0.7°.
    expect(run(before, upright).azStd).toBeGreaterThan(8);
    expect(run(before, { ...upright, hz: 60 }).azStd).toBeGreaterThan(8);
    expect(run(before, tilted).azStd).toBeLessThan(1.5);
  });

  it('held upright at the horizon, the drawn facing moves no more than the hand, and as steadily as tilted', () => {
    for (const scene of [upright, tilted, { ...upright, hz: 60 }]) {
      const m = run(after, scene);
      expect(m.azStd).toBeLessThanOrEqual(m.trueAzStd);
      expect(Math.abs(m.azBias)).toBeLessThan(1);
      expect(m.maxStepDeg).toBeLessThan(0.5);
    }
  });

  it('at iOS Chrome’s 10 readings a second the picture no longer steps: its jerk is a fifth of what it was', () => {
    // Measured: 11.3 px → 0.23 px upright, 1.45 px → 0.20 px tilted.
    expect(run(after, upright).jerkPx).toBeLessThan(0.4);
    expect(run(after, tilted).jerkPx).toBeLessThan(0.4);
    expect(run(after, tilted).jerkPx * 5).toBeLessThan(run(before, tilted).jerkPx);
  });

  it('follows a turn with no more lag than before', () => {
    // A pan at 30° a second, lag net of the still bias.
    const pan = { ...upright, panDegS: 30, tremorDeg: 0.3 };
    const lag = (make: () => Pipeline, scene: Scene): number => run(make, scene).lagDeg + run(make, { ...scene, panDegS: 0 }).azBias;
    expect(lag(after, pan)).toBeLessThan(lag(before, pan) + 0.2);
    expect(lag(after, { ...pan, hz: 60 })).toBeLessThan(lag(before, { ...pan, hz: 60 }) + 0.2);
  });

  it('calibrates the same offset however the platform splits an upright pose between alpha and gamma', () => {
    // An upright phone a hair off true vertical: the W3C angles lock, and gamma swings across its range.
    const offsets: number[] = [];
    const gammas: number[] = [];
    for (const [tilt, roll] of [
      [0.3, 0.4],
      [-0.3, 0.4],
      [0.3, -0.4],
      [-0.3, -0.4],
      [0.05, 1],
      [1, 0.05],
    ] as const) {
      const truth = rolled(uprightRotation(305, tilt), roll);
      const e = eulerOf(truth);
      gammas.push(e.gamma);
      const sample = calibrationSample({ alpha: (e.alpha - 123.4 + 360) % 360, beta: e.beta, gamma: e.gamma, absolute: undefined, webkitCompassHeading: lookDirection(truth).azDeg, webkitCompassAccuracy: 15 });
      offsets.push(sample ?? NaN);
    }
    expect(Math.max(...gammas) - Math.min(...gammas)).toBeGreaterThan(90);
    for (const offset of offsets) expect(Math.abs(wrap(offset - (offsets[0] ?? 0)))).toBeLessThan(1e-6);
  });

  it('keeps the screen’s quarter while the phone is held upright at the horizon (FR-FSC-10)', () => {
    const next = random(3);
    let quarter: Quarter = 0;
    for (let i = 0; i < 2000; i += 1) {
      const m = rolled(uprightRotation(305 + 4 * (next() - 0.5), 6 * (next() - 0.5)), 6 * (next() - 0.5));
      quarter = quarterTurnFor(m, quarter);
      expect(quarter).toBe(0);
    }
  });
});
