/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-10, FR-A11Y-1..2; US-39
 * AC1, AC2, AC4): the stars page as a component — its one `h1` and its
 * outline, the window under the hand camera, the facing picker turning the
 * camera, the layers, `In this field` naming a mark, the inert line without a
 * place, and both languages. The box's layout and the list against a measured
 * box are the e2e's (`tests/e2e/stars.spec.ts`, `tests/e2e/clean-sky.spec.ts`): jsdom lays nothing out.
 *
 * R163 (FR-CLEAN-1..4, FR-CLEAN-6, FR-CLEAN-11; US-49 AC2, AC3, AC4, AC6; D-997, D-999, D-1004, D-1009..D-1011): on
 * compact the page is the full form — with the sheet closed exactly the box, the head with the door's line, the
 * corner readout, the bottom row and the hint; the sheet's rows in FR-CLEAN-4's order in both languages; the `h1`
 * hidden; `Esc` in two steps; no `[ passes ]` toggle and no pass in the scene.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { STARS_PAGE_CATALOGS } from '../../i18n/starsPageT';
import { I18nProvider } from '../../i18n/useT';
import type { SkyBand } from '../../lib/timeStripe';
import type { Locale, Observer } from '../../model';
import { appStore } from '../../state';
import { STARS_DEFAULT_TILT } from '../components/guide/skychart/window/camera';
import { WINDOW_FOV_MAX_DEG } from '../components/guide/skychart/window/projection';
import { resetOrientationAccess } from '../components/guide/skychart/window/orientationAccess';
import { FieldList } from './stars/FieldList';
import { STAR_LABEL_HOLD_S } from './stars/field';
import { starsHeadLine, StarsPage } from './Stars';

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

/**
 * R160 (D-971): the window is `SkyChart`'s lazy view, drawn after the page's commit. `drawn` waits for a view's drawing
 * and flushes the commit's passive effects inside `act` with an empty probe root (`Live.test.tsx`'s `windowDrawn`, D-987),
 * so the hand camera's subscription is attached before a test moves it.
 */
async function drawn(view: 'window' | 'polar' = 'window'): Promise<void> {
  // The chunk's import lands late under a loaded run: five seconds, not `waitFor`'s one.
  await waitFor(
    () => {
      expect(document.querySelector(`[data-drawing="${view}"]`)).not.toBeNull();
    },
    { timeout: 5_000 },
  );
  const probe = createRoot(document.createElement('div'));
  act(() => {
    probe.render(null);
  });
  act(() => {
    probe.unmount();
  });
}
/** The page with its window drawn. */
async function opened(locale: Locale = 'en'): Promise<ReturnType<typeof page>> {
  const rendered = page(locale);
  await drawn();
  return rendered;
}
/** The stars page's own view row (FR-PHONE-7): `[ Window ] Whole sky`; on compact the sheet's first row (FR-CLEAN-4). */
const viewRow = () => within(screen.getByTestId('stars-view-row'));
/** R163 (FR-CLEAN-4): `[ controls ]` opens the sheet; its body's children are the page's groups in order. */
const openSheet = (): HTMLElement => {
  fireEvent.click(screen.getByTestId('live-controls'));
  expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
  return screen.getByTestId('sheet-body');
};
const sheetRows = (body: HTMLElement): (string | null)[] => [...body.children].map((el) => el.getAttribute('data-testid'));

