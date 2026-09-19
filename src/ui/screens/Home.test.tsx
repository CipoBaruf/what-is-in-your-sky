/**
 * R76 (FR-FIRST-1, FR-FIRST-2, FR-FIRST-3, US-26 AC1/AC2, board 1B): the cold
 * open's inventory and nothing else — on a phone the step line, the question,
 * its sentence and the group; on a desk the Where pane and the two dimmed
 * panes beside it; the input group's three controls in FR-FIRST-2's order with
 * the primary action's name and note and the look's foot note after the last
 * field, in both layouts and both languages; and, once there is a place, the
 * next-event block ahead of the list.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { I18nProvider } from '../../i18n/useT';
import type { Locale, Observer } from '../../model';
import { appStore, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { App } from '../App';
import { WhereReading } from './Home';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: true, persistent: true };
const initial = appStore.getInitialState();
const device = { geolocation: {} as Geolocation, secure: true };
const CATALOG = { en, es } as const;

/** Whether `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

let media: MatchMediaStub;

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
  window.history.replaceState(null, '', window.location.pathname);
});

/** Stale elements that would raise a banner, and passes that would fill a list: none of it is shown with no place. */
function withEverythingButAPlace(): void {
  act(() => {
    appStore.setState({ elements: ready, passes: { ...IDLE_PASSES, status: 'done', passes: [pass], hasDarkness: true } });
  });
}

/** Nothing that is about a place: no Now panel, no readiness line, no hero card, no sort row, no list, no elements banner. */
function expectNothingAboutAPlace(): void {
  for (const name of ['Right now', 'Upcoming passes']) expect(screen.queryByRole('region', { name })).toBeNull();
  for (const id of ['readiness', 'readiness-stored', 'iss-hero', 'elements-banners', 'next-event', 'location-summary']) expect(screen.queryByTestId(id)).toBeNull();
  expect(screen.queryByRole('group', { name: en.passes.sortGroup })).toBeNull();
}

