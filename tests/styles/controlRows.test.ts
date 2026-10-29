// @vitest-environment jsdom
/**
 * R52 (FR-COMP-4, US-20 AC6, D-193): every control row the compact layout
 * renders fits 36 cells, in both languages.
 *
 * The rows are FR-COMP-4's own list — the header, the sort row, the chart view
 * control, the live page's playback rows, the share and follow actions — plus
 * the two this task adds: the home screen's location summary (FR-COMP-3) and
 * the settings page's install row (V11-16). R76 (FR-FIRST-1..4) adds the home
 * page's own: the step line, the primary action, and the next-event block's
 * label; the location summary loses its no-place form, which the cold open
 * replaces (FR-SET-3). R81 (FR-FIRST-3, FR-FIRST-10, FR-FIRST-11) re-cuts them to
 * board 1B's: the location summary becomes the Where reading's lines — the place,
 * the readiness line, the elements line and the saved places line — and the
 * card's first line, the count and the sort, and the new label line join them.
 * Each is rendered on its own with
 * `matchMedia` stubbed to a phone, and measured by `cells.ts`: the text it
 * draws, the brackets its stylesheet adds, and one cell of gap between each
 * pair of controls.
 *
 * What this cannot see is CSS wrapping — jsdom lays nothing out — so the number
 * is the budget and the 390 px captures in the task are the proof. What it can
 * see, and what no capture would catch in both languages on every task, is a
 * label growing past the row it has to live on.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement, createRef, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../support/matchMedia';
import { goldenPassFixture } from '../support/catalogFixtures';
import { CATALOGS, I18nProvider } from '../../src/i18n/useT';
import { LOCALES } from '../../src/i18n/locale';
import { BASE_FONT_PX, CELL_ADVANCE_EM_MAX, SHELL_PADDING_CELLS, thresholdPx, WIDE_CELLS, WIDE_MIN_PX } from '../../src/lib/layout';
import { FieldList } from '../../src/ui/screens/stars/FieldList';
import type { Messages } from '../../src/i18n/messages';
import type { Locale, Observer } from '../../src/model';
import { appStore } from '../../src/state';
import { Header } from '../../src/ui/components/common/Header';
import { ElementsLine } from '../../src/ui/components/elements/ElementsLine';
import { Favourites } from '../../src/ui/components/location/Favourites';
import { WherePlace } from '../../src/ui/components/location/WherePlace';
import { PassCard } from '../../src/ui/components/passes/PassCard';
import { PassList } from '../../src/ui/components/passes/PassList';
import { IDLE_PASSES } from '../../src/state/slices/passes';
import { fixtureRecords } from '../support/catalogFixtures';
import { InstallAction } from '../../src/ui/components/common/InstallAction';
import { ShareButton } from '../../src/ui/components/common/ShareButton';
import { HiddenToggle, PlaybackControls } from '../../src/ui/components/live/PlaybackControls';
import { StepControls } from '../../src/ui/components/live/StepControls';
import { SortToggle } from '../../src/ui/components/passes/SortToggle';
import { ToggleGroup } from '../../src/ui/components/primitives/ToggleGroup';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from '../../src/ui/components/common/installOffer';
import { SettingsPage } from '../../src/ui/screens/Settings';
import { StepLine } from '../../src/ui/screens/Home';
import { UseMyLocation } from '../../src/ui/components/location/UseMyLocation';
import { NextEventBlock } from '../../src/ui/components/passes/NextEventBlock';
import { StatusStrip } from '../../src/ui/components/live/StatusStrip';
import { LivePage } from '../../src/ui/screens/Live';
import { PassDetail } from '../../src/ui/screens/PassDetail';
import { VisitNotice } from '../../src/ui/components/common/VisitNotice';
import { FaintToggle } from '../../src/ui/components/passes/FaintToggle';
import { STARS_PAGE_CATALOGS } from '../../src/i18n/starsPageT';
import { StarsPage } from '../../src/ui/screens/Stars';
import { StateIndicator } from '../../src/ui/components/live/StateIndicator';
import { formatDate } from '../../src/lib/timeFormat';
import type { HeaderPage } from '../../src/i18n/messages';
import { decorations, rowCells, rowParts } from './cells';
import { chipRows, contextRows, tapsRows } from './tonightRows';

/** FR-COMP-4: a 390 px viewport at the default cell. */
const BUDGET = 36;
/** A row set at `--small` (14 px): 36 cells of the 16 px body hold 41 of its characters (D-504). */
const SMALL_BUDGET = Math.floor((BUDGET * 16) / 14);
/** FR-COMP-7 (R85, D-549): the compact live page's top row and actions rows keep two cells of the 36 spare. */
const LIVE_ROW_BUDGET = BUDGET - 2;
/** R132 (FR-FLOW-4, D-846): the view row is 30 cells in English and 35 in Spanish, and the spec pins the Spanish number. */
const VIEW_ROW_BUDGET = 35;
/** R129 (FR-FLOW-3): the four pages under the home, each with the compact `[ ← ]` row. */
const SUB_PAGES = ['live', 'stars', 'pass', 'settings'] as const satisfies readonly HeaderPage[];

const CSS = [
  'src/ui/components/common/Header.module.css',
  'src/ui/components/location/WherePlace.module.css',
  'src/ui/components/passes/PassCard.module.css',
  'src/ui/components/passes/PassList.module.css',
  'src/ui/components/common/InstallAction.module.css',
  // R104 (FR-DS-4, D-704): the brackets and the `[x]` marks are the primitives' alone, read off their modules.
  'src/ui/components/primitives/TextButton.module.css',
  'src/ui/components/primitives/BracketLink.module.css',
  'src/ui/components/primitives/OptionToggle.module.css',
  'src/ui/components/common/ShareButton.module.css',
  'src/ui/components/live/PlaybackControls.module.css',
  'src/ui/components/live/StepControls.module.css',
  'src/ui/screens/Settings.module.css',
  'src/ui/components/location/UseMyLocation.module.css',
  'src/ui/components/location/Favourites.module.css',
  'src/ui/components/location/LocationInput.module.css',
  'src/ui/App.module.css',
  'src/ui/components/passes/NextEventBlock.module.css',
  'src/ui/screens/Live.module.css',
  'src/ui/components/live/StatusStrip.module.css',
  'src/ui/components/live/StateIndicator.module.css',
  'src/ui/components/common/VisitNotice.module.css',
].map((file) => resolve(process.cwd(), file));

