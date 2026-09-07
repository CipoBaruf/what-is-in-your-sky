/**
 * R52 (FR-COMP-1..4, US-20, V11-16) in a real browser, which is where the two
 * things the unit tests cannot see live: that the rows really are on one line
 * at 390 px, and that the two layouts swap at the breakpoint.
 *
 * `controlRows.test.ts` measures the same rows in characters and both
 * languages; this measures the boxes the browser actually laid out, on the one
 * viewport FR-COMP-4 names.
 */
import { expect, test, type Locator } from '@playwright/test';
import { seedStoredRun } from './liveHelpers';

const COMPACT = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };

test.use({ viewport: COMPACT });

/**
 * Whether every control on the row is on the same line as every other.
 *
 * Not "the same top": a bracketed text control carries a 48 px tap box around a
 * 24 px line (`inline-control`), so two controls that read as one line have
 * tops 12 px apart by design. What a *wrapped* row has instead is two boxes
 * that do not overlap vertically at all, which is what this asks.
 */
async function isOneLine(row: Locator): Promise<boolean> {
  return row.evaluate((element: HTMLElement) => {
    const boxes = Array.from(element.querySelectorAll<HTMLElement>(':scope > *')).map((child) => child.getBoundingClientRect()).filter((box) => box.width > 0 || box.height > 0);
    return boxes.every((box) => boxes.every((other) => box.top < other.bottom && other.top < box.bottom));
  });
}

/** The row does not push the page sideways either, which is the other way a 36-cell budget is blown. */
async function fitsTheViewport(row: Locator): Promise<boolean> {
  const width = await row.evaluate((element: HTMLElement) => element.getBoundingClientRect().right);
  return width <= COMPACT.width;
}

test.describe('the settings page at 390 px (FR-COMP-1..4, US-20)', () => {
  test('the header, the summary and the sort row are each one line, and [ settings ] opens the page', async ({ page }) => {
    await seedStoredRun(page);

    const header = page.getByTestId('header');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('Your sky');
    expect(await isOneLine(header)).toBe(true);
    expect(await fitsTheViewport(header)).toBe(true);

    const summary = page.getByTestId('location-summary');
    await expect(summary).toBeVisible();
    expect(await isOneLine(summary)).toBe(true);
    expect(await fitsTheViewport(summary)).toBe(true);

    const sort = page.getByRole('group', { name: 'Sort passes' });
    await expect(sort.getByRole('button', { name: 'Soonest' })).toBeVisible();
    expect(await isOneLine(sort)).toBe(true);

    await page.getByTestId('settings-link').click();
    await expect(page).toHaveURL(/#settings$/);
    await expect(page.getByTestId('settings-back')).toBeVisible();
    // FR-COMP-2's order, on the page the reader is now looking at.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Language', 'Theme', 'Location']);
    await expect(page.getByRole('button', { name: 'Clear saved location' })).toBeVisible();
  });

  test('the settings page still has a one-line header, and its own [ settings ] is the current page', async ({ page }) => {
    await seedStoredRun(page);
    await page.getByTestId('settings-link').click();
    const header = page.getByTestId('header');
    expect(await isOneLine(header)).toBe(true);
    await expect(page.getByTestId('settings-link')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('live-link')).toHaveAttribute('href', '#live');
  });

  test('a change on the settings page applies at once and survives the trip back (US-20 AC2)', async ({ page }) => {
    await seedStoredRun(page);
    await page.getByTestId('settings-link').click();
    await page.getByRole('button', { name: 'Español' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByTestId('settings-back')).toHaveText('← Volver');
    await page.getByTestId('settings-back').click();
    await expect(page).toHaveURL((url) => url.hash === '');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('Escape, the back control and the browser’s Back all return to the home screen (US-20 AC4)', async ({ page }) => {
    await seedStoredRun(page);
    const home = page.getByTestId('location-summary');
    const back = page.getByTestId('settings-back');
    // Each trip waits for the page to be up before leaving it: the click returns
    // as soon as the hash is set, and a key pressed before React has re-rendered
    // would be the home screen's.
    const openSettings = async (): Promise<void> => {
      await page.getByTestId('settings-link').click();
      await expect(back).toBeVisible();
    };

    await openSettings();
    await page.keyboard.press('Escape');
    await expect(home).toBeVisible();

    await openSettings();
    await back.click();
    await expect(home).toBeVisible();

    await openSettings();
    await page.goBack();
    await expect(home).toBeVisible();
  });

  test('a reload on #settings reopens it: the hash is the only route state (D-13)', async ({ page }) => {
    await seedStoredRun(page);
    await page.getByTestId('settings-link').click();
    await page.reload();
    await expect(page.getByTestId('settings-back')).toBeVisible();
  });

  test('the install offer is on the settings page after the last decline, with no "Not now" beside it (V11-16)', async ({ page }) => {
    await seedStoredRun(page, { prefs: { installHintDismissed: true, installHintDeclines: 3 } });
    await page.getByTestId('settings-link').click();
    // The browser is offering; the hint is not, because the reader has answered it for good.
    await page.evaluate(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
    });
    const row = page.getByTestId('settings-install');
    await expect(row).toBeVisible();
    await expect(row.getByTestId('install-action')).toHaveText('Install');
    await expect(row.getByRole('button', { name: 'Not now' })).toHaveCount(0);
    // FR-COMP-4 is about the row of controls; the sentence above it is prose and wraps.
    expect(await isOneLine(row.getByTestId('install-action').locator('..'))).toBe(true);
  });

  test('there is no install row where the browser is offering nothing', async ({ page }) => {
    await seedStoredRun(page);
    await page.getByTestId('settings-link').click();
    await expect(page.getByTestId('settings-install')).toHaveCount(0);
  });
});

test.describe('the wide header at 1280 px (FR-DESK-2 as amended, US-20 AC5)', () => {
  test.use({ viewport: WIDE });

  test('has [ Live sky ] beside the title, the preferences at the right, and no link to #settings', async ({ page }) => {
    await seedStoredRun(page);
    const header = page.getByTestId('header');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('What is in your sky right now');
    await expect(page.getByTestId('live-link')).toHaveText('Live sky');
    await expect(page.getByTestId('settings-link')).toHaveCount(0);
    // The live control is on the title's own line, not in the group of preferences at the right (V11-8).
    const box = (locator: Locator): Promise<DOMRect> => locator.evaluate((el: HTMLElement) => el.getBoundingClientRect().toJSON() as DOMRect);
    const [title, live, language] = await Promise.all([box(header.getByRole('heading', { level: 1 })), box(page.getByTestId('live-link')), box(page.getByRole('group', { name: 'Language' }))]);
    // Beside the title, on its line — the two boxes overlap vertically — and left of the preferences.
    expect(live.top).toBeLessThan(title.bottom);
    expect(title.top).toBeLessThan(live.bottom);
    expect(live.right).toBeLessThan(language.left);
    // The wide home keeps the whole form: the summary is the compact layout's line (US-20 AC5).
    await expect(page.getByRole('region', { name: 'Location' })).toBeVisible();
    await expect(page.getByTestId('location-summary')).toHaveCount(0);
  });

  test('renders #settings when navigated to, at a width that links to it from nowhere (FR-COMP-2)', async ({ page }) => {
    await seedStoredRun(page);
    await page.evaluate(() => {
      window.location.hash = 'settings';
    });
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Location' })).toBeVisible();
  });
});