describe('<StarsPage> (FR-STAR-3)', () => {
  it('has its own visible h1, four h2 blocks in the rail, and the drawing named as a group on wide (FR-A11Y-1, FR-A11Y-2, FR-FLOW-3)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    const p = STARS_PAGE_CATALOGS.en;
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([en.starsHeading]);
    // R129 (FR-FLOW-3): under it at `--small`, the dark window and the cloud word — with no forecast, the cloud word says so.
    expect(screen.getByTestId('stars-intro')).toContainElement(screen.getByTestId('stars-tonight'));
    expect(screen.getByTestId('stars-tonight')).toHaveTextContent(en.weather.state.unknown);
    // R132 (FR-FLOW-4, D-846): the rail's view row and facing row are labelled by the layout (`View`, `Facing`), then the page's Layers and In this field.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([en.skyView.view, en.skyView.facing, p.layersHeading, p.fieldHeading]);
    // The readout is the layout's `readout` slot — in the box's corner on wide — placed there by the window itself.
    expect(screen.getByTestId('window-readout').closest('[data-slot]')).toHaveAttribute('data-slot', 'readout');
    expect(screen.getByRole('group', { name: p.drawing })).toContainElement(container.querySelector('[data-drawing="window"]') as HTMLElement);
    // The window is the hand's: the box takes the focus and the arrow keys, and the drawing itself is hidden from AT.
    expect(container.querySelector('[data-state="hand"] [tabindex="0"]')).not.toBeNull();
    expect(container.querySelector('svg[data-drawing="window"]')).toHaveAttribute('aria-hidden', 'true');
    // R163 (FR-CLEAN-10): wide has no sheet and no head over the sky.
    expect(screen.queryByTestId('live-controls')).toBeNull();
    expect(screen.queryByTestId('live-head')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens on the pole side at the default tilt, south of the equator and north of it, and focuses the box', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    const { unmount } = await opened();
    expect(stars()).toHaveAttribute('data-look-az', '180');
    expect(stars()).toHaveAttribute('data-look-alt', String(STARS_DEFAULT_TILT));
    expect(within(screen.getByRole('group', { name: STARS_PAGE_CATALOGS.en.facing })).getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('stars-sky')).toContainElement(document.activeElement as HTMLElement);
    unmount();
    appStore.setState({ observer: NORTH });
    await opened();
    expect(stars()).toHaveAttribute('data-look-az', '0');
  });

  it('turns the camera from the facing picker: a point at the current tilt, up to the zenith, and a point from there back down (FR-STAR-4)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
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

  /** R163 (FR-CLEAN-11, D-1004): four toggles, no `[ passes ]`, and the chart handed no pass. */
  it('toggles the four layers, all on at first, names included, with no passes toggle and no pass in the scene (FR-STAR-3 as amended v2.11, FR-CLEAN-11)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    const layers = screen.getByRole('group', { name: STARS_PAGE_CATALOGS.en.layersHeading });
    const toggles = within(layers).getAllByRole('button');
    expect(toggles.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['stars', 'true'],
      ['figures', 'true'],
      ['planets', 'true'],
      ['names', 'true'],
    ]);
    expect(container.querySelector('[data-layer="passes"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /passes|pases/ })).toBeNull();
    expect(container.querySelector('[data-pass-id]')).toBeNull();
    fireEvent.click(within(layers).getByRole('button', { name: 'figures' }));
    expect(within(layers).getByRole('button', { name: 'figures' })).toHaveAttribute('aria-pressed', 'false');
    // FR-CLEAN-4: one group of two rows, two toggles each — the row's room is 32 cells, and three would be 33 (D-865's split).
    expect(within(layers).getAllByTestId('stars-layers-row').map((row) => row.children.length)).toEqual([2, 2]);
    // FR-CLEAN-1 (D-919): the full form's three slots and nothing else; the hint over the box (a mouse's three clauses here).
    const slots = [...screen.getByTestId('stars-layout').querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot'));
    expect(slots).toEqual(['drawing', 'overlay', 'readout', 'sheet']);
    expect(screen.getByTestId('stars-layout').querySelector('[data-slot="overlay"]')).toContainElement(screen.getByTestId('sky-hint'));
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Drag or use the arrow keys · ctrl + wheel to zoom · click a star');
  });

  it('puts the hint away for good on the first drag, pinch or tap in the box, and renders no hint after it (FR-FLOW-6)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    expect(screen.getByTestId('sky-hint')).toBeInTheDocument();
    const box = screen.getByTestId('stars-sky').querySelector<HTMLElement>('[tabindex="0"]');
    fireEvent.pointerDown(box as HTMLElement, { pointerId: 1, button: 0, pointerType: 'touch', clientX: 10, clientY: 10 });
    expect(appStore.getState().skyHintSeen).toBe(true);
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    expect(screen.getByTestId('stars-layout').querySelector('[data-slot="hint"]')).toBeNull();
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

  it('focuses the drawing’s box on open (FR-A11Y-1..3)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    // R160: the box arrives with the window's chunk and takes the focus then.
    await waitFor(() => {
      expect(screen.getByTestId('stars-sky').querySelector('[tabindex="0"]')).toHaveFocus();
    });
  });

  it('is all Spanish in Spanish, the compass abbreviations and the star names aside (FR-STAR-10)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    await opened('es');
    const p = STARS_PAGE_CATALOGS.es;
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Vista', 'Hacia', p.layersHeading, p.fieldHeading]);
    expect(within(screen.getByRole('group', { name: p.facing })).getByRole('button', { name: 'arriba' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: p.layersHeading })).getAllByRole('button').map((b) => b.textContent)).toEqual(['estrellas', 'figuras', 'planetas', 'nombres']);
    // R160 (FR-PHONE-7) → R170 (FR-GLOBE-1): the view row's two words on wide.
    expect(viewRow().getAllByRole('button').map((b) => b.textContent)).toEqual(['Ventana', 'Globo']);
  });
});

/**
 * R163 (FR-CLEAN-1..4, FR-CLEAN-6; US-49 AC2..AC4; D-997, D-999, D-1009..D-1011): the compact page in the full form —
 * the inventory with the sheet closed, the head's line in its three forms, the sheet's order in both languages, the
 * facing row's picker, the corner readout and the sheet's readout taking turns, `Esc`'s two steps, the turn.
 */