const table = decorations(CSS);

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const pass = goldenPassFixture();
const records = fixtureRecords();
const NEWEST = Math.max(...records.map((record) => record.epochMs));
const ready = { status: 'ready' as const, records, unavailable: [], rejected: [], fetchedAt: NEWEST, stale: false, persistent: true };
const initial = appStore.getInitialState();
const noop = (): void => undefined;

/** R77: the live page with a sky to draw — the store as `Live.test.tsx` sets it, the place a ten-letter name. */
const withLiveSky = (): void => {
  const place: Observer = { ...observer, label: 'Cipolletti' };
  appStore.setState({ observer: place, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: place, passes: [pass], hasDarkness: true } });
};

let media: MatchMediaStub;

/** The rows FR-COMP-4 names, each as what to render and how to find the row in it. */
interface Row {
  name: string;
  element: ReactElement;
  find: () => Element;
  /** Run before rendering: the store or the browser has to be in the state the row appears in. */
  setUp?: () => void;
  /** Run after rendering: a row the page shows only after a tap (R77: the scrubbing state's). */
  after?: () => void;
  /** Tighter than `BUDGET` where FR-COMP-4 names a number for the row itself (R70: the stepping row's 35); for a row set at `--small`, the same 390 px counted in its own characters. */
  budget?: number;
  /** R82: the row's width where `rowCells` cannot see it all (a rule on an item that holds a control). */
  measure?: (element: Element) => number;
}

const chartView = (): ReactElement =>
  createElement(ToggleGroup, {
    name: 'View',
    prefix: 'View:',
    options: [
      { value: 'dome', label: 'Dome' },
      { value: 'polar', label: 'Polar' },
      { value: 'window', label: 'Window' },
    ],
    value: 'dome',
    onChange: noop,
  });

const offerAnInstall = (): void => {
  const event = Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt: () => Promise.resolve({}) }) as BeforeInstallPromptEvent;
  window.dispatchEvent(event);
};

/**
 * The chart view control's real labels come from the catalogs, so it is built
 * from them rather than from the literals above; everything else renders the
 * component the app renders.
 */
