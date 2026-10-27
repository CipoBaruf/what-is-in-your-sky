/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-10, FR-A11Y-1..2; US-39
 * AC1, AC2, AC4): the stars page as a component — its one `h1` and its
 * outline, the window under the hand camera, the facing picker turning the
 * camera, the layers, `In this field` naming a mark, the inert line without a
 * place, and both languages. The box's layout and the list against a measured
 * box are the e2e's (`tests/e2e/stars.spec.ts`): jsdom lays nothing out.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import { STARS_PAGE_CATALOGS } from '../../i18n/starsPageT';
import { I18nProvider } from '../../i18n/useT';
import type { Locale, Observer } from '../../model';
import { appStore } from '../../state';
import { IDLE_PASSES } from '../../state/slices/passes';
import { goldenPassFixture } from '../../../tests/support/catalogFixtures';
import { STARS_DEFAULT_TILT } from '../components/guide/skychart/window/camera';
import { FieldList } from './stars/FieldList';
import { STAR_LABEL_HOLD_S } from './stars/field';
import { passesRunIn, StarsPage } from './Stars';

const SOUTH: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Cipolletti', source: 'coords', timeZone: null };
const NORTH: Observer = { ...SOUTH, lat: 48.86, lon: 2.35, label: 'Paris' };
const initial = appStore.getInitialState();
let media: MatchMediaStub | null = null;

afterEach(() => {
  media?.restore();
  media = null;
  appStore.setState(initial, true);
  vi.useRealTimers();
});

const page = (locale: Locale = 'en') => render(<I18nProvider locale={locale}>{<StarsPage />}</I18nProvider>);
const stars = () => screen.getByTestId('stars-page');

