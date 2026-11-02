/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-10, FR-A11Y-1..2; US-39
 * AC1, AC2, AC4): the stars page as a component — its one `h1` and its
 * outline, the window under the hand camera, the facing picker turning the
 * camera, the layers, `In this field` naming a mark, the inert line without a
 * place, and both languages. The box's layout and the list against a measured
 * box are the e2e's (`tests/e2e/stars.spec.ts`): jsdom lays nothing out.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
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
import { WINDOW_FOV_MAX_DEG } from '../components/guide/skychart/window/projection';
import { resetOrientationAccess } from '../components/guide/skychart/window/orientationAccess';
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

/**
 * R160 (D-971): the window is `SkyChart`'s lazy view, drawn after the page's commit. `drawn` waits for a view's drawing
 * and flushes the commit's passive effects inside `act` with an empty probe root (`Live.test.tsx`'s `windowDrawn`, D-987),
 * so the hand camera's subscription is attached before a test moves it.
 */
async function drawn(view: 'window' | 'polar' = 'window'): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector(`[data-drawing="${view}"]`)).not.toBeNull();
  });
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
/** The stars page's own view row (FR-PHONE-7): `[ Window ] Whole sky`. */
const viewRow = () => within(screen.getByTestId('stars-view-row'));

describe('<StarsPage> (FR-STAR-3)', () => {
  it('has its own visible h1, three h2 blocks in the rail, and the drawing named as a group (FR-A11Y-1, FR-A11Y-2, FR-FLOW-3)', async () => {
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

  it('toggles the four layers, all on at first, names included, and [ passes ] off (FR-STAR-3 as amended v2.4.1, FR-SKY-6)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
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
    // R132 (FR-FLOW-8): one group of two rows — three toggles, then names and `[ passes ]`.
    expect(within(layers).getAllByTestId('stars-layers-row').map((row) => row.children.length)).toEqual([3, 2]);
    // FR-FLOW-4's order: the view row after the h1 block (R160, FR-PHONE-7), the action right after the hint, the layers after it, then `In this field`.
    const slots = [...screen.getByTestId('stars-layout').querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot'));
    expect(slots).toEqual(['answer', 'viewRow', 'readout', 'drawing', 'picker', 'hint', 'layers', 'list']);
    expect(screen.getByTestId('sky-hint')).toHaveTextContent('Drag or use the arrow keys · ctrl + wheel to zoom · click a star');
  });

  it('puts the hint away for good on the first drag, pinch or tap in the box, and renders no hint slot after it (FR-FLOW-6)', async () => {
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

  /*
   * R126 (FR-SKY-6, D-794; US-40 AC5): `[ passes ]` brings the store's run for this place onto the sky — the arc in
   * the page's window with its key — and is page state: off on every open, never in the saved prefs.
   */
  it('brings tonight’s passes onto the sky with [ passes ], off on every open and never saved (FR-SKY-6)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const golden = goldenPassFixture();
    vi.setSystemTime(golden.start.t + 10_000);
    appStore.setState({ observer: SOUTH, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: SOUTH, passes: [golden], hasDarkness: true } });
    const { unmount } = await opened();
    const sky = screen.getByTestId('stars-sky');
    expect(sky.querySelector('[data-pass-id]')).toBeNull();
    const toggle = screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.passesLayer });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(sky.querySelector(`[data-pass-id="${golden.id}"]`)).not.toBeNull();
    expect(sky.querySelector('[data-key="A"]')).not.toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toMatch(/passes/i);
    unmount();
    await opened();
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
    expect(within(screen.getByRole('group', { name: p.layersHeading })).getAllByRole('button').map((b) => b.textContent)).toEqual(['estrellas', 'figuras', 'planetas', 'nombres', 'pases']);
    // R160 (FR-PHONE-7): the view row's two words.
    expect(viewRow().getAllByRole('button').map((b) => b.textContent)).toEqual(['Ventana', 'Cielo entero']);
  });
});

