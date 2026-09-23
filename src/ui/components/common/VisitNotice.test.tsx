import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { LiveLink } from '../../../lib/shareLinks';
import type { Locale, Observer } from '../../../model';
import { appStore, type AppState } from '../../../state';
import { LinkNote, PageNotices, VisitNotice } from './VisitNotice';

/**
 * R87 (FR-VISIT-2..4, US-32 AC1 and AC3, D-539): the visit notice names the
 * link's place and its two controls call R83's `endVisit` and `keepVisit`; the
 * link notes say what `openLink()` could not honour, and are dismissed without
 * touching the visit.
 */
const initial = appStore.getInitialState();
const saved: Observer = { lat: -38.95, lon: -68.06, altM: 270, label: 'Neuquén, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const visited: Observer = { lat: 48.86, lon: 2.35, altM: 35, label: '48.86, 2.35', source: 'coords', timeZone: null };
const T = Date.UTC(2026, 8, 20, 21, 14);
const liveLink: LiveLink = { kind: 'live', observer: { lat: 48.86, lon: 2.35, altM: 35 }, t: T } as LiveLink;
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
});

describe('VisitNotice (FR-VISIT-2)', () => {
  it('says nothing without a visit', () => {
    set({ observer: saved });
    show(<VisitNotice />);
    expect(screen.queryByTestId('visit-notice')).toBeNull();
  });

  it('is a status line naming the place, and its two controls call endVisit and keepVisit', async () => {
    const endVisit = vi.fn();
    const keepVisit = vi.fn();
    set({ observer: saved, visiting: visited, endVisit, keepVisit });
    const { container } = show(<VisitNotice />);
    const notice = screen.getByRole('status');
    expect(notice).toHaveAttribute('data-testid', 'visit-notice');
    expect(notice).toHaveTextContent(en.visit.showingShort({ place: '48.86, 2.35' }));
    fireEvent.click(screen.getByRole('button', { name: en.visit.back }));
    expect(endVisit).toHaveBeenCalledTimes(1);
    expect(keepVisit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.visit.keep }));
    expect(keepVisit).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('back brings the saved place back and keep stores the visited one, and either removes the notice', () => {
    set({ observer: saved, visiting: visited });
    show(<VisitNotice />);
    fireEvent.click(screen.getByTestId('visit-back'));
    expect(appStore.getState().visiting).toBeNull();
    expect(appStore.getState().observer).toBe(saved);
    expect(screen.queryByTestId('visit-notice')).toBeNull();

    set({ visiting: visited });
    fireEvent.click(screen.getByTestId('visit-keep'));
    expect(appStore.getState().observer).toBe(visited);
    expect(screen.queryByTestId('visit-notice')).toBeNull();
  });

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('on a desk is FR-VISIT-2’s sentence on one line with the controls (%s)', (locale, t) => {
    media.restore();
    media = stubMatchMedia(WIDE_PX);
    set({ observer: saved, visiting: visited });
    show(<VisitNotice />, locale);
    expect(screen.getByTestId('visit-notice')).toHaveAttribute('data-form', 'line');
    expect(screen.getByTestId('visit-sentence')).toHaveTextContent(t.visit.showing({ place: '48.86, 2.35' }));
  });
});

describe('LinkNote (FR-VISIT-3, FR-VISIT-4)', () => {
  it('says an unreadable link could not be read, and is dismissed without a trace', () => {
    set({ observer: saved, linkResult: { kind: 'unreadable' } });
    show(<LinkNote kinds={['unreadable']} />);
    expect(screen.getByRole('status')).toHaveTextContent(en.visit.unreadable);
    fireEvent.click(screen.getByRole('button', { name: en.visit.dismiss }));
    expect(screen.queryByTestId('link-note')).toBeNull();
    expect(appStore.getState().linkResult).toBeNull();
  });

  it('is silent for an unknown hash', () => {
    set({ linkResult: { kind: 'unknown' } });
    show(<LinkNote kinds={['unreadable', 'past', 'far']} />);
    expect(screen.queryByTestId('link-note')).toBeNull();
  });

  it.each([
    ['en', en],
    ['es', es],
  ] as const)('names the moment that passed and the one too far ahead, and keeps the visit on dismissal (%s)', (locale, t) => {
    set({ observer: saved, visiting: visited, linkResult: { kind: 'visit', link: liveLink, note: 'past' } });
    const view = show(<LinkNote kinds={['past', 'far']} />, locale);
    expect(screen.getByTestId('link-note')).toHaveTextContent(t.visit.past({ time: '' }).split(',')[1]?.trim() ?? '');
    // The visited place has no zone yet, so the time says it is UTC (R46, F-27).
    expect(screen.getByTestId('link-note')).toHaveTextContent('2026-09-20 21:14 UTC');
    fireEvent.click(screen.getByTestId('link-note-dismiss'));
    expect(appStore.getState().linkResult).toEqual({ kind: 'visit', link: liveLink });
    expect(appStore.getState().visiting).toBe(visited);
    view.unmount();

    set({ linkResult: { kind: 'visit', link: liveLink, note: 'far' } });
    show(<LinkNote kinds={['past', 'far']} />, locale);
    expect(screen.getByTestId('link-note')).toHaveAttribute('data-note', 'far');
  });

  it('draws only the notes its page can be showing', () => {
    set({ linkResult: { kind: 'visit', link: liveLink, note: 'past' } });
    show(<LinkNote kinds={['unreadable']} />);
    expect(screen.queryByTestId('link-note')).toBeNull();
  });
});

describe('PageNotices', () => {
  it('is an empty strip when there is nothing to say', () => {
    const { container } = show(<PageNotices kinds={['unreadable']} />);
    expect(container.querySelector('[data-page-notices]')).toBeEmptyDOMElement();
  });
});