const rows = (t: Messages): readonly Row[] => [
  { name: 'the compact header (FR-COMP-1)', element: createElement(Header), find: () => screen.getByTestId('header') },
  // R81 (FR-FIRST-11): the Where reading's lines. The place is clipped, not wrapped, so the row is the place's own coordinates here;
  // the sentence under it is prose and wraps.
  {
    name: 'the Where place line (FR-FIRST-11)',
    element: createElement(WherePlace, { open: false, onToggle: () => undefined, controls: 'where-group' }),
    find: () => screen.getByTestId('location-summary'),
    setUp: () => {
      appStore.setState({ observer: { ...observer, source: 'geocode', label: 'Cipolletti, Río Negro, Argentina' } });
    },
  },
  // The readiness line's ready form is pinned at one 390 px row by `messages.test.ts` (R27, D-145); its not-ready form is a sentence and wraps.
  {
    name: 'the elements line (FR-SAT-4 as amended)',
    element: createElement(ElementsLine, { now: NEWEST + 9 * 86_400_000 + 4 * 3_600_000 }),
    find: () => screen.getByTestId('elements-line'),
    setUp: () => {
      appStore.setState({ elements: ready });
    },
    budget: SMALL_BUDGET,
  },
  {
    name: 'the saved places line (FR-FIRST-11)',
    element: createElement(Favourites, { form: 'line' }),
    find: () => screen.getByTestId('save-favourite').parentElement as Element,
    setUp: () => {
      appStore.setState({ observer });
    },
    budget: SMALL_BUDGET,
  },
  // R81 (FR-FIRST-10): the card's first line — the time, the name and the tag — on the golden pass, the ISS.
  { name: 'the card’s first line (FR-FIRST-10)', element: createElement(PassCard, { pass, timeZone: null, tag: t.passes.nextTag({ name: pass.name, iss: true }) }), find: () => screen.getByTestId('card-first-line') },
  // R81 (FR-FIRST-10): the count and the sort share a line where the pane holds them and break at the separator on a phone,
  // so each half is a row of its own here, at `--small`.
  ...(['count', 'sort'] as const).map(
    (half): Row => ({
      name: `the count and sort line: the ${half} (FR-FIRST-10)`,
      element: createElement(PassList),
      find: () => (half === 'count' ? screen.getByRole('status') : screen.getByRole('group', { name: t.passes.sortGroup })),
      setUp: () => {
        appStore.setState({ observer, elements: ready, passes: { ...IDLE_PASSES, status: 'done', observer, passes: [pass], hasDarkness: true } });
      },
      budget: SMALL_BUDGET,
    }),
  ),
  // R97 (FR-FAINT-2): the count line's third piece, `[ show 12 faint ]` / `[ ocultar 12 tenues ]`, wraps at its own
  // separator like the sort, so it is a row of its own at `--small`, counted in both states with a two-digit count.
  ...([false, true] as const).map(
    (shown): Row => ({
      name: `the count line's faint control, ${shown ? 'hide' : 'show'} (FR-FAINT-2)`,
      element: createElement(FaintToggle, { count: 12 }),
      find: () => screen.getByTestId('faint-toggle'),
      setUp: () => {
        appStore.setState({ showFaint: shown });
      },
      budget: SMALL_BUDGET,
    }),
  ),
  // R76 (FR-FIRST-1, board 1B): `[01] where ── 02 when ── 03 what`, the rules the stylesheet's. The line is set at
  // `--small` (14 px), so a character is 14/16 of a cell and 36 cells hold 41 of them: the budget is written in
  // the row's own characters, and the 390 px width it stands for is unchanged.
  {
    name: 'the step line (FR-FIRST-1)',
    element: createElement(StepLine, { current: 'where' }),
    find: () => screen.getByTestId('step-line'),
    budget: Math.floor((BUDGET * 16) / 14),
  },
  // R82 (FR-FIRST-4 as amended v2.0.2): on the what step two steps are finished, `01 where ✓ ── 02 when ✓ ── [03] what`,
  // each a control back to its step — the line at its longest. A finished item holds its control, and `cells.ts`
  // counts a rule only on a leaf, so the line is its items' text and the stylesheet's ` ── ` between each pair.
  {
    name: 'the step line with two steps finished (FR-FIRST-4)',
    element: createElement(StepLine, { current: 'what', reached: 'what', onGo: noop }),
    find: () => screen.getByTestId('step-line'),
    measure: (line) => {
      const items = [...line.children].map((item) => item.textContent);
      return items.join(' ── ').length;
    },
    budget: SMALL_BUDGET,
  },
  // R76 (FR-FIRST-2): the primary action's label line; the button is the whole box now, and the note in it is a sentence and wraps.
  {
    name: 'the primary action (FR-FIRST-2)',
    element: createElement(UseMyLocation, { onObserver: noop, primary: true, env: { geolocation: {} as Geolocation, secure: true } }),
    find: () => within(screen.getByRole('button', { name: t.location.useMyLocation })).getByText(t.location.useMyLocation),
  },
  // R81 (FR-FIRST-3 as amended): the label line at `--small`, at its longest — an hour and more to go — and the path line under the clock time.
  {
    name: 'the next-event label (FR-FIRST-3)',
    element: createElement(NextEventBlock, { passes: [pass], timeZone: null, now: pass.start.t - (3 * 3600 + 45 * 60 + 7) * 1000, hours: 72 }),
    find: () => screen.getByTestId('next-event-label'),
    budget: SMALL_BUDGET,
  },
  { name: 'the next-event path (FR-FIRST-3)', element: createElement(NextEventBlock, { passes: [pass], timeZone: null, now: pass.start.t - 60_000, hours: 72 }), find: () => screen.getByTestId('next-event-path') },
  { name: 'the next-event live link (FR-LIVE-1)', element: createElement(NextEventBlock, { passes: [pass], timeZone: null, now: pass.start.t - 60_000, hours: 72 }), find: () => screen.getByTestId('now-live-link') },
  { name: 'the sort row (US-5 AC2 as amended)', element: createElement(SortToggle, { value: 'chronological', onChange: noop }), find: () => screen.getByRole('group', { name: t.passes.sortGroup }) },
  { name: 'the chart view control (FR-CHART-1)', element: chartView(), find: () => screen.getByRole('group', { name: 'View' }) },
  {
    name: 'the playback row (FR-LIVE-4)',
    element: createElement(PlaybackControls, { playing: false, speed: 60, onPlay: noop, onPause: noop, onSpeed: noop }),
    find: () => screen.getByTestId('playback-controls'),
  },
  { name: 'the hidden-objects toggle (FR-LIVE-6)', element: createElement(HiddenToggle, { hidden: false, onToggle: noop }), find: () => screen.getByTestId('live-hidden-toggle') },
  {
    // R70 (FR-SPAN-3, FR-COMP-4 as amended v1.4): the six controls the row is re-cut to are the tightest row in
    // the app, and the requirement names their number — 35 of the 36 — which is why the ±10 min pair could not stay.
    name: 'the stepping row (FR-TRAJ-5 as amended v1.4, FR-SPAN-3)',
    element: createElement(StepControls, { t: pass.start.t, span: { start: pass.start.t - 3_600_000, end: pass.start.t + 3_600_000 }, passes: [pass], onStep: noop }),
    find: () => screen.getByTestId('step-controls'),
    budget: 35,
  },
  { name: 'the share action (FR-SHARE-2)', element: createElement(ShareButton, { url: 'https://example.test/#live', title: 'x', text: 'y', label: t.live.shareShort, ariaLabel: t.live.share }), find: () => screen.getByRole('button', { name: t.live.share }) },
  /*
   * R77 (FR-WATCH-8, FR-COMP-4 as amended v2.0, V20-8): the live page's new compact rows, rendered from the page
   * itself so the order, the labels and the forms are the ones `Live.tsx` gives them — the top row with the
   * indicator (`[ ← ]`, the mark, the word, the place, which ellipsises past its cells: a ten-letter place
   * here), the two actions rows, and the conditions line at its longest.
   *
   * R85 (FR-COMP-7, D-549): the top row and the actions rows are pinned at `LIVE_ROW_BUDGET`, two cells inside
   * FR-COMP-4's 36, in both languages — the room to spare F-82 found Spanish did not have.
   */
  {
    // `[ ← ]`, the mark, `en vivo` and `Cipolletti`: 28 cells in Spanish.
    name: 'the live top row with the state indicator (FR-WATCH-2, V20-8, FR-COMP-7)',
    element: createElement(LivePage, { link: null, onLeave: noop }),
    find: () => screen.getByTestId('live-top-row'),
    setUp: withLiveSky,
    budget: LIVE_ROW_BUDGET,
  },
  {
    // `[ scrub ] [ list (1) ] [ Share ]`, 32 cells in English; `[ fijar ] [ ver 1 ] [ Compartir ]`, 33 in Spanish.
    name: 'the live watching actions row (FR-WATCH-4, V20-8, FR-COMP-7)',
    element: createElement(LivePage, { link: null, onLeave: noop }),
    find: () => screen.getByTestId('live-actions'),
    setUp: withLiveSky,
    budget: LIVE_ROW_BUDGET,
  },
  {
    // `[ live ] [ ] Hidden [ Share ]`, 29 cells; `[ vivo ] [ ] Ocultos [ Compartir ]`, 34.
    name: 'the live scrubbing actions row (FR-WATCH-4, V20-8, FR-COMP-7)',
    element: createElement(LivePage, { link: null, onLeave: noop }),
    find: () => screen.getByTestId('live-actions'),
    setUp: withLiveSky,
    after: () => {
      fireEvent.click(screen.getByTestId('live-scrub'));
    },
    budget: LIVE_ROW_BUDGET,
  },
  /*
   * R132 (FR-FLOW-4, D-846): the view row is one line — the view control in the facing picker's idiom, the chosen view
   * bracketed and the others plain (`Polar Dome [Window]`, 19 cells; `Polar Domo [Ventana]`, 20), and `[x] stars` /
   * `[x] estrellas` at the row's end: 30 cells in English and 35 in Spanish, the spec's numbers, on the live page and
   * the pass detail. R123's `inline` second line is gone with the row.
   */
  {
    name: 'the live view row (FR-FLOW-4, D-846)',
    element: createElement(LivePage, { link: null, onLeave: noop }),
    find: () => screen.getByTestId('live-layout').querySelector('[data-slot="viewRow"]') as Element,
    setUp: withLiveSky,
    budget: VIEW_ROW_BUDGET,
  },
  {
    name: 'the pass detail view row (FR-FLOW-4, D-846)',
    element: createElement(PassDetail, { pass, observer, onClose: noop, onShowList: noop }),
    find: () => screen.getByTestId('pass-layout').querySelector('[data-slot="viewRow"]') as Element,
    budget: VIEW_ROW_BUDGET,
  },
  {
    name: 'the pass detail view row’s [ stars ] line (FR-SKY-3)',
    element: createElement(PassDetail, { pass, observer, onClose: noop, onShowList: noop }),
    find: () => screen.getByTestId('stars-toggle'),
  },
  {
    // FR-WATCH-3: the clock, the longest sky word, the longest cloud word and a two-digit count — `21:14:32 crepúsculo limpio 12 arriba`.
    name: 'the live conditions line at its longest (FR-WATCH-3)',
    element: createElement(StatusStrip, { t: pass.start.t, timeZone: 'America/Argentina/Salta', sky: 'bright-twilight', cloud: { state: 'partly', effectivePct: 50, at: pass.start.t }, count: 12, moon: null }),
    find: () => screen.getByTestId('status-strip'),
  },
  /*
   * R87 (FR-VISIT-2): the visit notice on a phone is at most two rows — the sentence's short form, then the two
   * controls — each at `--small`, so each is counted in its own characters. The place is the longest a link can
   * name at the hash's two decimals shown: three digits of longitude and both signs. R105 (D-718): the notice is
   * a `Line`, whose actions row is the primitive's own element — found as the parent of the first control.
   */
  ...(['sentence', 'actions'] as const).map(
    (part): Row => ({
      name: `the visit notice: the ${part} (FR-VISIT-2)`,
      element: createElement(VisitNotice),
      find: () => (part === 'sentence' ? screen.getByTestId('visit-sentence') : (screen.getByTestId('visit-back').parentElement as Element)),
      setUp: () => {
        appStore.setState({ observer, visiting: { ...observer, lat: -38.93, lon: -167.99, label: '−38.93, −167.99' } });
      },
      budget: SMALL_BUDGET,
    }),
  ),
  { name: 'the settings install row (V11-16)', element: createElement(InstallAction, { env: { standalone: undefined } }), find: () => screen.getByTestId('install-action').parentElement as Element, setUp: offerAnInstall },
  /*
   * R115 (FR-STAR-3, FR-STAR-10, FR-COMP-4): the stars page's compact rows, from the page itself — the facing picker
   * (`N NE E SE [S] SW W NW up`, the compact speeds' tight form with a cell between, D-245: 24 cells in English, 28 in Spanish with `arriba`), the
   * layers' two rows of two (`[x] stars [x] figures` 21 and 25; one row of four would be 43 and 51, D-776), and the
   * When pane's way in at `--small` (`Estrellas esta noche · [ mirá arriba ]`, 38 of its 41).
   */
  {
    name: 'the stars facing row (FR-STAR-3)',
    element: createElement(StarsPage),
    find: () => screen.getByRole('group', { name: starsPage(t).facing }),
    setUp: () => {
      appStore.setState({ observer });
    },
  },
  // R132 (FR-FLOW-8): two rows — three toggles then `names` and `passes` in English (33 and 19 cells), two then three in
  // Spanish (25 and 34), the split cut to the budget by `firstRowCount`.
  ...([0, 1] as const).map(
    (index): Row => ({
      name: `the stars layers row ${String(index + 1)} (FR-STAR-3, FR-SKY-6)`,
      element: createElement(StarsPage),
      find: () => screen.getAllByTestId('stars-layers-row')[index] as Element,
      setUp: () => {
        appStore.setState({ observer });
      },
    }),
  ),
];