/**
 * R160 (FR-PHONE-7, FR-PHONE-8, FR-PHONE-9; US-46 AC1, AC3; D-968, D-970, D-971, D-990): the whole sky on the stars
 * page — the view row, the polar chart in the box with the page's layers and the passes, the names' default by width,
 * `In this field` as the whole sky's twelve brightest, the outline of the page's camera, the view never saved and the
 * window on every open, and the handoff landing on the page's own view.
 */
describe('the whole sky on the stars page (FR-PHONE-7, FR-PHONE-9, FR-PHONE-10)', () => {
  const drawnStars = (): number => screen.getByTestId('stars-sky').querySelectorAll('[data-drawing="polar"] [data-star]').length;
  const polarMarks = async (): Promise<void> => {
    await waitFor(() => {
      expect(drawnStars()).toBeGreaterThan(0);
    });
  };

  it('reads [ Window ] Whole sky between the h1 block and the readout, opens on the window, and Whole sky draws the polar chart with the page’s layers and the passes', async () => {
    media = stubMatchMedia(COMPACT_PX);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const golden = goldenPassFixture();
    vi.setSystemTime(golden.start.t + 10_000);
    appStore.setState({ observer: SOUTH, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: SOUTH, passes: [golden], hasDarkness: true } });
    const { container } = await opened();
    expect(viewRow().getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Window', 'true'],
      ['Whole sky', 'false'],
    ]);
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
    fireEvent.click(viewRow().getByRole('button', { name: 'Whole sky' }));
    expect(screen.getByTestId('sky-chart')).toHaveAttribute('data-view', 'polar');
    await drawn('polar');
    await polarMarks();
    const sky = screen.getByTestId('stars-sky');
    expect(sky.querySelector('[data-drawing="window"]')).toBeNull();
    // The page's layers: the figures on; the names off by default on compact (FR-PHONE-8), the toggle reading so.
    expect(sky.querySelector('[data-drawing="polar"] [data-figures] path')).not.toBeNull();
    expect(sky.querySelector('[data-drawing="polar"] [data-names] text')).toBeNull();
    expect(screen.getByRole('button', { name: 'names' })).toHaveAttribute('aria-pressed', 'false');
    // `[ passes ]` on: the arc with its key on the whole sky, and the pass first in `In this field`.
    fireEvent.click(screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.passesLayer }));
    expect(sky.querySelector(`[data-drawing="polar"] [data-pass-id="${golden.id}"]`)).not.toBeNull();
    expect(sky.querySelector('[data-drawing="polar"] [data-key="A"]')).not.toBeNull();
    // The polar chart's own readout and picker take the slots (FR-FLOW-4): the convention line and the looking-up / map toggle.
    expect(screen.getByTestId('chart-convention').closest('[data-slot]')).toHaveAttribute('data-slot', 'readout');
    expect(screen.getByRole('group', { name: en.chart.orientationGroup }).closest('[data-slot]')).toHaveAttribute('data-slot', 'picker');
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

  it('names the whole sky’s twelve brightest in In this field, with the passes in it first', async () => {
    media = stubMatchMedia(WIDE_PX);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const golden = goldenPassFixture();
    vi.setSystemTime(golden.start.t + 10_000);
    appStore.setState({ observer: SOUTH, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer: SOUTH, passes: [golden], hasDarkness: true } });
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
    fireEvent.click(screen.getByRole('button', { name: STARS_PAGE_CATALOGS.en.passesLayer }));
    await waitFor(() => {
      expect(list().querySelector('[data-kind="pass"]')).not.toBeNull();
    });
    expect(within(list()).getAllByRole('listitem')).toHaveLength(12);
    expect(within(list()).getAllByRole('listitem')[0]?.querySelector('[data-kind="pass"]')).not.toBeNull();
  });

  it('defaults the names on for the whole sky on wide, and the [x] names toggle drives both views once tapped (FR-PHONE-8)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    await opened();
    const names = () => screen.getByRole('button', { name: 'names' });
    expect(names()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(viewRow().getByRole('button', { name: 'Whole sky' }));
    await drawn('polar');
    await polarMarks();
    expect(names()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('stars-sky').querySelector('[data-drawing="polar"] [data-names] text')).not.toBeNull();
    fireEvent.click(names());
    expect(names()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('stars-sky').querySelector('[data-drawing="polar"] [data-names] text')).toBeNull();
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

/**
 * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-6; US-44 AC1, AC2, AC4; D-943..D-945): `[ follow the phone ]` in the action
 * slot where `[ hold up to the sky ]` stood (FR-STAR-5 withdrawn), on a phone; nothing without the sensor. Its tap
 * asks inside the gesture and, granted, this page's own window takes the sensor; off, the hand has it back. The sky
 * screen's stars inventory (R117) is gone with the screen.
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
    expect(windowRoot(container)).toHaveAttribute('data-follow', 'true');
    expect(screen.queryByTestId('window-readout')).toBeNull();
    const box = container.querySelector('[data-follow="true"] [tabindex="0"]') as HTMLElement;
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(box, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 140, clientY: 100 });
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerUp(box, { pointerId: 1, clientX: 140, clientY: 100 });
    expect(windowRoot(container)).not.toHaveAttribute('data-follow');
    expect(windowRoot(container)).toHaveAttribute('data-state', 'hand');
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
    resetOrientationAccess();
    requestPermission.mockResolvedValue('denied');
    page();
    touch(screen.getByTestId('stars-sky'));
    await flush();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('follow-refused')).toHaveAttribute('role', 'status');
    expect(appStore.getState().followGranted).toBe(false);
    expect(window.localStorage.getItem('wiys:prefs:v1') ?? '').not.toContain('followGranted');
  });

  it('stands in the action slot after the hint on a phone, in both languages, and is absent without the sensor; no hold-up, no sky screen', () => {
    media = stubMatchMedia(COMPACT_PX);
    appStore.setState({ observer: SOUTH });
    const { unmount } = page();
    expect(screen.getByTestId('stars-layout').querySelector('[data-slot="action"]')).toBeNull();
    expect(screen.queryByTestId('follow-toggle')).toBeNull();
    expect(screen.queryByTestId('stars-hold-up')).toBeNull();
    unmount();

    // An iPhone's first visit: off until asked (FR-PHONE-2).
    withPhone(() => Promise.resolve('granted'));
    const { unmount: unmountEn } = page();
    const slots = [...screen.getByTestId('stars-layout').querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot'));
    expect(slots.slice(slots.indexOf('hint'), slots.indexOf('hint') + 3)).toEqual(['hint', 'action', 'layers']);
    const action = screen.getByTestId('stars-layout').querySelector('[data-slot="action"]') as HTMLElement;
    expect(within(action).getByTestId('follow-toggle')).toHaveTextContent(en.window.followToggle);
    expect(within(action).getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('stars-hold-up')).toBeNull();
    expect(screen.queryByTestId('window-hold-up')).toBeNull();
    expect(screen.queryByTestId('sky-screen')).toBeNull();
    unmountEn();

    page('es');
    expect(screen.getByTestId('follow-toggle')).toHaveTextContent('seguir el teléfono');
  });

  it('asks inside the tap and, granted, the page’s window follows the phone; off, the hand has it back (FR-GYRO-2)', async () => {
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
    expect(w()).toHaveAttribute('data-follow', 'true');
    // FR-GYRO-5: nothing over the drawing — the readout slot is empty while following.
    expect(screen.queryByTestId('window-readout')).toBeNull();
    fireEvent.click(screen.getByTestId('follow-toggle'));
    expect(screen.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(w()).not.toHaveAttribute('data-follow');
    expect(w()).toHaveAttribute('data-state', 'hand');
    expect(screen.getByTestId('window-readout')).toBeInTheDocument();
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