describe('<StarsPage> (FR-STAR-3)', () => {
  it('has its own visible h1, three h2 blocks in the rail, and the drawing named as a group (FR-A11Y-1, FR-A11Y-2, FR-FLOW-3)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = page();
    const p = STARS_PAGE_CATALOGS.en;
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([en.starsHeading]);
    // R129 (FR-FLOW-3): under it at `--small`, the dark window and the cloud word — with no forecast, the cloud word says so.
    expect(screen.getByTestId('stars-intro')).toContainElement(screen.getByTestId('stars-tonight'));
    expect(screen.getByTestId('stars-tonight')).toHaveTextContent(en.weather.state.unknown);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([p.facing, p.layersHeading, p.fieldHeading]);
    expect(screen.getByRole('group', { name: p.drawing })).toContainElement(screen.getByTestId('window-readout'));
    // The window is the hand's: the box takes the focus and the arrow keys, and the drawing itself is hidden from AT.
    expect(container.querySelector('[data-state="hand"] [tabindex="0"]')).not.toBeNull();
    expect(container.querySelector('svg[data-drawing="window"]')).toHaveAttribute('aria-hidden', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens on the pole side at the default tilt, south of the equator and north of it, and focuses the box', () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    const { unmount } = page();
    expect(stars()).toHaveAttribute('data-look-az', '180');
    expect(stars()).toHaveAttribute('data-look-alt', String(STARS_DEFAULT_TILT));
    expect(within(screen.getByRole('group', { name: STARS_PAGE_CATALOGS.en.facing })).getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('stars-sky')).toContainElement(document.activeElement as HTMLElement);
    unmount();
    appStore.setState({ observer: NORTH });
    page();
    expect(stars()).toHaveAttribute('data-look-az', '0');
  });

  it('turns the camera from the facing picker: a point at the current tilt, up to the zenith, and a point from there back down (FR-STAR-4)', () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    page();
    const picker = screen.getByRole('group', { name: STARS_PAGE_CATALOGS.en.facing });
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
    fireEvent.click(within(picker).getByRole('button', { name: 'NE' }));
    expect(stars()).toHaveAttribute('data-look-az', '45');
    expect(stars()).toHaveAttribute('data-look-alt', String(STARS_DEFAULT_TILT));
    fireEvent.click(within(picker).getByRole('button', { name: 'up' }));
    expect(stars()).toHaveAttribute('data-look-alt', '90');
    expect(within(picker).getByRole('button', { name: 'up' })).toHaveAttribute('aria-pressed', 'true');
    // A point from the zenith brings the view back down to the opening tilt, and is the pressed one; the arrow keys on the box are the window's, through the same camera.
    fireEvent.click(within(picker).getByRole('button', { name: 'W' }));
    expect(stars()).toHaveAttribute('data-look-az', '270');
    expect(stars()).toHaveAttribute('data-look-alt', String(STARS_DEFAULT_TILT));
    expect(within(picker).getByRole('button', { name: 'W' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByRole('button', { name: 'up' })).toHaveAttribute('aria-pressed', 'false');
    const box = screen.getByTestId('stars-sky').querySelector<HTMLElement>('[tabindex="0"]');
    fireEvent.keyDown(box as HTMLElement, { key: 'ArrowDown' });
    expect(stars()).toHaveAttribute('data-look-alt', String(STARS_DEFAULT_TILT - 5));
    fireEvent.keyDown(box as HTMLElement, { key: 'ArrowRight' });
    expect(stars()).toHaveAttribute('data-look-az', '285');
    expect(within(picker).getAllByRole('button').some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
  });

  it('toggles the four layers, all on at first, names included, and [ passes ] off (FR-STAR-3 as amended v2.4.1, FR-SKY-6)', () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    page();
    const layers = screen.getByRole('group', { name: STARS_PAGE_CATALOGS.en.layersHeading });
    const toggles = within(layers).getAllByRole('button');
    expect(toggles.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['stars', 'true'],
      ['figures', 'true'],
      ['planets', 'true'],
      ['names', 'true'],
      ['passes', 'false'],
    ]);
    fireEvent.click(within(layers).getByRole('button', { name: 'figures' }));
    expect(within(layers).getByRole('button', { name: 'figures' })).toHaveAttribute('aria-pressed', 'false');
    // Two rows of two on every width (D-776), and R126's `[ passes ]` on a row of its own.
    expect(within(layers).getAllByTestId('stars-layers-row').map((row) => row.children.length)).toEqual([2, 2, 1]);
  });

  /*
   * R126 (FR-SKY-6, D-794; US-40 AC5): `[ passes ]` brings the store's run for this place onto the sky — the arc in
   * the page's window with its key — and is page state: off on every open, never in the saved prefs.
   */
  it('brings tonight’s passes onto the sky with [ passes ], off on every open and never saved (FR-SKY-6)', () => {
    media = stubMatchMedia(COMPACT_PX);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const golden = goldenPassFixture();
    vi.setSystemTime(golden.start.t + 10_000);
    appStore.setState({ observer: SOUTH, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: SOUTH, passes: [golden], hasDarkness: true } });
    const { unmount } = page();
    const sky = screen.getByTestId('stars-sky');
    expect(sky.querySelector('[data-pass-id]')).toBeNull();
    const toggle = screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.passesLayer });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(sky.querySelector(`[data-pass-id="${golden.id}"]`)).not.toBeNull();
    expect(sky.querySelector('[data-key="A"]')).not.toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toMatch(/passes/i);
    unmount();
    page();
    expect(screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.passesLayer })).toHaveAttribute('aria-pressed', 'false');
    // A run for another place is not this sky's.
    appStore.setState({ passes: { ...appStore.getState().passes, observer: NORTH } });
    fireEvent.click(screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.passesLayer }));
    expect(screen.getByTestId('stars-sky').querySelector('[data-pass-id]')).toBeNull();
  });

  /*
   * R126 review: `[ passes ]` hands the screen the store's passes only once the run for this place is in — otherwise
   * the screen would draw the empty-sky chip ("nothing tonight") for a night not yet computed.
   */
  it('takes the store’s passes only once the run for this place is in (FR-SKY-6)', () => {
    const golden = goldenPassFixture();
    const run = { ...IDLE_PASSES, observer: SOUTH };
    expect(passesRunIn({ ...run, status: 'done', passes: [] }, SOUTH)).toBe(true);
    expect(passesRunIn({ ...run, status: 'done', passes: [golden] }, SOUTH)).toBe(true);
    expect(passesRunIn({ ...run, status: 'computing', passes: [golden] }, SOUTH)).toBe(true);
    expect(passesRunIn({ ...run, status: 'computing', passes: [] }, SOUTH)).toBe(false);
    expect(passesRunIn({ ...run, status: 'error', passes: [] }, SOUTH)).toBe(false);
    expect(passesRunIn({ ...run, status: 'idle', passes: [] }, SOUTH)).toBe(false);
    expect(passesRunIn({ ...run, status: 'done', observer: NORTH, passes: [golden] }, SOUTH)).toBe(false);
  });

  it('is the inert line with [ set a place ] when there is no observer (FR-LIVE-1)', () => {
    media = stubMatchMedia(COMPACT_PX);
    page();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.stars.heading);
    expect(screen.getByTestId('stars-inert')).toHaveTextContent(STARS_PAGE_CATALOGS.en.noPlace);
    expect(screen.getByTestId('stars-set-place')).toHaveTextContent(STARS_PAGE_CATALOGS.en.setPlace);
    expect(screen.queryByTestId('stars-sky')).toBeNull();
    // FR-A11Y-1..3: the page places its focus on its one control.
    expect(screen.getByTestId('stars-set-place')).toHaveFocus();
  });

  it('focuses the drawing’s box on open (FR-A11Y-1..3)', () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    page();
    expect(screen.getByTestId('stars-sky').querySelector('[tabindex="0"]')).toHaveFocus();
  });

  it('is all Spanish in Spanish, the compass abbreviations and the star names aside (FR-STAR-10)', () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    page('es');
    const p = STARS_PAGE_CATALOGS.es;
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([p.facing, p.layersHeading, p.fieldHeading]);
    expect(within(screen.getByRole('group', { name: p.facing })).getByRole('button', { name: 'arriba' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: p.layersHeading })).getAllByRole('button').map((b) => b.textContent)).toEqual(['estrellas', 'figuras', 'planetas', 'nombres', 'pases']);
  });
});