/** The stars page's own words for the catalog `rows` was given (they ride in the page's chunk, D-777). */
const starsPage = (t: Messages) => STARS_PAGE_CATALOGS[t === CATALOGS.es ? 'es' : 'en'];

beforeEach(() => {
  media = stubMatchMedia(COMPACT_PX);
});

afterEach(() => {
  // This file runs under the `node` project with the jsdom pragma above, so it
  // does not get `tests/setup/vitest.jsdom.ts` and RTL's automatic cleanup.
  cleanup();
  media.restore();
  appStore.setState(initial, true);
  localStorage.clear();
  forgetInstallOffer();
});

describe.each(LOCALES)('FR-COMP-4: every compact control row fits %s in 36 cells', (locale: Locale) => {
  it.each(rows(CATALOGS[locale]).map((row) => [row.name, row] as const))('%s', (_name, row) => {
    row.setUp?.();
    render(createElement(I18nProvider, { locale, children: row.element }));
    row.after?.();
    const element = row.find();
    const cells = row.measure ? row.measure(element) : rowCells(element, table);
    expect(cells, `${row.name} in ${locale}: ${rowParts(element, table).join(' | ')}`).toBeLessThanOrEqual(row.budget ?? BUDGET);
  });
});

/**
 * R129 (FR-FLOW-3, FR-COMP-7 as amended v2.6, D-845): the four compact sub-page rows — `[ ← ]`, the page's name (on
 * the live page the state indicator in its place: the mark and `live` / `en vivo`) and the context — at 360 and
 * 390 px in both languages. The context ellipsises, so what is pinned is the row's fixed part and that the context
 * it is about shows whole beside it: a coordinate pair (FR-COMP-7's, 14 cells) for the place, the date for the pass.
 * At 390 px the row with it stays inside FR-COMP-7's 34 cells; at 360 px inside what that width has.
 */
