/**
 * R97 (FR-FAINT-2, FR-FAINT-3, FR-FAINT-4, US-34 AC2..AC3): the faint control
 * on the stored Neuquén run, which has five passes fainter than `FAINT_MAG`
 * (`src/lib/faint.test.ts` pins which). The control shows them and hides them,
 * the choice survives a reload, and a faint pass's `#pass` link opens it with
 * faint passes hidden.
 */
import { expect, test, type Page } from '@playwright/test';
import { seedStoredRun, STORED_RUN } from './liveHelpers';

const DESK = { width: 1280, height: 720 };
// Five of the run are fainter than +3.5; the first, SL-16 R/B at +3.55, is the next event at the seed's instant and is kept.
const FAINT_COUNT = 4;
// Titan 4B R/B at +4.46 on the second night: faint, not the ISS, and not the next event.
const FAINT_PASS = '26474-1789203849375';

const cards = (page: Page) => page.locator('article[data-pass-card]');
const faintCards = (page: Page) => page.locator('article[data-pass-card]:has([data-testid="card-faint"])');

test.use({ viewport: DESK });

test('the control shows the faint passes in place and hides them, and the choice holds across a reload (US-34 AC2, AC3)', async ({ page }) => {
  expect(STORED_RUN.passes.some((pass) => (pass as { id: string }).id === FAINT_PASS)).toBe(true);
  await seedStoredRun(page, { settled: true });
  const toggle = page.getByTestId('faint-toggle');
  await expect(toggle).toHaveText(`show ${String(FAINT_COUNT)} faint`);
  const hidden = await cards(page).count();
  await expect(faintCards(page)).toHaveCount(0);
  await expect(page.locator(`article[data-pass-id="${FAINT_PASS}"]`)).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveText(`hide ${String(FAINT_COUNT)} faint`);
  await expect(cards(page)).toHaveCount(hidden + FAINT_COUNT);
  await expect(faintCards(page)).toHaveCount(FAINT_COUNT);
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { showFaint?: boolean }).showFaint)).toBe(true);

  await page.reload();
  await expect(page.getByTestId('faint-toggle')).toHaveText(`hide ${String(FAINT_COUNT)} faint`, { timeout: 30_000 });
  await expect(faintCards(page)).toHaveCount(FAINT_COUNT);

  await page.getByTestId('faint-toggle').click();
  await expect(page.getByTestId('faint-toggle')).toHaveText(`show ${String(FAINT_COUNT)} faint`);
  await page.reload();
  await expect(page.getByTestId('faint-toggle')).toHaveText(`show ${String(FAINT_COUNT)} faint`, { timeout: 30_000 });
  await expect(faintCards(page)).toHaveCount(0);
});

test('a faint pass’s #pass link opens that pass with faint passes hidden (FR-FAINT-3)', async ({ page }) => {
  await seedStoredRun(page, { settled: true });
  await expect(page.getByTestId('faint-toggle')).toHaveText(`show ${String(FAINT_COUNT)} faint`);
  await page.goto(`/#pass=${FAINT_PASS}`);
  await page.reload();
  const card = page.locator(`article[data-pass-id="${FAINT_PASS}"]`);
  // The open pass is never faint (FR-FAINT-1), so it is an ordinary card, marked as open; the other three stay hidden.
  await expect(card).toHaveAttribute('data-selected', 'true', { timeout: 30_000 });
  await expect(card.getByTestId('card-faint')).toHaveCount(0);
  await expect(faintCards(page)).toHaveCount(0);
  await expect(page.getByTestId('faint-toggle')).toHaveText(`show ${String(FAINT_COUNT - 1)} faint`);
  await expect(page.getByTestId('guide-panel')).toContainText('Titan 4B R/B');
});
