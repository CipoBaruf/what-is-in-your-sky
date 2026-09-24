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
import { appStore, useActiveObserver, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { App } from '../App';
import { Home, useSteps, WhereReading, type HomeProps } from './Home';
import { requestPlace } from './home/placeRequest';

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
 *
 * R82 (D-513): on a phone the first visit's where step holds the page until
 * the field is left (below); this is the desk's page, which has no steps, and
 * a phone's stacked page reached from `[ change ]` is the same component.
 */
describe('the group across the cold open and the readings', () => {
  beforeEach(() => {
    media = stubMatchMedia(WIDE_PX);
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

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, US-26 AC3, D-513): a phone's first visit
 * is three steps — where, when, what — one screen each, under the step line
 * with a ✓ on a finished step; every later visit is the stacked page.
 */
describe('the phone’s first visit (FR-FIRST-4, D-513)', () => {
  const found = { coords: { latitude: -38.93, longitude: -67.99, altitude: null, accuracy: 30 }, timestamp: 0 };
  const deviceFinds: typeof device = {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) => {
        ok(found as unknown as GeolocationPosition);
      },
    } as unknown as Geolocation,
    secure: true,
  };
  const onOpenPass = vi.fn();
  // R87: `App` holds the steps (D-548); here a host holds them the same way.
  function Stepped(props: Partial<HomeProps>) {
    const steps = useSteps(useActiveObserver());
    return <Home offersInert={false} guide="closed" shareNotice={null} selectedPassId={null} onOpenPass={onOpenPass} passDetail={null} MoonLore={undefined} geolocation={deviceFinds} steps={steps} {...props} />;
  }
  const home = (props: Partial<HomeProps> = {}) => <Stepped {...props} />;
  /** R87: the same host with a route of its own, as `App` has — the live and settings routes draw instead of `Home`. */
  function Routed({ offHome = false, ...props }: { offHome?: boolean } & Partial<HomeProps>) {
    const steps = useSteps(useActiveObserver(), offHome);
    if (offHome) return <p>another route</p>;
    return <Home offersInert={false} guide="closed" shareNotice={null} selectedPassId={null} onOpenPass={onOpenPass} passDetail={null} MoonLore={undefined} geolocation={deviceFinds} steps={steps} {...props} />;
  }
  const items = () => within(screen.getByTestId('step-line')).getAllByRole('listitem');
  const withTheRun = () => {
    act(() => {
      const current = appStore.getState().observer;
      appStore.setState({ elements: { ...ready, stale: false }, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: current, passes: [pass], hasDarkness: true } });
    });
  };

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(pass.start.t - 12 * 60_000);
    media = stubMatchMedia(COMPACT_PX);
  });

  it('a place set on another route comes back to the stacked page, not to a step — failing on the first cut of R87', () => {
    const { rerender } = render(<Routed />);
    expect(screen.getByTestId('cold-open')).toHaveAttribute('data-step', 'where');

    // The settings page draws instead of the home, and the place is set there.
    rerender(<Routed offHome />);
    act(() => {
      appStore.setState({ observer });
    });
    withTheRun();

    // Back on the home route: the steps are what a fresh mount makes of a place that is already set.
    rerender(<Routed />);
    expect(screen.queryByTestId('step-line')).toBeNull();
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
  });

  it('walks where → when → what with no navigation, and [ edit ] returns to where with the group open', () => {
    const hash = window.location.hash;
    render(home());
    // where: the cold open, under the step line with nothing finished.
    const where = screen.getByTestId('cold-open');
    expect(where).toHaveAttribute('data-step', 'where');
    expect(items().map((item) => item.textContent)).toEqual(['[01] where', '02 when', '03 what']);
    expect(within(screen.getByTestId('step-line')).queryByRole('button')).toBeNull();

    // The device button moves where to when.
    fireEvent.click(within(where).getByRole('button', { name: en.location.useMyLocation }));
    expect(appStore.getState().observer).not.toBeNull();
    withTheRun();
    const when = screen.getByTestId('step-when');
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(items().map((item) => item.textContent)).toEqual(['01 where ✓', '[02] when', '03 what']);
    expect(items()[1]).toHaveAttribute('aria-current', 'step');
    // Its inventory, in order: the step line, the heading and its sentence, the night's box, the sky's box, the control.
    const heading = within(when).getByRole('heading', { level: 2, name: en.home.whenStep.heading });
    expect(heading).toHaveFocus();
    const sentence = within(when).getByText(en.home.whenStep.sentence('−38.93, −67.99'));
    const night = within(when).getByTestId('when-night');
    const sky = within(when).getByTestId('when-sky');
    const next = within(when).getByRole('button', { name: en.home.whenStep.next });
    expect([...when.children]).toEqual([screen.getByTestId('step-line'), heading, sentence, night, sky, next]);
    expect(within(night).getByText(en.home.whenStep.passesIn)).toBeInTheDocument();
    expect(within(night).getByTestId('when-passes')).toHaveTextContent('1 tonight, 1 in 72 h');
    expect(within(sky).getByText(en.home.whenStep.clouds)).toBeInTheDocument();

    // [ See what crosses ] moves on to what.
    fireEvent.click(next);
    const what = screen.getByTestId('step-what');
    expect(items().map((item) => item.textContent)).toEqual(['01 where ✓', '02 when ✓', '[03] what']);
    const count = within(what).getByRole('heading', { level: 2, name: en.home.count(1) });
    expect(count).toHaveTextContent('One thing crosses tonight');
    expect(count).toHaveFocus();
    const whatSentence = within(what).getByText(en.home.whatStep.sentence);
    const cards = within(what).getByTestId('what-cards');
    const foot = within(what).getByTestId('what-foot');
    expect([...what.children]).toEqual([screen.getByTestId('step-line'), count, whatSentence, cards, foot]);
    // The first card is FR-FIRST-3's first-card form; the foot is ruled off with `[ edit ]` at its end.
    expect(within(cards).getByTestId('next-event')).toHaveAttribute('data-form', 'card');
    expect(within(cards).getByTestId('next-event-label')).toHaveTextContent(/^First up · in 12:00$/);
    expect(foot).toHaveTextContent(/^−38\.93, −67\.99 · .+edit$/);
    expect(foot.lastElementChild).toBe(within(foot).getByRole('button', { name: en.home.whatStep.edit }));

    // [ edit ] returns to where, with the group open and the place kept; the finished steps are the way back.
    fireEvent.click(within(foot).getByRole('button', { name: en.home.whatStep.edit }));
    const again = screen.getByTestId('cold-open');
    expect(again).toHaveAttribute('data-step', 'where');
    expect(within(again).getByTestId('location-group')).toBeVisible();
    expect(within(again).getByRole('heading', { level: 2, name: en.home.coldHeading })).toHaveFocus();
    expect(items().map((item) => item.textContent)).toEqual(['[01] where', '02 when ✓', '03 what ✓']);
    expect(appStore.getState().observer).not.toBeNull();
    fireEvent.click(screen.getByTestId('step-back-when'));
    expect(screen.getByTestId('step-when')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('step-back-where'));
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();

    // The step is the page's own state: not in the hash.
    expect(window.location.hash).toBe(hash);
  });

  it('holds the where step while a coordinate pair is typed, and moves on only when the field is left (D-467)', () => {
    render(home());
    const field = screen.getByLabelText(en.location.coordsLabel);
    field.focus();
    fireEvent.change(field, { target: { value: '-38.93, -67' } });
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    // The pair is the observer at its first valid keystroke, and the page has not moved from under the reader.
    expect(appStore.getState().observer).toMatchObject({ lat: -38.93, lon: -67.99, source: 'coords' });
    expect(screen.getByTestId('cold-open')).toHaveAttribute('data-step', 'where');
    expect(screen.getByLabelText(en.location.coordsLabel)).toBe(field);
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: '-38.93, -67.9' } });
    expect(field).toHaveFocus();
    expect(screen.queryByTestId('step-when')).toBeNull();

    // Leaving the field is what moves it.
    act(() => {
      field.blur();
    });
    expect(screen.getByTestId('step-when')).toBeInTheDocument();
  });

  it('moves on from a typed pair on Enter', () => {
    render(home());
    const field = screen.getByLabelText(en.location.coordsLabel);
    field.focus();
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    expect(screen.queryByTestId('step-when')).toBeNull();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('step-when')).toBeInTheDocument();
  });

  // R84 (FR-FIRST-2 as amended v2.1, US-26 AC7, F-86): the way forward is on the screen.
  it('offers [ continue ] exactly while a typed pair is held, and it moves the step on', () => {
    render(home());
    const continueButton = () => screen.queryByRole('button', { name: en.location.continue });
    expect(continueButton()).toBeNull();
    const field = screen.getByLabelText(en.location.coordsLabel);
    field.focus();
    fireEvent.change(field, { target: { value: '-38.93, -' } });
    expect(continueButton()).toBeNull();
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    expect(continueButton()).toBeInTheDocument();
    // Under the coordinate fields, inside the group.
    expect(within(screen.getByTestId('location-alternatives')).getByTestId('step-continue')).toBe(continueButton());
    // An invalid pair drops the observer, and the control with it.
    fireEvent.change(field, { target: { value: '-38.93, -6x' } });
    expect(continueButton()).toBeNull();
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    const button = continueButton();
    expect(button).not.toBeNull();
    // Moving the focus onto it does not move the page on; pressing it does.
    act(() => {
      button?.focus();
    });
    expect(screen.queryByTestId('step-when')).toBeNull();
    fireEvent.click(button as HTMLElement);
    expect(screen.getByTestId('step-when')).toBeInTheDocument();
  });

  /*
   * R87 (FR-FIRST-1 as amended v2.1): the receiving side of the live page's `[ set a place ]` (R89 draws it).
   * The request opens the where step with the focus in the input group — not on the heading, where an arrival
   * by the step line puts it — and is spent once read, so the next visit home is an ordinary one.
   */
  it('lands [ set a place ] on the where step with the focus in the group, once', () => {
    window.location.hash = '#live';
    act(() => {
      requestPlace();
    });
    expect(window.location.hash).toBe('');
    const first = render(home());
    const group = screen.getByTestId('cold-open');
    expect(group).toHaveAttribute('data-step', 'where');
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: en.location.useMyLocation }));
    first.unmount();

    render(home());
    expect(document.activeElement).toBe(document.body);
  });

  it('opens on the stacked page, and never a step, with a place at mount', () => {
    act(() => {
      appStore.setState({ observer });
    });
    withTheRun();
    render(home());
    expect(screen.getByTestId('reading-where')).toBeInTheDocument();
    expect(screen.getByTestId('reading-when')).toBeInTheDocument();
    expect(screen.getByTestId('list-column')).toBeInTheDocument();
    for (const id of ['step-line', 'step-when', 'step-what', 'cold-open']) expect(screen.queryByTestId(id)).toBeNull();
    // A new place from the group under `[ change ]` does not start the steps either.
    act(() => {
      appStore.setState({ observer: { ...observer, lat: -38.9, label: '−38.90, −67.99' } });
    });
    expect(screen.queryByTestId('step-when')).toBeNull();
  });

  it('shows the what step’s more controls, each opening its cards in place', () => {
    const at = (minutes: number, id: string) => ({ ...pass, id, start: { ...pass.start, t: pass.start.t + minutes * 60_000 }, peak: { ...pass.peak, t: pass.peak.t + minutes * 60_000 }, end: { ...pass.end, t: pass.end.t + minutes * 60_000 } });
    const tonight = [pass, at(30, 'b'), at(60, 'c'), at(90, 'd'), at(120, 'e')];
    const window = { startMs: pass.start.t - 3_600_000, endMs: pass.start.t - 3_600_000 + 72 * 3_600_000 };
    const later = [at(24 * 60, 'f'), at(48 * 60, 'g')];
    render(home());
    fireEvent.click(screen.getByRole('button', { name: en.location.useMyLocation }));
    act(() => {
      appStore.setState({ elements: { ...ready, stale: false }, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: appStore.getState().observer, passes: [...tonight, ...later], hasDarkness: true, window } });
    });
    expect(screen.getByTestId('when-passes')).toHaveTextContent('5 tonight, 7 in 72 h');
    fireEvent.click(screen.getByTestId('see-what'));
    const what = screen.getByTestId('step-what');
    expect(within(what).getByRole('heading', { level: 2, name: 'Five things cross tonight' })).toHaveFocus();
    // The first card and two more, then `[ 2 more tonight ]   [ 2 more nights ]` (board 1B).
    const cards = within(what).getByTestId('what-cards');
    expect(within(cards).getAllByRole('article').map((card) => card.getAttribute('data-pass-id'))).toEqual(['b', 'c']);
    expect(within(cards).getAllByRole('article')[0]).toHaveTextContent(/like|brighter|faint/i);
    const more = within(what).getByTestId('what-more');
    expect(within(more).getAllByRole('button').map((button) => button.textContent)).toEqual(['2 more tonight', '2 more nights']);
    fireEvent.click(within(more).getByTestId('more-tonight'));
    expect(within(cards).getAllByRole('article').map((card) => card.getAttribute('data-pass-id'))).toEqual(['b', 'c', 'd', 'e']);
    fireEvent.click(within(what).getByTestId('more-nights'));
    expect(within(cards).getAllByRole('article').map((card) => card.getAttribute('data-pass-id'))).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
    expect(within(what).getAllByTestId('what-night')).toHaveLength(2);
    expect(within(what).queryByTestId('what-more')).toBeNull();
    // A card is the control that opens its pass.
    fireEvent.click(within(within(cards).getAllByRole('article')[0] as HTMLElement).getByRole('button'));
    expect(onOpenPass).toHaveBeenCalledWith('b');
    // R84 (FR-FIRST-3 as amended v2.1, US-26 AC7, F-84): and so is the first card, whose pass the list leaves out.
    const first = within(cards).getByTestId('next-event');
    fireEvent.click(within(first).getByRole('button', { name: `Open guide → ${pass.name}` }));
    expect(onOpenPass).toHaveBeenLastCalledWith(pass.id);
  });

  it('counts what is shown on the what step, and puts the faint control after [<n> more tonight] (R97, FR-FAINT-2)', () => {
    const at = (minutes: number, id: string, faint = false) => ({
      ...pass,
      id,
      ...(faint ? { noradId: 2, name: `Faint ${id}`, peakMagnitude: 4 } : {}),
      start: { ...pass.start, t: pass.start.t + minutes * 60_000 },
      peak: { ...pass.peak, t: pass.peak.t + minutes * 60_000 },
      end: { ...pass.end, t: pass.end.t + minutes * 60_000 },
    });
    const tonight = [pass, at(30, 'b'), at(60, 'c'), at(75, 'x', true), at(90, 'd'), at(105, 'y', true)];
    const window = { startMs: pass.start.t - 3_600_000, endMs: pass.start.t - 3_600_000 + 72 * 3_600_000 };
    render(home());
    fireEvent.click(screen.getByRole('button', { name: en.location.useMyLocation }));
    act(() => {
      appStore.setState({ elements: { ...ready, stale: false }, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: appStore.getState().observer, passes: [...tonight, at(24 * 60, 'f')], hasDarkness: true, window } });
    });
    expect(screen.getByTestId('when-passes')).toHaveTextContent('4 tonight, 5 in 72 h');
    fireEvent.click(screen.getByTestId('see-what'));
    const what = screen.getByTestId('step-what');
    expect(within(what).getByRole('heading', { level: 2, name: 'Four things cross tonight' })).toBeInTheDocument();
    const more = within(what).getByTestId('what-more');
    expect(within(more).getAllByRole('button').map((button) => button.textContent)).toEqual(['1 more tonight', 'show 2 faint', '1 more night']);
    fireEvent.click(within(more).getByTestId('faint-toggle'));
    expect(within(what).getByRole('heading', { level: 2, name: 'Six things cross tonight' })).toBeInTheDocument();
    expect(within(more).getAllByRole('button').map((button) => button.textContent)).toEqual(['3 more tonight', 'hide 2 faint', '1 more night']);
    fireEvent.click(within(more).getByTestId('more-tonight'));
    const cards = within(what).getByTestId('what-cards');
    expect(within(cards).getAllByRole('article').map((card) => card.getAttribute('data-pass-id'))).toEqual(['b', 'c', 'x', 'd', 'y']);
    expect(within(cards).getAllByTestId('card-faint')).toHaveLength(2);
  });
});

