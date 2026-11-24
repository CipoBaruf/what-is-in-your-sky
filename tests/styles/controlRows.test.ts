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
 * draws, the boxes its stylesheets add (R206: a cell each side), and one cell
 * of gap between each pair of controls, a quarter between two options.
 *
 * What this cannot see is CSS wrapping — jsdom lays nothing out — so the number
 * is the budget and the 390 px captures in the task are the proof. What it can
 * see, and what no capture would catch in both languages on every task, is a
 * label growing past the row it has to live on.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement, createRef, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../support/matchMedia';
import { goldenPassFixture } from '../support/catalogFixtures';
import { CATALOGS, I18nProvider } from '../../src/i18n/useT';
import { LOCALES } from '../../src/i18n/locale';
import { BASE_FONT_PX, CELL_ADVANCE_EM_MAX, RAIL_MIN_CELLS, SHELL_PADDING_CELLS, WIDE_CELLS, WIDE_MIN_PX } from '../../src/lib/layout';
import { FieldList } from '../../src/ui/components/live/FieldList';
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
import { HiddenToggle } from '../../src/ui/components/sky/time/PlaybackControls';
import { StepControls } from '../../src/ui/components/live/StepControls';
import { SortToggle } from '../../src/ui/components/passes/SortToggle';
import { ToggleGroup } from '../../src/ui/components/primitives/ToggleGroup';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from '../../src/ui/components/common/installOffer';
import { SettingsPage } from '../../src/ui/screens/Settings';
import { UseMyLocation } from '../../src/ui/components/location/UseMyLocation';
import { NextEventBlock } from '../../src/ui/components/passes/NextEventBlock';
import { LivePage } from '../../src/ui/screens/Live';
import { PassDetail } from '../../src/ui/screens/PassDetail';
import { VisitNotice } from '../../src/ui/components/common/VisitNotice';
import { FaintToggle } from '../../src/ui/components/passes/FaintToggle';
import { SkyHead } from '../../src/ui/components/sky/SkyHead';
import { DETAIL_TIMES_CELLS } from '../../src/lib/format';
import { TimesRow } from '../../src/ui/components/guide/TimesRow';
import type { HeaderPage } from '../../src/i18n/messages';
import { decorations, rowCells, rowParts } from './cells';
import { chipRows, contextRows, tapsRows } from './tonightRows';
import { NextPassStrip } from '../../src/ui/components/live/NextPassStrip';

/** FR-COMP-4: a 390 px viewport at the default cell. */
const BUDGET = 36;
/** A row set at `--small` (14 px): 36 cells of the 16 px body hold 41 of its characters (D-504). */
const SMALL_BUDGET = Math.floor((BUDGET * 16) / 14);
/** FR-COMP-7 (R85, D-549): the compact live page's top row and actions rows keep two cells of the 36 spare. */
const LIVE_ROW_BUDGET = BUDGET - 2;
/** R132 (FR-FLOW-4, D-846): the view row is 30 cells in English and 35 in Spanish, and the spec pins the Spanish number. */
const VIEW_ROW_BUDGET = 35;
/** R129 (FR-FLOW-3), R212 (D-1231): the pages with the header's compact `[ ← ]` row; live and the satellites' list are tabs. */
const SUB_PAGES = ['settings'] as const satisfies readonly HeaderPage[];

const CSS = [
  'src/ui/components/common/Header.module.css',
  'src/ui/components/location/WherePlace.module.css',
  'src/ui/components/passes/PassCard.module.css',
  'src/ui/components/passes/PassList.module.css',
  'src/ui/components/common/InstallAction.module.css',
  // R104 (FR-DS-4, D-704), R206 (D-1226): the boxes and the blocks are the primitives' alone, read off their modules.
  'src/ui/components/primitives/TextButton.module.css',
  'src/ui/components/primitives/OptionToggle.module.css',
  'src/ui/components/common/ShareButton.module.css',
  'src/ui/components/sky/time/PlaybackControls.module.css',
  'src/ui/components/live/StepControls.module.css',
  'src/ui/screens/Settings.module.css',
  'src/ui/components/location/UseMyLocation.module.css',
  'src/ui/components/location/Favourites.module.css',
  'src/ui/components/location/LocationInput.module.css',
  'src/ui/App.module.css',
  'src/ui/components/passes/NextEventBlock.module.css',
  'src/ui/screens/Live.module.css',
  'src/ui/components/live/StateIndicator.module.css',
  'src/ui/components/common/VisitNotice.module.css',
].map((file) => resolve(process.cwd(), file));

