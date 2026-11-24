/**
 * R225 (FR-CTRL-10, US-65 AC7): one scroll per column. Every page — the list, the live page (its sheet open on a
 * phone), the pass detail and the settings page — at 1280 × 800, 1024 × 700 and 390 × 844 has no element whose
 * `overflow-y` is `auto` or `scroll` and whose content is taller than its box inside an ancestor that is the same.
 *
 *   npx playwright test one-scroll --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { openSheet, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1024, height: 700 },
  { width: 390, height: 844 },
] as const;

type Walked = 'list' | 'live' | 'pass' | 'settings';
const PAGES: readonly Walked[] = ['list', 'live', 'pass', 'settings'];

/** Opens one page settled, with the stored run's sky; the phone's sky pages with their sheet open. */
async function open(page: Page, which: Walked): Promise<void> {
  if (which === 'settings') {
    await page.clock.setFixedTime(NINE_DAYS_ON);
    await page.addInitScript((value: string) => {
      if (localStorage.getItem('wiys:prefs:v1') === null) localStorage.setItem('wiys:prefs:v1', value);
    }, JSON.stringify({ locale: 'en', observer: NEUQUEN }));
    await page.goto('/#settings');
    await expect(page.getByTestId('settings-browser')).toBeVisible({ timeout: 30_000 });
    return;
  }
  await seedStoredRun(page, { settled: true });
  if (which === 'list') {
    await expect(page.locator('article[data-pass-id]').first()).toBeVisible({ timeout: 30_000 });
    return;
  }
  if (which === 'live') {
    await page.goto('/#live');
    await page.reload();
    await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
  } else {
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
    await expect(page.getByTestId('pass-layout')).toBeAttached({ timeout: 30_000 });
  }
  await expect(page.locator('[data-slot="drawing"]').first()).toBeAttached({ timeout: 30_000 });
  await openSheet(page);
}

/** Every scrolling element with an overflow that sits inside another, named by its test id or its class. */
async function nestedScrolls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scrolls = (el: Element): boolean => {
      const { overflowY } = getComputedStyle(el);
      return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    };
    const name = (el: Element): string => el.getAttribute('data-testid') ?? (el.className && typeof el.className === 'string' ? `${el.tagName.toLowerCase()}.${el.className}` : el.tagName.toLowerCase());
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (!scrolls(el)) continue;
      for (let up = el.parentElement; up; up = up.parentElement) {
        if (scrolls(up)) {
          found.push(`${name(el)} inside ${name(up)}`);
          break;
        }
      }
    }
    return found;
  });
}

test('FR-CTRL-10: the walk finds a scroll planted inside a scroll', async ({ page }) => {
  await open(page, 'settings');
  await page.evaluate(() => {
    const outer = document.createElement('div');
    outer.style.cssText = 'height: 50px; overflow-y: auto';
    outer.innerHTML = '<div data-testid="planted" style="height: 80px; overflow-y: scroll"><div style="height: 200px"></div></div>';
    document.body.append(outer);
  });
  expect(await nestedScrolls(page)).toContain('planted inside div');
});

for (const size of SIZES) {
  test.describe(`FR-CTRL-10 at ${String(size.width)} × ${String(size.height)}`, () => {
    test.use({ viewport: size });

    for (const which of PAGES) {
      test(`FR-CTRL-10: the ${which} page has no scroll inside a scroll`, async ({ page }) => {
        await open(page, which);
        expect(await nestedScrolls(page)).toEqual([]);
      });
    }
  });
}
