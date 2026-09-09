import type { MoonFacts } from '../../lib/moonPhrases';
import type { MoonPhaseName, SkyState } from '../../model';
import type { HiddenReason } from '../messages';

/** FR-I18N-2 (D-69): the eight phases as `live.moon` reads them out; the same spelling as `en/ui.ts`'s (D-103), duplicated because the `live` lane owns this file alone. */
const moonPhase = {
  new: 'new',
  waxingCrescent: 'waxing crescent',
  firstQuarter: 'first quarter',
  waxingGibbous: 'waxing gibbous',
  full: 'full',
  waningGibbous: 'waning gibbous',
  lastQuarter: 'last quarter',
  waningCrescent: 'waning crescent',
} satisfies Record<MoonPhaseName, string>;

/**
 * R32 (FR-LIVE-1, FR-LIVE-3, FR-LIVE-9; US-15). The live page: how it is
 * reached, what it says when it cannot draw, and the five fields of the
 * status strip. Later `live` tasks (R33, R34) extend this section and no
 * other (PLAN §16.2). FR-I18N-2 (D-199 (2)): the `live` lane's own section,
 * merged into `en` by `../en.ts`.
 */
export const live = {
  live: {
    /** The header control (FR-LIVE-1). */
    open: 'Live sky',
    /** FR-COMP-1 (R52): the same control on the compact header's 36-cell row, lower case beside `[ settings ]`. */
    openShort: 'live',
    /** The Now panel's link to the same page. */
    openFromNow: 'Watch the sky live',
    back: '← Back',
    loading: 'Loading the live sky…',
    /** FR-LIVE-1's two inert states: one line each, beside the return control. */
    noObserver: 'The live sky needs somewhere to look from: a place name or coordinates on the home page.',
    noElements: 'No orbital elements yet, so there is nothing to draw.',
    /** The status strip's accessible name; the five fields below are its labels (FR-LIVE-3). */
    strip: 'Sky status',
    timeLabel: 'Time',
    skyLabel: 'Sky',
    cloudLabel: 'Clouds',
    countLabel: 'Visible',
    moonLabel: 'Moon',
    /** The sky state in words (FR-LIVE-3, `SkyState`). */
    sky: { day: 'day', 'bright-twilight': 'bright twilight', dark: 'dark' } satisfies Record<SkyState, string>,
    /** A field whose value is not known yet — the astronomy is still loading. */
    pending: '…',
    /** How many satellites have a marker on the dome at the shown instant. */
    visible: (count: number) => (count === 1 ? '1 satellite' : `${String(count)} satellites`),
    /** The Moon's phase and illumination, and nothing about where it is: the dome shows that. */
    moon: (p: Pick<MoonFacts, 'phase' | 'illumination'>) => `${moonPhase[p.phase]}, ${p.illumination} % lit`,
    /**
     * R48 (FR-LIVE-7 as amended, FR-COMP-4, D-246): the compact strip is two
     * lines of at most 36 cells — `06:48:24 GMT-3 bright twilight` over
     * `Clouds 12 % Visible 3 Moon 72 %`. The clouds and the Moon are their
     * percentages and the count its number; the first line's labels are
     * spoken, not shown. Without a forecast the clouds read `n/a`.
     */
    cloudPercent: (percent: string | null) => (percent === null ? 'n/a' : `${percent} %`),
    moonPercent: (illumination: string) => `${illumination} %`,
    /** FR-SHARE-1's live form: the same button as the pass's, with the page's own words. */
    share: 'Share this sky',
    shareTitle: 'The sky right now',
    shareText: (place: string) => `The whole sky over ${place}, live.`,
    /** R33 (FR-LIVE-4): the time stripe is a slider; its value text is the cursor's clock time. R70 (FR-SPAN-1): what it draws is four hours of the coming 24. */
    stripe: 'Time stripe: four hours of the coming 24',
    /** R70 (FR-SPAN-2): the overview row above the stripe — the whole span, a slider of its own, whose value text is the clock time under the cursor. */
    overview: 'Night overview',
    /** R33 (FR-LIVE-5): the playback controls. */
    playback: 'Playback',
    play: 'Play',
    pause: 'Pause',
    /** The action that returns the shown instant to real time. */
    now: 'Now',
    speedGroup: 'Playback speed',
    speed: (factor: number) => `${String(factor)}×`,
    /** The strip's sixth field, shown while playing (FR-LIVE-3). */
    speedLabel: 'Speed',
    /** R33 (FR-LIVE-6): the toggle, and the reasons an object up there is not worth looking for. */
    hiddenToggle: 'Hidden objects',
    hiddenReason: { low: 'too low', shadow: 'in shadow', daylight: 'daylight', faint: 'too faint' } satisfies Record<HiddenReason, string>,
    hiddenLabel: (p: { name: string; reason: string }) => `${p.name} · ${p.reason}`,
    /**
     * R71 (FR-LEG-7, D-387, D-388): the compact actions row's legend control,
     * `[ list (3) ]`. The count is the drawn passes — the rows the panel would
     * list — and not the Sun and Moon lines, which are in the panel and
     * uncounted (OQ-26: "list (2)" on an empty sky is the one number this must
     * not show). The word is the control's whole label, so it is also its
     * accessible name; `aria-expanded` carries the state.
     */
    list: (p: { count: number }) => `list (${String(p.count)})`,
    /*
     * R66 (V13-6): `follow`, `followShort`, `followRelative`, `followDenied`
     * and `followClose` are gone with the `[ follow phone ]` control. The two
     * notes are the window's own (`window.denied`, `window.relative`), beside
     * the view control that now asks; the `×`'s name is `chart.screenClose`.
     */
    /**
     * R44 (FR-WIN-3, US-21 AC6): the strip's heading field, shown only while
     * the dome is following the phone. It says what the correction is as much
     * as that there is one: a compass reads magnetic north, the sky is drawn
     * in true azimuths, and this is the angle between them here.
     */
    headingLabel: 'Heading',
    trueNorth: (p: { declination: string }) => `true north, declination ${p.declination}`,
    /**
     * R48 (FR-TRAJ-5, FR-COMP-4): the stepping row under the stripe, the six
     * buttons the spike chose (`docs/window/FINDINGS.md`). The visible labels
     * are the spike's glyphs, 33 cells in a row with their gaps; the
     * accessible names say the same in words.
     *
     * R70 (FR-SPAN-3, FR-SPAN-4, D-384): re-cut. The ±10 min pair is withdrawn
     * and the two chunk buttons take its place — the row is `|◀ pass  ◀ 4h
     * −1m  +1m  4h ▶  pass ▶|`, 33 cells with its gaps, inside FR-COMP-4's 35
     * — and the rise jumps are named for what they land on, a pass, since one
     * tap on them is now the whole gesture.
     */
    stepping: 'Step the shown instant',
    step: { prevRise: '|◀ pass', backChunk: '◀ 4h', back1: '−1m', forward1: '+1m', forwardChunk: '4h ▶', nextRise: 'pass ▶|' },
    stepName: {
      prevRise: 'Previous pass',
      backChunk: 'Back four hours',
      back1: 'Back one minute',
      forward1: 'Forward one minute',
      forwardChunk: 'Forward four hours',
      nextRise: 'Next pass',
    },
    /**
     * R48 (FR-LIVE-7 as amended, FR-COMP-4): the compact page's two control
     * rows, each within 36 cells (D-245). Play and pause are glyphs whose
     * accessible names are still the words; the toggles and the share action
     * keep one word of their wide labels. Labels may differ between the
     * shells; meaning may not (US-5 AC2).
     */
    playShort: '▶',
    pauseShort: '‖',
    hiddenShort: 'Hidden',
    shareShort: 'Share',
  },
};
