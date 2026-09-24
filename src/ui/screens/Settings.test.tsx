/**
 * R52 (FR-COMP-2, US-20 AC2/AC4, V11-16, D-184, D-260), R75 (FR-SET-1, US-29
 * AC1): the settings page.
 *
 * The controls are the home screen's own, so what is tested here is what the
 * screen adds: that it renders them in FR-SET-1's order, that the coordinates
 * disclosure starts open only for a coordinates observer, that each one still
 * writes the store field it wrote on the home screen with no save action in
 * between, that the install row is the offer and not the answer, and that the
 * three ways out lead back to the home screen. The route and the header are
 * covered from `App` (`App.settings.test.tsx`), which is where they meet.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { I18nProvider } from '../../i18n/useT';
import { INSTALL_SNOOZE_DAYS } from '../../lib/installSnooze';
import type { Observer } from '../../model';
import { appStore } from '../../state';
import type { InstallEnv } from '../components/common/installEnv';
import { BEFORE_INSTALL_PROMPT, forgetInstallOffer, type BeforeInstallPromptEvent } from '../components/common/installOffer';
import { Shell } from '../Shell';
import { SettingsPage } from './Settings';
import { settingsShell } from './SettingsRoute';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const initial = appStore.getInitialState();
const CHROMIUM: InstallEnv = { standalone: undefined };
const NOTHING_TO_OFFER = CHROMIUM;

const offerAnInstall = (): void => {
  const event = Object.assign(new Event(BEFORE_INSTALL_PROMPT, { cancelable: true }), { prompt: vi.fn(() => Promise.resolve({ outcome: 'accepted' })) }) as BeforeInstallPromptEvent;
  act(() => {
    window.dispatchEvent(event);
  });
};

const show = (onLeave = vi.fn(), env: InstallEnv = NOTHING_TO_OFFER, locale: 'en' | 'es' = 'en') =>
  render(
    <I18nProvider locale={locale}>
      {/* R93 (D-545): the route with the page in place of its chunk, so the composition renders synchronously here. */}
      <Shell routeKey="settings" title="" {...settingsShell(locale === 'es' ? es : en, { onLeave, installEnv: env }, { page: <SettingsPage onLeave={onLeave} installEnv={env} /> })} />
    </I18nProvider>,
  );

afterEach(() => {
  act(() => {
    appStore.setState(initial, true);
  });
  localStorage.clear();
  forgetInstallOffer();
});