describe('the stars page in the full form (FR-CLEAN-1..4, FR-CLEAN-6)', () => {
  /** What stands on the page and is not inside the closed sheet (`inert`). */
  const reachable = (container: HTMLElement, ids: readonly string[]): string[] =>
    ids.filter((id) => {
      const found = container.querySelector(`[data-testid="${id}"]`);
      return found !== null && found.closest('[inert]') === null;
    });
  const PARTS = ['stars-sky', 'live-head', 'stars-head-line', 'sky-corner-readout', 'live-bottom-row', 'live-controls', 'live-follow-control', 'sky-hint', 'stars-view-row', 'stars-follow', 'stars-facing', 'stars-layers', 'stars-field', 'stars-tonight'] as const;

  it('with the sheet closed renders exactly the box, the head with the door’s line, the corner readout with its second line, [ controls ] and the hint, the h1 hidden (FR-CLEAN-1..3)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    expect(screen.getByTestId('stars-layout')).toHaveAttribute('data-shape', 'full');
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    // No sensor here: no `[ follow ]` and no follow row; the finger has the sky, so the readout is in the corner.
    expect(reachable(container, PARTS).sort()).toEqual(['stars-sky', 'live-head', 'stars-head-line', 'sky-corner-readout', 'live-bottom-row', 'live-controls', 'sky-hint'].sort());
    // FR-CLEAN-2: the h1 stays in the document, visually hidden; the head carries `[ ← ]` and the door's line in one of
    // its forms (the bands land with the astronomy chunk; until then the cloud word alone; the zone is null here, so UTC).
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(en.starsHeading);
    expect(h1).toHaveAttribute('data-visually-hidden');
    expect(screen.queryByTestId('stars-tonight')).toBeNull();
    const head = screen.getByTestId('live-head');
    expect(within(head).getByTestId('live-back')).toHaveAccessibleName(en.header.backName);
    expect(within(head).getByTestId('stars-head-line').textContent).toMatch(/^(Dark \d\d:\d\d → \d\d:\d\d UTC|No full dark|Stars from \d\d:\d\d UTC|)$/);
    // FR-STAR-7 as amended: the corner readout asks the full form for two lines, and a named star is its second.
    const corner = screen.getByTestId('sky-corner-readout');
    expect(corner).toHaveAttribute('data-lines', '2');
    await waitFor(() => {
      expect(within(corner).getByTestId('window-readout')).toHaveTextContent(/^Facing /);
    });
    expect(screen.getByTestId('stars-layout').querySelector('[data-slot="overlay"]')).toContainElement(corner);
    // The sheet's rows are mounted, inert, so a turn keeps them (D-932); the layers and the list are in it.
    expect(screen.getByTestId('stars-view-row').closest('[inert]')).toBe(screen.getByTestId('live-sheet'));
    expect(screen.getByTestId('stars-field').closest('[inert]')).toBe(screen.getByTestId('live-sheet'));
    // The hint stands in the row above the button: a mouse's three clauses never fit beside it (D-924).
    expect(screen.getByTestId('sky-hint').parentElement).toHaveAttribute('data-beside', 'false');
  });

  /** R163 (FR-CLEAN-2; D-1009): the door's three forms, from the door's own words, in both languages. */
  it.each(['en', 'es'] as const)('words the head’s line in the door’s three forms in %s: the dark window with the cloud word, no full dark, and Stars from (FR-CLEAN-2)', (locale) => {
    const t = locale === 'en' ? en : es;
    const H = 3_600_000;
    // Noon UTC; a dark band from 20:25 to 07:05 UTC that night; the zone null, so the stamps say UTC and no cloud word (D-859).
    const noon = Date.UTC(2026, 10, 2, 12, 0);
    const dark: SkyBand = { from: Date.UTC(2026, 10, 2, 20, 25), to: Date.UTC(2026, 10, 3, 7, 5), sky: 'dark' };
    const bands: SkyBand[] = [
      { from: noon - 12 * H, to: dark.from, sky: 'day' },
      dark,
      { from: dark.to, to: dark.to + 12 * H, sky: 'day' },
    ];
    const zoned = { zone: 'UTC', cloud: { kind: 'steady', state: 'clear' } as const };
    expect(starsHeadLine(t, locale, { now: dark.from + H, bands, sunUp: false, ...zoned })).toBe(locale === 'en' ? 'Dark 20:25 → 07:05 · Clear' : 'Oscuro 20:25 → 07:05 · Despejado');
    // The Sun up and the stars still to come: the door's second line, "Stars from"; once the night is in, the window.
    expect(starsHeadLine(t, locale, { now: noon, bands, sunUp: true, ...zoned })).toBe(locale === 'en' ? 'Stars from 20:25' : 'Estrellas desde las 20:25');
    // No dark band tonight: the no-dark form; with no zone, no cloud word and the UTC stamp (the door's rule).
    const bright: SkyBand[] = [
      { from: noon - 12 * H, to: noon + 12 * H, sky: 'day' },
      { from: noon + 12 * H, to: noon + 24 * H, sky: 'bright-twilight' },
    ];
    expect(starsHeadLine(t, locale, { now: noon + 13 * H, bands: bright, sunUp: false, ...zoned })).toBe(locale === 'en' ? 'No full dark · Clear' : 'Sin oscuridad total · Despejado');
    expect(starsHeadLine(t, locale, { now: dark.from + H, bands, sunUp: false, zone: null, cloud: { kind: 'steady', state: 'clear' } })).toMatch(locale === 'en' ? /^Dark 20:25 → 07:05 UTC$/ : /^Oscuro 20:25 → 07:05 UTC$/);
    // D-1028: a night whose cloud changes once names its better part with that stretch of the dark; more than once, Variable.
    const clearing = { zone: 'UTC', cloud: { kind: 'change', before: 'obscured', after: 'clear', at: '02:00' } as const };
    expect(starsHeadLine(t, locale, { now: dark.from + H, bands, sunUp: false, ...clearing })).toBe(locale === 'en' ? 'Dark, clear 02:00 → 07:05' : 'Oscuro y despejado 02:00 → 07:05');
    const closing = { zone: 'UTC', cloud: { kind: 'change', before: 'clear', after: 'obscured', at: '01:00' } as const };
    expect(starsHeadLine(t, locale, { now: dark.from + H, bands, sunUp: false, ...closing })).toBe(locale === 'en' ? 'Dark, clear 20:25 → 01:00' : 'Oscuro y despejado 20:25 → 01:00');
    expect(starsHeadLine(t, locale, { now: dark.from + H, bands, sunUp: false, zone: 'UTC', cloud: { kind: 'variable' } })).toBe(locale === 'en' ? 'Dark 20:25 → 07:05 · Variable' : 'Oscuro 20:25 → 07:05 · Variable');
    // Before the bands are known: the cloud word alone, and with no zone (no forecast) nothing.
    expect(starsHeadLine(t, locale, { now: noon, bands: [], sunUp: false, ...zoned })).toBe(t.weather.state.clear);
    expect(starsHeadLine(t, locale, { now: noon, bands: [], sunUp: false, zone: null, cloud: { kind: 'steady', state: 'unknown' } })).toBe('');
  });

  it.each(['en', 'es'] as const)('holds the sheet’s rows in FR-CLEAN-4’s order in %s — the view row, the facing row, the layer rows, In this field open — the readout moving into the facing row and its tap opening the picker', async (locale) => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    await opened(locale);
    const p = STARS_PAGE_CATALOGS[locale];
    const t = locale === 'en' ? en : es;
    const body = openSheet();
    // No sensor: no follow row. Every row a group apart (FR-FLOW-10), the layer rows a row apart inside theirs.
    expect(sheetRows(body)).toEqual(['stars-view-row', 'stars-facing', 'stars-layer-rows', 'stars-field', 'app-footer']);
    for (const child of body.children) expect(child).toHaveAttribute('data-rhythm', 'group');
    for (const row of screen.getAllByTestId('stars-layers-row')) expect(row).toHaveAttribute('data-rhythm', 'row');
    expect(screen.getByTestId('sheet-place')).toHaveTextContent(SOUTH.label);
    expect(viewRow().getAllByRole('button').map((b) => b.textContent)).toEqual([t.chart.views.window, t.chart.views.wholeSky]);
    expect(within(screen.getByTestId('stars-field')).getByRole('heading', { level: 2 })).toHaveTextContent(p.fieldHeading);
    // The layers' heading is hidden on compact; the group carries its name.
    expect(screen.getByRole('group', { name: p.layersHeading })).toBeInTheDocument();
    // The readout left the corner for the facing row, and is the row's button's name.
    expect(screen.queryByTestId('sky-corner-readout')).toBeNull();
    const facing = screen.getByTestId('stars-facing');
    await waitFor(() => {
      expect(within(facing).getByTestId('window-readout')).toBeInTheDocument();
    });
    const toggle = within(facing).getByTestId('sky-readout-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: p.facing })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const picker = within(screen.getByTestId('stars-facing-picker')).getByRole('group', { name: p.facing });
    expect(within(picker).getAllByRole('button')).toHaveLength(9);
    // A pick turns the camera, closes the picker and keeps the sheet open (FR-CLEAN-6).
    fireEvent.click(within(picker).getByRole('button', { name: 'NE' }));
    expect(stars()).toHaveAttribute('data-look-az', '45');
    expect(screen.queryByTestId('stars-facing-picker')).toBeNull();
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    // Closed by the ×: the readout is the corner's again.
    fireEvent.click(screen.getByTestId('sheet-close'));
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    await waitFor(() => {
      expect(within(screen.getByTestId('sky-corner-readout')).getByTestId('window-readout')).toBeInTheDocument();
    });
  });

  /** R163 (FR-CLEAN-6; D-999, D-1011): the sheet first, then the page — the second press is the app's listener's. */
  it('takes Esc in two steps: the sheet closes and focus returns to [ controls ], then the key is left to the app to leave the page', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    const app = vi.fn();
    document.addEventListener('keydown', app);
    try {
      openSheet();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
      expect(document.activeElement).toBe(screen.getByTestId('live-controls'));
      expect(app).not.toHaveBeenCalled();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(app).toHaveBeenCalledTimes(1);
      expect((app.mock.calls[0]?.[0] as KeyboardEvent).defaultPrevented).toBe(false);
      // Another key with the sheet open is nobody's here.
      openSheet();
      fireEvent.keyDown(document, { key: 's' });
      expect(app).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    } finally {
      document.removeEventListener('keydown', app);
    }
  });

  it('keeps the sheet, its picker, the view and the camera through a turn of the phone (FR-CLEAN-6, FR-CLEAN-7)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    openSheet();
    fireEvent.click(screen.getByTestId('sky-readout-toggle'));
    fireEvent.click(within(screen.getByTestId('stars-facing-picker')).getByRole('button', { name: 'W' }));
    fireEvent.click(screen.getByTestId('sky-readout-toggle'));
    expect(screen.getByTestId('stars-facing-picker')).toBeInTheDocument();
    for (const size of [
      [844, 390],
      [390, 844],
    ] as const) {
      act(() => {
        media?.setSize(size[0], size[1]);
      });
      expect(screen.getByTestId('stars-layout')).toHaveAttribute('data-shape', 'full');
      expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('stars-facing-picker')).toBeInTheDocument();
      expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
      expect(stars()).toHaveAttribute('data-look-az', '270');
    }
  });
});