const table = decorations(CSS);
/** R223 (D-1298): the share of a cell between two step buttons, as `StepControls.module.css` declares it. */
const stepGap = (): number => {
  const part = /\.steps \{[^}]*gap: 0 calc\(var\(--cell\) \/ (\d+)\)/.exec(readFileSync('src/ui/components/live/StepControls.module.css', 'utf8'))?.[1];
  if (part === undefined) throw new Error('StepControls.module.css: .steps has no gap in shares of a cell');
  return 1 / Number(part);
};

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

/** R212 (D-1230): the head has no Back on the first page, live with nothing behind it. */
const offTheFirstPage = (): void => {
  window.history.replaceState(null, '', '#settings');
};

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
  // R212 (FR-LAND-6, D-1231): the two tabs' rows, each linking the other.
  ...(['live', 'pass'] as const).map(
    (page): Row => ({ name: `the compact header of the ${page} tab (FR-COMP-1)`, element: createElement(Header, { page }), find: () => screen.getByTestId('header') }),
  ),
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
  // D-1024 (FR-FLOW-2 amended): the folded Where has no ready line of its own any more (R156's `[ details ]` alone is
  // gone); its place row clips the place, as the place line above does.
  // R156 (FR-PHONE-14, D-978): the pass detail's one times row at its longest — a three-letter point with a
  // shadow entry, 36 cells — and the plain line with the same peak, within `DETAIL_TIMES_CELLS`.
  ...(['shadow', 'horizon'] as const).map(
    (endReason): Row => ({
      name: `the pass detail's times row, ${endReason} (FR-PHONE-14)`,
      element: createElement(TimesRow, { pass: { ...pass, endReason, peak: { ...pass.peak, elDeg: 89.9, azDeg: 22.5 } }, timeZone: null, compact: true }),
      find: () => screen.getByTestId('pass-times'),
      budget: DETAIL_TIMES_CELLS,
    }),
  ),
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
  { name: 'the chart view control (FR-COMP-4)', element: chartView(), find: () => screen.getByRole('group', { name: 'View' }) },
  // R145 (FR-TONIGHT-6): the playback row is wide's alone (the compact page plays from `TimeTaps`, pinned below), so it has no compact row here.
  { name: 'the hidden-objects toggle (FR-LIVE-6)', element: createElement(HiddenToggle, { hidden: false, onToggle: noop }), find: () => screen.getByTestId('live-hidden-toggle') },
  {
    // R70 (FR-SPAN-3, FR-COMP-4 as amended v1.4) counted the row at 35; R144 took it off compact, and R223 (FR-CTRL-16,
    // D-1298) boxed its six buttons, so it is held to the wide rail it stands in, 44 cells at the least.
    name: 'the stepping row (FR-TRAJ-5 as amended v1.4, FR-SPAN-3)',
    element: createElement(StepControls, { t: pass.start.t, span: { start: pass.start.t - 3_600_000, end: pass.start.t + 3_600_000 }, passes: [pass], onStep: noop }),
    find: () => screen.getByTestId('step-controls'),
    budget: RAIL_MIN_CELLS,
    // The boxes stand half a cell apart (StepControls.module.css), not the one cell `rowCells` counts between a pair.
    measure: (row) => rowCells(row, table) - (row.querySelectorAll(':scope > button').length - 1) * (1 - stepGap()),
  },
  { name: 'the share action (FR-SHARE-2)', element: createElement(ShareButton, { url: 'https://example.test/#live', title: 'x', text: 'y', label: t.live.shareShort, ariaLabel: t.live.share }), find: () => screen.getByRole('button', { name: t.live.share }) },
  /*
   * R77 (FR-WATCH-8, FR-COMP-4 as amended v2.0, V20-8): the live page's new compact rows, rendered from the page
   * itself so the order, the labels and the forms are the ones `Live.tsx` gives them — the top row with the
   * indicator (`[ ← ]`, the mark, the word, the place, which ellipsises past its cells: a ten-letter place
   * here), the two actions rows, and the conditions line at its longest (R145: gone with FR-TONIGHT-6, and its row
   * here with it).
   *
   * R85 (FR-COMP-7, D-549): the top row and the actions rows are pinned at `LIVE_ROW_BUDGET`, two cells inside
   * FR-COMP-4's 36, in both languages — the room to spare F-82 found Spanish did not have.
   */
  // R148 (FR-FULL-2, D-920): the compact live top row is gone — the head over the sky and the sheet's head are `sheetRows.test.ts`'s rows.
  // R132 (FR-FLOW-8) → R206 (D-1249) → R222 (FR-LAND-3, D-1240): the live page's `Layers`, the stars page's rows — three
  // toggles then `names` (25.5 and 7 cells in English, 30.5 and 9 in Spanish), split by `firstRowCount` — then `Hidden`.
  ...([0, 1] as const).map(
    (index): Row => ({
      name: `the live layers row ${String(index + 1)} (FR-LAND-3, FR-STAR-3)`,
      element: createElement(LivePage, { link: null }),
      find: () => screen.getAllByTestId('stars-layers-row')[index] as Element,
      setUp: withLiveSky,
    }),
  ),
  {
    name: 'the live layers row of the page’s own (FR-LIVE-6)',
    element: createElement(LivePage, { link: null }),
    find: () => screen.getByTestId('live-layers-own'),
    setUp: withLiveSky,
    budget: LIVE_ROW_BUDGET,
  },
  {
    // R213 (FR-STRIP-6, D-1269): the one play button has a row of its own over the three taps.
    name: 'the live play row (FR-STRIP-6)',
    element: createElement(LivePage, { link: null }),
    find: () => screen.getByTestId('live-play').parentElement as HTMLElement,
    setUp: withLiveSky,
    budget: LIVE_ROW_BUDGET,
  },
  {
    // R144 (FR-TONIGHT-4, D-901) → R213: the taps row as the page renders it.
    name: 'the live taps row (FR-TONIGHT-4)',
    element: createElement(LivePage, { link: null }),
    find: () => screen.getByTestId('live-jumps'),
    setUp: withLiveSky,
    budget: LIVE_ROW_BUDGET,
  },
  {
    // R144 (FR-TONIGHT-6, D-905) → R150 (FR-GYRO-10, D-949): the satellites' heading row — "Satellites (n)" with its
    // rule, and the hidden-objects toggle at its end, `[ ] Hidden` / `[ ] Ocultos`.
    name: 'the live satellites heading row (FR-GYRO-10, FR-LIVE-6)',
    element: createElement(LivePage, { link: null }),
    find: () => screen.getByTestId('live-satellites-head'),
    setUp: withLiveSky,
    budget: LIVE_ROW_BUDGET,
  },
  /*
   * R132 (FR-FLOW-4, D-846): the view row is one line — the view control in the facing picker's idiom, the chosen view
   * bracketed and the others plain (`[Window] Polar Dome`, 19 cells; `[Ventana] Polar Domo`, 20 — R150, FR-GYRO-11: the
   * window first), and `[x] stars` /
   * `[x] estrellas` at the row's end: 30 cells in English and 35 in Spanish, the spec's numbers, on the live page and
   * the pass detail. R123's `inline` second line is gone with the row.
   */
  {
    name: 'the live view row (FR-FLOW-4, D-846)',
    element: createElement(LivePage, { link: null }),
    // R148 (FR-FULL-4): the live page's view row is the sheet's.
    find: () => screen.getByTestId('live-view-row'),
    setUp: withLiveSky,
    budget: VIEW_ROW_BUDGET,
  },
  {
    name: 'the pass detail view row (FR-FLOW-4, D-846)',
    element: createElement(PassDetail, { pass, observer, onClose: noop }),
    find: () => screen.getByTestId('pass-view-row'),
    budget: VIEW_ROW_BUDGET,
  },
  {
    name: 'the pass detail view row’s [ stars ] line (FR-SKY-3)',
    element: createElement(PassDetail, { pass, observer, onClose: noop }),
    find: () => screen.getByTestId('stars-toggle'),
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
   * R164 (FR-CLEAN-2 as amended, D-1012): the compact pass detail's head — `[ ← ]`, then the countdown in the head's
   * phase words at `--text-heading` (1.25 cells a character) and the pass's name as its chip, which is what gives (cut
   * by the head's ellipsis), so the row's fixed part is the back control and the countdown at its longest form, a
   * two-digit hour ("Ended 23:59:59 ago" / "Terminó hace 23:59:59"): 30.5 cells in English and 32.25 in Spanish.
   */
  {
    name: "the pass detail's head (FR-CLEAN-2)",
    setUp: offTheFirstPage,
    element: createElement(SkyHead, { line: createElement('p', { 'data-testid': 'pass-head-line' }, longestPassHead(t)), onBack: noop }),
    find: () => screen.getByTestId('live-head'),
    measure: (row) => rowCells(within(row as HTMLElement).getByTestId('live-back'), table) + 1 + ([...longestPassHead(t)].length * 5) / 4,
  },
];

