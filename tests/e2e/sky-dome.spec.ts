/**
 * R15 (US-6 AC3, FR-GUIDE-2, FR-GUIDE-4..7), R21 (FR-DOME-1..4, FR-DOME-7,
 * FR-DOME-8) at 390 px on the production build under the relaxed-by-exactly-
 * one CSP: the detail sheet now opens on the *dome* (FR-DOME-7, closing
 * D-68), facing the pass's rise compass point; the dome is two stacked
 * scenes on one grid (FR-DOME-8, D-74) with no frame around it (FR-DOME-1);
 * the polar view is one toggle away and the two share one frame, so the
 * toggle moves nothing else on the sheet; dragging changes the facing
 * readout; ArrowLeft changes it by exactly 15°; ArrowUp cannot push the tilt
 * past 80° nor ArrowDown below 5°; toggling to the polar view keeps the same
 * pass highlighted and the choice survives a reload; no `<canvas>` anywhere;
 * no CSP violation while the dome chunk loads, draws and colours itself.
 * Screenshots of the dome for the golden (grazing) pass and the highest pass
 * of the night are saved for the PR.
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
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
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

test('the dome is the default view, shares the polar frame, faces the rise point, turns by drag and by keys within the tilt clamp, and the polar toggle keeps the pass', async ({ page }) => {
  const violations: string[] = [];
  const { passId, dialog } = await openGoldenPass(page, violations);
  const figure = dialog.getByRole('figure');
  // FR-DOME-7: the dome is what the sheet opens on, with no toggle needed.
  await expect(figure).toHaveAttribute('data-view', 'dome');
  await expect(figure.getByTestId('guide-sentence')).toHaveText(golden.en.asComputed);
  const viewToggle = figure.getByRole('group', { name: 'Chart view' });
  await expect(viewToggle.getByRole('button', { name: 'Dome' })).toHaveAttribute('aria-pressed', 'true');
  await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });

  // One frame for both views (R15 review): the drawing box and the numbers table stay where they are when the view changes.
  const frameBox = async () => (await figure.getByTestId('chart-frame').boundingBox()) ?? { x: NaN, y: NaN, width: NaN, height: NaN };
  const tableY = async () => (await dialog.getByRole('table').boundingBox())?.y ?? NaN;
  const domeFrame = await frameBox();
  const domeTableY = await tableY();
  await viewToggle.getByRole('button', { name: 'Polar' }).click();
  await expect(figure).toHaveAttribute('data-view', 'polar');
  expect(await frameBox()).toEqual(domeFrame);
  expect(await tableY()).toBe(domeTableY);
  await viewToggle.getByRole('button', { name: 'Dome' }).click();
  await expect(figure).toHaveAttribute('data-view', 'dome');

  // The chart chunk lands and draws: one <pre> of 30 rows × 60 braille columns, hidden from AT; no canvas anywhere (FR-GUIDE-5).
  const stage = figure.getByRole('group', { name: 'Sky dome' });
  const drawing = figure.locator('[data-drawing="dome"]');
  await expect(drawing).toHaveAttribute('aria-hidden', 'true', { timeout: 30_000 });
  const pre = drawing.locator('[data-layer="lines"] pre.glyph-output');
  await expect(pre).toBeVisible();
  const raster = await pre.evaluate((el) => el.textContent ?? '');
  const rows = raster.split('\n');
  // FR-DOME-1: the columns are the phone's 60 at this width (an integer rule, so exact everywhere), and the rows follow the
  // box's height at cell aspect 2. The row count is therefore platform-dependent: where glyph advances round to whole pixels
  // (Linux Chromium) the fitted cell is a little narrower, so a few more rows fit the same square box. 30 is the floor.
  expect(rows[0]).toHaveLength(60);
  expect(rows.length).toBeGreaterThanOrEqual(30);
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
  // FR-DOME-1: no frame, so the drawing fills the box itself rather than the box less a border — the *height* exactly, because
  // the rows are computed from it, and the width to within one glyph advance. That last gap is the platform's: where advances
  // round to whole pixels (Linux Chromium) the fitted row can only step by a whole pixel per cell, so 60 cells land a little
  // inside the box rather than overflowing it, and the raster is then taller than it is wide. The dome itself is not stretched
  // — `zoom` is per box (D-91), so the shortfall is margin, not distortion — which is why the raster is not asserted square.
  expect(preBox.width).toBeLessThanOrEqual(box.width + 1);
  expect(preBox.width).toBeGreaterThanOrEqual(box.width * 0.8);
  expect(Math.abs(preBox.height - box.height)).toBeLessThanOrEqual(preBox.height / rows.length + 1);
  expect(Math.abs(preBox.x + preBox.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // FR-DOME-8 / D-74: a second scene of surfaces sits behind the lines, on half the grid (D-92), taking no pointer.
  const basePre = drawing.locator('[data-layer="base"] pre.glyph-output');
  await expect(basePre).toBeVisible();
  const baseRaster = await basePre.evaluate((el) => el.textContent ?? '');
  const baseRows = baseRaster.split('\n');
  // Half the line layer's columns (D-92) — integer arithmetic, so exact everywhere. The row counts are *not* asserted against
  // each other: each layer rounds `height / cellHeight` with its own cell, and the two glyphs round differently on a platform
  // with whole-pixel advances, so the cell-for-cell half only holds where nothing rounds (the unit test pins it there).
  // What has to hold in a browser is the alignment itself, which is pixels: both layers cover the same box, at the same zoom,
  // each raster filling that box's height.
  expect(baseRows[0]).toHaveLength(30);
  expect(baseRaster.trim().length).toBeGreaterThan(0);
  const basePreBox = await basePre.boundingBox();
  if (!basePreBox) throw new Error('base raster has no box');
  expect(Math.abs(basePreBox.height - box.height)).toBeLessThanOrEqual(basePreBox.height / baseRows.length + 1);
  expect(await drawing.locator('[data-layer="base"]').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  // Both layers fill the same box, which is what keeps them aligned as it changes size.
  const boxOf = async (layer: string) => (await drawing.locator(`[data-layer="${layer}"]`).boundingBox()) ?? { x: NaN, y: NaN, width: NaN, height: NaN };
  expect(await boxOf('base')).toEqual(await boxOf('lines'));

  // FR-DOME-1: no frame around the drawing.
  expect(await stage.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');

  // FR-DOME-2 under the D-75 CSP: glyphcss colours glyphs with inline `style` attributes, and the browser must not block them.
  const colours = await pre.evaluate((el) => Array.from(el.querySelectorAll('span')).map((span) => getComputedStyle(span).color));
  expect(new Set(colours).size).toBeGreaterThan(1);

  // FR-DOME-4: the degree numbers on the horizon and the two labelled rings.
  for (const degrees of ['30°', '60°']) await expect(drawing.getByText(degrees, { exact: true }).first()).toBeVisible();

  for (const cardinal of ['N', 'E', 'S', 'W']) await expect(drawing.locator(`[data-anchor="${cardinal}"]`)).toHaveText(cardinal);
  await expect(drawing.locator(`[data-pass-id="${passId}"] [data-anchor="pass"]`)).toContainText('ISS (Zarya)');
  await expect(drawing.locator('[data-anchor="peak"]')).toHaveText(/^max \d+°$/);

  // FR-GUIDE-2 default view, FR-GUIDE-4 readout: facing the rise compass point at the D-92 default tilt.
  const readout = figure.getByTestId('dome-readout');
  const rise = reference.firstGoldenPass?.start.azDeg ?? 0;
  const initial = await facingOf(readout);
  expect(initial.point).toBe(compass16(rise));
  expect(initial.az).toBe(Math.round(rise));
  expect(initial.tilt).toBe(45);
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
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
  expect((await facingOf(readout)).tilt).toBe(45);

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
  await expect(page.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('dialog').getByRole('figure')).toHaveAttribute('data-view', 'polar');
  await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Dome' }).click();
  await expect(page.getByRole('dialog').getByRole('figure')).toHaveAttribute('data-view', 'dome');
  await expect(page.getByRole('dialog').locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
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
  await expect(highFigure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await expect(highFigure.locator('[data-anchor="peak"]')).toHaveText(`max ${String(highest.el)}°`);
  await highFigure.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/r15-dome-high-390.png' });
  await page.getByRole('dialog').getByRole('group', { name: 'Sky dome' }).focus();
  // Two steps up from the D-92 default of 45°, so this capture is the same 55° view R15 filed.
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('dialog').getByTestId('dome-readout')).toHaveText(/tilt 55°$/);
  await page.screenshot({ path: 'test-results/r15-dome-high-tilt-390.png' });
});