describe('home.count (D-513)', () => {
  it.each([
    ['en', ['One thing crosses tonight', 'Two things cross tonight', 'Three things cross tonight', 'Four things cross tonight', 'Five things cross tonight', 'Six things cross tonight', 'Seven things cross tonight', 'Eight things cross tonight', 'Nine things cross tonight', 'Ten things cross tonight', 'Eleven things cross tonight', 'Twelve things cross tonight'], '13 things cross tonight'],
    [
      'es',
      ['Esta noche hay un pase', 'Esta noche hay dos pases', 'Esta noche hay tres pases', 'Esta noche hay cuatro pases', 'Esta noche hay cinco pases', 'Esta noche hay seis pases', 'Esta noche hay siete pases', 'Esta noche hay ocho pases', 'Esta noche hay nueve pases', 'Esta noche hay diez pases', 'Esta noche hay once pases', 'Esta noche hay doce pases'],
      'Esta noche hay 13 pases',
    ],
  ] as const)('writes the count in words from one to twelve and in figures past it (%s)', (locale, words, past) => {
    const t = CATALOG[locale];
    expect(Array.from({ length: 12 }, (_, index) => t.home.count(index + 1))).toEqual(words);
    expect(t.home.count(13)).toBe(past);
    expect(t.home.count(40)).toBe(past.replace('13', '40'));
  });
});
