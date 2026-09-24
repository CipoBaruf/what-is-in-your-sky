/**
 * R91 (FR-FAIL-5, D-544, US-33 AC3, F-88): a render error is a page. A screen
 * that throws inside the boundary leaves the header's title, the sentence,
 * `[ reload ]` and `[ details ]` — and nothing else of the app — in the
 * language `<html lang>` carries, English otherwise; `[ reload ]` reloads.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { I18nProvider } from '../i18n/useT';
import { RootBoundary } from './RootBoundary';

function Screen(): never {
  throw new TypeError("Cannot read properties of undefined (reading 'passes')");
}

const renderBroken = () =>
  render(
    <RootBoundary>
      <I18nProvider locale="en">
        <header>
          <p>Header of the app</p>
        </header>
        <main>
          <p>Before the screen</p>
          <Screen />
        </main>
      </I18nProvider>
    </RootBoundary>,
  );

describe('<RootBoundary> (FR-FAIL-5)', () => {
  beforeEach(() => {
    // React reports the caught error on the console; that is the error, not a failure of this test.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = '';
  });

  it('renders its children while nothing throws', () => {
    render(
      <RootBoundary>
        <p>the app</p>
      </RootBoundary>,
    );
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(screen.queryByTestId('root-boundary')).toBeNull();
  });

  it("a screen that throws is the boundary's title, sentence and [ reload ], and nothing else", () => {
    document.documentElement.lang = 'en';
    const { container } = renderBroken();
    const page = screen.getByTestId('root-boundary');
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(page);
    expect(page).toHaveTextContent(en.app.title);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.boundary.sentence);
    expect(screen.getByRole('button', { name: en.boundary.reload })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Header of the app')).toBeNull();
    expect(screen.queryByText('Before the screen')).toBeNull();
    // The internals are only behind [ details ].
    const visibleText = [...page.querySelectorAll('header, h1, button, summary')].map((node) => node.textContent).join(' ');
    expect(visibleText).not.toMatch(/TypeError|Cannot read/);
    expect(screen.getByTestId('boundary-detail')).not.toBeVisible();
  });

  it('holds the error behind [ details ]', async () => {
    renderBroken();
    await userEvent.click(screen.getByTestId('boundary-details'));
    expect(screen.getByTestId('boundary-detail')).toBeVisible();
    expect(screen.getByTestId('boundary-detail')).toHaveTextContent("TypeError: Cannot read properties of undefined (reading 'passes')");
  });

  it('speaks Spanish when the page was in Spanish, and English for anything else', () => {
    document.documentElement.lang = 'es';
    const { unmount } = renderBroken();
    const page = screen.getByTestId('root-boundary');
    expect(page).toHaveTextContent(es.app.title);
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(es.boundary.sentence);
    expect(within(page).getByRole('button', { name: es.boundary.reload })).toBeInTheDocument();
    expect(within(page).getByTestId('boundary-details')).toHaveTextContent(es.boundary.details);
    unmount();
    document.documentElement.lang = 'fr';
    renderBroken();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.boundary.sentence);
  });

  it('[ reload ] reloads the page', async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    try {
      renderBroken();
      await userEvent.click(screen.getByTestId('boundary-reload'));
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