describe.each(LOCALES)('FR-FLOW-3: the four compact sub-page rows in %s', (locale: Locale) => {
  /** The cells a viewport gives a row on the widest font in the stack, less the shell's padding (F-10). */
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const context = (page: HeaderPage): string => (page === 'pass' ? formatDate(pass.start.t, null, locale) : observer.label);
  const header = (page: HeaderPage, withContext: boolean): ReactElement =>
    createElement(Header, { page, context: withContext ? context(page) : null, onBack: noop, ...(page === 'live' ? { status: createElement(StateIndicator, { held: false }) } : {}) });
  /** The fixed part — `[ ← ]`, the name, the gaps — in cells, per page; the Done note's numbers. */
  const FIXED: Record<Locale, Record<(typeof SUB_PAGES)[number], number>> = {
    en: { live: 14, stars: 11, pass: 10, settings: 14 },
    es: { live: 17, stars: 15, pass: 10, settings: 13 },
  };

  it.each(SUB_PAGES)('%s: the fixed part, and the context whole beside it at 390 and 360 px', (page) => {
    const fixed = render(createElement(I18nProvider, { locale, children: header(page, false) }));
    const bare = screen.getByTestId('header');
    expect(rowCells(bare, table), rowParts(bare, table).join(' | ')).toBe(FIXED[locale][page]);
    fixed.unmount();
    render(createElement(I18nProvider, { locale, children: header(page, true) }));
    const row = screen.getByTestId('header');
    const cells = rowCells(row, table);
    expect(cells, rowParts(row, table).join(' | ')).toBe(FIXED[locale][page] + 1 + context(page).length);
    expect(cells, `${page} at 390 px`).toBeLessThanOrEqual(Math.min(LIVE_ROW_BUDGET, rowCellsAt(390)));
    expect(cells, `${page} at 360 px`).toBeLessThanOrEqual(rowCellsAt(360));
  });
});

/**
 * R132 (FR-FLOW-4, D-846): the view row at 360 and 390 px in both languages, on the live page and the pass detail —
 * `Polar Dome [Window]  [x] stars` is 30 cells and `Polar Domo [Ventana]  [x] estrellas` 35, the spec's numbers; at
 * 390 px inside FR-COMP-4's 36, at 360 px inside what that width has on the widest font in the stack.
 */
describe.each(LOCALES)('FR-FLOW-4: the view row at 360 and 390 px in %s', (locale: Locale) => {
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  // `cells.ts` counts one cell between a row's controls; the spec's 30 and 35 count the two the row's end leaves.
  const EXPECTED: Record<Locale, number> = { en: 29, es: 34 };

  it.each([
    ['the live page', () => createElement(LivePage, { link: null, onLeave: noop }), 'live-layout', withLiveSky],
    ['the pass detail', () => createElement(PassDetail, { pass, observer, onClose: noop, onShowList: noop }), 'pass-layout', noop],
  ] as const)('%s: one line, the spec’s cells, inside both widths', (_name, element, layoutId, setUp) => {
    setUp();
    render(createElement(I18nProvider, { locale, children: element() }));
    const row = screen.getByTestId(layoutId).querySelector('[data-slot="viewRow"]') as Element;
    const cells = rowCells(row, table);
    expect(cells, rowParts(row, table).join(' | ')).toBe(EXPECTED[locale]);
    expect(cells, 'at 390 px').toBeLessThanOrEqual(Math.min(BUDGET, rowCellsAt(390)));
    // At 360 px the widest font gives the row 33 cells: the English row is inside it; the Spanish row is the spec's
    // own 35 (FR-FLOW-4), two past it, so `[x] estrellas` wraps under the control there — a finding for the spec,
    // recorded in R132's summary; this pins the number so the gap cannot grow unnoticed.
    expect(cells, 'at 360 px').toBeLessThanOrEqual(Math.max(rowCellsAt(360), VIEW_ROW_BUDGET));
    if (locale === 'en') expect(cells, 'at 360 px').toBeLessThanOrEqual(rowCellsAt(360));
  });
});

/**
 * R126 (FR-STAR-10 as amended v2.5, D-832): the longest Spanish names in
 * `In this field` at 360 px — `Cabeza de la Serpiente` and `Cabellera de
 * Berenice`, 22 and 21 characters. A row is the name column and three fixed
 * ones (`FieldList.module.css`: 8, 4 and 3 cells, a cell between each), so at
 * 360 px the name has what the fixed columns leave, which is less than either
 * name: the row stays one line because the name column is cut — no wrap,
 * hidden overflow, `…` — and the button's accessible name carries the whole
 * name. A pass's row is the same columns with the key and the swatch at the
 * head of its name column, and the whole sentence as what is read.
 */
