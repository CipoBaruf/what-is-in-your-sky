/**
 * R56 captures (FR-FOL-5, US-21 AC10): the sky window with the phone swept
 * down out of the sky — the two states of pointing at the ground. The first is
 * the field 10° below the horizon, where the hatch fills the part below it and
 * the picture above it goes on drawing; the second is 60° below, where no sky
 * is left in the field and the box is the hatched panel with its note.
 * Evidence for the PR, not a test: the assertions only make sure the capture
 * shows the state it is named after. Off the pull-request path (FR-CI-1's
 * budget), like R54's and R55's:
 *
 *   CAPTURES=1 npx playwright test r56-captures --project=chromium
 *
 * The place, the pass and the instant are `sky-window.spec.ts`'s R47 window
 * shots — Paris on 2026-09-02, three minutes into the glare pass — so these
 * sit beside them and the only difference is where the phone points.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR, LOCALES, THEMES, type CaptureLocale, type CaptureTheme } from './captureSet';
import { stubCompass } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;
const FRAME_MS = 16;
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;
const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const WINDOW_OPTION = { en: 'Window', es: 'Ventana' } as const;
const NOTE = {
  ground: { en: 'Pointing at the ground — raise the phone.', es: 'Apuntando al suelo — levantá el teléfono.' },
  buried: { en: 'You are pointing at the ground — raise the phone.', es: 'Estás apuntando al suelo — levantá el teléfono.' },
} as const;

/** The two states, and how far below the horizon the phone has to point for each in a square 60° box. */
const AIMS = [
  { state: 'ground', altDeg: -10 },
  { state: 'buried', altDeg: -60 },
] as const;

const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function open(page: Page, prefs: { locale: CaptureLocale; theme: CaptureTheme; observer: Observer }): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ ...prefs, chartView: 'dome' })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
}

/** The glare pass's guide, open, at the shown instant. */
async function openDetail(page: Page, locale: CaptureLocale): Promise<Locator> {
  await page.goto('/');
  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
  const figure = guide(page).getByRole('figure');
  await expect(figure).toBeVisible();
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);
  return figure;
}

/** A reading from the phone: the W3C alpha for a back facing `azDeg`, tilted `altDeg` up; then one frame. */
async function point(page: Page, azDeg: number, altDeg: number): Promise<void> {
  await page.evaluate(
    ([alpha, beta]) => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta, gamma: 0, absolute: true }));
    },
    [(360 - azDeg) % 360, 90 + altDeg] as [number, number],
  );
  await page.clock.runFor(FRAME_MS);
}

/** Frames until the FR-WIN-3 smoothing has settled on the last reading. */
const settle = async (page: Page): Promise<void> => {
  await page.clock.runFor(40 * FRAME_MS);
};

test.describe('the phone pointed at the ground', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const { state, altDeg } of AIMS) {
    for (const theme of THEMES) {
      for (const locale of LOCALES) {
        test(`capture: the window ${altDeg}° below the horizon (${state}), 390 px, ${theme}, ${locale}`, async ({ page }) => {
          await stubCompass(page);
          await open(page, { locale, theme, observer: PARIS });
          const figure = await openDetail(page, locale);
          await figure.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] }).click();
          // The paused clock holds the lazy chunk's Suspense reveal (R32).
          await page.clock.runFor(1000);
          await expect(figure).toHaveAttribute('data-view', 'window');
          const w = figure.locator('[data-look-az]');
          await expect(w).toBeAttached();
          // Down the pass's own azimuth, so the sky the `ground` state still holds is the sky with the arc in it.
          const azDeg = Number(await w.getAttribute('data-look-az'));
          await point(page, azDeg, altDeg);
          await settle(page);
          await expect(w).toHaveAttribute('data-state', 'on');
          await expect(w).toHaveAttribute('data-ground', state);
          await expect(w).toHaveAttribute('data-look-alt', String(altDeg));

          const note = figure.getByTestId('window-ground-note');
          await expect(note).toHaveText(NOTE[state][locale]);
          await expect(note).toHaveAttribute('role', 'status');
          await expect(figure.locator(`[data-ground-veil="${state}"]`)).toBeAttached();
          // The `ground` state keeps drawing the sky above the horizon; the `buried` one has nothing to draw.
          await expect(figure.locator('[data-horizon]')).toHaveCount(state === 'ground' ? 1 : 0);
          await expect(figure.locator(`[data-drawing="window"] [data-pass-id="${GLARE_PASS}"]`)).toHaveCount(state === 'ground' ? 1 : 0);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await page.screenshot({ path: `${CAPTURE_DIR}/r56-window-390-${state}-${theme}-${locale}.png` });
        });
      }
    }
  }
});
