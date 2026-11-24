/**
 * R208 (FR-LAND-2, FR-STRIP-4, FR-LIVE-9; D-1233): what each width opens on. A desk opens the live page on the globe
 * with real time running by seconds and a pass page playing from its rise; a phone opens the window, not playing; a
 * stored view wins at both widths, and a link's instant or reduced motion opens paused.
 *
 * R212 (FR-LAND-1, FR-LAND-6, US-62 AC1; D-1230, D-1231): the live page is the first page. A load of `/`, `/#` or a
 * hash that names no route draws the live page and puts `#live` in the address without a history entry, at 390 × 844
 * and 1280 × 800; and on a phone the satellites page, `#pass`, is tonight's list, a card opening its pass's sheet.
 */
import { expect, test, type Page } from '@playwright/test';
import { formatClock } from '../../src/lib/timeFormat';
import type { ChartView } from '../../src/model';
import { shownInstant } from './deskPages';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';
import { NEUQUEN } from './observers';

/** The stored run at Neuquén with `chartView` saved, or nothing saved, and the live page reached by its hash. */
async function openLive(page: Page, chartView?: ChartView, hash = '#live'): Promise<void> {
  await seedStoredRun(page, { settled: true, prefs: { chartView } });
  await page.evaluate((to) => {
    window.location.hash = to;
  }, hash);
  await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
}

const drawing = (page: Page) => page.getByTestId('live-dome');

