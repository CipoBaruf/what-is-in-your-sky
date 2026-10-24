/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-10, FR-A11Y-1..2; US-39
 * AC1, AC2, AC4): the stars page as a component — its one `h1` and its
 * outline, the window under the hand camera, the facing picker turning the
 * camera, the layers, `In this field` naming a mark, the inert line without a
 * place, and both languages. The box's layout and the list against a measured
 * box are the e2e's (`tests/e2e/stars.spec.ts`): jsdom lays nothing out.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { en } from '../../i18n/en';
import { STARS_PAGE_CATALOGS } from '../../i18n/starsPageT';
import { I18nProvider } from '../../i18n/useT';
import type { Locale, Observer } from '../../model';
import { appStore } from '../../state';
import { STARS_DEFAULT_TILT } from '../components/guide/skychart/window/camera';
import { FieldList } from './stars/FieldList';
import { STAR_LABEL_HOLD_S } from './stars/field';
import { StarsPage } from './Stars';

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
  it('has its own h1, three h2 blocks in the rail, and the drawing named as a group (FR-A11Y-1, FR-A11Y-2)', async () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    const { container } = page();
    const p = STARS_PAGE_CATALOGS.en;
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([en.stars.heading]);
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

  it('turns the camera from the facing picker: a point at the current tilt, and up to the zenith (FR-STAR-4)', () => {
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
    // A point from the zenith keeps the tilt, so `up` stays pressed; the arrow keys on the box are the window's, through the same camera.
    fireEvent.click(within(picker).getByRole('button', { name: 'W' }));
    expect(stars()).toHaveAttribute('data-look-az', '270');
    const box = screen.getByTestId('stars-sky').querySelector<HTMLElement>('[tabindex="0"]');
    fireEvent.keyDown(box as HTMLElement, { key: 'ArrowDown' });
    expect(stars()).toHaveAttribute('data-look-alt', '85');
    fireEvent.keyDown(box as HTMLElement, { key: 'ArrowRight' });
    expect(stars()).toHaveAttribute('data-look-az', '285');
    expect(within(picker).getAllByRole('button').some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
  });

  it('toggles the four layers, all on at first, names included (FR-STAR-3 as amended v2.4.1)', () => {
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
    ]);
    fireEvent.click(within(layers).getByRole('button', { name: 'figures' }));
    expect(within(layers).getByRole('button', { name: 'figures' })).toHaveAttribute('aria-pressed', 'false');
    // Two rows of two on every width (D-776).
    expect(within(layers).getAllByTestId('stars-layers-row').map((row) => row.children.length)).toEqual([2, 2]);
  });

  it('is the inert line with [ set a place ] when there is no observer (FR-LIVE-1)', () => {
    media = stubMatchMedia(COMPACT_PX);
    page();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.stars.heading);
    expect(screen.getByTestId('stars-inert')).toHaveTextContent(STARS_PAGE_CATALOGS.en.noPlace);
    expect(screen.getByTestId('stars-set-place')).toHaveTextContent(STARS_PAGE_CATALOGS.en.setPlace);
    expect(screen.queryByTestId('stars-sky')).toBeNull();
  });

  it('is all Spanish in Spanish, the compass abbreviations and the star names aside (FR-STAR-10)', () => {
    media = stubMatchMedia(WIDE_PX);
    appStore.setState({ observer: SOUTH });
    page('es');
    const p = STARS_PAGE_CATALOGS.es;
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([p.facing, p.layersHeading, p.fieldHeading]);
    expect(within(screen.getByRole('group', { name: p.facing })).getByRole('button', { name: 'arriba' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: p.layersHeading })).getAllByRole('button').map((b) => b.textContent)).toEqual(['estrellas', 'figuras', 'planetas', 'nombres']);
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
