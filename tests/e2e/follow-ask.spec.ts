/**
 * v2.14.2 (FR-PHONE-17, V214-39..V214-44; D-1142..D-1144): a phone page asks before it follows the phone, at 390 × 844
 * in both languages, under `stubOrientation` with and without a motion request. The live page, the stars page and
 * the pass detail each show "Use your phone to look at the sky?" — at load where a request exists (iOS), at the first
 * reading with a north where none does (Android) — focus on `[ allow ]`; `[ allow ]` asks once inside its click and
 * follows, `[ not now ]` and `Esc` leave the page as it opened. Once answered, the other pages and a reload in the
 * tab do not ask again; a wide window never asks. Axe on the open dialog.
 *
 *   npx playwright test follow-ask --project=chromium
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedStoredRun } from './liveHelpers';
import { aimedAt, orientationAsks, stubOrientation } from './orientation';

type Locale = 'en' | 'es';
type Which = 'live' | 'stars' | 'detail';

const WORDS = {
  en: { question: 'Use your phone to look at the sky?', allow: 'allow', notNow: 'not now', openGuide: /Open guide/ },
  es: { question: '¿Usar el teléfono para mirar el cielo?', allow: 'permitir', notNow: 'ahora no', openGuide: /Abrir la guía/ },
} as const;
const PAGES: readonly Which[] = ['live', 'stars', 'detail'];

/** The page as a reader opens it from a settled home, the dome the saved view; returns the page's layout. */
async function openPage(page: Page, which: Which, locale: Locale): Promise<Locator> {
  await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome' } });
  switch (which) {
    case 'live':
      await page.evaluate(() => {
        window.location.hash = '#live';
      });
      return page.getByTestId('live-layout');
    case 'stars':
      await page.evaluate(() => {
        window.location.hash = '#stars';
      });
      return page.getByTestId('stars-layout');
    case 'detail':
      await page.locator('article[data-pass-id]').first().getByRole('button', { name: WORDS[locale].openGuide }).click();
      return page.getByTestId('pass-layout');
  }
}

const question = (page: Page): Locator => page.getByTestId('follow-ask');
const control = (root: Locator): Locator => root.getByTestId('live-follow-control');

for (const locale of ['en', 'es'] as const) {
  const words = WORDS[locale];
  test.describe(`the follow question at 390 × 844, ${locale} (FR-PHONE-17)`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    for (const which of PAGES) {
      test(`${which}, iOS: asks at load, focus on allow, no axe violation; allow asks once and follows`, async ({ page }) => {
        await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)] });
        const root = await openPage(page, which, locale);
        const shown = page.getByRole('dialog', { name: words.question });
        await expect(shown).toBeVisible({ timeout: 30_000 });
        await expect(shown).toHaveAttribute('aria-modal', 'true');
        await expect(shown.getByRole('button')).toHaveText([words.allow, words.notNow]);
        await expect(page.getByTestId('follow-ask-allow')).toBeFocused();
        expect(await orientationAsks(page)).toBe(0);
        const results = await new AxeBuilder({ page }).include('[data-testid="follow-ask"]').analyze();
        expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
        await page.getByTestId('follow-ask-allow').click();
        await expect(question(page)).toHaveCount(0);
        expect(await orientationAsks(page)).toBe(1);
        await expect(control(root)).toHaveAttribute('aria-pressed', 'true');
        await expect(root.locator('[data-follow="true"]').first()).toBeAttached({ timeout: 15_000 });
      });

      test(`${which}, iOS: not now asks nothing and leaves following off; a reload in the tab does not ask again`, async ({ page }) => {
        await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)] });
        const root = await openPage(page, which, locale);
        await expect(question(page)).toBeVisible({ timeout: 30_000 });
        await page.getByTestId('follow-ask-not-now').click();
        await expect(question(page)).toHaveCount(0);
        expect(await orientationAsks(page)).toBe(0);
        await expect(control(root)).toHaveAttribute('aria-pressed', 'false');
        await page.reload();
        await expect(root).toBeAttached({ timeout: 30_000 });
        await expect(control(root)).toBeAttached();
        await expect(question(page)).toHaveCount(0);
      });
    }

    test('Android: asks at the first reading with a north; Esc is not now, and the next page does not ask', async ({ page }) => {
      await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)], request: false });
      const root = await openPage(page, 'live', locale);
      await expect(question(page)).toBeVisible({ timeout: 30_000 });
      await page.keyboard.press('Escape');
      await expect(question(page)).toHaveCount(0);
      await expect(root).toBeVisible();
      await expect(control(root)).toHaveAttribute('aria-pressed', 'false');
      await expect(root.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
      await page.evaluate(() => {
        window.location.hash = '#stars';
      });
      const stars = page.getByTestId('stars-layout');
      await expect(control(stars)).toBeAttached({ timeout: 30_000 });
      await expect(question(page)).toHaveCount(0);
      await expect(control(stars)).toHaveAttribute('aria-pressed', 'false');
    });

    test('Android: allow follows at once and saves the allow, so the next visit follows unasked', async ({ page }) => {
      await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)], request: false });
      const root = await openPage(page, 'stars', locale);
      await expect(question(page)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('follow-ask-allow').click();
      await expect(control(root)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { followGranted?: boolean }).followGranted)).toBe(true);
      // A later visit: a new session.
      await page.evaluate(() => {
        sessionStorage.clear();
      });
      await page.reload();
      await expect(control(root)).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
      await expect(question(page)).toHaveCount(0);
    });
  });
}

test.describe('the follow question on wide (FR-PHONE-17)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test('a wide window never asks, with or without a request', async ({ page }) => {
    await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)] });
    const root = await openPage(page, 'live', 'en');
    await expect(root).toBeVisible({ timeout: 30_000 });
    await expect(root.getByTestId('follow-toggle')).toBeAttached();
    await expect(question(page)).toHaveCount(0);
  });
});
