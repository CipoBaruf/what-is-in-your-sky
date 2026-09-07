/**
 * R52 (FR-COMP-1, FR-DESK-2 as amended, US-20 AC1/AC5, D-184): the two shapes
 * of the header, and what each one does and does not carry.
 */
import { act, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../tests/support/matchMedia';
import { en } from '../../../i18n/en';
import { Header } from './Header';

let media: MatchMediaStub;

afterEach(() => {
  media.restore();
});

describe('<Header> compact (FR-COMP-1)', () => {
  it('is one row of the short title, [ live ] and [ settings ], with no language or theme control (US-20 AC1)', async () => {
    media = stubMatchMedia(COMPACT_PX);
    const { container } = render(<Header />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('heading', { level: 1, name: en.app.shortTitle })).toBeInTheDocument();
    expect(banner).not.toHaveTextContent(en.app.tagline);
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.openShort);
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '#settings');
    expect(screen.getByTestId('settings-link')).toHaveTextContent(en.settings.open);
    expect(screen.queryByRole('group', { name: en.app.language })).toBeNull();
    expect(screen.queryByRole('group', { name: en.app.theme })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('marks the settings control as the current page rather than removing it, so the row does not shift between screens', () => {
    media = stubMatchMedia(COMPACT_PX);
    render(<Header current="settings" />);
    const settings = screen.getByTestId('settings-link');
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(settings).not.toHaveAttribute('href');
    // The live control is still a link: it is not the page we are on.
    expect(screen.getByTestId('live-link')).toHaveAttribute('href', '#live');
  });
});

describe('<Header> wide (FR-DESK-2 as amended, V11-8)', () => {
  it('has the full title with the tagline, [ Live sky ] beside the title, and the two preference controls', async () => {
    media = stubMatchMedia(WIDE_PX);
    const { container } = render(<Header />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('heading', { level: 1, name: en.app.title })).toBeInTheDocument();
    expect(banner).toHaveTextContent(en.app.tagline);
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.open);
    expect(screen.getByRole('group', { name: en.app.language })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: en.app.theme })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('links to no settings page: at this width the settings are the page (US-20 AC5)', () => {
    media = stubMatchMedia(WIDE_PX);
    render(<Header />);
    expect(screen.queryByTestId('settings-link')).toBeNull();
  });

  it('swaps shape when the width crosses the breakpoint', () => {
    media = stubMatchMedia(WIDE_PX);
    render(<Header />);
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.open);
    act(() => {
      media.setWidth(COMPACT_PX);
    });
    expect(screen.getByTestId('live-link')).toHaveTextContent(en.live.openShort);
    expect(screen.getByTestId('settings-link')).toBeInTheDocument();
  });
});
