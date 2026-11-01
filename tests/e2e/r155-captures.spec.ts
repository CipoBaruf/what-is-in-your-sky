/**
 * R155 (FR-LOOK-1..9, US-47; D-974, D-982..D-985): the review captures of the
 * look's second pass — the stars page's window over Neuquén on the fixture
 * night at 390 px, turned to SW 35° up where Scorpius and Ara stand, at the
 * default field and pinched to 20°, in both themes (the eight tokens have
 * night values); the same at 1280 px in the dark theme; and the live page's
 * window at 1280 px turned south and tilted up, where the night's gibbous
 * Moon stands, for the disc with its phase. No text changed, so English alone.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Theme } from '../../src/model';
import { CAPTURE_DIR } from './captureSet';
import { FIXTURE_DATE, NEUQUEN, NINE_DAYS_ON, PARIS } from './observers';
import { pinch } from './windowZoom';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

/** The stars page as `window-zoom.spec.ts` opens it, in `theme`, turned to SW 35° up with the deep chunk in. */
async function openStars(page: Page, viewport: { width: number; height: number }, theme: Theme): Promise<void> {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', theme, observer: NEUQUEN })] as [string, string],
  );
  await page.goto('/#stars');
  const w = page.getByTestId('stars-sky').locator('[data-look-az]');
  await expect(w).toHaveAttribute('data-state', 'hand');
  const box = w.locator('div[data-dragging]');
  await box.focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
  await expect(w).toHaveAttribute('data-look-az', '225');
  await expect(w.locator('[data-layer="stars"]')).toHaveAttribute('data-deep', /^[1-9]\d*$/, { timeout: 30_000 });
  await expect.poll(() => w.locator('[data-deep-pool] > circle:not([visibility="hidden"])').count()).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
}

test.describe('the stars page’s window', () => {
  for (const theme of ['dark', 'night'] as const) {
    test(`390 px, SW 35° up, at 60° and at 20°, ${theme}`, async ({ page }) => {
      await openStars(page, { width: 390, height: 844 }, theme);
      await page.screenshot({ path: `${CAPTURE_DIR}/r155-stars-390-window-60-${theme}-en.png` });
      const w = page.getByTestId('stars-sky').locator('[data-look-az]');
      await pinch(w.locator('div[data-dragging]'), 40, 120);
      await expect(w).toHaveAttribute('data-fov', '20');
      await expect.poll(() => w.locator('[data-star-name][visibility="visible"]').count()).toBeGreaterThan(0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r155-stars-390-window-20-${theme}-en.png` });
    });
  }

  test('1280 px, SW 35° up, at 60°, dark', async ({ page }) => {
    await openStars(page, { width: 1280, height: 800 }, 'dark');
    await page.screenshot({ path: `${CAPTURE_DIR}/r155-stars-1280-window-60-dark-en.png` });
  });
});

test.describe('the live page’s window', () => {
  test('1280 px, facing south, the Moon’s disc with its phase, dark', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(
      ([key, value]: [string, string]) => {
        localStorage.setItem(key, value);
      },
      [PREFS_KEY, JSON.stringify({ locale: 'en', theme: 'dark', observer: PARIS, chartView: 'window' })] as [string, string],
    );
    await page.route('https://celestrak.org/**', async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
    for (const pattern of EXTERNAL.slice(1)) await page.route(pattern, (route) => route.abort('failed'));
    const clock = Date.parse('2026-09-02T03:00:00Z');
    await page.clock.install({ time: clock });
    await page.clock.pauseAt(clock);
    await page.goto('/');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
    await page.getByTestId('live-link').click();
    await expect
      .poll(async () => {
        await page.clock.runFor(200);
        return page.getByTestId('sky-chart').count();
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await page.clock.runFor(1000);
    const w = page.getByTestId('sky-chart').locator('[data-look-az]');
    await expect(w).toHaveAttribute('data-state', 'hand');
    // The Moon at the instant is at S 164°, 60° up (`physics/moon.ts`): the window turns south and tilts up to 55°.
    await w.locator('div[data-dragging]').focus();
    // The live window opens at the next rise's tilt (FR-FLOW-14), so it is stepped up until it reads 55°.
    for (let i = 0; i < 14 && (await w.getAttribute('data-look-alt')) !== '55'; i += 1) await page.keyboard.press('ArrowUp');
    await page.getByRole('group', { name: 'Facing' }).getByRole('button', { name: 'S', exact: true }).click();
    await page.clock.runFor(200);
    await expect(w).toHaveAttribute('data-look-az', '180');
    await expect(w).toHaveAttribute('data-look-alt', '55');
    await expect(w.locator('[data-body="moon"]')).toHaveAttribute('data-in-view', 'true');
    await expect(w.locator('[data-layer="stars"]')).toHaveAttribute('data-deep', /^[1-9]\d*$/, { timeout: 30_000 });
    await page.clock.runFor(1000);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r155-live-1280-window-moon-dark-en.png` });
  });
});