/** R164: the longest of the pass head's countdown forms, over the four phases at a two-digit hour. */
function longestPassHead(t: Messages): string {
  const forms = (['before', 'to-peak', 'to-end', 'over'] as const).map((phase) => t.countdown.head({ phase, clock: '23:59:59' }));
  return forms.reduce((longest, form) => ([...form].length > [...longest].length ? form : longest), '');
}

beforeEach(() => {
  media = stubMatchMedia(COMPACT_PX);
});

afterEach(() => {
  // This file runs under the `node` project with the jsdom pragma above, so it
  // does not get `tests/setup/vitest.jsdom.ts` and RTL's automatic cleanup.
  cleanup();
  media.restore();
  window.history.replaceState(null, '', window.location.pathname);
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
describe.each(LOCALES)('FR-FLOW-3: the three compact sub-page rows in %s', (locale: Locale) => {
  /** The cells a viewport gives a row on the widest font in the stack, less the shell's padding (F-10). */
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const header = (page: HeaderPage, withContext: boolean): ReactElement =>
    createElement(Header, { page, context: withContext ? observer.label : null, onBack: noop });
  /**
   * The fixed part — `[ ← ]`, the name, the gaps — in cells, per page; the Done note's numbers. R149 (FR-FULL-2,
   * D-934): the live row is the inert page's alone since v2.8, `[ ← ] live` without the mark (R148 took the indicator
   * off compact and R149 `Header`'s `status` with it), so 14 → 10 and 17 → 13.
   */
  const FIXED: Record<Locale, Record<(typeof SUB_PAGES)[number], number>> = {
    en: { settings: 15 },
    es: { settings: 16 },
  };

  it.each(SUB_PAGES)('%s: the fixed part, and the context whole beside it at 390 and 360 px', (page) => {
    const fixed = render(createElement(I18nProvider, { locale, children: header(page, false) }));
    const bare = screen.getByTestId('header');
    expect(rowCells(bare, table), rowParts(bare, table).join(' | ')).toBe(FIXED[locale][page]);
    fixed.unmount();
    render(createElement(I18nProvider, { locale, children: header(page, true) }));
    const row = screen.getByTestId('header');
    const cells = rowCells(row, table);
    expect(cells, rowParts(row, table).join(' | ')).toBe(FIXED[locale][page] + 1 + observer.label.length);
    expect(cells, `${page} at 390 px`).toBeLessThanOrEqual(Math.min(LIVE_ROW_BUDGET, rowCellsAt(390)));
    expect(cells, `${page} at 360 px`).toBeLessThanOrEqual(rowCellsAt(360));
  });
});

/**
 * R132 (FR-FLOW-4, D-846): the view row at 360 and 390 px in both languages, on the live page and the pass detail —
 * R206 (FR-CTRL-2, FR-CTRL-3): four blocks, a cell inside each side, a quarter cell between the three views, are 29.5
 * cells in English and 34.5 in Spanish, half a cell over the bracketed row's (R150, FR-GYRO-11: the window first); at
 * 390 px inside FR-COMP-4's 36, at 360 px inside what that width has on the widest font in the stack.
 */
describe.each(LOCALES)('FR-FLOW-4: the view row at 360 and 390 px in %s', (locale: Locale) => {
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const EXPECTED: Record<Locale, number> = { en: 29.5, es: 34.5 };

  it.each([
    ['the live page', () => createElement(LivePage, { link: null }), 'live-layout', withLiveSky],
    ['the pass detail', () => createElement(PassDetail, { pass, observer, onClose: noop }), 'pass-layout', noop],
  ] as const)('%s: one line, the spec’s cells, inside both widths', (_name, element, layoutId, setUp) => {
    setUp();
    render(createElement(I18nProvider, { locale, children: element() }));
    const row = screen.getByTestId(layoutId).querySelector('[data-slot="view"], [data-testid="live-view-row"], [data-testid="pass-view-row"]') as Element;
    const cells = rowCells(row, table);
    expect(cells, rowParts(row, table).join(' | ')).toBe(EXPECTED[locale]);
    // R150 (FR-GYRO-11, D-950): the window first, every view its block's two cells.
    const view = CATALOGS[locale].chart.view;
    expect(rowParts(row, table).slice(0, 3)).toEqual([`##${view.window}`, `##${view.polar}`, `##${view.dome}`]);
    expect(cells, 'at 390 px').toBeLessThanOrEqual(Math.min(BUDGET, rowCellsAt(390)));
    // At 360 px the widest font gives the row 33 cells: the English row is inside it; the Spanish row is the spec's
    // own 35 (FR-FLOW-4), two past it, so `estrellas` wraps under the control there — a finding for the spec,
    // recorded in R132's summary; this pins the number so the gap cannot grow unnoticed.
    expect(cells, 'at 360 px').toBeLessThanOrEqual(Math.max(rowCellsAt(360), VIEW_ROW_BUDGET));
    if (locale === 'en') expect(cells, 'at 360 px').toBeLessThanOrEqual(rowCellsAt(360));
  });
});

/**
 * R170 (FR-GLOBE-16) → R222 (FR-LAND-3, D-1240): the wide live page's globe rows — `Turn` and the layer rows with
 * `faint` — each one line inside the rail's minimum (`RAIL_MIN_CELLS`) in both languages.
 */
describe.each(LOCALES)('FR-GLOBE-16: every globe row of the live rail fits the rail in %s', (locale: Locale) => {
  beforeEach(() => {
    media.restore();
    media = stubMatchMedia(1280);
    withLiveSky();
    render(createElement(I18nProvider, { locale, children: createElement(LivePage, { link: null }) }));
  });

  it.each([
    ['the turn', () => screen.getByTestId('globe-turn-row')],
    ['the first layer row', () => screen.getAllByTestId('stars-layers-row')[0] as Element],
    ['the second layer row, with faint', () => screen.getAllByTestId('stars-layers-row')[1] as Element],
  ] as const)('%s', (name, find) => {
    const row = find();
    const cells = rowCells(row, table);
    expect(cells, `${name} in ${locale}: ${rowParts(row, table).join(' | ')}`).toBeLessThanOrEqual(RAIL_MIN_CELLS);
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
 * name. R163 (FR-CLEAN-11): the pass rows R126 added went with the toggle.
 */
describe('FR-STAR-10: the longest Spanish names in In this field at 360 px', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/ui/components/live/FieldList.module.css'), 'utf8');
  const block = (selector: string): string => new RegExp(`\\n${selector.replace(/[.>]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  /** The cells a 360 px viewport gives a row on the widest font in the stack, less the shell's padding (F-10). */
  const rowCells360 = Math.floor(360 / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const fixed = [...block('.item > .row').matchAll(/calc\((\d+) \* var\(--cell\)\)/g)].map((match) => Number(match[1]));
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
  });
});

/**
 * R202 (FR-OPEN-8, FR-OPEN-12, FR-COMP-4): the example first run's new rows at 360 and 390 px in both languages.
 * The controls — `[ Not there? Set your place ]` in the band, a cell of padding each side, and `[ back ]` — are one
 * row each and never wrap. The sentences wrap as sentences do, so each is held to the lines the fold rule
 * (FR-OPEN-3) was measured with: the tagline at body size, two lines; the label, the wait and the look line at
 * `--small` inside the band (and, for the look line, the card's 12 px each side), at most two lines at 390 px and
 * three at 360. The faint control's row stays counted here, where the steps' rows were.
 */
describe.each(LOCALES)('FR-OPEN-8: every new row of the example first run fits %s at 360 and 390 px', (locale: Locale) => {
  const t = CATALOGS[locale];
  const control = (text: string): number => `[ ${text} ]`.length;
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  /** The band's rule and its cell of padding each side. */
  const BAND_CELLS = 2;
  /** The card's 12 px each side, in cells of the widest font, rounded up. */
  const CARD_CELLS = Math.ceil(24 / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX));
  const small = (cells: number): number => Math.floor((cells * 16) / 14);
  /** The lines `text` takes in `width` characters, broken at spaces as the browser breaks it. */
  const lines = (text: string, width: number): number => {
    let count = 1;
    let used = 0;
    for (const word of text.split(' ')) {
      expect(word.length, word).toBeLessThanOrEqual(width);
      if (used > 0 && used + 1 + word.length > width) {
        count += 1;
        used = word.length;
      } else used += (used > 0 ? 1 : 0) + word.length;
    }
    return count;
  };
  const CITY = 'Ciudad de México';

  it.each([
    // R215 (FR-LAND-4, D-1238): the satellites list's head on a phone — `<city> · example  change` — keeps a ten-letter
    // city whole (`Montevideo`); a longer name is cut with an ellipsis (`PlaceLine.module.css`).
    ['place line with the example', () => `Montevideo · ${t.header.place.example}`.length + 2 + control(t.header.place.change)],
    ['place line with no place', () => control(t.header.place.set)],
    // R97 (FR-FAINT-2): the faint control, in its longer state.
    ['[ hide n faint ]', () => Math.max(control(t.passes.faintToggle({ shown: false, count: 99 })), control(t.passes.faintToggle({ shown: true, count: 99 })))],
  ] as const)('the %s row, in 36 cells and inside 360 px', (_name, cells) => {
    expect(cells()).toBeLessThanOrEqual(BUDGET);
    expect(cells()).toBeLessThanOrEqual(rowCellsAt(360));
  });

  it.each([
    ['the tagline, at body size', () => t.app.tagline, (row: number) => row, 2, 2],
    ['the label, in the band', () => t.example.label(CITY), (row: number) => small(row - BAND_CELLS), 2, 2],
    ['the look line, in the card', () => t.example.looks(11), (row: number) => small(row - BAND_CELLS - CARD_CELLS), 2, 3],
  ] as const)('%s: its lines at 390 and 360 px', (_name, text, width, at390, at360) => {
    expect(lines(text(), width(rowCellsAt(390))), 'at 390 px').toBeLessThanOrEqual(at390);
    expect(lines(text(), width(rowCellsAt(360))), 'at 360 px').toBeLessThanOrEqual(at360);
  });

  it('FR-OPEN-13: the path in words, at its longest, is two lines in the card at 360 px', () => {
    const path = t.nextEvent.withDuration({ path: t.nextEvent.path({ start: { point: 'NNW', altitude: 30 }, peak: { point: 'N', altitude: 60 }, end: { point: 'SSE', altitude: 30 } }, true), minutes: 11 });
    expect(path).not.toMatch(/°/);
    expect(lines(path, small(rowCellsAt(360) - BAND_CELLS - CARD_CELLS))).toBeLessThanOrEqual(3);
    const usual = t.nextEvent.withDuration({ path: t.nextEvent.path({ start: { point: 'NW', altitude: 'low' }, peak: { point: 'N', altitude: 80 }, end: { point: 'SE', altitude: null } }, true), minutes: 6 });
    expect(usual).toBe(locale === 'es' ? 'NW bajo → casi en el cenit → SE · 6 min' : 'NW low → almost overhead → SE · 6 min');
    expect(lines(usual, small(rowCellsAt(360) - BAND_CELLS - CARD_CELLS))).toBeLessThanOrEqual(2);
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
    // The column is the three visible labels `Settings.tsx` draws — the Install row's is `App` since v2.1 (V21-17, F-83), not
    // the button's `Install`. R156 (FR-PHONE-15): the Theme row with Auto is 8 + 1 + 27 = 36 in English and 6 + 1 + 29 = 36 in Spanish.
    const labels = [t.app.language, t.app.theme, t.settings.installLabel];
    const column = Math.max(...labels.map((label) => label.length));
    const cells = column + 1 + rowCells(control(), table);
    expect(cells, `${String(column)} + 1 + ${rowParts(control(), table).join(' | ')}`).toBeLessThanOrEqual(BUDGET);
  });
});

/**
 * R74 (FR-COMP-1 as amended, D-441), R215 (FR-LAND-6, FR-COMP-1 as amended v3.0): the row's arithmetic, not merely the
 * budget it fits inside. The mark is three cells — a 24 px box needs three of the 9.6 px cells — and the row is the
 * mark and the three tabs, `live satellites settings`: on the satellites page 3 + 5 (`live` keeps `--target`'s five
 * cells) + 10 + 8, two cells after the mark and one between the tabs, **29** of the 36. The short title left the row
 * (FR-LAND-6: "the mark and the three links"); every tab row in both languages stays inside FR-COMP-1's 36 cells.
 */
it('counts the compact header with the mark and the three tabs at 29 cells (FR-COMP-1, FR-LAND-6, D-441)', () => {
  render(createElement(I18nProvider, { locale: 'en', children: createElement(Header, { page: 'pass' }) }));
  const header = screen.getByTestId('header');
  expect(screen.getByTestId('mark').getAttribute('data-mark-cells')).toBe('3');
  expect(rowCells(header, table), rowParts(header, table).join(' | ')).toBe(29);
});

it.each(LOCALES.flatMap((locale) => (['live', 'pass', 'settings'] as const).map((page) => [locale, page] as const)))('FR-LAND-6: the %s compact tab row on %s holds the mark and the three links in 36 cells', (locale, page) => {
  render(createElement(I18nProvider, { locale, children: createElement(Header, { page: page === 'settings' ? 'live' : page }) }));
  const header = screen.getByTestId('header');
  expect(rowCells(header, table), rowParts(header, table).join(' | ')).toBeLessThanOrEqual(36);
});

/**
 * R93 (FR-HOME-1, D-546, D-605; F-76): the wide header's one row, at every wide width in both languages. R129
 * (FR-FLOW-3, D-845): the title row lost the switches; R212 (D-1230) the tagline and the home link. What is pinned
 * is that a page's row fits the wide breakpoint with room for its context, recomputed here from the catalogs, the
 * mark's declared cells, and the gaps the stylesheets declare, which are read rather than remembered.
 */
const HEADER_CSS = readFileSync(resolve(process.cwd(), 'src/ui/components/common/Header.module.css'), 'utf8');

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

describe.each(LOCALES)('FR-HOME-1, FR-FLOW-3: the wide header row in %s (D-546, D-845)', (locale: Locale) => {
  const t = CATALOGS[locale];
  const rowGap = cellsOf(HEADER_CSS, '.row', 'gap');
  const navGap = cellsOf(HEADER_CSS, '.nav', 'gap');
  let markCells = 0;

  beforeEach(() => {
    media.restore();
    media = stubMatchMedia(1280);
    render(createElement(I18nProvider, { locale, children: createElement(Header, { page: 'settings' }) }));
    markCells = Number(screen.getByTestId('mark').getAttribute('data-mark-cells'));
    expect(markCells).toBeGreaterThan(0);
  });

  it('never wraps the row, and draws the full title at every wide width', () => {
    expect(HEADER_CSS).toMatch(/\.row\s*\{[^}]*flex-wrap:\s*nowrap;/);
    expect(HEADER_CSS).toMatch(/\.title\s*\{[^}]*white-space:\s*nowrap;/);
    expect(HEADER_CSS).not.toMatch(/attr\(data-short\)/);
    expect(screen.getByRole('heading', { level: 1, name: t.app.title })).toBeTruthy();
  });

  it('fits a sub-page’s row — ← back, the mark and the title, the example’s place line, the three tabs — at the wide breakpoint in both languages', () => {
    // R215 (FR-LAND-4, FR-LAND-6, D-1238): `settings` is one of the three tabs, and the place line stands between the
    // title and the tabs. With a five-letter city the whole row is 94 cells in English and 100 in Spanish, so it fits
    // the wide breakpoint (964 px, `WIDE_CELLS`) whole; a longer name is cut (below).
    const { container } = render(createElement(I18nProvider, { locale, children: createElement(Header, { page: 'pass', place: { label: 'Salta', example: true }, onBack: noop }) }));
    const row = within(container).getByTestId('header');
    const parts = rowParts(row, table);
    expect(parts).toEqual([t.header.backWords, '#'.repeat(markCells), t.app.title, 'Salta', `· ${t.header.place.example}`, expect.stringContaining(t.header.place.change), t.header.pages.live, t.header.pages.pass, t.header.pages.settings]);
    expect(rowGap).toBe(2);
    expect(navGap).toBe(1);
    const fixed = 2 * SHELL_PADDING_CELLS + rowCells(row, table);
    expect(fixed, parts.join(' | ')).toBe(locale === 'es' ? 100 : 94);
    expect(WIDE_MIN_PX).toBe(964);
    expect(fixed, 'the whole row at 964 px').toBeLessThanOrEqual(WIDE_CELLS);
  });

  it('with a long place, the place line gives — its name cut with an ellipsis — never the title, back or the tabs', () => {
    const place = 'San Carlos de Bariloche, Río Negro, Argentina';
    const { container } = render(createElement(I18nProvider, { locale, children: createElement(Header, { page: 'pass', place: { label: place, example: false }, onBack: noop }) }));
    const parts = rowParts(within(container).getByTestId('header'), table);
    expect(parts).toEqual([t.header.backWords, '#'.repeat(markCells), t.app.title, place, expect.stringContaining(t.header.place.change), t.header.pages.live, t.header.pages.pass, t.header.pages.settings]);
    const rule = (css: string, selector: string): string => new RegExp(`(?:^|\\n)${selector.replace(/[.\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const LINE_CSS = readFileSync(resolve(process.cwd(), 'src/ui/components/common/PlaceLine.module.css'), 'utf8');
    // The two ends share what the line leaves and never shrink under their words; the line shrinks, and in it the name.
    for (const end of ['.start', '.end']) {
      expect(rule(HEADER_CSS, end), end).toMatch(/flex:\s*1 1 0;/);
      expect(rule(HEADER_CSS, end), end).toMatch(/min-width:\s*max-content;/);
    }
    expect(rule(HEADER_CSS, '.place')).toMatch(/flex:\s*0 1 auto;/);
    expect(rule(HEADER_CSS, '.nav')).toMatch(/flex:\s*0 0 auto;/);
    expect(rule(LINE_CSS, '.line')).toMatch(/min-width:\s*0;/);
    expect(rule(LINE_CSS, '.name')).toMatch(/min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/);
    expect(rule(LINE_CSS, '.change')).toMatch(/flex:\s*0 0 auto;/);
  });
});

/**
 * R143 (FR-TONIGHT-4, FR-TONIGHT-7, FR-COMP-4) → R213 (FR-STRIP-6, D-1269): the compact live page's rows — the play
 * button's and the taps' (R206's boxes), the time line's ends and every form of the context line — in both
 * languages, from the catalogs (`tonightRows.ts` words them at their longest). Each is at most 36 characters
 * (FR-COMP-4, FR-TONIGHT-7's "at most 36 cells in both languages") and inside what 390 and 360 px hold on the widest
 * font, the headline and the context line counted at their own sizes (1.25 rem and `--small`). The snapshot is the
 * strings' snapshot FR-TONIGHT-7 asks for, with the counts the task's Done note lists. No row is exempt: the play
 * button has a row of its own, so neither its words nor its two faces touch the taps' row.
 */
describe.each(LOCALES)('FR-TONIGHT-4, FR-TONIGHT-7: the play and taps rows, the time line and the context line in %s', (locale: Locale) => {
  const rowCellsAt = (px: number): number => Math.floor(px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX)) - 2 * SHELL_PADDING_CELLS;
  const t = CATALOGS[locale];
  const all = [...tapsRows(t), ...chipRows(t, locale), ...contextRows(t)];

  it.each(all.map((row) => [row.name, row] as const))('%s: within 36 cells, and inside 390 and 360 px', (_name, row) => {
    expect(row.text.length, row.text).toBeLessThanOrEqual(BUDGET);
    expect(row.cells, `${row.text} at 390 px`).toBeLessThanOrEqual(rowCellsAt(390));
    expect(row.cells, `${row.text} at 360 px`).toBeLessThanOrEqual(rowCellsAt(360));
  });

  it('the play button then the taps: 8 and 10 over 22 cells in English, 14 and 9 over 25 in Spanish (FR-STRIP-6, FR-CTRL-1)', () => {
    expect(tapsRows(t).map((row) => row.cells)).toEqual(locale === 'en' ? [8, 10, 22] : [14, 10, 25]);
  });

  it('the strings, with their cells', () => {
    expect(all.map((row) => `${row.name} | ${row.text} | ${String(row.text.length)} chars | ${String(row.cells)} cells`)).toMatchSnapshot();
  });
});

/**
 * R213 (FR-STRIP-1, FR-STRIP-3, G70, V30-32): what never gives on the strip's one row. The row is the box's width
 * less its half cell each side, the text at `--small`: the tag, its city and either button fit, so a phone never
 * shows the example unnamed.
 */
describe.each(LOCALES)('FR-STRIP-1: the strip’s row in %s', (locale: Locale) => {
  const stripCells = (px: number): number => px / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX) - 1;

  it.each([true, false])('the tag, the city and the button fit at 390 px (live: %s)', (live) => {
    const strip = createElement(NextPassStrip, { strip: { kind: 'next', pass }, t: pass.start.t - 3_600_000, timeZone: 'UTC', form: 'row', exampleCity: 'Salta', live, onWatch: noop, onLive: noop });
    render(createElement(I18nProvider, { locale, children: strip }));
    const named = `[${CATALOGS[locale].live.nextPass.example}] Salta`;
    expect(screen.getByTestId('strip-text').textContent?.startsWith(named)).toBe(true);
    const button = within(screen.getByTestId('live-strip')).getByRole('button');
    expect(named.length * (14 / 16) + 1 + rowCells(button, table)).toBeLessThanOrEqual(stripCells(390));
  });
});
