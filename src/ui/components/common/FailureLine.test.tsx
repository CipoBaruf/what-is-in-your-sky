import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { I18nProvider } from '../../../i18n/useT';
import type { Locale } from '../../../model';
import type { Failure, FailureKind } from '../../../state/failure';
import { FailureLine } from './FailureLine';

/**
 * R89 (FR-FAIL-1, FR-FAIL-2; US-33 AC1): one sentence per failure kind in each
 * language, with no status code, exception name or provider message in it; the
 * raw detail is only inside `[ details ]`; `[ retry ]` calls the slice's action.
 */
const KINDS: readonly FailureKind[] = ['offline', 'rate-limited', 'server', 'bad-data', 'timeout', 'unknown'];

/** What a real failure's detail looks like: the kind of text that must never reach the sentence. */
const DETAILS: Record<FailureKind, string> = {
  offline: 'TypeError: Failed to fetch',
  'rate-limited': 'CelesTrak answered HTTP 429 Too Many Requests',
  server: 'CelesTrak answered HTTP 503 Service Unavailable',
  'bad-data': 'ZodError: Expected array, received string',
  timeout: 'AbortError: The operation was aborted due to timeout',
  unknown: 'Error: something odd',
};

const renderLine = (failure: Failure, locale: Locale, onRetry = vi.fn()) =>
  render(
    <I18nProvider locale={locale}>
      <FailureLine failure={failure} what={(locale === 'es' ? es : en).failure.what.elements} onRetry={onRetry} />
    </I18nProvider>,
  );

describe('FailureLine', () => {
  for (const locale of ['en', 'es'] as const) {
    const messages = locale === 'es' ? es : en;
    for (const kind of KINDS) {
      it(`says a ${kind} failure in ${locale} with no internals, and keeps the detail behind [ details ]`, () => {
        renderLine({ kind, detail: DETAILS[kind] }, locale);
        const sentence = screen.getByTestId('failure-sentence').textContent;
        expect(sentence).toBe(messages.failure[kind](messages.failure.what.elements));
        expect(sentence).not.toMatch(/HTTP|\d{3}|Error:/);
        expect(sentence).not.toContain(DETAILS[kind]);
        const detail = screen.getByTestId('failure-detail');
        expect(detail).not.toBeVisible();
        expect(detail.tagName).toBe('PRE');
        expect(detail).toHaveTextContent(DETAILS[kind]);
        const toggle = screen.getByTestId('failure-details');
        expect(toggle).toHaveTextContent(messages.failure.details);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveAttribute('aria-controls', detail.id);
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(detail).toBeVisible();
      });
    }
  }

  it('re-renders the sentence in the other language from the same stored failure', () => {
    const failure: Failure = { kind: 'server', detail: DETAILS.server };
    const { rerender } = renderLine(failure, 'en');
    expect(screen.getByTestId('failure-sentence')).toHaveTextContent(en.failure.server(en.failure.what.elements));
    rerender(
      <I18nProvider locale="es">
        <FailureLine failure={failure} what={es.failure.what.elements} onRetry={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('failure-sentence')).toHaveTextContent(es.failure.server(es.failure.what.elements));
    expect(screen.getByTestId('failure-retry')).toHaveTextContent(es.failure.retry);
  });

  it('calls the retry action from [ retry ]', () => {
    const onRetry = vi.fn();
    renderLine({ kind: 'offline', detail: DETAILS.offline }, 'en', onRetry);
    fireEvent.click(screen.getByRole('button', { name: en.failure.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('adds what the page is using instead after the sentence', () => {
    render(
      <I18nProvider locale="en">
        <FailureLine failure={{ kind: 'timeout', detail: DETAILS.timeout }} what={en.failure.what.elements} instead="Showing the stored passes." onRetry={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('failure-sentence')).toHaveTextContent(`${en.failure.timeout(en.failure.what.elements)} Showing the stored passes.`);
  });

  it('has no axe violations', async () => {
    const { container } = renderLine({ kind: 'server', detail: DETAILS.server }, 'en');
    expect(await axe(container)).toHaveNoViolations();
  });
});
