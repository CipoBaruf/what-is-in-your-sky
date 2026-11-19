/**
 * R203 (FR-OPEN-7; D-1180, D-1205): from the example, each door and each of the header's links opens its page for the
 * example, with `Example: <city>, from your time zone · [ set your place ]` under the header; the control brings the
 * home back with the place question open over the example (`[ back ]`). The settings page shows no place and no line.
 * At 390 × 844 and 1280 × 800, both languages; the zone, the clock and the elements are `firstRun.spec.ts`'s.
 */
import { expect, test, type Page } from '@playwright/test';
import { NINE_DAYS_ON, stubNetwork } from './liveHelpers';

const ZONE = 'America/Argentina/Buenos_Aires';
const WORDS = {
  en: { locale: 'en-GB', label: 'Example: Buenos Aires, from your time zone', control: 'set your place', back: 'back', question: 'Where will you be looking from?' },
  es: { locale: 'es-AR', label: 'Ejemplo: Buenos Aires, según tu zona horaria', control: 'elegí tu lugar', back: 'volver', question: '¿Desde dónde se va a mirar?' },
} as const;
const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

test.use({ serviceWorkers: 'block', timezoneId: ZONE });

/** The example with its pass on screen: the satellites door names the pass. */
async function openExample(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // The live page's follow question would stand over the line on a phone (v2.14.2); it is not this spec's.
    sessionStorage.setItem('wiys:followAsked:v1', '1');
  });
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.route('**/e', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await expect(page.getByTestId('door-satellites')).toHaveAttribute('href', /^#pass=/, { timeout: 60_000 });
}

for (const lang of ['en', 'es'] as const) {
  const w = WORDS[lang];
  for (const viewport of SIZES) {
    const wide = viewport.width >= 964;
    test.describe(`${lang} at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
      test.use({ viewport, locale: w.locale });

      /** Each way off the home: the three doors, then the header's page links (the phone's header has `[ live ]` alone). */
      const WAYS = ['door-satellites', 'door-stars', 'door-live', 'live-link', ...(wide ? ['stars-link'] : [])] as const;

      test('FR-OPEN-7: every door and header link opens its page for the example, with the line and its control', async ({ page }) => {
        test.setTimeout(180_000);
        await openExample(page);
        for (const way of WAYS) {
          await page.getByTestId(way).first().click();
          const line = page.getByTestId('example-notice');
          await expect(line, way).toBeVisible({ timeout: 30_000 });
          // The wide live page asks about the first pass once per visit (FR-WIDE-13), its first opening; staying keeps the page.
          if (wide && way === 'door-live') await page.getByTestId('first-pass-stay').click();
          await expect(line, way).toContainText(w.label);
          // Under the header: nothing of the page above it.
          const [header, box] = await Promise.all([page.locator('header').first().boundingBox(), line.boundingBox()]);
          expect(box?.y ?? 0, way).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
          // The page opened for the example, not its "needs a place".
          for (const id of ['live-set-place', 'stars-set-place']) await expect(page.getByTestId(id), way).toHaveCount(0);
          // D-1205: the wide stars page's globe lists no place under the example (nothing saved, so no Place group).
          if (wide && way === 'door-stars') {
            await expect(page.getByTestId('globe-turn-row')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByTestId('globe-place')).toHaveCount(0);
          }

          // The control: the home, the question open over the example, `[ back ]` to it.
          await line.getByRole('button', { name: w.control }).click();
          // The phone's question is a screen of its own; on wide the group opens in the Where pane (FR-OPEN-5).
          if (wide) await expect(page.getByTestId('reading-where').getByTestId('location-group'), way).toBeVisible();
          else await expect(page.getByTestId('cold-open').getByRole('heading', { level: 2, name: w.question }), way).toBeVisible();
          await expect(page.getByTestId('place-back'), way).toBeVisible();
          await expect(page.getByTestId('example-notice')).toHaveCount(0);
          expect(await page.evaluate(() => window.location.hash), way).toBe('');
          await page.getByTestId('place-back').click();
          await expect(page.getByTestId('door-satellites'), way).toBeVisible();
        }
      });

      test('FR-OPEN-7: the settings page shows no place and no line', async ({ page }) => {
        await openExample(page);
        await page.getByTestId('settings-link').first().click();
        const field = page.getByRole('combobox').first();
        await expect(field).toBeVisible({ timeout: 30_000 });
        await expect(field).toHaveValue('');
        await expect(page.getByTestId('example-notice')).toHaveCount(0);
        await expect(page.getByRole('main')).not.toContainText('Buenos Aires');
      });
    });
  }
}
