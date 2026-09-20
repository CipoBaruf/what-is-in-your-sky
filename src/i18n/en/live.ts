import type { MoonFacts } from '../../lib/moonPhrases';
import type { CloudState, MoonPhaseName, SkyState } from '../../model';
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
    /**
     * The conditions line's accessible name; the fields below are its labels (FR-LIVE-3). R77 (FR-WATCH-3):
     * one line per state — on wide `Sky dark · Clouds Clear, 12 % cloud · Up 3 · Moon waxing crescent, 18 % lit`,
     * on compact the clock and three short words with the labels spoken, `21:14:32 dark clear 3 up`.
     */
    strip: 'Sky conditions',
    timeLabel: 'Time',
    skyLabel: 'Sky',
    cloudLabel: 'Clouds',
    countLabel: 'Up',
    /** The compact count's spoken label: its value already says `3 up`. */
    countSpoken: 'Satellites',
    moonLabel: 'Moon',
    /** The sky state in words (FR-LIVE-3, `SkyState`). */
    sky: { day: 'day', 'bright-twilight': 'bright twilight', dark: 'dark' } satisfies Record<SkyState, string>,
    /** R77 (FR-WATCH-3, FR-COMP-4): the compact line's sky word, one word each so the line keeps its 36 cells. */
    skyShort: { day: 'day', 'bright-twilight': 'twilight', dark: 'dark' } satisfies Record<SkyState, string>,
    /** R77 (FR-WATCH-3): the compact line's cloud verdict, one word each; `unknown` without a forecast (FR-WX-5). */
    cloudWord: { clear: 'clear', partly: 'partly', obscured: 'cloudy', unknown: 'unknown' } satisfies Record<CloudState, string>,
    /** R77 (FR-WATCH-3): the compact line's count, `3 up`. */
    upCount: (count: number) => `${String(count)} up`,
    /** A field whose value is not known yet — the astronomy is still loading. */
    pending: '…',
    /** The Moon's phase and illumination, and nothing about where it is: the dome shows that. */
    moon: (p: Pick<MoonFacts, 'phase' | 'illumination'>) => `${moonPhase[p.phase]}, ${p.illumination} % lit`,
    /**
     * R77 (FR-WATCH-1, FR-WATCH-2, FR-MARK-5): the state indicator's word beside the mark — never the colour
     * alone (FR-X-5) — and the two ways between the states. `[ scrub ]` holds the instant at the tap
     * (`[ scrub the night ]` on wide); `[ back to live ]` is FR-LIVE-5's `now` action, named for where it goes.
     */
    state: { live: 'live', held: 'held' },
    scrub: 'scrub',
    scrubWide: 'scrub the night',
    backToLive: 'back to live',
    /** R77 (FR-WATCH-2, FR-TRAJ-4): the held instant's offset from real time — `+33 min`, `−1 h 05 min`. */
    heldOffset: (p: { sign: '+' | '−'; hours: number; minutes: number }) =>
      p.hours === 0 ? `${p.sign}${String(p.minutes)} min` : `${p.sign}${String(p.hours)} h ${String(p.minutes).padStart(2, '0')} min`,
    /** R77 (FR-WATCH-4, FR-SPAN-2): the watching overview's end labels, one text row under it on compact. */
    overviewStart: 'now',
    overviewEnd: '+24 h',
    /**
     * FR-SHARE-1's live form: the same button as the pass's, with the page's own words. R77 (FR-WATCH-8): on
     * wide the name says what the link carries — the sky while watching, the moment while scrubbing.
     */
    share: 'Share this sky',
    shareMoment: 'Share this moment',
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
    speedGroup: 'Playback speed',
    speed: (factor: number) => `${String(factor)}×`,
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
