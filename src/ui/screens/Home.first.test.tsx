/**
 * R202 (FR-OPEN-3..6, FR-OPEN-12..14, FR-FIRST-4 as amended v2.16; US-60, US-61; D-1178, D-1179): the first visit
 * draws the example — the band on a phone, the populated panes on a desk — the action opens the place question with
 * `[ back ]`, a place set by any way in lands on the stacked page or the panes, and where there is no example the
 * first screen is the question. The steps are gone.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { I18nProvider } from '../../i18n/useT';
import type { Observer } from '../../model';
import { appStore, type ElementsState } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { Home, type HomeProps } from './Home';
import { requestPlace } from './home/placeRequest';
import { usePlaceOpen } from './home/usePlaceOpen';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: true, persistent: true };
const initial = appStore.getInitialState();

/** Whether `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

let media: MatchMediaStub;

// FR-OPEN-6: with no city the first visit is the place question; the cases of the example set their own outcome.
beforeEach(() => {
  act(() => {
    appStore.setState({ exampleOutcome: 'no_city' });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
  window.history.replaceState(null, '', window.location.pathname);
});

describe('the first visit (FR-OPEN-3..6, FR-FIRST-4 as amended v2.16, D-1178)', () => {
  const found = { coords: { latitude: -38.93, longitude: -67.99, altitude: null, accuracy: 30 }, timestamp: 0 };
  const deviceFinds = {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) => {
        ok(found as unknown as GeolocationPosition);
      },
    } as unknown as Geolocation,
    secure: true,
  };
  const example: Observer = { lat: -34.6, lon: -58.45, altM: 0, label: 'Buenos Aires', source: 'example', timeZone: 'America/Argentina/Buenos_Aires' };
  const onOpenPass = vi.fn();
  // R87, R202: `App` holds the first visit's state (D-1178); here a host holds it the same way, with a route of its
  // own as `App` has — the live and settings routes draw instead of `Home`.
  function Routed({ offHome = false, ...props }: { offHome?: boolean } & Partial<HomeProps>) {
    const place = usePlaceOpen(offHome);
    if (offHome) return <p>another route</p>;
    return <Home offersInert={false} guide="closed" shareNotice={null} selectedPassId={null} onOpenPass={onOpenPass} passDetail={null} MoonLore={undefined} geolocation={deviceFinds} place={place} {...props} />;
  }
  const home = (props: Partial<HomeProps> = {}) => <Routed {...props} />;
  const run = (observer: Observer | null, passes = [pass]) => ({ ...IDLE_PASSES, jobId: 'job-1', status: 'done' as const, observer, passes, hasDarkness: true });
  const withTheRun = () => {
    act(() => {
      appStore.setState({ elements: { ...ready, stale: false }, passes: run(appStore.getState().observer) });
    });
  };
  /** The example as `startApp` and the effects leave it: the zone's city, its run and what the run came to. */
  const withExample = (outcome: 'pending' | 'pass' | 'none' | 'failed' | 'slow') => {
    act(() => {
      appStore.setState({ example, exampleStartedMs: NOW, exampleOutcome: outcome, elements: { ...ready, stale: false }, passes: outcome === 'pending' ? IDLE_PASSES : run(example, outcome === 'none' ? [] : [pass]) });
    });
  };

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(pass.start.t - 12 * 60_000);
    media = stubMatchMedia(COMPACT_PX);
    onOpenPass.mockClear();
  });

  it('FR-OPEN-3 (US-60 AC1): on a phone the tagline, the example band, then the stacked page for the example, doors first — and no step line', () => {
    withExample('pass');
    render(home());
    const tagline = screen.getByTestId('home-tagline');
    expect(tagline).toHaveTextContent(en.app.tagline);
    const band = screen.getByTestId('example-band');
    const doors = screen.getByTestId('home-doors');
    const where = screen.getByTestId('reading-where');
    const when = screen.getByTestId('reading-when');
    const what = screen.getByTestId('list-column');
    for (const [a, b] of [
      [tagline, band],
      [band, doors],
      [doors, where],
      [where, when],
      [when, what],
    ] as const)
      expect(precedes(a, b)).toBe(true);
    for (const id of ['step-line', 'cold-open', 'place-back', 'location-summary', 'readiness']) expect(screen.queryByTestId(id)).toBeNull();

    // The band's blocks in order: the label, the first card — a control that opens that pass — and the action.
    const label = within(band).getByTestId('example-label');
    expect(label).toHaveTextContent('Example: Buenos Aires, from your time zone');
    const card = within(band).getByTestId('next-event');
    expect(card).toHaveAttribute('data-form', 'card');
    const action = within(band).getByRole('button', { name: en.example.setPlace });
    expect(precedes(label, card)).toBe(true);
    expect(precedes(card, action)).toBe(true);
    fireEvent.click(within(card).getByRole('button', { name: `${en.passes.openGuide} ${pass.name}` }));
    expect(onOpenPass).toHaveBeenCalledWith(pass.id);

    // FR-OPEN-12, FR-OPEN-13: what it looks like, and words for every height and brightness on the home.
    expect(within(card).getByTestId('next-event-path')).toHaveTextContent('NE low → low in the sky → ENE · 1 min');
    expect(within(card).getByTestId('next-event-brightness')).toHaveTextContent(/^Like a bright star$/);
    expect(within(card).getByTestId('example-looks')).toHaveTextContent(en.example.looks(1));
    expect(within(doors).getAllByTestId('door-satellites-line')[1]).toHaveTextContent('ISS (Zarya) · low → ENE');
    expect(within(what).getByTestId('card-detail')).toHaveTextContent('1 min · peak low NE · like a bright star');
    for (const part of [band, doors, what]) expect(part.textContent).not.toMatch(/°|mag /);

    // D-1179: the Where reading is the label and the action in place of the place and `[ change ]`.
    expect(within(where).getByTestId('where-example-label')).toHaveTextContent(en.example.label('Buenos Aires'));
    expect(within(where).getByRole('button', { name: en.example.setPlace })).toBeInTheDocument();
    expect(within(where).getByTestId('location-group')).not.toBeVisible();
    // FR-OPEN-2: nothing of the example is in the fields or offered to be saved.
    expect(within(where).getByLabelText(en.location.coordsLabel)).toHaveValue('');
    expect(screen.queryByTestId('save-favourite')).toBeNull();
  });

  it('FR-OPEN-3: the band reads Spanish under a Spanish provider', () => {
    withExample('pass');
    render(createElement(I18nProvider, { locale: 'es', children: home() }));
    const band = screen.getByTestId('example-band');
    expect(screen.getByTestId('home-tagline')).toHaveTextContent(es.app.tagline);
    expect(within(band).getByTestId('example-label')).toHaveTextContent('Ejemplo: Buenos Aires, según tu zona horaria');
    expect(within(band).getByTestId('next-event-path')).toHaveTextContent('NE bajo → bajo en el cielo → ENE · 1 min');
    expect(within(band).getByRole('button', { name: '¿No es ahí? Elegí tu lugar' })).toBeInTheDocument();
  });

  it('FR-OPEN-4: until the run is ready the band is the label, the wait and the action, already live', () => {
    withExample('pending');
    render(home());
    const band = screen.getByTestId('example-band');
    expect(band).toHaveAttribute('data-state', 'pending');
    expect(within(band).getByTestId('example-label')).toHaveTextContent(en.example.label('Buenos Aires'));
    expect(within(band).getByTestId('example-finding')).toHaveTextContent("Finding tonight's passes over Buenos Aires…");
    expect(within(band).queryByTestId('next-event')).toBeNull();
    expect(within(band).getByTestId('example-hold')).toBeInTheDocument();
    fireEvent.click(within(band).getByRole('button', { name: en.example.setPlace }));
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
  });

  it('holds the band’s shape for the moment before the city is known, and asks at once when a place was dropped', () => {
    act(() => {
      appStore.setState({ exampleOutcome: 'pending' });
    });
    render(home());
    expect(screen.getByTestId('example-band')).toHaveAttribute('data-state', 'pending');
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(within(screen.getByTestId('example-band')).getByRole('button', { name: en.example.setPlace })).toBeEnabled();
    // A place set and then cleared in this load: nothing is coming, so the page is the question.
    act(() => {
      appStore.getState().setObserver(observer);
    });
    act(() => {
      appStore.getState().setObserver(null);
    });
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
    expect(screen.queryByTestId('example-band')).toBeNull();
  });

  it('FR-OPEN-5 (US-61 AC1): the action opens the question as one screen with the focus in the group and [ back ] above the heading; [ back ] returns to the example with no new run', () => {
    withExample('pass');
    render(home());
    const before = appStore.getState();
    fireEvent.click(within(screen.getByTestId('example-band')).getByRole('button', { name: en.example.setPlace }));
    const cold = screen.getByTestId('cold-open');
    expect(cold).toHaveAttribute('data-step', 'where');
    for (const id of ['example-band', 'home-doors', 'reading-when', 'list-column', 'home-tagline']) expect(screen.queryByTestId(id)).toBeNull();
    const back = within(cold).getByRole('button', { name: en.example.back });
    const heading = within(cold).getByRole('heading', { level: 2, name: en.home.coldHeading });
    const group = within(cold).getByTestId('location-group');
    expect(precedes(back, heading)).toBe(true);
    expect(precedes(heading, within(cold).getByText(en.home.coldSentence))).toBe(true);
    expect(group).toHaveAttribute('data-look', 'boxed');
    expect(document.activeElement).toBe(within(group).getByRole('button', { name: en.location.useMyLocation }));

    fireEvent.click(back);
    expect(screen.queryByTestId('cold-open')).toBeNull();
    const action = within(screen.getByTestId('example-band')).getByRole('button', { name: en.example.setPlace });
    expect(action).toHaveFocus();
    expect(within(screen.getByTestId('example-band')).getByTestId('next-event')).toBeInTheDocument();
    // The example as it was: the same run, the same clock.
    expect(appStore.getState().passes).toBe(before.passes);
    expect(appStore.getState().nowMs).toBe(before.nowMs);
    expect(appStore.getState().example).toBe(example);
  });

  it('FR-OPEN-5 (US-61 AC2): a place set from the question lands on the stacked page, with no step between', () => {
    withExample('pass');
    render(home());
    fireEvent.click(within(screen.getByTestId('example-band')).getByRole('button', { name: en.example.setPlace }));
    fireEvent.click(within(screen.getByTestId('cold-open')).getByRole('button', { name: en.location.useMyLocation }));
    withTheRun();
    expect(appStore.getState().observer).toMatchObject({ source: 'device' });
    expect(appStore.getState().example).toBeNull();
    for (const id of ['cold-open', 'example-band', 'home-tagline', 'step-line', 'where-example']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
    expect(screen.getByTestId('home-doors')).toBeInTheDocument();
    expect(screen.getByTestId('reading-when')).toBeInTheDocument();
    // A set place keeps its figures (FR-OPEN-13).
    expect(within(screen.getByTestId('list-column')).getByTestId('card-detail')).toHaveTextContent(/peak \d+° NE · mag/);
    expect(within(screen.getByTestId('home-doors')).getAllByTestId('door-satellites-line')[1]).toHaveTextContent(/NE \d+° → ENE/);
  });

  it.each(['none', 'failed', 'slow'] as const)('FR-OPEN-6 (US-60 AC4): with the example %s the first screen is the question, the tagline above its heading and no [ back ]', (outcome) => {
    withExample(outcome);
    render(home());
    const cold = screen.getByTestId('cold-open');
    expect(precedes(within(cold).getByTestId('home-tagline'), within(cold).getByRole('heading', { level: 2, name: en.home.coldHeading }))).toBe(true);
    for (const id of ['example-band', 'place-back', 'home-doors', 'reading-when', 'list-column']) expect(screen.queryByTestId(id)).toBeNull();
    // The fields are the reader's own, never the example's.
    expect(within(cold).getByLabelText(en.location.coordsLabel)).toHaveValue('');
  });

  it('FR-OPEN-6: once the fallback is shown, a late run does not replace it', () => {
    act(() => {
      appStore.setState({ example, exampleStartedMs: NOW, exampleOutcome: 'slow', elements: { ...ready, stale: false }, passes: IDLE_PASSES });
    });
    render(home());
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
    act(() => {
      appStore.setState({ passes: run(example) });
    });
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
    expect(screen.queryByTestId('example-band')).toBeNull();
  });

  it('a place set on another route comes back to the stacked page, not to the question — failing on the first cut of R87', () => {
    const { rerender } = render(<Routed />);
    expect(screen.getByTestId('cold-open')).toHaveAttribute('data-step', 'where');

    // The settings page draws instead of the home, and the place is set there.
    rerender(<Routed offHome />);
    act(() => {
      appStore.setState({ observer });
    });
    withTheRun();

    rerender(<Routed />);
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
  });

  it('leaving the home closes the question the action opened', () => {
    withExample('pass');
    const { rerender } = render(<Routed />);
    fireEvent.click(within(screen.getByTestId('example-band')).getByRole('button', { name: en.example.setPlace }));
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
    rerender(<Routed offHome />);
    rerender(<Routed />);
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('example-band')).toBeInTheDocument();
  });

  it('holds the question while a coordinate pair is typed, and moves on only when the field is left (D-467)', () => {
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
    expect(screen.queryByTestId('reading-when')).toBeNull();

    // Leaving the field is what moves it — to the stacked page, with no step between (FR-OPEN-5).
    act(() => {
      field.blur();
    });
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('reading-when')).toBeInTheDocument();
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
  });

  it('holds a pair typed in the question the action opened, the example gone with the first valid keystroke', () => {
    withExample('pass');
    render(home());
    fireEvent.click(within(screen.getByTestId('example-band')).getByRole('button', { name: en.example.setPlace }));
    const field = screen.getByLabelText(en.location.coordsLabel);
    field.focus();
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    expect(appStore.getState().example).toBeNull();
    expect(screen.getByTestId('cold-open')).toContainElement(field);
    expect(field).toHaveFocus();
    // There is no example to go back to.
    expect(screen.queryByTestId('place-back')).toBeNull();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('location-summary')).toBeInTheDocument();
  });

  it('moves on from a typed pair on Enter', () => {
    render(home());
    const field = screen.getByLabelText(en.location.coordsLabel);
    field.focus();
    fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
    expect(screen.queryByTestId('reading-when')).toBeNull();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByTestId('reading-when')).toBeInTheDocument();
  });

  // R84 (FR-FIRST-2 as amended v2.1, US-26 AC7, F-86): the way forward is on the screen.
  it('offers [ continue ] exactly while a typed pair is held, and it moves the page on', () => {
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
    expect(screen.getByTestId('cold-open')).toBeInTheDocument();
    fireEvent.click(button as HTMLElement);
    expect(screen.queryByTestId('cold-open')).toBeNull();
    expect(screen.getByTestId('reading-when')).toBeInTheDocument();
  });

  /*
   * R87 (FR-FIRST-1 as amended v2.1): the receiving side of the live page's `[ set a place ]` (R89 draws it).
   * The request opens the question with the focus in the input group and is spent once read, so the next visit
   * home is an ordinary one.
   */
  it('lands [ set a place ] on the question with the focus in the group, once', () => {
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

  it('FR-OPEN-5: over the example, [ set a place ] opens the question as the action does, and it stays open once the request is spent', () => {
    withExample('pass');
    act(() => {
      requestPlace();
    });
    render(home());
    const cold = screen.getByTestId('cold-open');
    expect(document.activeElement).toBe(within(cold).getByRole('button', { name: en.location.useMyLocation }));
    expect(within(cold).getByRole('button', { name: en.example.back })).toBeInTheDocument();
    fireEvent.click(within(cold).getByRole('button', { name: en.example.back }));
    expect(screen.getByTestId('example-band')).toBeInTheDocument();
  });

  it('opens on the stacked page, and never the question or the example, with a place at mount (FR-OPEN-9)', () => {
    act(() => {
      appStore.setState({ observer, exampleOutcome: 'pending' });
    });
    withTheRun();
    render(home());
    expect(screen.getByTestId('reading-where')).toBeInTheDocument();
    expect(screen.getByTestId('reading-when')).toBeInTheDocument();
    expect(screen.getByTestId('list-column')).toBeInTheDocument();
    for (const id of ['step-line', 'cold-open', 'example-band', 'home-tagline', 'where-example']) expect(screen.queryByTestId(id)).toBeNull();
    // A new place from the group under `[ change ]` does not bring the question's screen either.
    act(() => {
      appStore.setState({ observer: { ...observer, lat: -38.9, label: '−38.90, −67.99' } });
    });
    expect(screen.queryByTestId('cold-open')).toBeNull();
  });

  describe('on wide', () => {
    beforeEach(() => {
      media = stubMatchMedia(WIDE_PX);
    });

    it('FR-OPEN-4 (US-60 AC3): the populated panes for the example — the label and the action in the Where pane, the next event in When, the cards in words', () => {
      withExample('pass');
      render(home());
      for (const id of ['example-band', 'cold-open', 'ghost-when', 'ghost-what', 'home-tagline', 'location-summary', 'readiness']) expect(screen.queryByTestId(id)).toBeNull();
      const where = screen.getByTestId('reading-where');
      const label = within(where).getByTestId('where-example-label');
      expect(label).toHaveTextContent('Example: Buenos Aires, from your time zone');
      const action = within(where).getByRole('button', { name: en.example.setPlace });
      expect(precedes(label, action)).toBe(true);
      expect(within(where).getByTestId('location-group')).not.toBeVisible();
      // Its saved places read none: nothing to save, nothing listed.
      expect(within(where).queryByTestId('favourites')).toBeNull();

      const when = screen.getByTestId('reading-when');
      const block = within(when).getByTestId('next-event');
      expect(block).toHaveAttribute('data-form', 'block');
      expect(within(block).getByTestId('next-event-path')).toHaveTextContent('ISS (Zarya) · NE low → low in the sky → ENE');
      expect(block.lastElementChild).toBe(within(block).getByTestId('example-looks'));
      expect(within(block).getByTestId('example-looks')).toHaveTextContent(en.example.looks(1));
      expect(within(screen.getByTestId('list-column')).getByTestId('card-detail')).toHaveTextContent('1 min · peak low NE · like a bright star');
      expect(within(screen.getByTestId('home-doors')).getAllByTestId('door-satellites-line')[1]).toHaveTextContent('ISS (Zarya) · low → ENE');
      for (const id of ['home-doors', 'reading-when', 'list-column']) expect(screen.getByTestId(id).textContent, id).not.toMatch(/\d°|mag /);
    });

    it('FR-OPEN-4: until the run is ready the Where pane is the label, the wait and the action, and the next event holds its height', () => {
      withExample('pending');
      render(home());
      const where = screen.getByTestId('reading-where');
      expect(within(where).getByTestId('where-example-finding')).toHaveTextContent(en.example.finding('Buenos Aires'));
      expect(within(where).getByRole('button', { name: en.example.setPlace })).toBeEnabled();
      const when = screen.getByTestId('reading-when');
      expect(within(when).queryByTestId('next-event')).toBeNull();
      expect(within(when).getByTestId('next-event-hold')).toBeInTheDocument();
    });

    it('FR-OPEN-5: the action opens the group in place, plain, with the focus in it and [ back ] under it; [ back ] folds it away', () => {
      withExample('pass');
      render(home());
      const where = screen.getByTestId('reading-where');
      fireEvent.click(within(where).getByRole('button', { name: en.example.setPlace }));
      // In place: the same pane, the other panes still populated.
      expect(screen.getByTestId('reading-where')).toBe(where);
      expect(screen.queryByTestId('cold-open')).toBeNull();
      expect(screen.getByTestId('reading-when')).toBeInTheDocument();
      expect(screen.getByTestId('list-column')).toBeInTheDocument();
      const group = within(where).getByTestId('location-group');
      expect(group).toBeVisible();
      expect(group).toHaveAttribute('data-look', 'plain');
      expect(document.activeElement).toBe(within(group).getByRole('button', { name: en.location.useMyLocation }));
      const back = within(where).getByRole('button', { name: en.example.back });
      expect(precedes(group, back)).toBe(true);
      expect(within(where).queryByRole('button', { name: en.example.setPlace })).toBeNull();

      fireEvent.click(back);
      expect(within(where).getByTestId('location-group')).not.toBeVisible();
      expect(within(where).getByRole('button', { name: en.example.setPlace })).toHaveFocus();
    });

    it('FR-OPEN-5: a pair typed in the open group sets the place under the reader’s hands, and the panes are that place’s', () => {
      withExample('pass');
      render(home());
      fireEvent.click(within(screen.getByTestId('reading-where')).getByRole('button', { name: en.example.setPlace }));
      const field = screen.getByLabelText(en.location.coordsLabel);
      field.focus();
      fireEvent.change(field, { target: { value: '-38.93, -67.99' } });
      expect(appStore.getState().observer).toMatchObject({ source: 'coords' });
      expect(screen.getByLabelText(en.location.coordsLabel)).toBe(field);
      expect(field).toHaveFocus();
      expect(field).toBeVisible();
      expect(screen.queryByTestId('where-example')).toBeNull();
      expect(screen.getByTestId('location-summary')).toBeInTheDocument();
    });

    it.each(['none', 'failed', 'slow'] as const)('FR-OPEN-6: with the example %s the page is the cold open — Where active, When and What dimmed', (outcome) => {
      withExample(outcome);
      render(home());
      const cold = screen.getByTestId('cold-open');
      expect(within(cold).getByRole('heading', { level: 2, name: '[01] Where' })).toBeInTheDocument();
      expect(screen.getByTestId('ghost-when')).toBeInTheDocument();
      expect(screen.getByTestId('ghost-what')).toBeInTheDocument();
      for (const id of ['home-doors', 'reading-when', 'list-column', 'where-example', 'place-back']) expect(screen.queryByTestId(id)).toBeNull();
    });
  });
});