describe('FR-STAR-10: the longest Spanish names in In this field at 360 px', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/screens/stars/FieldList.module.css'), 'utf8');
  const block = (selector: string): string => new RegExp(`\\n${selector.replace('.', '\\.')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  /** The cells a 360 px viewport gives a row on the widest font in the stack, less the shell's padding (F-10). */
  const rowCells360 = Math.floor(360 / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const fixed = [...block('.row').matchAll(/calc\((\d+) \* var\(--cell\)\)/g)].map((match) => Number(match[1]));
  const nameCells = rowCells360 - fixed.reduce((sum, cells) => sum + cells, 0) - fixed.length;
  const LONGEST = ['Cabeza de la Serpiente', 'Cabellera de Berenice'];

  it('leaves the name a column narrower than either name, and cuts it on one line with …', () => {
    expect(fixed).toEqual([8, 4, 3]);
    expect(nameCells).toBeGreaterThan(0);
    for (const name of LONGEST) expect(name.length).toBeGreaterThan(nameCells);
    const name = block('.name');
    expect(name).toMatch(/white-space: nowrap;/);
    expect(name).toMatch(/overflow: hidden;/);
    expect(name).toMatch(/text-overflow: ellipsis;/);
    expect(name).toMatch(/min-width: 0;/);
  });

  it.each(LONGEST)('reads “%s” whole as the row’s accessible name, the drawn text the same name in the cut column', (longest) => {
    render(
      createElement(I18nProvider, {
        locale: 'es',
        children: createElement(FieldList, {
          objects: [{ index: 1, name: longest, planet: null, mag: 2.6, altDeg: 45, point: 'SSW' }],
          passes: [{ id: 'p', key: 'A', color: 'series-1', name: longest, state: 'live', peakAltDeg: 64, peakPoint: 'NNW' }],
          named: null,
          onName: () => undefined,
          buried: false,
          labelledBy: 'h',
        }),
      }),
    );
    const star = screen.getByRole('button');
    expect(star.getAttribute('aria-label')).toBe(`${longest} · mag 2,6 · 45° de altura · SSW`);
    expect(star.firstElementChild?.textContent).toBe(longest);
    const pass = screen.getByTestId('field-list').querySelector('[data-kind="pass"]');
    expect(pass?.textContent).toContain(`A: ${longest} · arriba`);
    // The pass's name column opens with the key and the two-cell swatch, and still has room for a name to cut.
    expect(nameCells - 'A '.length - 3).toBeGreaterThan(0);
  });
});

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, FR-COMP-4): the phone's when and what
 * steps. Their rows are a label at the left and a value at the right with at
 * least a cell between (`Steps.module.css` `.row`), so a row is the two and a
 * cell; they are counted here at their longest — the longest phase at 100 %,
 * the longest cloud word, two-digit counts, a clock that has to say UTC —
 * rather than at whatever the fixture's night happens to hold. The bracketed
 * controls draw `[ ` and ` ]` round their text. The more controls and the foot
 * line break between their pieces where a phone cannot hold them all (as the
 * count and sort line does), so each piece is a row, and `[ edit ]` stands on
 * the foot's last line with the cloud word; the foot is set at `--small`.
 */
describe.each(LOCALES)('FR-FIRST-4: every row of the phone’s steps fits %s in 36 cells', (locale: Locale) => {
  const t = CATALOGS[locale];
  const row = (label: string, value: string): number => label.length + 1 + value.length;
  const control = (text: string): number => `[ ${text} ]`.length;
  const clock = '05:31 UTC';
  const phases = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'] as const;
  const clouds = ['clear', 'partly', 'obscured', 'unknown'] as const;

  it.each([
    ['Dark from', () => row(t.home.whenStep.darkFrom, clock)],
    ['Until', () => row(t.home.whenStep.until, clock)],
    ['Passes in it', () => row(t.home.whenStep.passesIn, t.home.whenStep.passesValue({ tonight: 99, total: 99, hours: 72 }))],
    ['Clouds tonight', () => Math.max(...clouds.map((cloud) => row(t.home.whenStep.clouds, t.weather.state[cloud])))],
    ['Moon', () => Math.max(...phases.map((phase) => row(t.home.whenStep.moon, t.home.whenStep.moonValue({ phase, illumination: '100' }))))],
    ['[ See what crosses ]', () => control(t.home.whenStep.next)],
    ['[ n more tonight ]', () => control(t.home.whatStep.moreTonight(99))],
    ['[ n more nights ]', () => control(t.home.whatStep.moreNights(99))],
    // R97 (FR-FAINT-2): the faint control after `[<n> more tonight]`, in its longer state.
    ['[ hide n faint ]', () => Math.max(control(t.passes.faintToggle({ shown: false, count: 99 })), control(t.passes.faintToggle({ shown: true, count: 99 })))],
  ] as const)('the %s row', (_name, cells) => {
    expect(cells()).toBeLessThanOrEqual(BUDGET);
  });

  it('the foot line, piece by piece at --small, with [ edit ] on its last line', () => {
    for (const cloud of clouds) {
      const pieces = t.home.whatStep.foot({ place: '−38.93, −67.99', dark: { from: '20:14', to: clock }, cloud });
      const last = pieces[pieces.length - 1] ?? '';
      for (const piece of pieces.slice(0, -1)) expect(`${piece} ·`.length, piece).toBeLessThanOrEqual(SMALL_BUDGET);
      expect(last.length + 1 + control(t.home.whatStep.edit), last).toBeLessThanOrEqual(SMALL_BUDGET);
    }
    expect(t.home.whatStep.foot({ place: 'x', dark: 'none', cloud: 'unknown' })[1]?.length).toBeLessThanOrEqual(SMALL_BUDGET);
  });
});

/**
 * R75 (FR-SET-1, FR-COMP-4): the settings page's own rows, measured on the page
 * itself rather than on a component alone, because two of them are the page's
 * composition — `[ Use my location ] [ coordinates ]` and
 * `[ Save this place ] [ Clear saved ]` — and the three in This browser are a
 * label column and a control column. A label-and-control row is as wide as the
 * *longest* label in that language, one cell of gap, and its control: the
 * labels are one grid column, so a short label still reserves the long one's
 * width.
 */
describe.each(LOCALES)('FR-SET-1: every settings row fits %s in 36 cells', (locale: Locale) => {
  const t = CATALOGS[locale];
  let restoreGeolocation: () => void = noop;

  beforeEach(() => {
    // `UseMyLocation` draws nothing without a secure context and a geolocation API, and jsdom has neither.
    const secure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: noop }, configurable: true });
    Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
    restoreGeolocation = () => {
      Reflect.deleteProperty(navigator, 'geolocation');
      if (secure) Object.defineProperty(globalThis, 'isSecureContext', secure);
      else Reflect.deleteProperty(globalThis, 'isSecureContext');
    };
    appStore.setState({ observer, favourites: [{ cellKey: '-38.93,-67.99', observer, addedAt: 0, lastUsedAt: 0 }] });
    offerAnInstall();
    render(createElement(I18nProvider, { locale, children: createElement(SettingsPage, { backRef: createRef<HTMLButtonElement>(), installEnv: { standalone: undefined } }) }));
  });

  afterEach(() => {
    restoreGeolocation();
  });

  it('the device row: [ Use my location ] [ coordinates ]', () => {
    const row = screen.getByTestId('location-actions');
    expect(row.contains(screen.getByRole('button', { name: t.location.useMyLocation }))).toBe(true);
    expect(rowCells(row, table), rowParts(row, table).join(' | ')).toBeLessThanOrEqual(BUDGET);
  });

  it('the save row: [ Save this place ] [ Clear saved ]', () => {
    const row = screen.getByTestId('save-favourite').parentElement as Element;
    expect(row.contains(screen.getByTestId('clear-saved-location'))).toBe(true);
    expect(rowCells(row, table), rowParts(row, table).join(' | ')).toBeLessThanOrEqual(BUDGET);
  });

  it('the saved place row: [ <label> ] (in use) [ × ]', () => {
    const row = screen.getByTestId('favourite');
    expect(rowCells(row, table), rowParts(row, table).join(' | ')).toBeLessThanOrEqual(BUDGET);
  });

  it.each([
    ['Language', () => screen.getByRole('group', { name: t.app.language })],
    ['Theme', () => screen.getByRole('group', { name: t.app.theme })],
    ['Install', () => screen.getByTestId('settings-install')],
  ] as const)('the %s row: its label and its control', (_name, control) => {
    const labels = [t.app.language, t.app.theme, t.install.action];
    const column = Math.max(...labels.map((label) => label.length));
    const cells = column + 1 + rowCells(control(), table);
    expect(cells, `${String(column)} + 1 + ${rowParts(control(), table).join(' | ')}`).toBeLessThanOrEqual(BUDGET);
  });
});

/**
 * R74 (FR-COMP-1 as amended, D-441): the row's arithmetic, not merely the
 * budget it fits inside. The mark is three cells — a 24 px box needs three of
 * the 9.6 px cells and would spill out of two — and the row is
 * `mark + 'Your sky' + [ live ] + [ settings ]` with a cell of gap between each
 * pair: 3 + 8 + 8 + 12 and three gaps, **34** of the 36.
 *
 * FR-COMP-1 and D-441 both say 33. The difference is the gap after the mark:
 * the row without it was 8 + 8 + 12 and two gaps = 30, and adding a three-cell
 * mark makes 33 only if the mark touches the title. It does not — `.brand` puts
 * a cell between them, which is the same cell the wide tagline's indent is
 * built from — so the row measures 34, still three inside FR-COMP-4's 36. The
 * number is pinned here so a mark that quietly grew a cell fails at the
 * arithmetic rather than at the far edge of the budget.
 */
it('counts the compact header with the mark at 34 cells (FR-COMP-1, D-441)', () => {
  render(createElement(I18nProvider, { locale: 'en', children: createElement(Header) }));
  const header = screen.getByTestId('header');
  expect(screen.getByTestId('mark').getAttribute('data-mark-cells')).toBe('3');
  expect(rowCells(header, table), rowParts(header, table).join(' | ')).toBe(34);
});

/**
 * R93 (FR-HOME-1, D-546, D-605; F-76): the wide header's fold. The title row
 * and the tagline are each one line at every wide width in both languages, and
 * what makes that true is not measured at run time: each line's width in cells
 * is known from the catalog, so `Header.module.css` carries one pixel literal
 * per language per line, derived as the breakpoints are (`thresholdPx`, F-10),
 * under which the tagline is not drawn. R129 (FR-FLOW-3, D-845): the title row
 * lost the switches and its fold with them; what is pinned for it now is that a
 * sub-page's row fits the wide breakpoint with room for its context.
 * This is where those literals are recomputed — from the catalogs, the mark's
 * declared cells, and the gaps the stylesheets declare, which are read rather
 * than remembered — so a longer word in either catalog moves the number here
 * before it wraps the header on a screen.
 */
const HEADER_CSS = readFileSync(resolve(process.cwd(), 'src/ui/components/common/Header.module.css'), 'utf8');

/** The `@media (width < N px)` blocks of a stylesheet: the literal and the rules under it. */
function foldBlocks(css: string): { px: number; body: string }[] {
  const blocks: { px: number; body: string }[] = [];
  for (const match of css.matchAll(/@media\s*\(width\s*<\s*(\d+)px\)\s*\{/g)) {
    let depth = 1;
    let i = match.index + match[0].length;
    const from = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ px: Number(match[1]), body: css.slice(from, i - 1) });
  }
  return blocks;
}

/** The one literal under which `locale`'s block hides the tagline. */
function foldLiteral(locale: Locale): number {
  const found = foldBlocks(HEADER_CSS).filter(({ body }) => body.includes(`:root[lang='${locale}']`) && body.includes('.tagline'));
  expect(found, `Header.module.css should fold the tagline once for ${locale}`).toHaveLength(1);
  return found[0]?.px ?? NaN;
}

/** A gap or padding declared in cells, read from the rule itself. */
function cellsOf(css: string, selector: string, property: 'gap' | 'padding'): number {
  const block = new RegExp(`${selector.replace(/[.\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  expect(block, `${selector} should be a rule`).not.toBeNull();
  const value = new RegExp(`${property}:\\s*([^;]+);`).exec(block?.[1] ?? '')?.[1] ?? '';
  const calc = /calc\((\d+)\s*\*\s*var\(--cell\)\)/.exec(value);
  if (calc) return Number(calc[1]);
  expect(value, `${selector}'s ${property} should be in cells`).toMatch(/var\(--cell\)/);
  return 1;
}

describe.each(LOCALES)('FR-HOME-1, FR-FLOW-3: the wide header row and its tagline in %s (D-546, D-845)', (locale: Locale) => {
  const t = CATALOGS[locale];
  const control = (text: string): number => `[ ${text} ]`.length;
  const rowGap = cellsOf(HEADER_CSS, '.row', 'gap');
  const navGap = cellsOf(HEADER_CSS, '.nav', 'gap');
  let markCells = 0;

  beforeEach(() => {
    media.restore();
    media = stubMatchMedia(1280);
    render(createElement(I18nProvider, { locale, children: createElement(Header) }));
    markCells = Number(screen.getByTestId('mark').getAttribute('data-mark-cells'));
    expect(markCells).toBeGreaterThan(0);
  });

  it('never wraps the row, and draws the full title at every wide width', () => {
    expect(HEADER_CSS).toMatch(/\.row\s*\{[^}]*flex-wrap:\s*nowrap;/);
    expect(HEADER_CSS).toMatch(/\.title\s*\{[^}]*white-space:\s*nowrap;/);
    expect(HEADER_CSS).not.toMatch(/attr\(data-short\)/);
    expect(screen.getByRole('heading', { level: 1, name: t.app.title })).toBeTruthy();
  });

  it('fits a sub-page’s row — [ ← ], the mark and title, the three links, the context, [ settings ] — in the wide breakpoint, the context with ten cells at least', () => {
    // R129 (D-845): with the switches gone the title has no short form on wide; the context is what ellipsises.
    const nav = Object.values({ home: t.header.pages.home, live: t.header.pages.live, stars: t.header.pages.stars }).reduce((sum, word) => sum + word.length, 0) + 2 * navGap;
    const fixed = 2 * SHELL_PADDING_CELLS + control(t.header.back) + rowGap + markCells + 1 + t.app.title.length + rowGap + nav + rowGap + rowGap + control(t.settings.open);
    expect(fixed).toBe(locale === 'es' ? 89 : 79);
    expect(WIDE_CELLS - fixed).toBeGreaterThanOrEqual(10);
    expect(thresholdPx(fixed + 10)).toBeLessThanOrEqual(WIDE_MIN_PX);
  });

  it('draws a sub-page’s row with [ ← ] and a long place as counted above, and at 1024 px the place gives first, then the title, never the links', () => {
    // The finding this answers: on a full Spanish row near 1024 px every item shrank by its share and the title drew
    // over `inicio`. The rendered row — not only the arithmetic — is measured here, `[ ← ]` and the place on it.
    const place = 'San Carlos de Bariloche, Río Negro, Argentina';
    const { container } = render(createElement(I18nProvider, { locale, children: createElement(Header, { page: 'live', context: place, onBack: noop }) }));
    const row = within(container).getByTestId('header');
    const parts = rowParts(row, table);
    const nav = [t.header.pages.home, t.header.pages.live, t.header.pages.stars];
    expect(parts.slice(1)).toEqual(['#'.repeat(markCells), t.app.title, ...nav, place, expect.stringContaining(t.settings.open)]);
    expect(parts[0]).toContain(t.header.back);
    // The row's gaps: two cells between its items, one between the mark and the title, the nav's between its links.
    const drawn = parts.filter((part) => part !== place).reduce((sum, part) => sum + part.length, 0);
    const measured = 2 * SHELL_PADDING_CELLS + drawn + 4 * rowGap + 1 + 2 * navGap;
    expect(measured, parts.join(' | ')).toBe(locale === 'es' ? 89 : 79);
    const at1024 = Math.floor(1024 / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX));
    expect(at1024 - measured, 'the place keeps cells at 1024 px').toBeGreaterThanOrEqual(10);
    expect(at1024 - measured).toBeLessThan(place.length + rowGap);
    // What gives, in order: the place (its shrink weight dwarfs the title's), then the title, cut with an ellipsis;
    // `[ ← ]`, the links and `[ settings ]` never shrink.
    const rule = (selector: string): string => new RegExp(`(?:^|\\n)${selector.replace(/[.\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(HEADER_CSS)?.[1] ?? '';
    expect(rule('.wide .context')).toMatch(/flex:\s*0 1000 auto;/);
    expect(rule('.context')).toMatch(/text-overflow:\s*ellipsis;/);
    expect(rule('.title')).toMatch(/min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/);
    expect(rule('.brand')).toMatch(/min-width:\s*0;/);
    for (const fixed of ['.back', '.nav', '.settings']) expect(rule(fixed), fixed).toMatch(/flex:\s*0 0 auto;/);
  });

  it('hides the tagline under the width its one line needs: the indent and its words', () => {
    const cells = 2 * SHELL_PADDING_CELLS + markCells + 1 + t.app.tagline.length;
    expect(cells).toBe(locale === 'es' ? 109 : 88);
    expect(foldLiteral(locale)).toBe(thresholdPx(cells));
  });
});

/**
 * R143 (FR-TONIGHT-4, FR-TONIGHT-7, FR-COMP-4): the compact live page's new rows — the taps row
 * (`▶ [ tonight ] [ next ] [ now ]`), every chip form of the headline and every form of the context line — in both
 * languages, from the catalogs (`tonightRows.ts` words them at their longest). Each is at most 36 characters
 * (FR-COMP-4, FR-TONIGHT-7's "at most 36 cells in both languages") and inside what 390 and 360 px hold on the widest
 * font, the headline and the context line counted at their own sizes (1.25 rem and `--small`). The snapshot is the
 * strings' snapshot FR-TONIGHT-7 asks for, with the counts the task's Done note lists.
 *
 * The one exception is the taps row while playing in Spanish at 360 px: `❚❚ [ noche ] [ próximo ] [ ahora ]` is 34
 * cells, one past 33. The spec pins the labels and the glyph, so this pins the number, as FR-FLOW-4's view row does;
 * recorded in R143's summary.
 */
describe.each(LOCALES)('FR-TONIGHT-4, FR-TONIGHT-7: the taps row, the chip and the context line in %s', (locale: Locale) => {
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const t = CATALOGS[locale];
  const all = [...tapsRows(t), ...chipRows(t, locale), ...contextRows(t)];

  it.each(all.map((row) => [row.name, row] as const))('%s: within 36 cells, and inside 390 and 360 px', (_name, row) => {
    expect(row.text.length, row.text).toBeLessThanOrEqual(BUDGET);
    expect(row.cells, `${row.text} at 390 px`).toBeLessThanOrEqual(rowCellsAt(390));
    const spanishPause = locale === 'es' && row.text.startsWith(t.live.pauseGlyph);
    expect(row.cells, `${row.text} at 360 px`).toBeLessThanOrEqual(spanishPause ? 34 : rowCellsAt(360));
  });

  it('the taps row is the spec’s: 30 cells in English, 33 in Spanish', () => {
    expect(tapsRows(t)[0]?.cells).toBe(locale === 'en' ? 30 : 33);
  });

  it('the strings, with their cells', () => {
    expect(all.map((row) => `${row.name} | ${row.text} | ${String(row.text.length)} chars | ${String(row.cells)} cells`)).toMatchSnapshot();
  });
});
