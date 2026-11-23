/**
 * R203 (FR-OPEN-7; D-1180, D-1205): the example's pages each say so, with `Example: <city>, from your time zone ·
 * [ set your place ]` under the header. R212 (FR-LAND-1, FR-LAND-6; D-1230): the home and its doors are gone, so the
 * pages are the live page `/` opens and the satellites page (`#pass`) and the stars page, reached by address; the
 * control opens the settings page's place group. The settings page shows no place and no line.
 * At 390 × 844 and 1280 × 800, both languages; the zone, the clock and the elements are `firstRun.spec.ts`'s.
 */
import { expect, test, type Page } from '@playwright/test';
import { NINE_DAYS_ON, stubNetwork } from './liveHelpers';

const ZONE = 'America/Argentina/Buenos_Aires';
const WORDS = {
  en: { locale: 'en-GB', label: 'Example: Buenos Aires, from your time zone', control: 'set your place' },
  es: { locale: 'es-AR', label: 'Ejemplo: Buenos Aires, según tu zona horaria', control: 'elegí tu lugar' },
} as const;
const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

test.use({ serviceWorkers: 'block', timezoneId: ZONE });

/** The example on the live page `/` opens, its line drawn. */
async function openExample(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // The live page's follow question would stand over the line on a phone (v2.14.2); it is not this spec's.
    sessionStorage.setItem('wiys:followAsked:v1', '1');
  });
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.route('**/e', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await expect(page.getByTestId('example-notice')).toBeVisible({ timeout: 60_000 });
}

for (const lang of ['en', 'es'] as const) {
  const w = WORDS[lang];
  for (const viewport of SIZES) {
    const wide = viewport.width >= 964;
    test.describe(`${lang} at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
      test.use({ viewport, locale: w.locale });

      /** The pages the example opens, by address (R212: no door leads to them). */
      const PAGES = ['#live', '#pass', '#stars'] as const;

      test('FR-OPEN-7: every page opens for the example, with the line and its control', async ({ page }) => {
        test.setTimeout(180_000);
        await openExample(page);
        for (const hash of PAGES) {
          await page.evaluate((target) => {
            location.hash = target;
          }, hash);
          const line = page.getByTestId('example-notice');
          await expect(line, hash).toBeVisible({ timeout: 30_000 });
          await expect(line, hash).toContainText(w.label);
          // On a desk under the header: nothing of the page above it. The phone's sky pages are all sky and have none.
          if (wide) {
            const [header, box] = await Promise.all([page.locator('header').first().boundingBox(), line.boundingBox()]);
            expect(box?.y ?? 0, hash).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
          }
          // The page opened for the example, not its "needs a place".
          for (const id of ['live-set-place', 'stars-set-place', 'pass-set-place']) await expect(page.getByTestId(id), hash).toHaveCount(0);
          // D-1205: the wide stars page's globe lists no place under the example (nothing saved, so no Place group).
          if (wide && hash === '#stars') {
            await expect(page.getByTestId('globe-turn-row')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByTestId('globe-place')).toHaveCount(0);
          }
        }
        // The control: the settings page's place group (D-1230).
        await page.getByTestId('example-notice').getByRole('button', { name: w.control }).click();
        await expect(page).toHaveURL(/#settings$/);
        await expect(page.getByTestId('location-actions')).toBeVisible();
        await expect(page.getByTestId('example-notice')).toHaveCount(0);
      });

      test('FR-OPEN-7: the settings page shows no place and no line', async ({ page }) => {
        await openExample(page);
        // The phone's live page is all sky with no header (its sheet links settings); the hash is the same page.
        await page.evaluate(() => {
          location.hash = '#settings';
        });
        const field = page.getByRole('combobox').first();
        await expect(field).toBeVisible({ timeout: 30_000 });
        await expect(field).toHaveValue('');
        await expect(page.getByTestId('example-notice')).toHaveCount(0);
        await expect(page.getByRole('main')).not.toContainText('Buenos Aires');
      });
    });
  }
}
