/**
 * R170 (FR-GLOBE-1, FR-GLOBE-7..10, FR-GLOBE-12, FR-GLOBE-16; US-50; D-1035, D-1039, D-1040, D-1042): the wide stars
 * page's globe as a component — the view row in both languages, the breakpoint crossing, `v`, the rail's groups, the
 * second playback, the places and the faint toggle. `Stars.test.tsx` holds the page's other cases; these are apart so
 * the deep chunk's mock stays with them.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { loadDeepChunk } from '../../data/stars/deepChunk';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { STARS_PAGE_CATALOGS } from '../../i18n/starsPageT';
import { I18nProvider } from '../../i18n/useT';
import type { Favourite, Locale, Observer } from '../../model';
import { appStore, favouriteCellKey } from '../../state';
import { StarsPage } from './Stars';

vi.mock('../../data/stars/deepChunk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/stars/deepChunk')>();
  return { ...actual, loadDeepChunk: vi.fn(actual.loadDeepChunk) };
});

const BUENOS_AIRES: Observer = { lat: -34.6, lon: -58.38, altM: 0, label: 'Buenos Aires', source: 'coords', timeZone: 'America/Argentina/Buenos_Aires' };
const LONDON: Observer = { lat: 51.51, lon: -0.13, altM: 0, label: 'London', source: 'coords', timeZone: 'Europe/London' };
const TOKYO: Observer = { lat: 35.68, lon: 139.69, altM: 0, label: 'Tokyo', source: 'coords', timeZone: 'Asia/Tokyo' };
const HOUR_MS = 3_600_000;
const initial = appStore.getInitialState();
let media: MatchMediaStub | null = null;

afterEach(() => {
  cleanup();
  media?.restore();
  media = null;
  appStore.setState(initial, true);
});

const saved = (observer: Observer, lastUsedAt: number): Favourite => ({ cellKey: favouriteCellKey(observer), observer, addedAt: 0, lastUsedAt });

/** A view's drawing is in, and the commit's passive effects are flushed (`Stars.test.tsx`'s `drawn`). */
async function drawn(view: 'window' | 'polar' = 'window'): Promise<void> {
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

/** The page on its window; on wide it opens on the globe (FR-GLOBE-1 as amended, V212-11), so `Window` is pressed first. */
async function opened(locale: Locale = 'en') {
  const rendered = render(
    <I18nProvider locale={locale}>
      <StarsPage />
    </I18nProvider>,
  );
  if (screen.getByTestId('stars-sky').getAttribute('data-view') === 'globe') {
    fireEvent.click(within(screen.getByTestId('stars-view-row')).getByRole('button', { name: locale === 'es' ? 'Ventana' : 'Window' }));
  }
  await drawn();
  return rendered;
}

const viewRow = () => within(screen.getByTestId('stars-view-row'));
const globe = (): Promise<HTMLElement> => screen.findByTestId('globe-box', {}, { timeout: 5_000 });
const showGlobe = (name = 'Globe'): Promise<HTMLElement> => {
  fireEvent.click(viewRow().getByRole('button', { name }));
  return globe();
};
// R187 (FR-WIDE-4): the globe's instant is the time control's `t`, the overview slider's value.
const clockAt = (): number => Number(screen.getByTestId('stripe-overview').getAttribute('aria-valuenow'));
const timeState = (): string | null => screen.getByTestId('time-control').getAttribute('data-state');
const readoutClock = (): string => screen.getByTestId('time-readout').textContent ?? '';
const skyLabel = (): string => screen.getByTestId('stars-sky').getAttribute('aria-label') ?? '';

describe('the globe on the wide stars page (FR-GLOBE-1, FR-GLOBE-7..10, FR-GLOBE-12)', () => {
  it('opens on the globe on a desk and on the window on a phone, unsaved (FR-GLOBE-1 as amended, V212-11, D-1054)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    const before = appStore.getState().chartView;
    render(
      <I18nProvider locale="en">
        <StarsPage />
      </I18nProvider>,
    );
    await globe();
    expect(screen.getByTestId('stars-sky')).toHaveAttribute('data-view', 'globe');
    expect(viewRow().getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Globe', 'true'],
      ['Window', 'false'],
      ['Dome', 'false'],
    ]);
    expect(appStore.getState().chartView).toBe(before);
    cleanup();
    media?.setSize(390, 844);
    render(
      <I18nProvider locale="en">
        <StarsPage />
      </I18nProvider>,
    );
    await drawn('window');
    expect(screen.queryByTestId('globe-box')).toBeNull();
  });

  it('FR-WIDE-2: reads [ Globe ] Window Dome, draws the globe in the box with its rail, and keeps the choice across the breakpoint (FR-GLOBE-1)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    const { container } = await opened();
    expect(viewRow().getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Globe', 'false'],
      ['Window', 'true'],
      ['Dome', 'false'],
    ]);
    await showGlobe();
    expect(container.querySelector('[data-drawing]')).toBeNull();
    expect(screen.getByTestId('stars-sky')).toHaveAttribute('data-view', 'globe');
    // The rail: the view row, Time, Turn, Place, the layers and Up from <place>; no facing picker.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([en.skyView.view, en.skyView.time, en.globe.turnHeading, en.globe.placeHeading, STARS_PAGE_CATALOGS.en.layersHeading, en.globe.upFrom('Buenos Aires')]);
    expect(screen.queryByRole('group', { name: STARS_PAGE_CATALOGS.en.facing })).toBeNull();
    expect(within(screen.getByTestId('stars-layers')).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['stars', 'true'],
      ['figures', 'true'],
      ['planets', 'true'],
      ['names', 'true'],
      ['faint', 'false'],
    ]);
    // FR-GLOBE-12: the drawing's group names the place, the instant and the turn.
    expect(skyLabel()).toMatch(/^Celestial globe over Buenos Aires at \d\d:\d\d GMT[−-]3, turning with you$/);
    // The breakpoint: the polar chart on compact, the globe again on wide (one choice at two widths).
    act(() => {
      media?.setSize(390, 844);
    });
    await drawn('polar');
    expect(screen.queryByTestId('globe-box')).toBeNull();
    act(() => {
      media?.setSize(1280, 800);
    });
    await globe();
    expect(container.querySelector('[data-drawing]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  // R186 (FR-WIDE-2, D-1095; amends FR-GLOBE-1): the row has three values and the stars page saves the choice.
  it('FR-WIDE-2: cycles Globe Window Dome with v and saves each choice (FR-DESK-4)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    await opened();
    expect(appStore.getState().chartView).toBe('window');
    fireEvent.keyDown(document.body, { key: 'v' });
    await waitFor(() => {
      expect(screen.getByTestId('stars-sky')).toHaveAttribute('data-view', 'dome');
    });
    expect(appStore.getState().chartView).toBe('dome');
    fireEvent.keyDown(document.body, { key: 'v' });
    await globe();
    expect(appStore.getState().chartView).toBe('globe');
  });

  it('is all Spanish in Spanish: the view, the groups, the turn, the faint toggle, now and the label (FR-GLOBE-16)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    await opened('es');
    expect(viewRow().getAllByRole('button').map((b) => b.textContent)).toEqual(['Globo', 'Ventana', 'Domo']);
    await showGlobe('Globo');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([es.skyView.view, es.skyView.time, es.globe.turnHeading, es.globe.placeHeading, STARS_PAGE_CATALOGS.es.layersHeading, es.globe.upFrom('Buenos Aires')]);
    expect(within(screen.getByTestId('globe-turn')).getAllByRole('button').map((b) => b.textContent)).toEqual([es.globe.turn.you, es.globe.turn.stars]);
    expect(screen.getByRole('button', { name: es.globe.faint })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: es.globe.stepNames.hourAhead }));
    expect(screen.getByTestId('time-now')).toHaveTextContent(es.skyView.now);
    const time = /\d\d:\d\d GMT[−-]3/.exec(skyLabel())?.[0] ?? '';
    expect(skyLabel()).toBe(es.globe.label({ place: 'Buenos Aires', time, turn: 'you' }));
  });

  it('moves the globe’s clock by the steps and nothing else, the instant kept across a visit to the window (FR-GLOBE-7)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    await opened();
    await showGlobe();
    const hash = window.location.hash;
    const stored = JSON.stringify(window.localStorage);
    const at = clockAt();
    expect(timeState()).toBe('watching');
    fireEvent.click(screen.getByRole('button', { name: en.globe.stepNames.dayAhead }));
    expect(clockAt() - at).toBe(24 * HOUR_MS);
    expect(timeState()).toBe('scrubbing');
    fireEvent.click(screen.getByRole('button', { name: en.globe.stepNames.hourBack }));
    expect(clockAt() - at).toBe(23 * HOUR_MS);
    // The window keeps real time; back on the globe, its instant is where it was left.
    fireEvent.click(viewRow().getByRole('button', { name: 'Window' }));
    await drawn('window');
    await showGlobe();
    expect(clockAt() - at).toBe(23 * HOUR_MS);
    expect(window.location.hash).toBe(hash);
    expect(JSON.stringify(window.localStorage)).toBe(stored);
    // `[ now ]`: real time again, stopped.
    fireEvent.click(screen.getByTestId('time-now'));
    expect(timeState()).toBe('watching');
  });

  it('FR-WIDE-4: the steps stand under the playback row; a day step past the span moves the span to that night, [ now ] brings it back', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    await opened();
    await showGlobe();
    const overview = (): HTMLElement => screen.getByTestId('stripe-overview');
    const start = Number(overview().getAttribute('aria-valuemin'));
    const at = clockAt();
    fireEvent.click(screen.getByRole('button', { name: en.globe.stepNames.dayAhead }));
    fireEvent.click(screen.getByRole('button', { name: en.globe.stepNames.dayAhead }));
    expect(clockAt() - at).toBe(48 * HOUR_MS);
    const moved = Number(overview().getAttribute('aria-valuemin'));
    expect(moved).toBeGreaterThan(start + 24 * HOUR_MS);
    expect(Number(overview().getAttribute('aria-valuemax')) - moved).toBe(24 * HOUR_MS);
    expect(clockAt()).toBeGreaterThanOrEqual(moved);
    // The control's rows, in order: the time row with the playback row, the overview, the stripe, then the steps.
    const block = screen.getByTestId('stripe-block');
    expect([...block.children].map((el) => el.getAttribute('data-testid'))).toEqual(['time-row', 'overview-row', 'time-stripe', 'globe-steps', 'time-now-row']);
    fireEvent.click(screen.getByTestId('time-now'));
    expect(timeState()).toBe('watching');
    expect(Number(overview().getAttribute('aria-valuemin'))).toBe(start);
  });

  it('FR-WIDE-4: plays at the playback row\'s speeds, and pauses (FR-GLOBE-7)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    await opened();
    await showGlobe();
    fireEvent.click(screen.getByRole('button', { name: en.globe.stepNames.hourAhead }));
    const speeds = within(screen.getByRole('group', { name: en.live.speedGroup }));
    expect(speeds.getAllByRole('button').map((b) => b.textContent)).toEqual(['1×', '60×', '600×', '3600×']);
    const fast = speeds.getByRole('button', { name: '3600×' });
    fireEvent.click(fast);
    expect(fast).toHaveAttribute('aria-pressed', 'true');
    const play = screen.getByTestId('live-play');
    fireEvent.click(play);
    expect(play).toHaveAttribute('data-playing', 'true');
    fireEvent.click(play);
    expect(play).toHaveAttribute('data-playing', 'false');
  });

  it('lists the observer then the saved places; a press moves the clock’s zone and the list and leaves the store alone (FR-GLOBE-8, FR-GLOBE-9)', async () => {
    media = stubMatchMedia(WIDE_PX);
    const favourites = [saved(TOKYO, 10), saved(LONDON, 20), saved(BUENOS_AIRES, 30)];
    appStore.setState({ observer: BUENOS_AIRES, favourites });
    await opened();
    await showGlobe();
    const places = within(screen.getByTestId('globe-place'));
    // The observer first, then by most recent use; the observer's own entry is not listed twice.
    expect(places.getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Buenos Aires', 'true'],
      ['London', 'false'],
      ['Tokyo', 'false'],
    ]);
    // R187 (FR-WIDE-4, FR-GLOBE-8): the readout, while the instant is held, is in the shown place's zone — three hours on in London.
    fireEvent.click(screen.getByRole('button', { name: en.globe.stepNames.hourAhead }));
    const at = clockAt();
    const inBuenosAires = readoutClock();
    fireEvent.click(places.getByRole('button', { name: 'London' }));
    expect(places.getByRole('button', { name: 'London' })).toHaveAttribute('aria-pressed', 'true');
    expect(readoutClock()).not.toBe(inBuenosAires);
    expect(clockAt()).toBe(at);
    expect(screen.getByRole('heading', { level: 2, name: en.globe.upFrom('London') })).toBeInTheDocument();
    expect(skyLabel()).toMatch(/over London/);
    // The app's place and the saved places' order are untouched.
    expect(appStore.getState().observer).toBe(BUENOS_AIRES);
    expect(appStore.getState().favourites).toEqual(favourites);
    // The chosen place removed meanwhile: back to the observer.
    act(() => {
      appStore.setState({ favourites: [saved(TOKYO, 10)] });
    });
    expect(places.getByRole('button', { name: 'Buenos Aires' })).toHaveAttribute('aria-pressed', 'true');
    expect(readoutClock()).toBe(inBuenosAires);
  });

  it('holds [ ] faint off on every visit; on, it asks the deep chunk; a failed load unpresses it (FR-GLOBE-10)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: BUENOS_AIRES });
    vi.mocked(loadDeepChunk).mockClear();
    vi.mocked(loadDeepChunk).mockRejectedValueOnce(new Error('offline'));
    await opened();
    await showGlobe();
    const faint = () => screen.getByRole('button', { name: en.globe.faint });
    expect(faint()).toHaveAttribute('aria-pressed', 'false');
    expect(loadDeepChunk).not.toHaveBeenCalled();
    fireEvent.click(faint());
    expect(faint()).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(faint()).toHaveAttribute('aria-pressed', 'false');
    });
    expect(loadDeepChunk).toHaveBeenCalled();
  });
});