describe('the cold open on compact (FR-FIRST-1)', () => {
  beforeEach(() => {
    media = stubMatchMedia(COMPACT_PX);
  });

  it('renders exactly the inventory, in order, and nothing about passes', async () => {
    withEverythingButAPlace();
    const { container } = render(<App />);
    const main = screen.getByRole('main');
    // One column, holding the cold open alone: no When, no What.
    expect(main.children).toHaveLength(1);
    const cold = within(main).getByTestId('cold-open');
    expect([...(main.firstElementChild?.children ?? [])]).toEqual([cold]);
    // Board 1B: no mark and no tagline in the cold open (the header keeps its own mark).
    expect(within(cold).queryByTestId('mark')).toBeNull();
    expect(cold).not.toHaveTextContent(en.app.tagline);

    const steps = within(cold).getByRole('list', { name: en.home.stepsLabel });
    expect(within(steps).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['[01] where', '02 when', '03 what']);
    expect(within(steps).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    const heading = within(cold).getByRole('heading', { level: 2, name: en.home.coldHeading });
    const sentence = within(cold).getByText(en.home.coldSentence);
    const group = within(cold).getByTestId('location-group');
    expect(group).toHaveAccessibleName(en.home.coldHeading);

    // In this order: step line, heading, sentence, group — and the cold open holds nothing else.
    expect(group.parentElement?.children).toHaveLength(1);
    expect([...cold.children]).toEqual([steps, heading, sentence, group.parentElement as Element]);
    expectNothingAboutAPlace();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('the cold open on wide (FR-FIRST-1)', () => {
  beforeEach(() => {
    media = stubMatchMedia(WIDE_PX);
  });

  it('renders exactly the inventory, in order, and nothing about passes', async () => {
    withEverythingButAPlace();
    const { container } = render(<App />);
    const main = screen.getByRole('main');
    // Board 1B: the three panes before there is a place — Where, and When and What dimmed beside it.
    const [left, right] = [...main.children];
    const cold = within(main).getByTestId('cold-open');
    const ghostWhen = within(main).getByTestId('ghost-when');
    const ghostWhat = within(main).getByTestId('ghost-what');
    expect([...(left?.children ?? [])]).toEqual([cold, ghostWhen]);
    expect([...(right?.children ?? [])]).toEqual([ghostWhat]);
    expect(within(cold).queryByTestId('mark')).toBeNull();

    // The Where pane: its heading (the step line's first item), the question, the group; no sentence under the question.
    const paneHeading = within(cold).getByRole('heading', { level: 2, name: '[01] Where' });
    const heading = within(cold).getByRole('heading', { level: 2, name: en.home.coldHeading });
    const group = within(cold).getByTestId('location-group');
    expect(group).toHaveAccessibleName(en.home.coldHeading);
    expect([...cold.children]).toEqual([paneHeading, heading, group.parentElement as Element]);
    expect(cold).not.toHaveTextContent(en.home.coldSentence);

    // The dimmed panes are pictures of what they will hold: hidden from assistive technology, and no control in them.
    for (const [ghost, texts] of [
      [ghostWhen, ['02 When', en.home.ghost.whenHeading, en.home.ghost.whenSentence]],
      [ghostWhat, ['03 What', en.home.ghost.whatHeading, en.home.ghost.whatCard]],
    ] as const) {
      expect(ghost).toHaveAttribute('aria-hidden', 'true');
      for (const text of texts) expect(ghost).toHaveTextContent(text);
      expect(ghost.querySelector('a, button, input, [tabindex]')).toBeNull();
    }
    expectNothingAboutAPlace();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe.each([
  ['compact', COMPACT_PX],
  ['wide', WIDE_PX],
] as const)('the input group on %s (FR-FIRST-2)', (mode, width) => {
  beforeEach(() => {
    media = stubMatchMedia(width);
  });

  it.each(['en', 'es'] as const)("offers the primary action first, then the place and the coordinates, then the look's foot note (%s)", (locale: Locale) => {
    const t = CATALOG[locale];
    render(createElement(I18nProvider, { locale, children: <WhereReading offersInert={false} geolocation={device} /> }));
    const group = screen.getByTestId('location-group');
    const primary = within(group).getByRole('button', { name: t.location.useMyLocation });
    expect(primary).toHaveAccessibleDescription(t.location.useMyLocationNote);
    const place = within(group).getByLabelText(t.location.placeLabel);
    const coords = within(group).getByLabelText(t.location.coordsLabel);
    const altitude = within(group).getByLabelText(t.location.altitudeLabel);
    expect(precedes(primary, place)).toBe(true);
    expect(precedes(place, coords)).toBe(true);
    expect(precedes(coords, altitude)).toBe(true);

    // Board 1B gives each look one note, as the group's foot, after the last field, hung off no control: on a
    // phone "Saved in this browser only. No account, no tracking.", in the wide pane the precision note (US-1 AC4).
    const foot = within(group).getByTestId('location-foot');
    const note = mode === 'compact' ? t.home.savedFoot : t.location.precisionNote;
    expect([...foot.children].map((child) => child.textContent)).toEqual([note]);
    expect(group).toHaveAttribute('data-look', mode === 'compact' ? 'boxed' : 'plain');
    expect(precedes(altitude, foot)).toBe(true);
    expect(group.lastElementChild).toBe(foot);
  });

  it('puts the place field first, and says nothing about a missing button, where US-3 AC1 withholds it', () => {
    render(<WhereReading offersInert={false} geolocation={{ geolocation: undefined, secure: true }} />);
    const group = screen.getByTestId('location-group');
    expect(within(group).queryByRole('button', { name: en.location.useMyLocation })).toBeNull();
    expect(group.querySelector('input, button')).toBe(within(group).getByLabelText(en.location.placeLabel));
    expect(group).not.toHaveTextContent(en.location.useMyLocationNote);
  });
});

/**
 * A coordinate pair becomes an observer at its first valid keystroke, and the
 * page turns from the cold open to the readings under the reader's hands. The
 * field they are typing in has to be the same field afterwards, still focused,
 * with the group left open under the location line; a place that arrives any
 * other way folds the group away.
 */
describe('the group across the cold open and the readings', () => {
  beforeEach(() => {
    media = stubMatchMedia(COMPACT_PX);
  });

  it('keeps the field being typed in, focused and open, when the typing sets the place — and when it clears it', () => {
    render(<App />);
    const field = screen.getByLabelText(en.location.coordsLabel);
    field.focus();
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    expect(appStore.getState().observer).not.toBeNull();
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByLabelText(en.location.coordsLabel)).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toBeVisible();
    expect(screen.getByTestId('location-summary-change')).toHaveAttribute('aria-expanded', 'true');

    // An invalid pair drops the place again; the same field is still the one under the reader's hands.
    fireEvent.change(field, { target: { value: '-38.93, -6x' } });
    expect(appStore.getState().observer).toBeNull();
    expect(screen.getByTestId('cold-open')).toContainElement(field);
    expect(field).toHaveFocus();
  });

  it('folds the group away when the place arrives from elsewhere', () => {
    render(<App />);
    act(() => {
      appStore.setState({ observer });
    });
    expect(screen.getByTestId('location-summary-change')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('location-group')).not.toBeVisible();
  });
});

describe('once there is a place (FR-FIRST-3, FR-FIRST-4)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(pass.start.t - 4 * 60_000 - 12_000);
    media = stubMatchMedia(COMPACT_PX);
  });

  it('stacks the readings in board 1B’s order: Where, then When — the stripe, the table, the next event — then What (FR-FIRST-4, FR-FIRST-5)', () => {
    act(() => {
      appStore.setState({ observer, elements: { ...ready, stale: false }, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass], hasDarkness: true } });
    });
    render(<App />);
    const block = screen.getByTestId('next-event');
    expect(within(block).getByTestId('next-event-label')).toHaveTextContent(/^Next up · in 4:12$/);
    expect(within(block).getByTestId('next-event-path')).toHaveTextContent(/^ISS \(Zarya\) · [NESW]{1,3} low → \d+° [NESW]{1,3} → [NESW]{1,3}$/);
    expect(within(block).getByRole('link', { name: 'Open the live sky' })).toHaveAttribute('href', '#live');

    const where = screen.getByTestId('reading-where');
    const when = screen.getByTestId('reading-when');
    const list = screen.getByRole('region', { name: 'Upcoming passes' });
    expect(precedes(screen.getByTestId('location-summary'), block)).toBe(true);
    expect(precedes(block, list)).toBe(true);
    // The three readings in order, each under its plain heading (FR-FIRST-5 as amended).
    expect(precedes(where, when)).toBe(true);
    expect(precedes(when, screen.getByTestId('list-column'))).toBe(true);
    for (const [reading, name] of [[where, 'Where'], [when, 'When'], [screen.getByTestId('list-column'), 'What']] as const) expect(within(reading).getByRole('heading', { level: 2, name })).toBeInTheDocument();
    // When: the table (the stripe once the astronomy chunk lands), then the next event last; no Now panel.
    expect(precedes(within(when).getByTestId('conditions'), block)).toBe(true);
    expect(when.lastElementChild).toBe(block);
    expect(screen.queryByRole('region', { name: 'Right now' })).toBeNull();
    // Where: the place, the readiness, the elements and the saved places as lines; no dome on a phone.
    expect(within(where).getByTestId('favourites')).toBeInTheDocument();
    expect(within(where).getByTestId('elements-line')).toBeInTheDocument();
    expect(within(where).queryByTestId('where-dome')).toBeNull();
    // What: the tag in place of the hero card.
    expect(screen.queryByTestId('iss-hero')).toBeNull();
    expect(within(list).getByTestId('next-tag')).toHaveTextContent('Next ISS');
  });

  it('says in one line why there is nothing to count down to', () => {
    act(() => {
      appStore.setState({ observer, elements: { ...ready, stale: false }, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [], hasDarkness: false } });
    });
    render(<App />);
    expect(screen.getByTestId('next-event-none')).toHaveTextContent(en.nextEvent.none({ reason: 'no-darkness', hours: 72 }));
  });
});
