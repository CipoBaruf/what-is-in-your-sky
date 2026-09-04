/**
 * R15 (US-6 AC3, FR-GUIDE-2, FR-GUIDE-4..7) at 390 px on the production
 * build under the strict CSP: the detail sheet opens on the polar chart
 * (D-68) and the dome is one toggle away, facing the pass's rise compass
 * point; the two views share one frame, so the toggle moves nothing else on
 * the sheet; dragging changes the facing
 * readout; ArrowLeft changes it by exactly 15°; ArrowUp cannot push the tilt
 * past 80° nor ArrowDown below 5°; toggling to the polar view keeps the same
 * pass highlighted and the choice survives a reload; no `<canvas>` anywhere;
 * no CSP violation while the dome chunk loads and draws. Screenshots of the
 * dome for the golden (grazing) pass and the highest pass of the night are
 * saved for the PR.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number; azDeg: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const golden = JSON.parse(readFileSync('tests/fixtures/guide-sentences.json', 'utf8')) as { en: { asComputed: string } };
const DAY_MS = 86_400_000;
const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass16 = (az: number): string => COMPASS_16[Math.round((((az % 360) + 360) % 360) / 22.5) % 16] ?? 'N';

test.use({ viewport: { width: 390, height: 844 } });

async function openGoldenPass(page: Page, violations: string[]): Promise<{ passId: string; dialog: Locator }> {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(pass.start.t)}`;
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations ??= [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text().slice(0, 200));
  });
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 15_000 });
  await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: /Open guide/ }).click();
  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(dialog).toBeVisible();
  return { passId, dialog };
}

const facingOf = async (readout: Locator): Promise<{ point: string; az: number; tilt: number }> => {
  const text = (await readout.textContent()) ?? '';
  const match = /^Facing ([A-Z]{1,3}) \((\d+)°\) · tilt (\d+)°$/.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error(`unexpected readout "${text}"`);
  return { point: match[1], az: Number(match[2]), tilt: Number(match[3]) };
};

test('the dome is one toggle from the polar default, shares its frame, faces the rise point, turns by drag and by keys within the tilt clamp, and the polar toggle keeps the pass', async ({ page }) => {
  const violations: string[] = [];
  const { passId, dialog } = await openGoldenPass(page, violations);
  const figure = dialog.getByRole('figure');
  await expect(figure).toHaveAttribute('data-view', 'polar');
  await expect(figure.getByTestId('guide-sentence')).toHaveText(golden.en.asComputed);
  const viewToggle = figure.getByRole('group', { name: 'Chart view' });
  await expect(viewToggle.getByRole('button', { name: 'Polar' })).toHaveAttribute('aria-pressed', 'true');
  // One frame for both views (R15 review): the drawing box and the numbers table stay where they are when the view changes.
  const frameBox = async () => (await figure.getByTestId('chart-frame').boundingBox()) ?? { x: NaN, y: NaN, width: NaN, height: NaN };
  const tableY = async () => (await dialog.getByRole('table').boundingBox())?.y ?? NaN;
  const polarFrame = await frameBox();
  const polarTableY = await tableY();
  await viewToggle.getByRole('button', { name: 'Dome' }).click();
  await expect(figure).toHaveAttribute('data-view', 'dome');
  await expect(viewToggle.getByRole('button', { name: 'Dome' })).toHaveAttribute('aria-pressed', 'true');
  await expect(figure.locator('[data-drawing="dome"] pre.glyph-output')).toBeVisible({ timeout: 15_000 });
  expect(await frameBox()).toEqual(polarFrame);
  expect(await tableY()).toBe(polarTableY);

  // The chart chunk lands and draws: one <pre> of 30 rows × 60 braille columns, hidden from AT; no canvas anywhere (FR-GUIDE-5).
  const stage = figure.getByRole('group', { name: 'Sky dome' });
  const drawing = figure.locator('[data-drawing="dome"]');
  await expect(drawing).toHaveAttribute('aria-hidden', 'true', { timeout: 15_000 });
  const pre = drawing.locator('pre.glyph-output');
  await expect(pre).toBeVisible();
  const raster = await pre.evaluate((el) => el.textContent ?? '');
  expect(raster.split('\n')).toHaveLength(30);
  expect(raster.split('\n')[0]).toHaveLength(60);
  expect(raster.replace(/[\s⠀]/g, '').length).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.querySelector('canvas'))).toBeNull();
  const box = await stage.boundingBox(); // the focusable stage fills the frame's square box; the drawing inside is sized by its raster
  if (!box) throw new Error('drawing has no box');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.width).toBeGreaterThan(300);
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(2); // the shared square box
  const preBox = await pre.boundingBox();
  if (!preBox) throw new Error('raster has no box');
  // 60 columns fit the box (a 1 px border each side) and nearly fill it: the font is fitted to the measured row, so a platform that rounds
  // glyph advances to whole pixels (Linux Chromium) gets a slightly smaller, centred raster rather than an overflowing one.
  expect(preBox.width).toBeLessThanOrEqual(box.width - 2 + 1);
  expect(preBox.width).toBeGreaterThanOrEqual((box.width - 2) * 0.8);
  expect(Math.abs(preBox.height - preBox.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(preBox.x + preBox.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const cardinal of ['N', 'E', 'S', 'W']) await expect(drawing.locator(`[data-anchor="${cardinal}"]`)).toHaveText(cardinal);
  await expect(drawing.locator(`[data-pass-id="${passId}"] [data-anchor="pass"]`)).toContainText('ISS (Zarya)');
  await expect(drawing.locator('[data-anchor="peak"]')).toHaveText(/^max \d+°$/);

  // FR-GUIDE-2 default view, FR-GUIDE-4 readout: facing the rise compass point at tilt 25°.
  const readout = figure.getByTestId('dome-readout');
  const rise = reference.firstGoldenPass?.start.azDeg ?? 0;
  const initial = await facingOf(readout);
  expect(initial.point).toBe(compass16(rise));
  expect(initial.az).toBe(Math.round(rise));
  expect(initial.tilt).toBe(25);
  await figure.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/r15-dome-390.png' });

  // Keyboard: ArrowLeft is exactly 15°; ArrowUp stops at 80°, ArrowDown at 5°.
  await stage.focus();
  await page.keyboard.press('ArrowLeft');
  const afterLeft = await facingOf(readout);
  expect(((initial.az - afterLeft.az) % 360) + (initial.az - afterLeft.az < 0 ? 360 : 0)).toBe(15);
  await page.keyboard.press('ArrowRight');
  expect((await facingOf(readout)).az).toBe(initial.az);
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowUp');
  expect((await facingOf(readout)).tilt).toBe(80);
  await page.keyboard.press('ArrowUp');
  expect((await facingOf(readout)).tilt).toBe(80);
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowDown');
  expect((await facingOf(readout)).tilt).toBe(5);
  await page.keyboard.press('ArrowDown');
  expect((await facingOf(readout)).tilt).toBe(5);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
  expect((await facingOf(readout)).tilt).toBe(25);

  // Drag: a real pointer drag across the drawing changes the facing readout, and the raster with it.
  const before = await facingOf(readout);
  const rasterBefore = await pre.evaluate((el) => el.textContent ?? '');
  const stageBox = await drawing.boundingBox(); // measured again: the sheet was scrolled since the first box
  if (!stageBox) throw new Error('drawing has no box');
  const cx = stageBox.x + stageBox.width / 2;
  const cy = stageBox.y + stageBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx - i * 12, cy - i * 4);
  await page.mouse.up();
  await expect(readout).not.toHaveText(`Facing ${before.point} (${String(before.az)}°) · tilt ${String(before.tilt)}°`);
  const after = await facingOf(readout);
  expect(after.az).not.toBe(before.az);
  expect(after.tilt).toBeGreaterThan(before.tilt);
  expect(await pre.evaluate((el) => el.textContent ?? '')).not.toBe(rasterBefore);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');

  // The chunk loaded and drew under the strict CSP (D-61: no injected stylesheet, no inline colours).
  expect(await page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [])).toEqual([]);
  expect(violations).toEqual([]);

  // FR-GUIDE-2b: the polar fallback is one toggle away, shows the same pass, and the choice survives a reload (US-6 AC5).
  await viewToggle.getByRole('button', { name: 'Polar' }).click();
  await expect(figure).toHaveAttribute('data-view', 'polar');
  await expect(figure.locator(`svg[data-drawing="polar"] [data-pass-id="${passId}"] [data-anchor="pass"]`)).toContainText('ISS (Zarya)');
  await expect(figure.getByTestId('guide-sentence')).toHaveText(golden.en.asComputed);
  expect(JSON.parse(await page.evaluate(() => window.localStorage.getItem('wiys:prefs:v1') ?? '{}'))).toMatchObject({ chartView: 'polar' });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('dialog').getByRole('figure')).toHaveAttribute('data-view', 'polar');
  await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Dome' }).click();
  await expect(page.getByRole('dialog').getByRole('figure')).toHaveAttribute('data-view', 'dome');
  await expect(page.getByRole('dialog').locator('[data-drawing="dome"] pre.glyph-output')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => document.querySelector('canvas'))).toBeNull();

  // The golden pass grazes the horizon; for the PR's visual check, also capture the highest pass of the night on the dome.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const list = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('list');
  const highest = await list.locator('article').evaluateAll((cards) => {
    const elevation = (card: Element): number => Number(Array.from(card.querySelectorAll('dt')).find((dt) => dt.textContent === 'Max elevation')?.nextElementSibling?.textContent?.replace('°', '') ?? 0);
    return cards.map((card) => ({ id: card.getAttribute('data-pass-id') ?? '', el: elevation(card) })).sort((a, b) => b.el - a.el)[0];
  });
  if (!highest || highest.el < 30) throw new Error(`no high pass among the fixtures (best ${String(highest?.el)}°)`);
  await list.locator(`article[data-pass-id="${highest.id}"]`).getByRole('button', { name: /Open guide/ }).click();
  const highFigure = page.getByRole('dialog').getByRole('figure');
  await expect(highFigure.locator('[data-drawing="dome"] pre.glyph-output')).toBeVisible({ timeout: 15_000 });
  await expect(highFigure.locator('[data-anchor="peak"]')).toHaveText(`max ${String(highest.el)}°`);
  await highFigure.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/r15-dome-high-390.png' });
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
  await page.getByRole('dialog').getByRole('group', { name: 'Sky dome' }).focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('dialog').getByTestId('dome-readout')).toHaveText(/tilt 55°$/);
  await page.screenshot({ path: 'test-results/r15-dome-high-tilt-390.png' });
});
