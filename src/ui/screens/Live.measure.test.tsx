/**
 * FR-MEAS-2 (D-1152): the live page's start failing is `failure:live`, counted when its failure line is shown and not
 * while the page is loading or drawing; `failure:elements` is the store's (`measureEffects`).
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../model';
import { appStore } from '../../state';
import { count } from '../../state/measure';
import { LivePage } from './Live';

vi.mock('../../state/measure', () => ({ count: vi.fn() }));

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

beforeEach(() => {
  vi.mocked(count).mockClear();
});

afterEach(() => {
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('<LivePage> counts its failure line (FR-MEAS-2: failure:live)', () => {
  it('is counted once the line is shown, not while the page loads', () => {
    act(() => {
      appStore.setState({ observer, elements: { status: 'loading' } });
    });
    render(<LivePage link={null} />);
    expect(screen.getByTestId('live-inert')).toHaveAttribute('data-inert', 'loading');
    expect(count).not.toHaveBeenCalled();
    act(() => {
      appStore.setState({ elements: { status: 'error', failure: { kind: 'offline', detail: 'TypeError: Failed to fetch' } } });
    });
    expect(screen.getByTestId('failure-line')).toBeInTheDocument();
    expect(count).toHaveBeenCalledExactlyOnceWith('failure', 'live');
  });

  it('is not counted with no place', () => {
    render(<LivePage link={null} />);
    expect(screen.getByTestId('live-inert')).toHaveAttribute('data-inert', 'no-place');
    // R222 (FR-LAND-5): the box holds the place group, which counts `where_shown` as it is drawn; no failure is.
    expect(count).not.toHaveBeenCalledWith('failure', expect.anything());
  });
});
