/**
 * R17 (US-13, FR-I18N-1..6): the whole app in Spanish for a Spanish browser,
 * switched from the header without a reload, and remembered. The clock, the
 * observer and the CelesTrak fixtures are the R1 golden set, so the pass on
 * screen is the one `src/lib/phrases.test.ts` pins the golden sentence for,
 * in both languages.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const golden = JSON.parse(readFileSync('tests/fixtures/guide-sentences.json', 'utf8')) as Record<'en' | 'es', { asComputed: string }>;
const DAY_MS = 86_400_000;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;

const EN_TITLE = 'What is in your sky right now';
const ES_TITLE = 'Qué hay en el cielo ahora mismo';

// FR-I18N-1: the browser reports `es-AR`, so the first visit is Spanish without any saved preference.
test.use({ locale: 'es-AR', viewport: { width: 390, height: 844 } });

async function withFixtures(page: Page): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // Without a forecast the zone stays unknown and times stay in UTC, which is what the golden sentences are written in.
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
}

/** Frames the chart's caption and the numeric table under it. The sheet scrolls itself, and the wide table scrolls inside it — that inner scroll is reset, or the columns land off-screen. */
async function showNumbers(dialog: Locator): Promise<void> {
  await dialog.getByRole('table').scrollIntoViewIfNeeded();
  await dialog.getByRole('table').evaluate((table) => table.parentElement?.scrollTo(0, 0));
}

test('a Spanish browser gets a Spanish app, and the header switch changes it without a reload', async ({ page }) => {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(pass.start.t)}`;
  await withFixtures(page);
  await page.goto('/');

  // FR-I18N-5: the document follows the language, from the first render.
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page).toHaveTitle(ES_TITLE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ES_TITLE);
  await expect(page.getByRole('region', { name: 'Próximos pases' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ahora mismo' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('Sin analítica ni rastreo');
  // No English left anywhere on the empty screen.
  await expect(page.locator('body')).not.toContainText('Enter a place name');
  await page.screenshot({ path: 'test-results/r17-home-390-es.png', fullPage: true });

  await page.getByLabel('Coordenadas (lat, lon)').fill(NEUQUEN);
  const passes = page.getByRole('region', { name: 'Próximos pases' }).getByRole('status');
  await expect(passes).toHaveText(/\d+ pases visibles en las próximas 72 h/, { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/r17-passes-390-es.png', fullPage: true });

  // The guide sheet: the FR-GUIDE-1 sentence is the Spanish golden one, times and numbers included.
  const card = page.locator(`article[data-pass-id="${passId}"]`);
  await card.getByRole('button', { name: /Abrir la guía/ }).click();
  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(dialog.getByTestId('guide-sentence')).toHaveText(golden.es.asComputed);
  // The capture is only evidence once the lazy chart chunk has drawn: its caption and labels are translated too.
  // The sheet is a fixed overlay, so these two are viewport captures — a fullPage one stretches the document and clips it.
  const track = dialog.locator(`svg[data-drawing="polar"] [data-pass-id="${passId}"] [data-anchor="pass"]`);
  await expect(track).toContainText('ISS (Zarya)');
  await expect(dialog.getByRole('figure')).toContainText('Vista al cielo: el este a la izquierda');
  await page.screenshot({ path: 'test-results/r17-detail-390-es.png' });
  // Further down the sheet: the chart's caption and the numeric table, which carry translated text of their own.
  await showNumbers(dialog);
  await page.screenshot({ path: 'test-results/r17-numbers-390-es.png' });
  await dialog.evaluate((el) => el.scrollTo(0, 0)); // back to the top of the sheet, so the next capture frames the same thing

  // FR-I18N-5: switching keeps the observer and the open pass, and never reloads — a marker on `window` survives it.
  await page.evaluate(() => {
    (window as unknown as { __wiys: boolean }).__wiys = true;
  });
  await dialog.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click();
  await expect(dialog.getByTestId('guide-sentence')).toHaveText(golden.en.asComputed);
  expect(await page.evaluate(() => (window as unknown as { __wiys?: boolean }).__wiys)).toBe(true);
  await expect(page).toHaveTitle(EN_TITLE);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`)); // D-13: the selection is untouched
  await expect(dialog.getByRole('heading', { name: 'ISS (Zarya)' })).toBeVisible();
  await expect(track).toContainText('ISS (Zarya)');
  await expect(dialog.getByRole('figure')).toContainText('Looking up: east on the left');
  await page.screenshot({ path: 'test-results/r17-detail-390-en.png' });
  await showNumbers(dialog);
  await page.screenshot({ path: 'test-results/r17-numbers-390-en.png' });
  await dialog.evaluate((el) => el.scrollTo(0, 0));

  // Back on the list, the observer is the one that was typed and the screen is English throughout.
  await dialog.getByRole('button', { name: /Back to the list/ }).click();
  await expect(page.getByLabel('Coordinates (lat, lon)')).toHaveValue(NEUQUEN);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/);
  await page.screenshot({ path: 'test-results/r17-passes-390-en.png', fullPage: true });
});

test('the chosen language survives a reload, browser preference notwithstanding', async ({ page }) => {
  await withFixtures(page);
  await page.goto('/');
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(EN_TITLE);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle(EN_TITLE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(EN_TITLE);
  await page.screenshot({ path: 'test-results/r17-home-390-en.png', fullPage: true });

  // And back: Spanish is saved the same way.
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ES_TITLE);
});