/**
 * R160 (FR-PHONE-7, FR-PHONE-8, FR-PHONE-9; US-46 AC1, AC3; D-968, D-970, D-971, D-990): the whole sky on the stars
 * page — the view row, the polar chart in the box with the page's layers, the names' default by width,
 * `In this field` as the whole sky's twelve brightest, the outline of the page's camera, the view never saved and the
 * window on every open, and the handoff landing on the page's own view. R163: on compact the view row is the sheet's
 * first row and the polar chart's convention line and toggle take the sheet's facing row (FR-CLEAN-4).
 */
describe('the whole sky on the stars page (FR-PHONE-7, FR-PHONE-9, FR-PHONE-10)', () => {
  const drawnStars = (): number => screen.getByTestId('stars-sky').querySelectorAll('[data-drawing="polar"] [data-star]').length;
  const polarMarks = async (): Promise<void> => {
    await waitFor(() => {
      expect(drawnStars()).toBeGreaterThan(0);
    });
  };

  it('reads [ Window ] Whole sky as the sheet’s first row, opens on the window, and Whole sky draws the polar chart with the page’s layers, its convention line and toggle in the facing row', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    const body = openSheet();
    expect(sheetRows(body)[0]).toBe('stars-view-row');
    expect(viewRow().getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Window', 'true'],
      ['Whole sky', 'false'],
    ]);
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
    fireEvent.click(viewRow().getByRole('button', { name: 'Whole sky' }));
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'polar');
    // A pick keeps the sheet open (FR-CLEAN-6).
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
    await drawn('polar');
    await polarMarks();
    const sky = screen.getByTestId('stars-sky');
    expect(sky.querySelector('[data-drawing="window"]')).toBeNull();
    // The page's layers: the figures on; the names off by default on compact (FR-PHONE-8), the toggle reading so.
    expect(sky.querySelector('[data-drawing="polar"] [data-figures] path')).not.toBeNull();
    expect(sky.querySelector('[data-drawing="polar"] [data-names] text')).toBeNull();
    expect(screen.getByRole('button', { name: 'names' })).toHaveAttribute('aria-pressed', 'false');
    // No pass on the whole sky either (FR-CLEAN-11).
    expect(sky.querySelector('[data-pass-id]')).toBeNull();
    // The polar chart's own readout and picker take the facing row (FR-CLEAN-4): the convention line, and the looking-up / map toggle under it on a tap.
    const facing = screen.getByTestId('stars-facing');
    await waitFor(() => {
      expect(within(facing).getByTestId('chart-convention')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sky-corner-readout')).toBeNull();
    fireEvent.click(within(facing).getByTestId('sky-readout-toggle'));
    await waitFor(() => {
      expect(within(screen.getByTestId('stars-facing-picker')).getByRole('group', { name: en.chart.orientationGroup })).toBeInTheDocument();
    });
    expect(screen.queryByRole('group', { name: STARS_PAGE_CATALOGS.en.facing })).toBeNull();
    // A layer off takes its marks off the whole sky too.
    fireEvent.click(screen.getByRole('button', { name: 'stars' }));
    expect(drawnStars()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'stars' }));
    // Back to the window: the camera where it was (the page's), nothing saved.
    fireEvent.click(viewRow().getByRole('button', { name: 'Window' }));
    await drawn('window');
    expect(container.querySelector('[data-look-az][data-fov]')).toHaveAttribute('data-look-az', '180');
    expect(JSON.stringify(window.localStorage)).not.toMatch(/polar|chartView/);
  });

  it('names the whole sky’s twelve brightest in In this field', async () => {
    // R170: on wide the second view is the globe; the whole sky is compact's.
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    const list = () => screen.getByRole('list', { name: STARS_PAGE_CATALOGS.en.fieldHeading });
    // jsdom lays nothing out: the window's box is unmeasured, so the window lists nothing — and the whole sky lists its twelve.
    expect(screen.queryByRole('list', { name: STARS_PAGE_CATALOGS.en.fieldHeading })).toBeNull();
    fireEvent.click(viewRow().getByRole('button', { name: 'Whole sky' }));
    await waitFor(() => {
      expect(within(list()).getAllByRole('button')).toHaveLength(12);
    });
    const mags = within(list())
      .getAllByRole('button')
      .map((b) => Number((/mag (−?\d+\.\d)/.exec(b.getAttribute('aria-label') ?? '')?.[1] ?? '99').replace('−', '-')));
    expect([...mags].sort((a, b) => a - b)).toEqual(mags);
    expect(within(list()).getAllByRole('button').map((b) => Number(/(-?\d+)° up/.exec(b.getAttribute('aria-label') ?? '')?.[1])).every((alt) => alt >= 0)).toBe(true);
    // Stars and planets only (FR-CLEAN-11): every row a button, none a pass.
    expect(within(list()).getAllByRole('listitem')).toHaveLength(12);
    expect(list().querySelector('[data-kind="pass"]')).toBeNull();
  });

  it('defaults the names on for the globe on wide, and the [x] names toggle drives both views once tapped (FR-PHONE-8, FR-GLOBE-10)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    const names = () => screen.getByRole('button', { name: 'names' });
    expect(names()).toHaveAttribute('aria-pressed', 'true');
    // R170 (FR-GLOBE-1): on wide the second value is the globe; the names are on for it by default.
    fireEvent.click(viewRow().getByRole('button', { name: 'Globe' }));
    await screen.findByTestId('globe-box', {}, { timeout: 5_000 });
    expect(names()).toHaveAttribute('aria-pressed', 'true');
    const globeNames = () => screen.getByTestId('stars-sky').querySelectorAll('[data-names] text[visibility="visible"]');
    await waitFor(() => {
      expect(globeNames().length).toBeGreaterThan(0);
    });
    fireEvent.click(names());
    expect(names()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      expect(globeNames()).toHaveLength(0);
    });
    // The choice holds for the window too.
    fireEvent.click(viewRow().getByRole('button', { name: 'Window' }));
    await drawn('window');
    expect(names()).toHaveAttribute('aria-pressed', 'false');
    // And on compact the whole sky's names start off, and a tap turns them on for both.
    act(() => {
      media?.setSize(390, 844);
    });
    fireEvent.click(viewRow().getByRole('button', { name: 'Whole sky' }));
    await drawn('polar');
    expect(names()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(names());
    expect(names()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(viewRow().getByRole('button', { name: 'Window' }));
    await drawn('window');
    expect(names()).toHaveAttribute('aria-pressed', 'true');
  });

  it('outlines the page’s camera on the whole sky, and a pinch back lands on the window at the aim at the widest field (FR-PHONE-9, FR-PHONE-10)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    fireEvent.click(viewRow().getByRole('button', { name: 'Whole sky' }));
    await drawn('polar');
    const outline = (): Element | null => container.querySelector('[data-field-outline]');
    await waitFor(() => {
      expect(outline()?.getAttribute('d')).toMatch(/^M/);
    });
    const south = outline()?.getAttribute('d');
    // The facing picker is the whole sky's too: a point moves the outline with the camera, with no render of the chart.
    const before = outline();
    fireEvent.keyDown(container, { key: 'ArrowRight' });
    expect(outline()).toBe(before);
    // The pinch in on the whole sky: two touches forty px apart, spread to a hundred, released — the window, facing the midpoint, at 90°.
    const svg = container.querySelector('[data-drawing="polar"]') as SVGSVGElement;
    svg.setPointerCapture = vi.fn();
    svg.releasePointerCapture = vi.fn();
    svg.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 250, height: 250, right: 250, bottom: 250, toJSON: () => ({}) }) as DOMRect;
    // The midpoint at the chart's centre is the zenith.
    fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 105, clientY: 125 });
    fireEvent.pointerDown(svg, { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 145, clientY: 125 });
    fireEvent.pointerMove(svg, { pointerId: 1, pointerType: 'touch', clientX: 75, clientY: 125 });
    fireEvent.pointerMove(svg, { pointerId: 2, pointerType: 'touch', clientX: 175, clientY: 125 });
    fireEvent.pointerUp(svg, { pointerId: 1, pointerType: 'touch', clientX: 75, clientY: 125 });
    fireEvent.pointerUp(svg, { pointerId: 2, pointerType: 'touch', clientX: 175, clientY: 125 });
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
    expect(viewRow().getByRole('button', { name: 'Window' })).toHaveAttribute('aria-pressed', 'true');
    // FR-CLEAN-6: the handoff keeps the sheet as it was — closed here.
    expect(screen.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
    await drawn('window');
    expect(stars()).toHaveAttribute('data-look-alt', '90');
    expect(container.querySelector('[data-look-az][data-fov]')).toHaveAttribute('data-fov', String(WINDOW_FOV_MAX_DEG));
    expect(south).toMatch(/^M/);
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
    // R163 (FR-CLEAN-11): every row is a star's or a planet's; no pass row.
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list.querySelector('[data-kind="pass"]')).toBeNull();
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
    cleanup();
  });
});

