// @vitest-environment jsdom
/**
 * R146 (FR-FULL-10, FR-FULL-8, US-43 AC5 at the unit level, PLAN §9.10): the opening card on its own — both forms in
 * both languages with the catalog's words, the pass line's name, rise time and chip, each button's callback (`onNext`
 * with the lead instant, `onNow`), the group named by its sentence, the polite live region, focus to the first
 * button on mount, each button a `.target`. What the card asks is `openingChoice`'s (`tonightJump.test.ts`); where
 * and when the page shows it is R148's.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import { openingChoice } from '../../../lib/tonightJump';
import type { Locale } from '../../../model';
import { OpeningCard, type CardChoice } from './OpeningCard';

afterEach(cleanup);

const MIN = 60_000;
/** 17:35 UTC; Tiangong rises at 21:47, 4 h 12 min later. */
const NOW = Date.UTC(2026, 9, 30, 17, 35);
const RISE = Date.UTC(2026, 9, 30, 21, 47);
const tiangong = { name: 'Tiangong', start: { t: RISE }, end: { t: RISE + 5 * MIN } };
const span = { start: NOW, end: NOW + 24 * 60 * MIN };

const ask = openingChoice([tiangong], NOW, span) as CardChoice;
const advise = openingChoice([], NOW, span) as CardChoice;

const mount = (locale: Locale, choice: CardChoice) => {
  const onNext = vi.fn();
  const onNow = vi.fn();
  const utils = render(
    <I18nProvider locale={locale}>
      <OpeningCard choice={choice} now={NOW} timeZone="UTC" onNext={onNext} onNow={onNow} />
    </I18nProvider>,
  );
  return { ...utils, onNext, onNow, card: screen.getByTestId('live-card') };
};

const catalogs = [
  ['en', en, 'Tiangong · 21:47 · in 4 h 12 min'],
  ['es', es, 'Tiangong · 21:47 · en 4 h 12 min'],
] as const;

describe('<OpeningCard> asking (FR-FULL-10)', () => {
  it('the choice is the ask, at the lead instant', () => {
    expect(ask).toEqual({ kind: 'ask', pass: tiangong, at: RISE - MIN });
  });

  it.each(catalogs)('in %s: the sentence, the pass line, then see next pass and see now', async (locale, m, line) => {
    const { container, card } = mount(locale, ask);
    expect(card).toHaveAttribute('role', 'group');
    expect(card).toHaveAttribute('data-kind', 'ask');
    expect(within(card).getByText(m.live.opening.nothingUp)).toBeInTheDocument();
    expect(screen.getByTestId('live-card-pass')).toHaveTextContent(line);
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual([m.live.opening.seeNext, m.live.opening.seeNow]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(catalogs)('in %s: the group is named by its sentence, which a polite live region carries with the pass line', (_locale, m, line) => {
    const { card } = mount(_locale, ask);
    expect(screen.getByRole('group', { name: m.live.opening.nothingUp })).toBe(card);
    const region = card.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region).toHaveTextContent(m.live.opening.nothingUp);
    expect(region).toHaveTextContent(line);
    // The buttons are not in the region: it says what is so, not what to press.
    expect(within(region as HTMLElement).queryAllByRole('button')).toEqual([]);
  });

  it('moves focus to see next pass on mount', () => {
    mount('en', ask);
    expect(screen.getByTestId('live-card-next')).toHaveFocus();
  });

  it('see next pass calls onNext with the lead instant; see now calls onNow', () => {
    const { onNext, onNow } = mount('en', ask);
    fireEvent.click(screen.getByTestId('live-card-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(RISE - MIN);
    expect(onNow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('live-card-now'));
    expect(onNow).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('every button is a target', () => {
    const { card } = mount('es', ask);
    for (const b of within(card).getAllByRole('button')) expect(b.classList.contains('target'), b.textContent ?? '').toBe(true);
  });

  it('writes the rise in the observer’s zone and the chip from now to the rise, under an hour as minutes', () => {
    const soon = openingChoice([{ ...tiangong, start: { t: NOW + 7 * MIN }, end: { t: NOW + 12 * MIN } }], NOW, span) as CardChoice;
    render(
      <I18nProvider locale="en">
        <OpeningCard choice={soon} now={NOW} timeZone="America/Argentina/Buenos_Aires" onNext={vi.fn()} onNow={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('live-card-pass')).toHaveTextContent('Tiangong · 14:42 · in 7 min');
  });
});

describe('<OpeningCard> advising (FR-FULL-10)', () => {
  it('the choice is the advice', () => {
    expect(advise).toEqual({ kind: 'advise' });
  });

  it.each(catalogs)('in %s: the no-pass sentence over see the sky now, named and announced', async (locale, m) => {
    const { container, card } = mount(locale, advise);
    expect(card).toHaveAttribute('data-kind', 'advise');
    expect(screen.getByRole('group', { name: m.live.opening.noPass })).toBe(card);
    expect(card.querySelector('[aria-live="polite"]')).toHaveTextContent(m.live.opening.noPass);
    expect(screen.queryByTestId('live-card-pass')).toBeNull();
    const buttons = within(card).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([m.live.opening.seeSkyNow]);
    expect(buttons[0]?.classList.contains('target')).toBe(true);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves focus to see the sky now on mount, which calls onNow', () => {
    const { onNext, onNow } = mount('en', advise);
    const now = screen.getByTestId('live-card-now');
    expect(now).toHaveFocus();
    fireEvent.click(now);
    expect(onNow).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('the strings (FR-FULL-8)', () => {
  it('are the spec’s, in both languages', () => {
    expect(en.live.opening).toMatchObject({ nothingUp: 'Nothing visible up now.', noPass: 'No visible pass in the next 24 h.', seeNext: 'see next pass', seeNow: 'see now', seeSkyNow: 'see the sky now' });
    expect(es.live.opening).toMatchObject({ nothingUp: 'Nada visible ahora.', noPass: 'Ningún pase visible en las próximas 24 h.', seeNext: 'ver próximo pase', seeNow: 'ver ahora', seeSkyNow: 'ver el cielo ahora' });
  });
});
