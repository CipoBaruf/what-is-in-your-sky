/**
 * P4 (SPEC §4.43, FR-SHOW-6; PLAN D-652..D-654): what the recording run
 * produces — the flows, their devices and their stills. One list, read from
 * both ends, the way `captureSet.ts` is: `promo-record.spec.ts` records each
 * flow from it and `tests/docs/promo.test.ts` holds the list to its rules and,
 * when a run has left `promo/media/`, the directory to the list. It is its own
 * module rather than an export of the spec because a Playwright spec cannot be
 * imported by a unit test — `test()` at module load is an error outside a
 * Playwright run — and `playwright.config.ts` wants the phone's frame too.
 *
 * P7 (FR-SHOW-9, D-683): every flow is on the showcase night over Bariloche,
 * and each names the instant its paused clock is installed at, so
 * `tests/docs/showcase.test.ts` and `tests/docs/promo.test.ts` can hold every
 * instant a recording shows to the night and to `SHOWCASE_UNTIL`.
 */
import { readFileSync } from 'node:fs';
import { SHOWCASE_NIGHT, STORED_RUN_BARILOCHE_FILE } from './observers';

export const MEDIA_DIR = 'promo/media';

/** Tiangong's NORAD number: the object the desk's live flow watches. */
const TIANGONG = 48_274;
/** The minute the night's brightest pass rises in, 07:20 local (`GMT-3`) on the 6th: Tiangong, peak −2.1 at 48°, in twilight (D-683). */
const BRIGHTEST_RISE_MINUTE = Date.parse('2026-09-06T10:20:00Z');
const run = JSON.parse(readFileSync(STORED_RUN_BARILOCHE_FILE, 'utf8')) as { passes: { id: string; noradId: number; start: { t: number } }[] };
const brightest = run.passes.find((pass) => pass.noradId === TIANGONG && pass.start.t >= BRIGHTEST_RISE_MINUTE && pass.start.t < BRIGHTEST_RISE_MINUTE + 60_000);
if (!brightest) throw new Error(`${STORED_RUN_BARILOCHE_FILE} has no Tiangong pass rising at 07:20 local on 2026-09-06`);
/** The night's brightest pass, read from the stored run by its object and its start rather than written as a number. */
export const BRIGHTEST_PASS = { id: brightest.id, start: brightest.start.t };
/** Three minutes into it: the marker near the peak, half the arc behind it — the desk's live flow (D-683, as the capture set's `SHOWN`). */
export const SHOWCASE_SHOWN = BRIGHTEST_PASS.start + 180_000;
/**
 * The phone's live flow wants `[ see this pass ]`, offered only while nothing
 * is up and the next rise is between two minutes and a day ahead (FR-JUMP-1),
 * so it opens the same night by day: twelve hours on, 16:00 local on the 6th,
 * under `SHOWCASE_UNTIL` (D-673's reason, D-683's instant).
 */
export const SHOWCASE_BY_DAY = SHOWCASE_NIGHT + 12 * 3_600_000;

type PromoDevice = 'phone' | 'desktop';

export interface PromoFlow {
  /** The `<flow>` part of the file names: `promo/media/<flow>-<device>.webm`. */
  readonly name: string;
  readonly device: PromoDevice;
  readonly locale: 'en' | 'es';
  readonly theme: 'dark' | 'night';
  /**
   * The seconds the flow spends watching the screen move between its actions;
   * the recording is this plus the loads, and FR-SHOW-6 wants each flow under
   * 40 s, so the list keeps well inside it.
   */
  readonly seconds: number;
  /** The instant the flow's paused clock is installed at (D-683); the clock runs on from it for about `seconds`, never past `SHOWCASE_UNTIL`. */
  readonly at: number;
  /** The stills the flow shoots, in order, as `promo/media/<flow>-<device>-<still>.png` (D-654). */
  readonly stills: readonly string[];
}

/**
 * The two devices (FR-SHOW-6): a phone at 390 × 844 with a device pixel ratio
 * of 3, held upright, and a desk at 1440 × 900. `frame` is the recording asked
 * for (D-652): Playwright scales a video to fit 800 × 800 unless told
 * otherwise, so the phone asks for its device pixels — 1170 × 2532, a reel's
 * shape — and the desk for its own size. Chromium's screencast may cap the
 * phone frame below what is asked; the size a run produced is in P4's Done
 * note, not promised here.
 */
export const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, frame: { width: 1170, height: 2532 } },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: false, frame: { width: 1440, height: 900 } },
} as const;

/**
 * The flows, in the order FR-SHOW-6 lists them. English by default, the
 * Spanish first run as one more flow, both themes for the phone's first run;
 * every other flow is shot once, dark and in English.
 */
export const PROMO_FLOWS: readonly PromoFlow[] = [
  { name: 'first-run-en-dark', device: 'phone', locale: 'en', theme: 'dark', seconds: 14, at: SHOWCASE_NIGHT, stills: ['where', 'when', 'what', 'guide'] },
  { name: 'first-run-en-night', device: 'phone', locale: 'en', theme: 'night', seconds: 14, at: SHOWCASE_NIGHT, stills: ['where', 'when', 'what', 'guide'] },
  { name: 'first-run-es-dark', device: 'phone', locale: 'es', theme: 'dark', seconds: 14, at: SHOWCASE_NIGHT, stills: ['where', 'when', 'what', 'guide'] },
  { name: 'list-and-card', device: 'phone', locale: 'en', theme: 'dark', seconds: 14, at: SHOWCASE_NIGHT, stills: ['list', 'guide'] },
  { name: 'live-see-this-pass', device: 'phone', locale: 'en', theme: 'dark', seconds: 18, at: SHOWCASE_BY_DAY, stills: ['watching', 'held', 'back-to-live'] },
  { name: 'settings-language', device: 'phone', locale: 'en', theme: 'dark', seconds: 12, at: SHOWCASE_NIGHT, stills: ['settings', 'spanish'] },
  { name: 'cold-open-to-pass', device: 'desktop', locale: 'en', theme: 'dark', seconds: 16, at: SHOWCASE_NIGHT, stills: ['cold-open', 'after-place', 'pass-open'] },
  { name: 'live-scrubbing', device: 'desktop', locale: 'en', theme: 'dark', seconds: 18, at: SHOWCASE_SHOWN, stills: ['watching', 'scrubbing'] },
];

/** `promo/media/<flow>-<device>` — the stem every file of a flow shares. */
const promoStem = (flow: PromoFlow): string => `${MEDIA_DIR}/${flow.name}-${flow.device}`;
/** The flow's video, and the still it names. */
export const promoVideo = (flow: PromoFlow): string => `${promoStem(flow)}.webm`;
export const promoStill = (flow: PromoFlow, still: string): string => `${promoStem(flow)}-${still}.png`;
