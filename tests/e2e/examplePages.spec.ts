/**
 * R203 (FR-OPEN-7; D-1180, D-1205), R212 (FR-LAND-1, FR-LAND-6; D-1230): every page opens for the example — the live
 * page `/` opens, and the satellites page (`#pass`), by address (the stars page folded into live in R222). R215 (FR-LAND-4, FR-OPEN-7 as amended;
 * D-1238): the line under the header is gone; on a desk every page's header reads `Buenos Aires · example  change`, on
 * a phone the satellites list's head does, and `change` opens the place dialog. The settings page shows no place.
 * At 390 × 844 and 1280 × 800, both languages; the zone, the clock and the elements are `firstRun.spec.ts`'s.
 */
import { expect, test, type Page } from '@playwright/test';
import { NINE_DAYS_ON, stubNetwork } from './liveHelpers';

const ZONE = 'America/Argentina/Buenos_Aires';
const WORDS = {
  en: { locale: 'en-GB', example: 'example', change: 'change' },
  es: { locale: 'es-AR', example: 'ejemplo', change: 'cambiar' },
} as const;
const CITY = 'Buenos Aires';
const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

test.use({ serviceWorkers: 'block', timezoneId: ZONE });

/** The example on the live page `/` opens. */
async function openExample(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // The live page's follow question would stand over the page on a phone (v2.14.2); it is not this spec's.
    sessionStorage.setItem('wiys:followAsked:v1', '1');
  });
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.route('**/e', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 60_000 });
}

const goTo = async (page: Page, hash: string): Promise<void> => {
  await page.evaluate((target) => {
    location.hash = target;
  }, hash);
};

for (const lang of ['en', 'es'] as const) {
  const w = WORDS[lang];
  for (const viewport of SIZES) {
    const wide = viewport.width >= 964;
    test.describe(`${lang} at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
      test.use({ viewport, locale: w.locale });

      /** The pages the example opens, by address (R212: no door leads to them). */
      const PAGES = ['#live', '#pass'] as const;

      test('FR-OPEN-7, FR-LAND-4: every page opens for the example, its place line reading it, and change opens the dialog', async ({ page }) => {
        test.setTimeout(180_000);
        await openExample(page);
        for (const hash of PAGES) {
          await goTo(page, hash);
          // The page opened for the example, not its "needs a place".
          await expect(page.getByRole('main'), hash).toBeVisible({ timeout: 30_000 });
          for (const id of ['live-set-place', 'pass-set-place']) await expect(page.getByTestId(id), hash).toHaveCount(0);
          // On a desk the header's place line on every page; on a phone the satellites list's head.
          if (wide || hash === '#pass') {
            const line = page.getByTestId('place-line').first();
            await expect(line, hash).toBeVisible({ timeout: 30_000 });
            await expect(line, hash).toHaveAttribute('data-place', 'example');
            await expect(line, hash).toContainText(CITY);
            await expect(line, hash).toContainText(w.example);
          }
          // D-1205: the wide globe lists no place under the example (nothing saved, so no Place group); on #live since R222.
          if (wide && hash === '#live') {
            await expect(page.getByTestId('globe-turn-row')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByTestId('globe-place')).toHaveCount(0);
          }
        }
        // `change` opens the place dialog over the page, with no route change (D-1238).
        await goTo(page, '#pass');
        const change = page.getByTestId('place-change').first();
        await expect(change).toBeVisible({ timeout: 30_000 });
        // On a desk a bare `#pass` becomes the pass `[ satellites ]` names once the passes are in (V214-35): read the address after.
        if (wide) await expect(page).toHaveURL(/#pass=\d+-\d+$/, { timeout: 30_000 });
        const before = page.url();
        await change.click();
        await expect(page.getByTestId('place-dialog')).toBeVisible();
        expect(page.url()).toBe(before);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('place-dialog')).toHaveCount(0);
      });

      test('FR-OPEN-7: the settings page shows no place', async ({ page }) => {
        await openExample(page);
        await goTo(page, '#settings');
        const field = page.getByRole('combobox').first();
        await expect(field).toBeVisible({ timeout: 30_000 });
        await expect(field).toHaveValue('');
        await expect(page.getByRole('main')).not.toContainText(CITY);
      });
    });
  }
}
