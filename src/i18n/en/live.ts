import type { CompassPoint } from '../../lib/compass';
import type { UpEvent } from '../../lib/contextLine';
import type { Landmark } from '../../lib/landmark';
import type { MoonFacts } from '../../lib/moonPhrases';
import { offsetSpan } from '../../lib/playback';
import type { CloudState, MoonPhaseName, SkyState } from '../../model';
import type { HiddenReason } from '../messages';

type LandmarkWord = Landmark['word'];

/**
 * R143 (FR-TONIGHT-7): the chip as the catalog takes it — `lib/shownTime.ts`'s `ShownChip` with the weekday spelt
 * out by the component (`shortWeekday`), `null` when the chip carries none.
 */
export type ChipWords = { kind: 'now' } | { kind: 'ahead' | 'behind'; hours: number; minutes: number; tonight: boolean; weekday: string | null };

/** R143 (FR-TONIGHT-7): the context line's verb for what an up pass does next. */
const upVerb = { peak: 'peaks', horizon: 'sets', shadow: 'into shadow', twilight: 'fades' } satisfies Record<UpEvent, string>;

/** R123 for R127 (FR-SKY-11): the direction word of the landmark line, from the peak's altitude against the star's (`lib/landmark.ts`). */
const landmarkWord = { above: 'above', below: 'below', beside: 'beside' } satisfies Record<LandmarkWord, string>;

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
    loading: 'Loading the live sky…',
    /**
     * R89 (FR-LIVE-1 as amended v2.1, FR-FIRST-1, F-75, F-92): the three states before the page can draw, told
     * apart. No place: FR-FIRST-1's sentence and `[ set a place ]`, which opens the home page's where step.
     * Loading: the mark's bead moving beside `loadingElements`. Failed: the failure line (`failure.*`), and
     * `failedInstead` for what the page has in the meantime, which is nothing to draw.
     */
    noPlace: 'The live sky needs a place.',
    setPlace: 'set a place',
    loadingElements: 'Loading orbital elements…',
    failedInstead: 'There is no stored sky to draw meanwhile.',
    /**
     * The conditions line's accessible name; the fields below are its labels (FR-LIVE-3). R77 (FR-WATCH-3):
     * one line in both states, `Sky dark · Clouds Clear, 12 % cloud · Up 3 · Moon waxing crescent, 18 % lit`. Wide's
     * alone since R145: compact's `21:14:32 dark clear 3 up` and its words went with FR-TONIGHT-6.
     */
    strip: 'Sky conditions',
    skyLabel: 'Sky',
    cloudLabel: 'Clouds',
    countLabel: 'Up',
    moonLabel: 'Moon',
    /** The sky state in words (FR-LIVE-3, `SkyState`). */
    sky: { day: 'day', 'bright-twilight': 'bright twilight', dark: 'dark' } satisfies Record<SkyState, string>,
    /**
     * R85 (FR-COMP-7): what a screen reader says for the cloud word, where the word is an abbreviation (Spanish `s/d`);
     * the same word here. R145: the context line's (`context.cloudWord`) since the compact conditions line went (FR-TONIGHT-6).
     */
    cloudSpoken: { clear: 'clear', partly: 'partly', obscured: 'cloudy', unknown: 'unknown' } satisfies Record<CloudState, string>,
    /** A field whose value is not known yet — the astronomy is still loading. */
    pending: '…',
    /** The Moon's phase and illumination, and nothing about where it is: the dome shows that. */
    moon: (p: Pick<MoonFacts, 'phase' | 'illumination'>) => `${moonPhase[p.phase]}, ${p.illumination} % lit`,
    /**
     * R77 (FR-WATCH-1, FR-WATCH-2, FR-MARK-5): the state indicator's word beside the mark — never the colour
     * alone (FR-X-5) — and the two ways between the states. `[ scrub the night ]` holds the instant at the tap;
     * `[ back to live ]` is FR-LIVE-5's `now` action, named for where it goes. R145 (FR-TONIGHT-6, FR-TONIGHT-8): both
     * are wide's, and compact's `[ scrub ]` and `[ live ]` (R85) are gone with the rows that held them.
     */
    state: { live: 'live', held: 'held' },
    scrubWide: 'scrub the night',
    backToLive: 'back to live',
    /**
     * R101 (FR-JUMP-1): the watching headline's one control after its path line — `[ see this pass ]`, which holds
     * the page at the named pass's rise. `seeThisPassName` is its accessible name, with the satellite it names.
     */
    seeThisPass: 'see this pass',
    seeThisPassName: (name: string) => `See this pass: ${name}, held at its rise`,
    /** R77 (FR-WATCH-2, FR-TRAJ-4): the held instant's offset from real time — `+33 min`, `−1 h 05 min`. */
    heldOffset: (p: { sign: '+' | '−'; hours: number; minutes: number }) => `${p.sign}${offsetSpan(p)}`,
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
     * R150 (FR-GYRO-10, D-949, D-951): the heading over the satellites list at the controls sheet's end, in place of
     * v2.8's `[ list (n) ]`. The count is the drawn passes — the rows the list holds — and not the Sun and Moon
     * lines, which are in it and uncounted (OQ-26, FR-TONIGHT-7's count).
     */
    satellites: (p: { count: number }) => `Satellites (${String(p.count)})`,
    /**
     * R85 (F-81, FR-CAP-5, D-549): the short wide window's inventory ends on a whole row, and this line under it
     * says how many entries the clip leaves out; the list still scrolls to them.
     */
    more: (n: number) => `+${String(n)} more`,
    /*
     * R66 (V13-6): `follow`, `followShort`, `followRelative`, `followDenied`
     * and `followClose` are gone with the `[ follow phone ]` control. The two
     * notes are the window's own (`window.denied`, `window.relative`), beside
     * the view control; R152 retired the screen and its `×` with it.
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
    /**
     * R123 (FR-SKY-3, D-791): `[x] stars` — the stars, the figures and the planets under the arcs — on the live
     * page's actions row and the pass detail's view row (on compact the readout row). One word in both shells; the
     * name says what is drawn, and starts with the word on the control (WCAG 2.5.3).
     */
    starsToggle: 'stars',
    starsToggleName: 'Stars under the arcs',
    /**
     * R123 for R127 (FR-SKY-11, D-796): the landmark line under the highlighted pass's name, "passes 7° above
     * Betelgeuse, in Orion"; with no landmark star "passes through Orion". The degrees come formatted, the star's
     * and the constellation's names in the active language (D-832).
     */
    landmarkLine: (p: { degrees: string; word: LandmarkWord; star: string; constellation: string }) => `passes ${p.degrees} ${landmarkWord[p.word]} ${p.star}, in ${p.constellation}`,
    landmarkThrough: (p: { constellation: string }) => `passes through ${p.constellation}`,
    /**
     * R143 (FR-TONIGHT-4, FR-TONIGHT-8): the three taps under the time track, `▶ [ tonight ] [ next ] [ now ]`,
     * 30 cells either way: the play control is `playShort` or `pauseShort`, one glyph and one cell (D-911), named
     * by `play` and `pause`.
     */
    taps: 'Jump in time',
    tap: { tonight: 'tonight', next: 'next', now: 'now' },
    /**
     * R143 (FR-TONIGHT-7): the chip after the shown time — `now`; `in 6 h 12 min`, `12 min ago`; `tonight · in 6 h
     * 12 min` inside tonight's night band; `Sat · in 20 h 00 min` when the instant is not today; `in <1 min`,
     * `<1 min ago` under half a minute off real time (D-911).
     */
    chip: (c: ChipWords): string => {
      if (c.kind === 'now') return 'now';
      const offset = c.kind === 'ahead' ? `in ${offsetSpan(c, true)}` : `${offsetSpan(c, true)} ago`;
      const day = c.tonight ? 'tonight' : c.weekday;
      return day === null || day === '' ? offset : `${day} · ${offset}`;
    },
    /** R143 (FR-TONIGHT-7): the shown time's accessible name, the headline's own words. */
    shownTime: 'Shown time',
    /**
     * R143 (FR-TONIGHT-7): the context line, one line at `--small` within 36 cells. While a pass is up, its name,
     * the separator and what it does next, `Tiangong · peaks SE 0:40` — the name drawn apart, as the part that
     * gives way; otherwise the sky, the cloud word and the next rise, `Dark · Clear · next 21:47`; or one of the
     * two no-pass sentences (FR-TONIGHT-1, FR-TONIGHT-4).
     */
    context: {
      separator: ' · ',
      up: (p: { event: UpEvent; point: CompassPoint; countdown: string }) => `${upVerb[p.event]} ${p.point} ${p.countdown}`,
      sky: (p: { sky: string; cloud: string; next: string }) => `${p.sky} · ${p.cloud} · next ${p.next}`,
      skyWord: { day: 'Day', 'bright-twilight': 'Twilight', dark: 'Dark' } satisfies Record<SkyState, string>,
      cloudWord: { clear: 'Clear', partly: 'Partly', obscured: 'Cloudy', unknown: 'Unknown' } satisfies Record<CloudState, string>,
      noneSpan: 'No visible pass in 24 h',
      noneTonight: 'No visible pass tonight',
    },
    /**
     * R146 (FR-FULL-10, FR-FULL-8): the card over the sky when nothing visible is up as the compact live page opens.
     * With a visible pass in the span: `nothingUp`, then at `--small` the pass line — the name (drawn apart, as the
     * part that gives way), `separator` and `passWhen`, `Tiangong · 21:47 · in 4 h 12 min`: the rise time and the
     * chip's offset to the rise — over `[ see next pass ] [ see now ]`. With none: `noPass`, at `--small` (D-930),
     * over `[ see the sky now ]`. Every line and the button row within 36 cells (`controlRows.test.ts`).
     */
    opening: {
      nothingUp: 'Nothing visible up now.',
      noPass: 'No visible pass in the next 24 h.',
      separator: ' · ',
      passWhen: (p: { time: string; chip: string }) => `${p.time} · ${p.chip}`,
      seeNext: 'see next pass',
      seeNow: 'see now',
      seeSkyNow: 'see the sky now',
    },
  },
};
