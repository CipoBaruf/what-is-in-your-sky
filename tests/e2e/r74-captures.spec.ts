/**
 * R74 captures (FR-MARK-4 a and b, FR-MARK-8 e): the mark in both headers.
 *
 *   CAPTURES=1 npx playwright test r74-captures --project=chromium
 *
 * Four pictures of the header itself — the compact row at 390 px and the wide
 * title line at 1280 px, in both themes, in English — and one of each page
 * behind it, so the mark is seen both at 1 : 1 and in the room it lives in.
 * The icons and the favicon are not shot here: they are files in `public/`,
 * rendered by the same run that wrote the rasters (D-440), and the PR opens
 * them directly.
 *
 * Evidence for the PR, not a test: the two assertions are only there so a file
 * cannot end up being a picture of a header whose mark had not loaded. Off the
 * pull-request path (FR-CI-1's budget), like every other capture spec.
 *
 * The place is the suite's Neuquén fixture and the clock is paused, so the row
 * beside the mark is the same in every shot; the theme is seeded in
 * `wiys:prefs:v1` and never clicked (D-70). The bead is drawn at frame 0: the
 * clock is paused, so the timer never fires and the picture is the same every
 * run.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { FIXTURE_DATE, NEUQUEN } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const PREFS_KEY = 'wiys:prefs:v1';
/** Nine days on from the fixtures' capture, the instant the page specs run at. */
const CLOCK = Date.parse(`${FIXTURE_DATE}T21:00:00Z`) + 9 * 86_400_000;
const VIEWPORTS = { 390: { width: 390, height: 844 }, 1280: { width: 1280, height: 800 } } as const;

async function openHome(page: Page, width: 390 | 1280, theme: 'dark' | 'night'): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', theme, observer: NEUQUEN })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
  await page.goto('/');
  await expect(page.getByTestId('iss-hero')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await page.mouse.move(0, 0);
}

const shoot = async (page: Page, width: 390 | 1280, theme: 'dark' | 'night'): Promise<void> => {
  await openHome(page, width, theme);
  const mark = page.getByTestId('mark');
  await expect(mark).toHaveAttribute('data-mark-tier', 'header32');
  // FR-MARK-4: one `--row` tall, so neither header grows a line for it.
  const box = await mark.boundingBox();
  if (!box) throw new Error('the mark is not laid out');
  expect(box.height).toBeCloseTo(24, 0);
  expect(box.width).toBeCloseTo(24, 0);
  await page.getByTestId('header').screenshot({ path: `${CAPTURE_DIR}/r74-header-${String(width)}-${theme}-en.png` });
  if (theme === 'dark') await page.screenshot({ path: `${CAPTURE_DIR}/r74-home-${String(width)}-${theme}-en.png` });
};

for (const width of [390, 1280] as const) {
  for (const theme of ['dark', 'night'] as const) {
    test(`the header at ${String(width)} px, ${theme}, en: the mark before the title`, async ({ page }) => {
      await shoot(page, width, theme);
    });
  }
}
