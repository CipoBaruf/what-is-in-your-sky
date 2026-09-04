/**
 * R31 (US-12, FR-SHARE-1, FR-SHARE-3): what a recipient's device does with a
 * link. The observer comes out of the hash (that part is `startApp`'s, tested
 * in `state`), and the screen resolves the pass against its own recompute:
 * the same pass, the nearest pass of that object with a message, or no pass
 * with a message. A hash that means nothing leaves the app on the home screen.
 */
import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import { I18nProvider } from '../i18n/useT';
import { passLinkHash } from '../lib/shareLinks';
import { formatClock, formatDate } from '../lib/timeFormat';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { App } from './App';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 270, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const shared = { lat: observer.lat, lon: observer.lon, altM: observer.altM };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
/** Another object's pass, so "no pass of that satellite" is not "no passes at all". */
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };

const landOn = (hash: string, passes: (typeof pass)[]): void => {
  window.location.hash = hash;
  act(() => {
    appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes, hasDarkness: true } });
  });
};

const at = (t: number): string => `${formatDate(t, null, 'en')} ${formatClock(t, null, 'en')}`;

describe('landing on a shared pass link', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('opens the same pass when the recompute agrees, with nothing to explain', async () => {
    landOn(passLinkHash({ observer: shared, noradId: pass.noradId, startT: pass.start.t + 30_000 }), [other, pass]);
    const { container } = render(<App />);
    expect(screen.getByRole('dialog', { name: pass.name })).toBeInTheDocument();
    expect(screen.queryByTestId('share-fallback')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('falls back to the nearest pass of that satellite and says so (FR-SHARE-3)', async () => {
    const asked = pass.start.t - 6 * 3_600_000;
    landOn(passLinkHash({ observer: shared, noradId: pass.noradId, startT: asked }), [other, pass]);
    const { container } = render(<App />);
    expect(screen.getByRole('dialog', { name: pass.name })).toBeInTheDocument();
    const notice = screen.getByTestId('share-fallback');
    expect(notice).toHaveTextContent(pass.name);
    expect(notice).toHaveTextContent(at(asked));
    expect(notice).toHaveTextContent('is the nearest');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the satellite and the original time when the window holds no pass of it (FR-SHARE-3)', async () => {
    const asked = pass.start.t;
    landOn(passLinkHash({ observer: shared, noradId: pass.noradId, startT: asked }), [other]);
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
    const notice = screen.getByTestId('share-fallback');
    expect(notice).toHaveTextContent('ISS (Zarya)'); // from the catalog: there is no pass to take the name from
    expect(notice).toHaveTextContent(at(asked));
    expect(notice).toHaveTextContent('no other');
  });

  it('says nothing until the recompute is done: "no pass" would only mean "not yet"', () => {
    window.location.hash = passLinkHash({ observer: shared, noradId: pass.noradId, startT: pass.start.t });
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'computing', observer } });
    });
    render(<App />);
    expect(screen.queryByTestId('share-fallback')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    const asked = pass.start.t;
    landOn(passLinkHash({ observer: shared, noradId: pass.noradId, startT: asked }), [other]);
    render(
      <I18nProvider locale="es">
        <App />
      </I18nProvider>,
    );
    expect(screen.getByTestId('share-fallback')).toHaveTextContent('El paso de ISS (Zarya) para el que se hizo este enlace');
  });

  it('leaves a malformed or partial link on the home screen', () => {
    for (const hash of ['#pass?lat=-38.93', '#pass?lat=&lon=&norad=&start=', '#pass?lat=-38.93&lon=-67.99&alt=270&norad=25544&start=never', '#%%%']) {
      landOn(hash, [other, pass]);
      const { unmount } = render(<App />);
      expect(screen.queryByRole('dialog'), hash).toBeNull();
      expect(screen.queryByTestId('share-fallback'), hash).toBeNull();
      expect(screen.getByRole('region', { name: 'Upcoming passes' }), hash).toBeInTheDocument();
      unmount();
    }
  });
});
