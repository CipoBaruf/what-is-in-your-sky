/**
 * TASKS R12 (FR-X-1, FR-X-2, FR-X-5, FR-X-6): the frame is header (title,
 * tagline), the three titled regions, and the footer; `jest-axe` finds no
 * violation on the empty Home screen nor on a Home screen with passes (hero
 * card, sort toggle, list); header and footer are inert with the sheet open.
 */
import { act, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureRecords, goldenPassFixture, goldenWindowStart } from '../../tests/support/catalogFixtures';
import type { Observer } from '../model';
import { appStore, type ElementsState } from '../state';
import { IDLE_PASSES } from '../state/slices/passes';
import { en } from '../i18n/en';
import { App } from './App';

const pass = goldenPassFixture();
const NOW = goldenWindowStart();
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const ready: ElementsState = { status: 'ready', records: fixtureRecords(), unavailable: [], rejected: [], fetchedAt: NOW, stale: false, persistent: true };
const initial = appStore.getInitialState();
const other = { ...pass, id: 'other', noradId: 2, name: 'Other object', start: { ...pass.start, t: pass.start.t + 3_600_000 } };

describe('<App> frame (R12)', () => {
  afterEach(() => {
    appStore.setState(initial, true);
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('has the title, the tagline, the three titled regions and the footer, with no axe violations while empty', async () => {
    const { container } = render(<App />);
    expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1, name: 'What is in your sky right now' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent(en.app.tagline);
    for (const name of ['Location', 'Right now', 'Upcoming passes']) {
      const region = screen.getByRole('region', { name });
      expect(within(region).getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Orbital elements by CelesTrak.');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('with passes: the hero card, the sort toggle and the list, no axe violations; header and footer inert with the sheet open', async () => {
    act(() => {
      appStore.setState({ observer, nowMs: NOW, elements: ready, passes: { ...IDLE_PASSES, jobId: 'job-1', status: 'done', observer, passes: [pass, other], hasDarkness: true } });
    });
    const { container } = render(<App />);
    expect(screen.getByTestId('iss-hero')).toHaveAttribute('data-pass-id', pass.id);
    expect(screen.getByRole('group', { name: 'Sort passes' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();

    act(() => {
      window.location.hash = `#pass=${pass.id}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeInTheDocument();
    for (const role of ['banner', 'main', 'contentinfo']) expect(screen.getByRole(role, { hidden: true })).toHaveAttribute('inert');
  });
});
