/**
 * R52 (FR-COMP-3, US-20 AC3): the one line the compact home shows where the
 * wide layout shows the form — what it names, where it goes, and what it does
 * with the two things that have no fixed length (a place name, an accuracy).
 * R76 (FR-FIRST-4, FR-SET-3): `[ change ]` opens the input group in place and
 * never links to `#settings`; with no observer there is no line at all.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
  it('names the place, and [ change ] opens the input group in place, never #settings (FR-FIRST-4, FR-SET-3)', async () => {
    set(coords);
    const { container } = render(<LocationSummary geolocation={{ geolocation: {} as Geolocation, secure: true }} />);
    expect(screen.getByTestId('location-summary')).toHaveTextContent(en.location.summary('−38.93, −67.99'));
    const change = screen.getByRole('button', { name: en.location.summaryChange });
    expect(change).toBe(screen.getByTestId('location-summary-change'));
    expect(change).not.toHaveAttribute('href');
    expect(container.querySelector('a[href="#settings"]')).toBeNull();
    expect(change).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('location-group')).toBeNull();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByTestId('location-group');
    expect(document.getElementById(change.getAttribute('aria-controls') ?? '')).toContainElement(group);
    // The group is FR-FIRST-2's: the primary action first, then the two alternatives, then the foot.
    expect(within(group).getByRole('button', { name: en.location.useMyLocation })).toBeInTheDocument();
    expect(within(group).getByLabelText(en.location.placeLabel)).toBeInTheDocument();
    expect(within(group).getByTestId('clear-saved-location')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('location-group')).toBeNull();
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

  it('renders nothing with no observer: the cold open is the Where reading then (FR-FIRST-1, FR-SET-3)', () => {
    set(null);
    const { container } = render(<LocationSummary />);
    expect(container).toBeEmptyDOMElement();
  });
});
