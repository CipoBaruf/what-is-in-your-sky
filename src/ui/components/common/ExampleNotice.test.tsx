import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { ExampleOutcome } from '../../../lib/exampleOutcome';
import type { Locale, Observer } from '../../../model';
import { appStore, type AppState } from '../../../state';
import { ExampleNotice } from './ExampleNotice';
import { PageNotices } from './VisitNotice';

/** R203 (FR-OPEN-7, FR-OPEN-6; D-1180, D-1205): the page line under the header while a page opens for the example. */
const initial = appStore.getInitialState();
const example: Observer = { lat: -34.6, lon: -58.38, altM: 0, label: 'Buenos Aires', source: 'example', timeZone: 'America/Argentina/Buenos_Aires' };
const saved: Observer = { lat: -38.95, lon: -68.06, altM: 270, label: 'Neuquén, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
let media: MatchMediaStub;

const set = (patch: Partial<AppState>): void => {
  act(() => {
    appStore.setState(patch);
  });
};
const show = (element: React.ReactElement, locale: Locale = 'en') => render(<I18nProvider locale={locale}>{element}</I18nProvider>);

beforeEach(() => {
  media = stubMatchMedia(COMPACT_PX);
});

afterEach(() => {
  media.restore();
  appStore.setState(initial, true);
  window.history.replaceState(null, '', window.location.pathname);
});

describe('ExampleNotice (FR-OPEN-7)', () => {
  it('names the example and its zone, and its control opens the place group on settings (D-1230)', async () => {
    set({ example, exampleOutcome: 'pass' });
    window.history.replaceState(null, '', '#live');
    const { container } = show(<ExampleNotice />);
    const line = screen.getByTestId('example-notice');
    expect(line).toHaveTextContent('Example: Buenos Aires, from your time zone');
    expect(line).toHaveTextContent('·');
    expect(line).toContainElement(screen.getByRole('button', { name: en.example.pageLine }));
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: en.example.pageLine }));
    expect(window.location.hash).toBe('#settings');
  });

  it('reads in Spanish', () => {
    set({ example, exampleOutcome: 'pending' });
    show(<ExampleNotice />, 'es');
    expect(screen.getByTestId('example-notice')).toHaveTextContent(es.example.label('Buenos Aires'));
    expect(screen.getByRole('button', { name: es.example.pageLine })).toBeInTheDocument();
  });

  it('says nothing with a place set, or with none at all', () => {
    set({ observer: saved });
    const { unmount } = show(<ExampleNotice />);
    expect(screen.queryByTestId('example-notice')).toBeNull();
    unmount();
    set({ observer: null, exampleOutcome: 'no_city' });
    show(<ExampleNotice />);
    expect(screen.queryByTestId('example-notice')).toBeNull();
  });

  // FR-OPEN-6: the latch keeps the example in the store; once a fallback is latched no page opens for it.
  for (const outcome of ['none', 'failed', 'slow'] satisfies ExampleOutcome[]) {
    it(`says nothing once the fallback (${outcome}) replaced the example`, () => {
      set({ example, exampleOutcome: outcome });
      show(<ExampleNotice />);
      expect(screen.queryByTestId('example-notice')).toBeNull();
    });
  }

  it('is in the page strip, unless the page draws its own (D-1180)', () => {
    set({ example, exampleOutcome: 'pass' });
    const { unmount } = show(<PageNotices kinds={[]} />);
    expect(screen.getByTestId('example-notice')).toBeInTheDocument();
    unmount();
    show(<PageNotices kinds={[]} example={false} />);
    expect(screen.queryByTestId('example-notice')).toBeNull();
  });
});
