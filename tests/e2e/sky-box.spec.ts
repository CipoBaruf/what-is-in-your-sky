/** R133 probe: the boxes as they stand. Replaced by the real spec once the rule is in. */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { painted } from './domeInk';
import { domeDrawn, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const box = async (locator: Locator): Promise<Box> => {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${String(locator)}`);
  return found;
};
const fmt = (b: Box): string => `${String(Math.round(b.x))},${String(Math.round(b.y))} ${String(Math.round(b.width))}×${String(Math.round(b.height))}`;

async function openLive(page: Page): Promise<Locator> {
  await seedStoredRun(page, { locale: 'en', settled: true });
  await page.goto('/#live');
  await page.reload();
  const layout = page.getByTestId('live-layout');
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await domeDrawn(page);
  return layout;
}

async function report(page: Page, layout: Locator, label: string): Promise<void> {
  const names = ['answer', 'viewRow', 'readout', 'drawing', 'picker', 'hint', 'action', 'list', 'foot'];
  const lines: string[] = [label];
  for (const name of names) {
    const slot = layout.locator(`[data-slot="${name}"]`);
    if ((await slot.count()) === 0) continue;
    lines.push(`  slot ${name}: ${fmt(await box(slot))}`);
  }
  lines.push(`  layout: ${fmt(await box(layout))}`);
  lines.push(`  frame: ${fmt(await box(page.getByTestId('chart-frame').first()))}`);
  lines.push(`  chart-box: ${fmt(await box(page.getByTestId('chart-box').first()))}`);
  const dome = page.locator('[data-drawing="dome"]');
  if ((await dome.count()) > 0) {
    const { extent, layers } = await painted(dome);
    lines.push(`  ink extent: ${fmt(extent)}`);
    for (const l of layers) lines.push(`  layer ${l.layer}: ${String(l.cols)}×${String(l.rows)} cell ${l.cellWidthPx.toFixed(2)}×${l.cellHeightPx.toFixed(2)} ink ${fmt(l.ink)}`);
  }
  const hint = page.getByTestId('sky-hint');
  if ((await hint.count()) > 0) lines.push(`  hint: ${fmt(await box(hint))}`);
  lines.push(`  viewport: ${JSON.stringify(await page.evaluate(() => [window.innerWidth, window.innerHeight, document.documentElement.scrollHeight]))}`);
  console.log(lines.join('\n'));
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false });
  test('live compact', async ({ page }) => {
    const layout = await openLive(page);
    await report(page, layout, 'live 390×844 dome');
  });
  test('detail compact', async ({ page }) => {
    await seedStoredRun(page, { locale: 'en', settled: true });
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
    const layout = page.getByTestId('pass-layout');
    await expect(layout.locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
    await expect(layout.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
    await report(page, layout, 'detail 390×844 dome');
  });
});

test.describe('desk', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });
  test('live wide, three views', async ({ page }) => {
    const layout = await openLive(page);
    await report(page, layout, 'live 1280×800 dome');
    for (const view of ['Polar', 'Window'] as const) {
      await layout.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: view }).click();
      await expect(layout.locator(`[data-drawing="${view.toLowerCase()}"]`)).toBeAttached({ timeout: 30_000 });
      await page.waitForTimeout(500);
      await report(page, layout, `live 1280×800 ${view}`);
    }
  });
  test('stars wide', async ({ page }) => {
    await page.clock.setFixedTime(NINE_DAYS_ON);
    for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
    await page.addInitScript(
      ([key, value]: [string, string]) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      },
      [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
    );
    await page.goto('/#stars');
    const layout = page.getByTestId('stars-layout');
    await expect(layout.locator('[data-drawing="window"]')).toBeAttached();
    await page.waitForTimeout(500);
    const lines = ['stars 1280×800'];
    for (const name of ['answer', 'readout', 'drawing', 'picker', 'hint', 'layers', 'list']) {
      const slot = layout.locator(`[data-slot="${name}"]`);
      if ((await slot.count()) === 0) continue;
      lines.push(`  slot ${name}: ${fmt(await box(slot))}`);
    }
    lines.push(`  layout: ${fmt(await box(layout))}`);
    lines.push(`  sky: ${fmt(await box(page.getByTestId('stars-sky')))}`);
    lines.push(`  svg: ${fmt(await box(layout.locator('svg[data-drawing="window"]')))}`);
    console.log(lines.join('\n'));
  });
  test('detail panel', async ({ page }) => {
    await seedStoredRun(page, { locale: 'en', settled: true });
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
    const layout = page.getByTestId('pass-layout');
    await expect(layout.locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
    await expect(layout.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    const panel = await box(page.getByTestId('guide-panel'));
    const body = await box(page.getByTestId('guide-body'));
    const drawing = await box(layout.getByTestId('chart-box'));
    console.log(`detail panel 1280×800: panel ${fmt(panel)} body ${fmt(body)} drawing ${fmt(drawing)} share/panel ${((drawing.width * drawing.height) / (panel.width * panel.height)).toFixed(3)} share/body ${((drawing.width * drawing.height) / (body.width * body.height)).toFixed(3)}`);
    await report(page, layout, 'detail 1280×800');
  });
});
