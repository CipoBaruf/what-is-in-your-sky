/** R31 (FR-SHARE-2): the share sheet where there is one, the clipboard with an inline confirmation everywhere else. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/useT';
import { ShareButton } from './ShareButton';

const URL_ = 'https://sky.test/#pass?lat=-38.93&lon=-67.99&alt=0&norad=25544&start=2026-09-02T03:04:05Z';
const props = { url: URL_, title: 'ISS (Zarya) in your sky', text: 'Appears low in the northwest at 03:04…' };

function withClipboard(writeText: () => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(navigator, 'share');
});

describe('<ShareButton>', () => {
  it('hands the title, the sentence and the URL to the share sheet where there is one', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    const { container } = render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share this pass' }));

    expect(share).toHaveBeenCalledWith({ title: props.title, text: props.text, url: URL_ });
    // The sheet said it; the app does not repeat it, and nothing touched the clipboard.
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByTestId('share-status')).toHaveTextContent('');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says nothing when the share sheet is dismissed', async () => {
    const share = vi.fn(() => Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share this pass' }));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByTestId('share-status')).toHaveTextContent('');
  });

  it('copies the URL and confirms it inline where there is no share sheet', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share this pass' }));

    expect(writeText).toHaveBeenCalledWith(URL_);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    });
  });

  it('falls through to the clipboard when the share sheet refuses the payload', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(() => Promise.reject(new TypeError('bad payload'))), configurable: true });
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share this pass' }));

    expect(writeText).toHaveBeenCalledWith(URL_);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    });
  });

  it('shows the link to copy by hand when the clipboard is refused', async () => {
    withClipboard(() => Promise.reject(new Error('denied')));

    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share this pass' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('The link could not be copied.');
    });
    expect(screen.getByRole('status')).toHaveTextContent(URL_);
  });

  it('survives a browser with no clipboard at all', async () => {
    render(<ShareButton {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share this pass' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('The link could not be copied.');
    });
  });

  it('speaks Spanish (FR-I18N-2)', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);

    render(
      <I18nProvider locale="es">
        <ShareButton {...props} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compartir este paso' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado');
    });
  });
});