describe('the label hold (FR-STAR-7)', () => {
  it('is four seconds', () => {
    expect(STAR_LABEL_HOLD_S).toBe(4);
  });
});

/**
 * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-6; US-44 AC1, AC2, AC4; D-943..D-945): `[ follow the phone ]` on a phone, and
 * nothing without the sensor. Its tap asks inside the gesture and, granted, this page's own window takes the sensor;
 * off, the hand has it back. R163 (FR-GYRO-1 as amended, FR-CLEAN-3, FR-CLEAN-4): the toggle is the sheet's row after
 * the view row, and `[ follow ]` stands before `[ controls ]` in the bottom row, the two agreeing both ways.
 */
/** R157 (FR-PHONE-6): a Screen Wake Lock whose requests and releases the test can count. */
function stubWakeLock(): { request: ReturnType<typeof vi.fn>; released: () => number } {
  let released = 0;
  const request = vi.fn(() =>
    Promise.resolve({
      release: () => {
        released += 1;
        return Promise.resolve();
      },
      addEventListener: () => undefined,
    }),
  );
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return { request, released: () => released };
}

describe('[ follow the phone ] on the stars page (FR-GYRO-1, FR-GYRO-2, FR-GYRO-6)', () => {
  const withPhone = (requestPermission?: () => Promise<'granted' | 'denied'>): void => {
    vi.stubGlobal(
      'DeviceOrientationEvent',
      Object.assign(
        function DeviceOrientationEvent() {
          return undefined;
        },
        requestPermission ? { requestPermission } : {},
      ),
    );
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
  };
  const flush = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
    resetOrientationAccess();
    window.localStorage.clear();
  });
  const windowRoot = (container: HTMLElement): Element => container.querySelector('[data-look-az][data-fov]') as Element;
  const touch = (element: Element, pointerId = 1): void => {
    fireEvent.pointerDown(element, { pointerId, pointerType: 'touch' });
    fireEvent.pointerUp(element, { pointerId, pointerType: 'touch' });
  };

  /** R159 (FR-PHONE-1; US-45 AC1; D-962): where nothing has to be asked the page opens following; a drag hands the sky to the finger. */
  it('opens following where nothing is asked, and a drag ends it (FR-PHONE-1, FR-GYRO-4)', async () => {
    withPhone();
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    // D-986: from the first reading with a north.
    act(() => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 270, beta: 120, gamma: 0, absolute: true }));
    });
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'true');
    expect(windowRoot(container)).toHaveAttribute('data-follow', 'true');
    // FR-GYRO-5: nothing over the drawing — no readout in the corner, and no facing row in the sheet (D-957).
    expect(screen.queryByTestId('window-readout')).toBeNull();
    expect(screen.queryByTestId('sky-corner-readout')).toBeNull();
    expect(screen.queryByTestId('stars-facing')).toBeNull();
    const box = container.querySelector('[data-follow="true"] [tabindex="0"]') as HTMLElement;
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 140, clientY: 100 });
    expect(windowRoot(container)).not.toHaveAttribute('data-follow');
    expect(windowRoot(container)).toHaveAttribute('data-state', 'hand');
    expect(screen.getByTestId('stars-facing')).toBeInTheDocument();
  });

  /** R159 (FR-PHONE-2; US-45 AC2; D-963, D-986): a saved grant arms the page; the first touch on the sky asks, once. */
  it('with a saved grant asks nothing at load and once inside the first touch, then follows; a refusal clears the grant and shows the line', async () => {
    const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
    withPhone(requestPermission);
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    appStore.getState().setFollowGranted(true);
    const { container, unmount } = await opened();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    touch(screen.getByTestId('stars-sky'));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(windowRoot(container)).toHaveAttribute('data-follow', 'true');
    touch(screen.getByTestId('stars-sky'), 2);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    unmount();

    // Next visit, the grant withdrawn in the browser's settings: refused, the grant cleared, the finger keeps the sky.
    // R163 (D-987): with the sheet closed the line is the bottom row's, over the sky, and takes the hint's place.
    resetOrientationAccess();
    requestPermission.mockResolvedValue('denied');
    page();
    touch(screen.getByTestId('stars-sky'));
    await flush();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('live-follow-refused')).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('sky-hint')).toBeNull();
    expect(appStore.getState().followGranted).toBe(false);
    expect(window.localStorage.getItem('wiys:prefs:v1') ?? '').not.toContain('followGranted');
  });

  it('stands in the sheet as its own row after the view row on a phone, with [ follow ] in the bottom row, in both languages, and is absent without the sensor; no hold-up, no sky screen', () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { unmount } = page();
    expect(screen.queryByTestId('stars-follow')).toBeNull();
    expect(screen.queryByTestId('follow-toggle')).toBeNull();
    expect(screen.queryByTestId('live-follow-control')).toBeNull();
    expect(screen.queryByTestId('stars-hold-up')).toBeNull();
    expect([...screen.getByTestId('live-bottom-row').children].map((el) => el.getAttribute('data-testid'))).toEqual(['live-controls']);
    unmount();

    // An iPhone's first visit: off until asked (FR-PHONE-2).
    withPhone(() => Promise.resolve('granted'));
    const { unmount: unmountEn } = page();
    const body = openSheet();
    expect(sheetRows(body)).toEqual(['stars-view-row', 'stars-follow', 'stars-facing', 'stars-layer-rows', 'stars-field', 'app-footer']);
    const row = screen.getByTestId('stars-follow');
    expect(within(row).getByTestId('follow-toggle')).toHaveTextContent(en.window.followToggle);
    expect(within(row).getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(row).toHaveAttribute('data-rhythm', 'group');
    // FR-CLEAN-3: `[ follow ]` then `[ controls ]` on the bottom row.
    expect([...screen.getByTestId('live-bottom-row').children].map((el) => el.getAttribute('data-testid'))).toEqual(['live-follow-control', 'live-controls']);
    expect(screen.getByTestId('live-follow-control')).toHaveTextContent(en.sheet.follow);
    expect(screen.queryByTestId('stars-hold-up')).toBeNull();
    expect(screen.queryByTestId('window-hold-up')).toBeNull();
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    unmountEn();

    page('es');
    expect(screen.getByTestId('follow-toggle')).toHaveTextContent('seguir el teléfono');
    expect(screen.getByTestId('live-follow-control')).toHaveTextContent('seguir');
  });

  it('asks inside the tap and, granted, the page’s window follows the phone; off, the hand has it back; [ follow ] and the sheet’s toggle agree both ways (FR-GYRO-2, FR-PHONE-3)', async () => {
    const requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>().mockResolvedValue('granted');
    withPhone(requestPermission);
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = await opened();
    const w = (): Element => container.querySelector('[data-look-az][data-fov]') as Element;
    expect(w()).toHaveAttribute('data-state', 'hand');
    fireEvent.click(screen.getByTestId('follow-toggle'));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'true');
    expect(w()).toHaveAttribute('data-follow', 'true');
    // FR-GYRO-5: nothing over the drawing — the readout slot is empty while following.
    expect(screen.queryByTestId('window-readout')).toBeNull();
    fireEvent.click(screen.getByTestId('live-follow-control'));
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('live-follow-control')).toHaveAttribute('aria-pressed', 'false');
    expect(w()).not.toHaveAttribute('data-follow');
    expect(w()).toHaveAttribute('data-state', 'hand');
    expect(screen.getByTestId('window-readout')).toBeInTheDocument();
    // From the overlay's control the other way round.
    fireEvent.click(screen.getByTestId('live-follow-control'));
    await flush();
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(w()).toHaveAttribute('data-follow', 'true');
  });

  it('holds the screen awake while following and lets it go when following ends (FR-PHONE-6, D-967)', async () => {
    const lock = stubWakeLock();
    withPhone(() => Promise.resolve('granted'));
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    page();
    await flush();
    expect(lock.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('follow-toggle'));
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
    expect(lock.request).toHaveBeenCalledWith('screen');
    fireEvent.click(screen.getByTestId('follow-toggle'));
    await flush();
    expect(lock.released()).toBe(1);
    expect(lock.request).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(navigator, 'wakeLock');
  });
});
