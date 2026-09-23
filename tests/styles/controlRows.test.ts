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
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../support/matchMedia';
import { goldenPassFixture } from '../support/catalogFixtures';
import { CATALOGS, I18nProvider } from '../../src/i18n/useT';
import { LOCALES } from '../../src/i18n/locale';
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
import { OptionToggle } from '../../src/ui/components/common/OptionToggle';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from '../../src/ui/components/common/installOffer';
import { SettingsPage } from '../../src/ui/screens/Settings';
import { StepLine } from '../../src/ui/screens/Home';
import { UseMyLocation } from '../../src/ui/components/location/UseMyLocation';
import { NextEventBlock } from '../../src/ui/components/passes/NextEventBlock';
import { StatusStrip } from '../../src/ui/components/live/StatusStrip';
import { LivePage } from '../../src/ui/screens/Live';
import { VisitNotice } from '../../src/ui/components/common/VisitNotice';
import { decorations, rowCells, rowParts } from './cells';

/** FR-COMP-4: a 390 px viewport at the default cell. */
const BUDGET = 36;
/** A row set at `--small` (14 px): 36 cells of the 16 px body hold 41 of its characters (D-504). */
const SMALL_BUDGET = Math.floor((BUDGET * 16) / 14);
/** FR-COMP-7 (R85, D-549): the compact live page's top row and actions rows keep two cells of the 36 spare. */
const LIVE_ROW_BUDGET = BUDGET - 2;

const CSS = [
  'src/ui/components/common/Header.module.css',
  'src/ui/components/location/WherePlace.module.css',
  'src/ui/components/elements/ElementsLine.module.css',
  'src/ui/components/passes/PassCard.module.css',
  'src/ui/components/passes/PassList.module.css',
  'src/ui/components/common/InstallAction.module.css',
  'src/ui/components/common/OptionToggle.module.css',
  'src/ui/components/common/ShareButton.module.css',
  'src/ui/components/live/PlaybackControls.module.css',
  'src/ui/components/live/StepControls.module.css',
  'src/ui/components/passes/SortToggle.module.css',
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
  createElement(OptionToggle, {
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
  {
    // FR-WATCH-3: the clock, the longest sky word, the longest cloud word and a two-digit count — `21:14:32 crepúsculo limpio 12 arriba`.
    name: 'the live conditions line at its longest (FR-WATCH-3)',
    element: createElement(StatusStrip, { t: pass.start.t, timeZone: 'America/Argentina/Salta', sky: 'bright-twilight', cloud: { state: 'partly', effectivePct: 50, at: pass.start.t }, count: 12, moon: null }),
    find: () => screen.getByTestId('status-strip'),
  },
  /*
   * R87 (FR-VISIT-2): the visit notice on a phone is at most two rows — the sentence's short form, then the two
   * controls — each at `--small`, so each is counted in its own characters. The place is the longest a link can
   * name at the hash's two decimals shown: three digits of longitude and both signs.
   */
  ...(['sentence', 'actions'] as const).map(
    (part): Row => ({
      name: `the visit notice: the ${part} (FR-VISIT-2)`,
      element: createElement(VisitNotice),
      find: () => screen.getByTestId(`visit-${part}`),
      setUp: () => {
        appStore.setState({ observer, visiting: { ...observer, lat: -38.93, lon: -167.99, label: '−38.93, −167.99' } });
      },
      budget: SMALL_BUDGET,
    }),
  ),
  { name: 'the settings install row (V11-16)', element: createElement(InstallAction, { env: { standalone: undefined } }), find: () => screen.getByTestId('install-action').parentElement as Element, setUp: offerAnInstall },
];

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
    render(createElement(I18nProvider, { locale, children: createElement(SettingsPage, { onLeave: noop, installEnv: { standalone: undefined } }) }));
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
