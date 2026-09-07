/**
 * R52 (FR-COMP-3, US-20 AC3): the one line the compact home shows where the
 * wide layout shows the form — what it names, where it goes, and what it does
 * with the two things that have no fixed length (a place name, an accuracy).
 */
import { act, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import type { Observer } from '../../../model';
import { appStore } from '../../../state';
import { LocationSummary } from './LocationSummary';

const coords: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();

const set = (observer: Observer | null): void => {
  act(() => {
    appStore.setState({ observer });
  });
};

afterEach(() => {
  act(() => {
    appStore.setState(initial, true);
  });
});

describe('<LocationSummary>', () => {
  it('names the place and opens #settings (US-20 AC3)', async () => {
    set(coords);
    const { container } = render(<LocationSummary />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(en.location.summary('−38.93, −67.99'));
    expect(screen.getByTestId('location-summary-change')).toHaveAttribute('href', '#settings');
    expect(screen.getByTestId('location-summary-change')).toHaveTextContent(en.location.summaryChange);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses a geocoded place its own name rather than its coordinates', () => {
    set({ ...coords, label: 'Cipolletti', source: 'geocode' });
    render(<LocationSummary />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(en.location.summary('Cipolletti'));
  });

  it('puts the device accuracy on a second line, out of the row (US-3 AC3)', () => {
    set({ ...coords, source: 'device', accuracyM: 3000 });
    render(<LocationSummary />);
    const accuracy = screen.getByTestId('location-summary-accuracy');
    expect(accuracy).toHaveTextContent(en.location.summaryAccuracy(en.location.accuracy('3')));
    // The row itself stays the place and the control: the accuracy is not in it.
    expect(screen.getByTestId('location-summary')).not.toHaveTextContent('accurate to');
  });

  it('says nothing about accuracy for a place that was not the device', () => {
    set(coords);
    render(<LocationSummary />);
    expect(screen.queryByTestId('location-summary-accuracy')).toBeNull();
  });

  it('is the prompt to set a place, and the same way in, with no observer (FR-COMP-3)', () => {
    set(null);
    render(<LocationSummary />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(en.location.summaryNone);
    expect(screen.getByTestId('location-summary-change')).toHaveTextContent(en.location.summarySet);
    expect(screen.getByTestId('location-summary-change')).toHaveAttribute('href', '#settings');
  });
});
