// @vitest-environment jsdom
/**
 * R213 (FR-STRIP-1, FR-STRIP-2, FR-STRIP-3; US-63): the next-pass strip on its own: each kind in both forms, the
 * example's tag on compact, which of the two buttons stands, where the focus goes when one leaves, both languages.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { I18nProvider } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import type { NextPassStrip as StripFacts } from '../../../lib/nextPassStrip';
import { interpolateTrack } from '../../../lib/skyGeometry';
import { formatShortClock } from '../../../lib/timeFormat';
import type { Locale, Pass } from '../../../model';
import { NextPassStrip, type NextPassStripProps } from './NextPassStrip';

afterEach(cleanup);

const ZONE = 'America/Argentina/Salta';
const MIN = 60_000;
const pass: Pass = { ...goldenPassFixture(), name: 'ISS' };
const RISE = formatShortClock(pass.start.t, ZONE, 'en');
const SET = formatShortClock(pass.end.t, ZONE, 'en');
const NEXT: StripFacts<Pass> = { kind: 'next', pass };
const UP: StripFacts<Pass> = { kind: 'up', pass };
const NONE: StripFacts<Pass> = { kind: 'none' };
/** An hour and ten before the rise (US-63 AC1's countdown). */
const BEFORE = pass.start.t - 70 * MIN;
const DURING = pass.start.t + 30_000;

const element = (over: Partial<NextPassStripProps>, locale: Locale = 'en') => (
  <I18nProvider locale={locale}>
    <NextPassStrip strip={NEXT} t={BEFORE} timeZone={ZONE} form="row" live onWatch={() => undefined} onLive={() => undefined} {...over} />
  </I18nProvider>
);
const strip = (): HTMLElement => screen.getByTestId('live-strip');
const line = (): HTMLElement => screen.getByTestId('strip-text');
const buttons = (): (string | null)[] => within(strip()).queryAllByRole('button').map((b) => b.getAttribute('data-testid'));

describe('<NextPassStrip> (FR-STRIP-1)', () => {
  it('reads `Next  ISS · HH:MM · in 1 h 10` with ▶ watch while nothing is up (US-63 AC1)', async () => {
    const onWatch = vi.fn();
    const { container } = render(element({ onWatch }));
    expect(strip()).toHaveAttribute('data-kind', 'next');
    // The two spaces after the lead are the spec's, so the text is read raw.
    expect(line().textContent).toBe(`Next  ISS · ${RISE} · in 1 h 10`);
    const watch = screen.getByRole('button', { name: 'watch: ISS, from a minute before its rise' });
    expect(watch).toHaveTextContent(/^▶ watch$/);
    expect(buttons()).toEqual(['live-watch']);
    fireEvent.click(watch);
    expect(onWatch).toHaveBeenCalledWith(pass);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads `Up now  ISS · sets HH:MM · look <direction>` while the pass is up, with no watch', () => {
    render(element({ strip: UP, t: DURING }));
    expect(strip()).toHaveAttribute('data-kind', 'up');
    expect(line().textContent).toBe(`Up now  ISS · sets ${SET} · look ${compassPoint(interpolateTrack(pass.track, DURING).azDeg)}`);
    expect(buttons()).toEqual([]);
  });

  it('says there is no visible pass in the next 24 h, and not before the passes are in', () => {
    const { rerender } = render(element({ strip: NONE }));
    expect(strip()).toHaveAttribute('data-kind', 'none');
    expect(line()).toHaveTextContent(/^No visible pass in the next 24 h$/);
    expect(buttons()).toEqual([]);
    rerender(element({ strip: NONE, pending: true }));
    expect(line()).not.toHaveTextContent('No visible pass');
  });

  it('names the zone with the time where the place has none', () => {
    render(element({ timeZone: null }));
    expect(line()).toHaveTextContent(/· \d\d:\d\d UTC · in 1 h 10$/);
  });

  it('starts with `[example] Salta` on compact while the example is the observer, whatever the kind (V30-32, G70)', () => {
    const { rerender } = render(element({ exampleCity: 'Salta' }));
    expect(line().textContent).toBe(`[example] Salta · Next  ISS · ${RISE} · in 1 h 10`);
    rerender(element({ strip: NONE, exampleCity: 'Salta' }));
    expect(line().textContent).toBe('[example] Salta · No visible pass in the next 24 h');
    rerender(element({ strip: UP, t: DURING, exampleCity: 'Salta' }));
    expect(line().textContent?.startsWith('[example] Salta · Up now  ISS')).toBe(true);
    rerender(element({}));
    expect(line().textContent?.startsWith('Next')).toBe(true);
  });

  it('is the wide rail’s block with the button under it, and adds the sets and look line while up (V30-30)', () => {
    const block = <p data-testid="block">the block</p>;
    const { rerender } = render(element({ form: 'head', block }));
    expect(screen.queryByTestId('strip-text')).toBeNull();
    expect(screen.getByTestId('block').compareDocumentPosition(screen.getByTestId('live-watch'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByTestId('strip-up')).toBeNull();
    rerender(element({ form: 'head', block, strip: UP, t: DURING }));
    expect(screen.getByTestId('strip-up')).toHaveTextContent(new RegExp(`^sets ${SET} · look [NSEW]{1,3}$`));
  });

  it('ends with ● back to live while held: in watch’s place on compact, beside it on wide (FR-STRIP-3, D-1268)', () => {
    const onLive = vi.fn();
    const { rerender } = render(element({ live: false, onLive }));
    expect(buttons()).toEqual(['live-now']);
    const back = screen.getByRole('button', { name: 'back to live' });
    expect(back).toHaveTextContent(/^● back to live$/);
    fireEvent.click(back);
    expect(onLive).toHaveBeenCalledTimes(1);
    rerender(element({ form: 'head', live: false }));
    expect(buttons()).toEqual(['live-watch', 'live-now']);
    rerender(element({ strip: NONE, live: false }));
    expect(buttons()).toEqual(['live-now']);
  });

  it('hands the focus on when the button pressed leaves, never to the page', () => {
    const { rerender } = render(element({}));
    const watch = screen.getByTestId('live-watch');
    watch.focus();
    fireEvent.click(watch);
    rerender(element({ live: false }));
    const back = screen.getByTestId('live-now');
    expect(back).toHaveFocus();
    fireEvent.click(back);
    rerender(element({ live: true, strip: NONE }));
    expect(strip()).toHaveFocus();
  });

  it('speaks Spanish (FR-I18N-2)', () => {
    const { rerender } = render(element({ exampleCity: 'Salta' }, 'es'));
    expect(line().textContent).toBe(`[ejemplo] Salta · Próximo  ISS · ${formatShortClock(pass.start.t, ZONE, 'es')} · en 1 h 10`);
    expect(screen.getByTestId('live-watch')).toHaveTextContent(/^▶ ver$/);
    rerender(element({ strip: NONE, live: false }, 'es'));
    expect(line()).toHaveTextContent(/^Ningún pase visible en las próximas 24 h$/);
    expect(screen.getByRole('button', { name: 'volver a en vivo' })).toHaveTextContent(/^● volver a en vivo$/);
  });
});