describe('<FieldList> (FR-STAR-7, FR-LEG-4)', () => {
  const objects = [
    { index: 1, name: 'Canopus', planet: null, mag: -0.74, altDeg: 28.2, point: 'SE' as const },
    { index: 1040, name: null, planet: 'Jupiter' as const, mag: -2.3, altDeg: 40, point: 'NE' as const },
  ];

  it('is a list named by its heading, one button a row reading name, magnitude, altitude and direction', () => {
    render(
      <I18nProvider locale="en">
        <h2 id="h">In this field</h2>
        <FieldList objects={objects} named={null} onName={vi.fn()} buried={false} labelledBy="h" />
      </I18nProvider>,
    );
    const list = screen.getByRole('list', { name: 'In this field' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(['Canopus · mag −0.7 · 28° up · SE', 'Jupiter · mag −2.3 · 40° up · NE']);
    expect(rows[0]).toHaveTextContent('Canopusmag −0.728°SE');
  });

  /*
   * R126 (FR-SKY-6, D-794; FR-STAR-10 as amended v2.5): the passes first — the key, the swatch and the name, the
   * FR-LEG-3 state word, the peak's altitude and direction — as rows that are not controls, with the whole row as
   * what is read; the stars after them, as before.
   */
  it('lists the passes in the field ahead of the stars: key, name, state and peak (FR-SKY-6)', () => {
    const passes = [{ id: 'iss', key: 'A', color: 'series-1' as const, name: 'ISS (ZARYA)', state: 'live' as const, peakAltDeg: 64.4, peakPoint: 'NNW' as const }];
    render(
      <I18nProvider locale="es">
        <h2 id="h">En este campo</h2>
        <FieldList objects={objects} passes={passes} named={null} onName={vi.fn()} buried={false} labelledBy="h" />
      </I18nProvider>,
    );
    const items = within(screen.getByRole('list', { name: 'En este campo' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const row = items[0]?.querySelector('[data-kind="pass"]');
    expect(row).toHaveAttribute('data-pass-id', 'iss');
    expect(within(items[0] as HTMLElement).queryByRole('button')).toBeNull();
    expect(items[0]).toHaveTextContent('A: ISS (ZARYA) · arriba · culmina a 64° de altura · NNW');
    expect(row?.querySelector('[data-color="series-1"]')).not.toBeNull();
    expect(within(items[1] as HTMLElement).getByRole('button')).toHaveAttribute('data-kind', 'star');
    // A list with passes in it and nothing else is not the empty note.
    cleanup();
    render(
      <I18nProvider locale="en">
        <FieldList objects={[]} passes={passes} named={null} onName={vi.fn()} buried={false} labelledBy="h" />
      </I18nProvider>,
    );
    expect(screen.queryByTestId('field-list-empty')).toBeNull();
    expect(screen.getByTestId('field-list')).toHaveTextContent('A: ISS (ZARYA) · up · peaks 64° up · NNW');
  });

  it('names a row’s mark on focus and on a click, and shows the named one pressed', () => {
    const onName = vi.fn();
    const { rerender } = render(
      <I18nProvider locale="es">
        <FieldList objects={objects} named={null} onName={onName} buried={false} labelledBy="h" />
      </I18nProvider>,
    );
    const jupiter = screen.getByRole('button', { name: /^Júpiter/ });
    act(() => {
      jupiter.focus();
    });
    fireEvent.click(jupiter);
    expect(onName.mock.calls).toEqual([[1040], [1040]]);
    rerender(
      <I18nProvider locale="es">
        <FieldList objects={objects} named={1040} onName={onName} buried={false} labelledBy="h" />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /^Júpiter · mag −2,3 · 40° de altura · NE$/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears a named row on a second activation, by pointer or by key, as a second tap on the mark does', () => {
    const onName = vi.fn();
    const list = (named: number | null) => (
      <I18nProvider locale="en">
        <FieldList objects={objects} named={named} onName={onName} buried={false} labelledBy="h" />
      </I18nProvider>
    );
    const { rerender } = render(list(null));
    const canopus = screen.getByRole('button', { name: /^Canopus/ });
    // A first click: the press focuses the row (which names it) and the click that follows names it too, not clears it.
    fireEvent.pointerDown(canopus);
    act(() => {
      canopus.focus();
    });
    rerender(list(1));
    fireEvent.click(canopus);
    expect(onName.mock.calls).toEqual([[1], [1]]);
    // A second click on the named row clears it.
    onName.mockClear();
    fireEvent.pointerDown(canopus);
    fireEvent.click(canopus);
    expect(onName.mock.calls).toEqual([[null]]);
    // By key: Enter on the named, focused row clears it; on a row not named it names it.
    onName.mockClear();
    fireEvent.click(canopus);
    rerender(list(null));
    fireEvent.click(canopus);
    expect(onName.mock.calls).toEqual([[null], [1]]);
  });

  it('is FR-FOL-5’s note when the field is all ground, and says so when nothing is drawn', () => {
    const { rerender } = render(
      <I18nProvider locale="en">
        <FieldList objects={objects} named={null} onName={vi.fn()} buried labelledBy="h" />
      </I18nProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(en.window.buried);
    expect(screen.queryByRole('list')).toBeNull();
    rerender(
      <I18nProvider locale="en">
        <FieldList objects={[]} named={null} onName={vi.fn()} buried={false} labelledBy="h" />
      </I18nProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(STARS_PAGE_CATALOGS.en.fieldEmpty);
  });
});

describe('the label hold (FR-STAR-7)', () => {
  it('is four seconds', () => {
    expect(STAR_LABEL_HOLD_S).toBe(4);
  });
});
