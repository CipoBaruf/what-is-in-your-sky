/**
 * R20 (US-19, FR-THEME-1..3): the night theme is one attribute on the root
 * element, chosen from the header, saved, and applied before anything is
 * painted. The captures at the end are the both-themes × both-languages set
 * the task asks for, at the phone width.
 *
 * The fixtures are the R1 golden set, as in `language.spec.ts`, so the screen
 * behind the palette is the one every other capture shows.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;

/** The two `--bg` values of `tokens.css`, as `getComputedStyle` reports them. */
const DARK_BG = 'rgb(11, 15, 20)';
const NIGHT_BG = 'rgb(10, 2, 2)';
/** `--fg` in night mode: the red the whole page is written in (FR-THEME-3). */
const NIGHT_FG = 'rgb(255, 143, 125)';
/** What the canvas would be without `color-scheme: dark` — the flash the meta tag exists to prevent. */
const UA_LIGHT = 'rgb(255, 255, 255)';

test.use({ locale: 'en-GB', viewport: { width: 390, height: 844 } });

async function withFixtures(page: Page): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
}

interface Frame {
  theme: string | null;
  background: string;
}

/**
 * Samples the root element on every rendering opportunity until `data-theme` is
 * on it, that frame included. The script runs before any page script, so the
 * first sample is the first frame the browser would composite.
 *
 * The attribute cannot be guaranteed on that first frame: `main.tsx` is a
 * module script, which is deferred, so the browser may paint before it runs
 * (D-99). What FR-THEME-1 asks, and what these samples check, is that none of
 * the frames before it carries the *other* palette — `color-scheme: dark` and
 * a ground that hangs off `html[data-theme]` leave them on the UA's dark
 * canvas instead.
 */
async function recordFirstFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const frames: Frame[] = [];
    const window_ = window as unknown as { __frames: Frame[]; __framesDone: boolean };
    window_.__frames = frames;
    window_.__framesDone = false;
    const sample = (left: number): void => {
      requestAnimationFrame(() => {
        const html = document.documentElement;
        const theme = html.getAttribute('data-theme');
        frames.push({ theme, background: getComputedStyle(html).backgroundColor });
        if (theme !== null || left <= 1) window_.__framesDone = true;
        else sample(left - 1);
      });
    };
    sample(120);
  });
}

async function firstFrames(page: Page): Promise<Frame[]> {
  await page.waitForFunction(() => (window as unknown as { __framesDone: boolean }).__framesDone);
  return page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
}

test('the header switch turns the page red on black, and the choice survives a reload', async ({ page }) => {
  await withFixtures(page);
  await recordFirstFrames(page);
  await page.goto('/');

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveCSS('background-color', DARK_BG);

  const themes = page.getByRole('group', { name: 'Theme' });
  await expect(themes.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await themes.getByRole('button', { name: 'Night' }).click();

  // FR-THEME-1: the attribute is the whole mechanism, and nothing reloads to apply it.
  await expect(html).toHaveAttribute('data-theme', 'night');
  await expect(html).toHaveCSS('background-color', NIGHT_BG);
  await expect(html).toHaveCSS('color', NIGHT_FG);
  await expect(themes.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true');

  // FR-THEME-1: saved, and no frame of the next visit is painted in the other palette.
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'night');
  await expect(html).toHaveCSS('background-color', NIGHT_BG);
  const frames = await firstFrames(page);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.at(-1)?.theme).toBe('night'); // the attribute lands, and these are the frames before it
  for (const frame of frames) {
    expect(frame.background).not.toBe(DARK_BG); // the acceptance: no dark-palette frame is painted first
    expect(frame.background).not.toBe(UA_LIGHT); // nor a white one: `color-scheme: dark` holds the canvas
  }
});

test('night mode reaches the pass list and the guide sheet, in both languages', async ({ page }) => {
  await withFixtures(page);
  await page.goto('/');
  const html = page.locator('html');

  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Night' }).click();
  await page.screenshot({ path: 'test-results/r20-home-390-night-en.png', fullPage: true });

  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);
  const passes = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(passes).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/r20-passes-390-night-en.png', fullPage: true });

  // The sheet makes the header inert, so it carries its own switches (D-94 and R20).
  await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
  const dialog = page.getByRole('dialog').first();
  await expect(dialog.getByRole('figure')).toBeVisible();
  await page.screenshot({ path: 'test-results/r20-detail-390-night-en.png' });

  // FR-I18N-2 / FR-THEME-1: the two preferences are independent, and both switches work from here.
  await dialog.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  await expect(html).toHaveAttribute('lang', 'es');
  await expect(html).toHaveAttribute('data-theme', 'night');
  await page.screenshot({ path: 'test-results/r20-detail-390-night-es.png' });

  await dialog.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Oscuro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('lang', 'es');
  await page.screenshot({ path: 'test-results/r20-detail-390-dark-es.png' });

  await dialog.getByRole('button', { name: /Volver a la lista/ }).click();
  await page.screenshot({ path: 'test-results/r20-passes-390-dark-es.png', fullPage: true });

  await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Nocturno' }).click();
  await expect(html).toHaveCSS('background-color', NIGHT_BG);
  await page.screenshot({ path: 'test-results/r20-passes-390-night-es.png', fullPage: true });

  // Back to English on the same palette: dark × en is the fourth of the four combinations.
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click();
  await expect(html).toHaveAttribute('lang', 'en');
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
  await expect(html).toHaveCSS('background-color', DARK_BG);
  await page.screenshot({ path: 'test-results/r20-passes-390-dark-en.png', fullPage: true });
});
