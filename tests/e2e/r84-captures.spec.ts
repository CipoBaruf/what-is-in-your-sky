/**
 * R84 captures (FR-FIRST-2, FR-FIRST-3, FR-FIRST-10 as amended v2.1): the
 * first run's controls.
 *
 *   CAPTURES=1 npx playwright test r84-captures --project=chromium
 *
 * Each in both themes and both languages:
 * - the cold open at 390 × 844 and 1280 × 800, its fields empty under their
 *   placeholders (F-73), and at 390 once a typed pair offers `[ continue ]`
 *   (F-86);
 * - the phone's third step at 390 × 844, whose first card is a control (F-84);
 * - the populated list at 390 × 844 and 1280 × 800: three-line cards with no
 *   Moon sentence (F-77) and the count line (F-78).
 *
 * Evidence for the PR, not a test. Off the pull-request path (FR-CI-1's
 * budget), like every other capture spec. The theme and the language are
 * seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';
import { NEUQUEN, STORED_RUN_FILE } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

type Theme = 'dark' | 'night';
type Locale = 'en' | 'es';

const THEMES: readonly Theme[] = ['dark', 'night'];
const LOCALES: readonly Locale[] = ['en', 'es'];
const STORED_RUN = JSON.parse(readFileSync(STORED_RUN_FILE, 'utf8')) as unknown;
const TYPED = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
const COORDS: Record<Locale, string> = { en: 'Coordinates · e.g. -38.93, -67.99', es: 'Coordenadas · p. ej. -38.93, -67.99' };
const CONTINUE: Record<Locale, string> = { en: 'continue', es: 'continuar' };

async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
}

/** A first visit with the run for the place the capture types already stored (R82's method). */
async function coldOpen(page: Page, theme: Theme, locale: Locale): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    ['wiys:prefs:v1', JSON.stringify({ locale, theme })] as [string, string],
  );
  await page.goto('/');
  await page.evaluate(async (run: unknown) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('wiys', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('elementGroups')) db.createObjectStore('elementGroups', { keyPath: 'group' });
        if (!db.objectStoreNames.contains('passRuns')) db.createObjectStore('passRuns', { keyPath: 'cellKey' });
      };
      request.onerror = () => {
        reject(new Error('could not open the wiys database'));
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('passRuns', 'readwrite');
        tx.objectStore('passRuns').put(run);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          reject(new Error('could not store the run'));
        };
      };
    });
  }, STORED_RUN);
  await expect(page.getByTestId('cold-open')).toBeVisible();
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the cold open at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await coldOpen(page, theme, locale);
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r84-cold-${label}-${theme}-${locale}.png`, fullPage: label === '390' });
      });
    }
  }
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the phone's where step with a typed pair and its third step at 390, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await coldOpen(page, theme, locale);
      await page.getByLabel(COORDS[locale]).fill(TYPED);
      const next = page.getByRole('button', { name: CONTINUE[locale] });
      await expect(next).toBeVisible();
      await settle(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r84-continue-390-${theme}-${locale}.png`, fullPage: true });
      await next.click();
      await expect(page.getByTestId('when-passes')).toHaveText(/^\d/, { timeout: 60_000 });
      await page.getByTestId('see-what').click();
      await expect(page.getByTestId('step-what').getByTestId('next-event')).toBeVisible();
      await settle(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r84-what-390-${theme}-${locale}.png`, fullPage: true });
    });
  }
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the populated list at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await seedStoredRun(page, { locale, prefs: { theme }, settled: true });
        if (size.width > 390) await expect(page.getByTestId('where-dome').locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
        await settle(page);
        if (label === '390') {
          await page.getByTestId('list-column').screenshot({ path: `${CAPTURE_DIR}/r84-list-390-${theme}-${locale}.png` });
        } else {
          await page.screenshot({ path: `${CAPTURE_DIR}/r84-list-1280-${theme}-${locale}.png` });
        }
      });
    }
  }
}
