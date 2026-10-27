/**
 * R130 (FR-FLOW-1, D-843): the home's three doors as drawn — the fixed order,
 * each one link over its whole box with its target, the Stars door's second
 * line held at its height until the `stars` chunk lands, and wide's one more
 * line each.
 */
import { act, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doorPass, local } from '../../../../tests/support/doorFixtures';
import { fixtureRecords } from '../../../../tests/support/catalogFixtures';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import { I18nProvider } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { appStore } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { HomeDoors } from './HomeDoors';

/** The chunk's idle prefetch, held so each test decides when (and whether) the chunk "lands". */
const chunk = vi.hoisted(() => ({ land: null as null | ((module: unknown) => void) }));
vi.mock('../starsChunk', () => ({
  prefetchStarsWhenIdle: (onLoad: (module: unknown) => void) => {
    chunk.land = onLoad;
    return () => undefined;
  },
  loadStarsChunk: () => new Promise(() => undefined),
}));

const STARS_MODULE = {
  brightestNow: () => ({ name: 'Canopus', dir: 'S' }),
  moonNow: () => ({ pct: 64, event: 'sets', at: local(12, 2, 10) }),
  starSource: () => ({ sceneAt: () => ({ stars: null, landmark: null }), names: { star: () => '' }, catalog: { con: [] } }),
};

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Cipolletti, Río Negro, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const tiangong = doorPass('tiangong', local(11, 5, 48), 'Tiangong');
const initial = appStore.getInitialState();
let media: MatchMediaStub;

const show = () =>
  render(
    <I18nProvider locale="en">
      <main>
        <HomeDoors observer={observer} selectedPassId={null} />
      </main>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(local(11, 5, 0));
  chunk.land = null;
  act(() => {
    appStore.setState({
      observer,
      elements: { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: local(11, 0), stale: false, persistent: true },
      passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [tiangong], hasDarkness: true },
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  media.restore();
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('HomeDoors (R130: FR-FLOW-1)', () => {
  it('draws the three doors in their fixed order, each one link with its target', async () => {
    media = stubMatchMedia(COMPACT_PX);
    const { container } = show();
    const nav = screen.getByRole('navigation', { name: en.doors.region });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('data-testid'))).toEqual(['door-satellites', 'door-stars', 'door-both']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([`#pass=${encodeURIComponent(tiangong.id)}`, '#stars', '#live']);
    // The whole box is the link: the title and every line are inside it.
    expect(links[0]).toHaveTextContent(/^SatellitesNext 05:48 · in 48:00Tiangong · NE 11° → ENE$/);
    expect(links[2]).toHaveTextContent(/^Both · live skyNothing up now · next 05:48$/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('holds the Stars door’s second line empty, at its height, until the chunk lands', () => {
    media = stubMatchMedia(COMPACT_PX);
    show();
    const lines = within(screen.getByTestId('door-stars')).getAllByTestId('door-stars-line');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveAttribute('data-pending');
    expect(lines[1]).toHaveTextContent('');
    expect(chunk.land).not.toBeNull();
    act(() => {
      chunk.land?.(STARS_MODULE);
    });
    const after = within(screen.getByTestId('door-stars')).getAllByTestId('door-stars-line');
    expect(after).toHaveLength(2);
    expect(after[1]).toHaveTextContent('Brightest now: Canopus, S');
    expect(after[1]).not.toHaveAttribute('data-pending');
  });

  it('on wide, one more line each: the Moon, and the Both door’s hint', () => {
    media = stubMatchMedia(WIDE_PX);
    show();
    act(() => {
      chunk.land?.(STARS_MODULE);
    });
    expect(within(screen.getByTestId('door-stars')).getAllByTestId('door-stars-line').map((line) => line.textContent)).toEqual([expect.any(String), 'Brightest now: Canopus, S', 'Moon 64 % · sets 02:10']);
    expect(within(screen.getByTestId('door-both')).getAllByTestId('door-both-line').at(-1)).toHaveTextContent('Stars under the arcs, drag to look');
    // No landmark for the pass in this sky: the Satellites door keeps its two lines.
    expect(within(screen.getByTestId('door-satellites')).getAllByTestId('door-satellites-line')).toHaveLength(2);
  });
});
