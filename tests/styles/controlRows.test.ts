// @vitest-environment jsdom
/**
 * R52 (FR-COMP-4, US-20 AC6, D-193): every control row the compact layout
 * renders fits 36 cells, in both languages.
 *
 * The rows are FR-COMP-4's own list — the header, the sort row, the chart view
 * control, the live page's playback rows, the share and follow actions — plus
 * the two this task adds: the home screen's location summary (FR-COMP-3) and
 * the settings page's install row (V11-16). Each is rendered on its own with
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
import { cleanup, render, screen } from '@testing-library/react';
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
import { LocationSummary } from '../../src/ui/components/common/LocationSummary';
import { InstallAction } from '../../src/ui/components/common/InstallAction';
import { ShareButton } from '../../src/ui/components/common/ShareButton';
import { HiddenToggle, LegendToggle, PlaybackControls } from '../../src/ui/components/live/PlaybackControls';
import { StepControls } from '../../src/ui/components/live/StepControls';
import { SortToggle } from '../../src/ui/components/passes/SortToggle';
import { OptionToggle } from '../../src/ui/components/common/OptionToggle';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from '../../src/ui/components/common/installOffer';
import { decorations, rowCells, rowParts } from './cells';

/** FR-COMP-4: a 390 px viewport at the default cell. */
const BUDGET = 36;

const CSS = [
  'src/ui/components/common/Header.module.css',
  'src/ui/components/common/LocationSummary.module.css',
  'src/ui/components/common/InstallAction.module.css',
  'src/ui/components/common/OptionToggle.module.css',
  'src/ui/components/common/ShareButton.module.css',
  'src/ui/components/live/PlaybackControls.module.css',
  'src/ui/components/live/StepControls.module.css',
  'src/ui/components/passes/SortToggle.module.css',
].map((file) => resolve(process.cwd(), file));

const table = decorations(CSS);

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const pass = goldenPassFixture();
const initial = appStore.getInitialState();
const noop = (): void => undefined;

let media: MatchMediaStub;

/** The rows FR-COMP-4 names, each as what to render and how to find the row in it. */
interface Row {
  name: string;
  element: ReactElement;
  find: () => Element;
  /** Run before rendering: the store or the browser has to be in the state the row appears in. */
  setUp?: () => void;
  /** Tighter than `BUDGET` where FR-COMP-4 names a number for the row itself (R70: the stepping row's 35). */
  budget?: number;
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
  {
    name: 'the location summary (FR-COMP-3)',
    element: createElement(LocationSummary),
    find: () => screen.getByTestId('location-summary'),
    setUp: () => {
      appStore.setState({ observer });
    },
  },
  { name: 'the location summary with no place set (FR-COMP-3)', element: createElement(LocationSummary), find: () => screen.getByTestId('location-summary') },
  { name: 'the sort row (US-5 AC2 as amended)', element: createElement(SortToggle, { value: 'chronological', onChange: noop }), find: () => screen.getByRole('group', { name: t.passes.sortGroup }) },
  { name: 'the chart view control (FR-CHART-1)', element: chartView(), find: () => screen.getByRole('group', { name: 'View' }) },
  {
    name: 'the playback row (FR-LIVE-4)',
    element: createElement(PlaybackControls, { playing: false, speed: 60, realTime: true, onPlay: noop, onPause: noop, onSpeed: noop, onNow: noop }),
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
  {
    /*
     * R71 (FR-COMP-4 as amended v1.4, FR-LEG-7): the live page's actions row, whole — the hidden-objects
     * toggle, the `[ list (n) ]` control and the share action, in the order and with the compact labels and
     * forms `Live.tsx` gives them. The three controls were each measured alone before this; the row they
     * share is the number the requirement names, and it is the tightest row on the page in Spanish:
     * `[ ] Ocultos [ lista (3) ] Compartir` is 35 of the 36, and with the share action's brackets it is 39,
     * which is why D-411 takes them off on this row.
     */
    name: 'the live actions row with the legend control (FR-LEG-7, FR-COMP-4 as amended v1.4)',
    element: createElement(
      'div',
      { 'data-testid': 'live-actions' },
      createElement(HiddenToggle, { hidden: false, onToggle: noop }),
      createElement(LegendToggle, { open: false, count: 3, controls: 'x', onToggle: noop }),
      createElement(ShareButton, { url: 'https://example.test/#live', title: 'x', text: 'y', label: t.live.shareShort, ariaLabel: t.live.share, plain: true }),
    ),
    find: () => screen.getByTestId('live-actions'),
  },
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
    const element = row.find();
    const cells = rowCells(element, table);
    expect(cells, `${row.name} in ${locale}: ${rowParts(element, table).join(' | ')}`).toBeLessThanOrEqual(row.budget ?? BUDGET);
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