test.describe('on a desk', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('FR-LAND-2, FR-STRIP-4: the globe, at real time, the clock advancing by real seconds', async ({ page }) => {
    await openLive(page);
    await expect(drawing(page).locator('[data-globe]')).toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('time-control')).toHaveAttribute('data-state', 'watching');
    // The seed's clock is fixed, so each second is set. The page's 10 s tick could show one of them, never all three.
    for (const second of [1, 2, 3]) {
      const at = NINE_DAYS_ON + second * 1_000;
      await page.clock.setFixedTime(at);
      await expect(page.getByTestId('live-clock')).toContainText(formatClock(at, 'UTC', 'en').slice(0, 8), { timeout: 3_000 });
    }
    await expect(page).toHaveURL(/#live$/);
  });

  test('FR-LAND-2: a stored Window wins', async ({ page }) => {
    await openLive(page, 'window');
    await expect(drawing(page).locator('[data-look-az]')).toBeAttached({ timeout: 30_000 });
    await expect(drawing(page).locator('[data-globe]')).toHaveCount(0);
  });

  test('FR-LIVE-9, FR-STRIP-4: a link’s t opens that instant paused', async ({ page }) => {
    const t = NINE_DAYS_ON + 3_600_000;
    await openLive(page, undefined, `#live?lat=${String(NEUQUEN.lat)}&lon=${String(NEUQUEN.lon)}&alt=0&t=${new Date(t).toISOString()}`);
    await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    await expect.poll(() => shownInstant(page.getByTestId('live-layout'))).toBe(t);
  });

  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`FR-STRIP-4: a pass page ${motion === 'reduce' ? 'stays at the rise under reduced motion' : 'plays at 60×, its instant past the rise'}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await seedStoredRun(page, { settled: true, prefs: { chartView: undefined } });
      await page.getByTestId('pass-link').click();
      const layout = page.getByTestId('pass-layout');
      await expect(layout).toBeVisible({ timeout: 30_000 });
      const id = (await page.getByTestId('guide-panel').getAttribute('data-pass-id')) ?? '';
      const rise = Number(/-(\d+)$/.exec(id)?.[1]);
      await expect(layout.getByTestId('live-play')).toHaveAttribute('data-playing', String(motion !== 'reduce'));
      if (motion === 'reduce') await expect.poll(() => shownInstant(layout)).toBe(rise);
      else await expect.poll(() => shownInstant(layout), { timeout: 10_000 }).toBeGreaterThan(rise);
    });
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('FR-LAND-2: the window, at real time, not playing', async ({ page }) => {
    await openLive(page);
    await expect(drawing(page).locator('[data-look-az]')).toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    await expect(page).toHaveURL(/#live$/);
  });

  test('FR-LAND-2: a stored Dome wins', async ({ page }) => {
    await openLive(page, 'dome');
    await expect(drawing(page).locator('[data-look-az]')).toHaveCount(0);
    await expect(page.getByTestId('live-layout')).toBeVisible();
  });
});

const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

for (const viewport of SIZES) {
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    for (const address of ['/', '/#', '/#nope'] as const) {
      test(`FR-LAND-1: ${address} opens #live with no history entry`, async ({ page }) => {
        await page.clock.setFixedTime(NINE_DAYS_ON);
        await stubNetwork(page);
        await page.route('**/e', (route) => route.fulfill({ status: 204 }));
        // A page of our own first, so the load under test adds exactly one entry and the replace adds none.
        await page.goto('about:blank');
        const before = await page.evaluate(() => history.length);
        await page.goto(address);
        await expect(page).toHaveURL(/\/#live$/);
        await expect(page.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
        expect(await page.evaluate(() => history.length)).toBe(before + 1);
        // The replace happened before the first render: Back leaves the app, not for the address as typed.
        await page.goBack();
        await expect(page).toHaveURL('about:blank');
      });
    }

    // R222 (FR-LAND-3, US-62 AC3, D-1240): the stars page folded into live; its address lands there, parameters kept.
    test('FR-LAND-3: #stars opens #live with no history entry', async ({ page }) => {
      await page.clock.setFixedTime(NINE_DAYS_ON);
      await stubNetwork(page);
      await page.route('**/e', (route) => route.fulfill({ status: 204 }));
      await page.goto('about:blank');
      const before = await page.evaluate(() => history.length);
      await page.goto('/#stars');
      await expect(page).toHaveURL(/\/#live$/);
      await expect(page.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => history.length)).toBe(before + 1);
    });

    test('FR-LAND-3: #stars?<params> opens #live with the parameters live reads', async ({ page }) => {
      const t = NINE_DAYS_ON + 3_600_000;
      const params = `lat=${String(NEUQUEN.lat)}&lon=${String(NEUQUEN.lon)}&alt=0&t=${new Date(t).toISOString()}`;
      await page.clock.setFixedTime(NINE_DAYS_ON);
      await stubNetwork(page);
      await page.route('**/e', (route) => route.fulfill({ status: 204 }));
      await page.goto(`/#stars?${params}`);
      await expect(page).toHaveURL(new RegExp(`/#live\\?lat=${String(NEUQUEN.lat)}&lon=${String(NEUQUEN.lon)}&alt=0&t=`));
      await expect(page.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
      // The link's place is the observer, and on a desk its instant is the one shown, paused (FR-LIVE-9).
      await expect(page.getByTestId('place-line')).toContainText(`${NEUQUEN.lat.toFixed(2).replace('-', '−')}`);
      if (viewport.width >= 1280) {
        await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
        await expect.poll(() => shownInstant(page.getByTestId('live-layout'))).toBe(t);
      }
    });

    // R222 (FR-LAND-5, US-62 AC2): no stored place and, in UTC, no city for an example — the place group in the box.
    test('FR-LAND-5: with no place and no example the box holds the place group under the tagline', async ({ page }) => {
      await page.clock.setFixedTime(NINE_DAYS_ON);
      await stubNetwork(page);
      await page.route('**/e', (route) => route.fulfill({ status: 204 }));
      await page.goto('/');
      const box = page.getByTestId('live-inert');
      await expect(box).toHaveAttribute('data-inert', 'no-place', { timeout: 30_000 });
      const group = box.getByTestId('live-no-place').getByTestId('live-place-group');
      await expect(group).toBeVisible();
      await expect(group.getByRole('heading', { level: 2 })).toBeVisible();
      const tagline = await box.getByTestId('live-tagline').boundingBox();
      const card = await group.boundingBox();
      if (!tagline || !card) throw new Error('the place group is not laid out');
      expect(tagline.y + tagline.height, 'the tagline above the group').toBeLessThanOrEqual(card.y + 1);
      // The wide header's place line (FR-LAND-4); the compact header has none, its place line is the sheet's, and the
      // inert page has no sheet — the group itself is in the box.
      if (viewport.width >= 1280) await expect(page.getByTestId('header').getByTestId('place-line')).toContainText('Set your place');
    });
  });
}

test.describe('the phone’s satellites page (FR-LAND-6, D-1231)', () => {
  test.use({ viewport: SIZES[0] });

  test('#pass is tonight’s stripe and list, and a card opens its pass’s sheet over it', async ({ page }) => {
    // The seed leaves the page on `#pass` (`seedStoredRun`).
    await seedStoredRun(page, { settled: true });
    await expect(page).toHaveURL(/#pass$/);
    const tonight = page.getByTestId('pass-tonight');
    await expect(tonight.getByTestId('tonight-stripe')).toBeVisible();
    const card = tonight.locator('article[data-pass-id]').first();
    const id = await card.getAttribute('data-pass-id');
    await card.getByRole('button', { name: /Open guide/ }).click();
    await expect(page).toHaveURL(new RegExp(`#pass=${String(id)}$`));
    await expect(page.getByRole('dialog')).toHaveAttribute('data-pass-id', String(id));
  });
});