describe('<SettingsPage> (FR-COMP-2 as amended, FR-SET-1)', () => {
  it('renders the three blocks in FR-SET-1 order, with no save action and no axe violations', async () => {
    act(() => {
      appStore.setState({ observer });
    });
    offerAnInstall();
    const { container } = show(vi.fn(), CHROMIUM);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([en.location.heading, en.favourites.heading, en.settings.browser]);
    /*
     * The order in the document, not only in the headings: each block and each
     * row FR-SET-1 names is found and compared by its position, so a row that
     * moved into the wrong block fails here even when the headings stand.
     */
    const main = screen.getByRole('main');
    const rows = [
      screen.getByRole('region', { name: en.location.heading }),
      screen.getByRole('combobox', { name: en.location.placeLabel }),
      screen.getByTestId('location-actions'),
      screen.getByText(en.location.precisionNote),
      screen.getByRole('region', { name: en.favourites.heading }),
      screen.getByTestId('save-favourite'),
      screen.getByTestId('clear-saved-location'),
      screen.getByRole('region', { name: en.settings.browser }),
      screen.getByRole('group', { name: en.app.language }),
      screen.getByRole('group', { name: en.app.theme }),
      screen.getByTestId('install-action'),
      screen.getByText(en.settings.privacy),
    ];
    for (const [before, after] of rows.slice(0, -1).map((row, i) => [row, rows[i + 1]] as const)) {
      if (after === undefined) continue;
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING, `${before.textContent ?? ''} comes before ${after.textContent ?? ''}`).toBeTruthy();
    }
    // The disclosure on the device row (jsdom has no geolocation, so the device button itself is the e2e spec's),
    // and the clear beside the save (FR-SET-1).
    expect(screen.getByTestId('location-actions')).toContainElement(screen.getByTestId('coords-disclosure'));
    expect(screen.getByTestId('clear-saved-location').closest('div')).toBe(screen.getByTestId('save-favourite').parentElement);
    // The privacy line is the foot: after the whole of the page's main region, not inside it.
    expect(main).not.toContainElement(screen.getByText(en.settings.privacy));
    // Its sentence took the place of the saved-here line, which is not said twice.
    expect(screen.queryByText(en.location.savedHere)).toBeNull();
    expect(screen.queryByRole('button', { name: /save settings/i })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws the Spanish page with the same blocks and no English (FR-I18N-1)', () => {
    act(() => {
      appStore.setState({ observer });
    });
    show(vi.fn(), NOTHING_TO_OFFER, 'es');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([es.location.heading, es.favourites.heading, es.settings.browser]);
    expect(screen.getByTestId('coords-disclosure')).toHaveTextContent(es.settings.coordinates);
    expect(screen.getByTestId('clear-saved-location')).toHaveTextContent(es.settings.clearSaved);
    expect(screen.getByText(es.settings.privacy)).toBeInTheDocument();
  });

  it('with no observer, has no saved places block and the coordinates closed', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([en.location.heading, en.settings.browser]);
    expect(screen.queryByTestId('favourites')).toBeNull();
    expect(screen.getByTestId('coords-disclosure')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('<SettingsPage> coordinates disclosure (FR-SET-1)', () => {
  const sources: readonly [Observer['source'], boolean, Observer][] = [
    ['coords', true, observer],
    ['geocode', false, { ...observer, label: 'Neuquén', source: 'geocode' }],
    ['device', false, { ...observer, source: 'device', accuracyM: 30 }],
  ];

  it.each(sources)('with a %s observer, is open by default: %s', (_source, open, given) => {
    act(() => {
      appStore.setState({ observer: given });
    });
    show();
    const disclosure = screen.getByTestId('coords-disclosure');
    expect(disclosure).toHaveAttribute('aria-expanded', String(open));
    const region = document.getElementById(disclosure.getAttribute('aria-controls') ?? '');
    expect(region).not.toBeNull();
    expect(region?.hidden).toBe(!open);
    if (open) expect(screen.getByLabelText(en.location.coordsLabel)).toBeVisible();
    else expect(screen.getByLabelText(en.location.coordsLabel)).not.toBeVisible();
  });

  it('opens and closes the fields, and keeps what was typed while closed', async () => {
    show();
    const disclosure = screen.getByTestId('coords-disclosure');
    await userEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    const field = screen.getByLabelText(en.location.coordsLabel);
    expect(field).toBeVisible();
    await userEvent.type(field, '-38.93, -67.99');
    expect(appStore.getState().observer).toMatchObject({ lat: -38.93, lon: -67.99, source: 'coords' });
    await userEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(field).not.toBeVisible();
    await userEvent.click(disclosure);
    expect(screen.getByLabelText(en.location.coordsLabel)).toHaveValue('-38.93, -67.99');
  });

  it('is opened by a click on the place picker’s "enter coordinates instead" link, so the link has a field to focus', () => {
    show();
    const link = document.createElement('a');
    link.href = '#coords';
    // The picker's own link only appears after a failed search; the page's capture listener is what is under test.
    screen.getByRole('region', { name: en.location.heading }).append(link);
    fireEvent.click(link);
    expect(screen.getByTestId('coords-disclosure')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(en.location.coordsLabel)).toBeVisible();
  });
});

describe('<SettingsPage> (FR-COMP-2: the controls and the way back, unchanged)', () => {
  it('writes the same store fields the home screen wrote, at once (US-20 AC2)', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(appStore.getState().locale).toBe('es');
    await userEvent.click(screen.getByRole('button', { name: en.app.themes.night }));
    expect(appStore.getState().theme).toBe('night');
  });

  it('takes focus to the way out, which is the control the reader arrived on the page needing', () => {
    show();
    expect(screen.getByTestId('settings-back')).toHaveFocus();
  });

  it('leaves through its own back control (US-20 AC4)', async () => {
    const onLeave = vi.fn();
    show(onLeave);
    await userEvent.click(screen.getByTestId('settings-back'));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('clears the saved location from the control inside the saved places', async () => {
    act(() => {
      appStore.setState({ observer });
    });
    show();
    await userEvent.click(screen.getByTestId('clear-saved-location'));
    expect(appStore.getState().observer).toBeNull();
    // The control goes with the location it cleared: there is nothing left to clear.
    expect(screen.queryByTestId('clear-saved-location')).toBeNull();
  });
});

describe('<SettingsPage> install row (V11-16, D-260)', () => {
  it('is absent when the browser has nothing to offer', () => {
    show();
    expect(screen.queryByTestId('settings-install')).toBeNull();
  });

  it('is present, with no decline beside it, when the browser offers an install', () => {
    offerAnInstall();
    show(vi.fn(), CHROMIUM);
    const row = screen.getByTestId('settings-install');
    expect(within(row).getByTestId('install-action')).toHaveTextContent(en.install.action);
    expect(within(row).queryByRole('button', { name: en.install.dismiss })).toBeNull();
  });

  it('is still present after the last decline and while a snooze is running', () => {
    offerAnInstall();
    act(() => {
      for (let i = 0; i <= INSTALL_SNOOZE_DAYS.length; i += 1) appStore.getState().declineInstallHint();
    });
    show(vi.fn(), CHROMIUM);
    expect(screen.getByTestId('settings-install')).toBeInTheDocument();
  });

  it('takes the iOS shape where that is the browser: the note and no button', () => {
    show(vi.fn(), { standalone: false });
    const row = screen.getByTestId('settings-install');
    expect(row).toHaveTextContent(en.install.ios);
    expect(within(row).queryByTestId('install-action')).toBeNull();
  });

  // R91 (FR-FAIL-8, D-550, F-95): the row opens the dialog and latches nothing; the hint's snooze is its own.
  it('opens the dialog and writes no latch when it is taken', async () => {
    offerAnInstall();
    show(vi.fn(), CHROMIUM);
    await userEvent.click(screen.getByTestId('install-action'));
    expect(appStore.getState().installAnswer.dismissed).not.toBe(true);
  });
});
