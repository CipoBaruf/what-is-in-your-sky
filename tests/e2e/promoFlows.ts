/**
 * P4 (SPEC §4.43, FR-SHOW-6; PLAN D-652..D-654): what the recording run
 * produces — the flows, their devices and their stills. One list, read from
 * both ends, the way `captureSet.ts` is: `promo-record.spec.ts` records each
 * flow from it and `tests/docs/promo.test.ts` holds the list to its rules and,
 * when a run has left `promo/media/`, the directory to the list. It is its own
 * module rather than an export of the spec because a Playwright spec cannot be
 * imported by a unit test — `test()` at module load is an error outside a
 * Playwright run — and `playwright.config.ts` wants the phone's frame too.
 */

export const MEDIA_DIR = 'promo/media';

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
  { name: 'first-run-en-dark', device: 'phone', locale: 'en', theme: 'dark', seconds: 14, stills: ['where', 'when', 'what', 'guide'] },
  { name: 'first-run-en-night', device: 'phone', locale: 'en', theme: 'night', seconds: 14, stills: ['where', 'when', 'what', 'guide'] },
  { name: 'first-run-es-dark', device: 'phone', locale: 'es', theme: 'dark', seconds: 14, stills: ['where', 'when', 'what', 'guide'] },
  { name: 'list-and-card', device: 'phone', locale: 'en', theme: 'dark', seconds: 14, stills: ['list', 'guide'] },
  { name: 'live-see-this-pass', device: 'phone', locale: 'en', theme: 'dark', seconds: 18, stills: ['watching', 'held', 'back-to-live'] },
  { name: 'settings-language', device: 'phone', locale: 'en', theme: 'dark', seconds: 12, stills: ['settings', 'spanish'] },
  { name: 'cold-open-to-pass', device: 'desktop', locale: 'en', theme: 'dark', seconds: 16, stills: ['cold-open', 'after-place', 'pass-open'] },
  { name: 'live-scrubbing', device: 'desktop', locale: 'en', theme: 'dark', seconds: 18, stills: ['watching', 'scrubbing'] },
];

/** `promo/media/<flow>-<device>` — the stem every file of a flow shares. */
const promoStem = (flow: PromoFlow): string => `${MEDIA_DIR}/${flow.name}-${flow.device}`;
/** The flow's video, and the still it names. */
export const promoVideo = (flow: PromoFlow): string => `${promoStem(flow)}.webm`;
export const promoStill = (flow: PromoFlow, still: string): string => `${promoStem(flow)}-${still}.png`;
