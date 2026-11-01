/**
 * R125 (FR-SKY-14; FR-WIN-1, FR-GUT-3, FR-STAR-4 as amended; US-41 AC6; D-798):
 * the zoom on the production build, on the two boxes the hand drives — the
 * live page's on wide, where the window is the saved view in the box, and the
 * stars page's. `+` three times narrows the field to 30° and spreads the
 * drawing about its centre; `0` restores it; ctrl + wheel and a synthetic
 * two-pointer pinch move the field the same way; a plain wheel is left to the
 * browser; the field is never saved, so a reload opens at 60°; and the drag at
 * the narrowest field still turns the window at the dome's rate.
 *
 * The readout's suffix (` · field 30°`) is R123's string: the field is read
 * from the root's `data-fov` here, and the readout's first line is held to
 * its shape with the suffix optional until that string lands (D-822).
 *
 *   npx playwright test window-zoom --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR } from './captureSet';
import { FIXTURE_DATE, NEUQUEN, NINE_DAYS_ON, PARIS } from './observers';
import { ctrlWheel, pinch, placedAt, wheel } from './windowZoom';

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const FRAME_MS = 16;
const DESK = { width: 1280, height: 800 };
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
/** The readout's first line under the hand, the field named after it while it is not 60° (R123's word, when it lands). */
const READOUT = /^Facing [NESW]{1,3} \(\d+°\) · up -?\d+°( · field \d+°)?$/;

/** `sky-window.spec.ts`'s opening: the saved view in the prefs, the elements from the fixtures, the clock paused. */
async function openLiveWindow(page: Page, prefs: { observer: Observer; chartView: 'window'; starsLayer?: boolean }): Promise<Locator> {
  await page.setViewportSize(DESK);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', theme: 'dark', ...prefs })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of EXTERNAL.slice(1)) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
  await page.goto('/');
  await expect(page.locator(`article[data-pass-id="${GLARE_PASS}"]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await page.getByTestId('live-link').click();
  // The paused clock holds React's lazy reveal (R32): the live chunk lands only as the clock runs.
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.getByTestId('sky-chart').count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.clock.runFor(1000);
  const chart = page.getByTestId('sky-chart');
  await expect(chart).toHaveAttribute('data-view', 'window');
  const w = chart.locator('[data-look-az]');
  await expect(w).toHaveAttribute('data-state', 'hand');
  return w;
}

/** The stars page as a reader with a saved place, every provider refused (`stars.spec.ts`'s opening). */
async function openStars(page: Page): Promise<Locator> {
  await page.setViewportSize(DESK);
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
  );
  await page.goto('/#stars');
  const w = page.getByTestId('stars-sky').locator('[data-look-az]');
  await expect(w).toHaveAttribute('data-state', 'hand');
  return w;
}

/** R155 (FR-LOOK-8 as amended): the two star chunks' requests, in order — `Stars-*.js` (the catalogue) and `deep-*.js` (`stars-deep`, D-976). */
function watchStarChunks(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    const name = /\/(Stars|deep)-[^/]*\.js$/.exec(request.url())?.[1];
    if (name) seen.push(name);
  });
  return seen;
}

/** R155 (FR-LOOK-9): every star the window draws this frame — the bright marks and the deep pool's dots. */
const drawnStars = (w: Locator): Locator => w.locator('[data-layer="stars"] [data-marks] > [data-star]:not([visibility="hidden"]), [data-layer="stars"] [data-deep-pool] > circle:not([visibility="hidden"])');
/** A Bayer or Flamsteed designation, which a star with no proper name is named by at the deeper rows (`Alp Sco`, `61 Cyg`). */
const DESIGNATION = /^(?:[A-Z][a-z]{2}\d?|\d+) [A-Z][A-Za-z]{2}$|^HR \d+$/;

/** The window's box under the hand: the one `div` with the drag state (the stripe's overview is an `svg` with one too). */
const box = (w: Locator): Locator => w.locator('div[data-dragging]');
const zenith = (w: Locator): Locator => w.locator('[data-marker="zenith"]');
const readout = (page: Page): Locator => page.getByTestId('window-readout');

test.describe('zoom on the live page’s box (wide, the window as the saved view)', () => {
  test.use({ viewport: DESK, hasTouch: false });

  test('+ three times narrows the field to 30° about the centre, 0 restores it, ctrl + wheel and a pinch move it the same way, a plain wheel is the browser’s', async ({ page }) => {
    const w = await openLiveWindow(page, { observer: PARIS, chartView: 'window' });
    await expect(w).toHaveAttribute('data-fov', '60');
    // R136 (FR-FLOW-14, D-876): the live page's window opens on the next rise (352°, 20° here); the zoom is measured
    // from north at 35°, as it was, so the window is turned there first: three `↑` and the picker's `N`.
    await box(w).focus();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowUp');
    await page.getByRole('group', { name: 'Facing' }).getByRole('button', { name: 'N', exact: true }).click();
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-look-az', '0');
    await expect(w).toHaveAttribute('data-look-alt', '35');
    await expect(readout(page)).toHaveText(READOUT);
    const line = (await readout(page).textContent()) ?? '';
    const centre = await box(w).boundingBox();
    if (!centre) throw new Error('no box');
    const before = await placedAt(zenith(w));

    // The keys, while the box has focus: 60 / 1.25³ = 30.72°, 31 whole; the readout reads 30° once the word lands.
    await box(w).focus();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('+');
    await expect(w).toHaveAttribute('data-fov', '31');
    await expect(readout(page)).toHaveText(READOUT);
    expect(((await readout(page).textContent()) ?? '').replace(/ · field \d+°$/, '')).toBe(line.replace(/ · field \d+°$/, ''));
    // About the centre: the aim is where it was, and the zenith (55° above the centre) stands further up the drawing.
    await expect(w).toHaveAttribute('data-look-az', '0');
    await expect(w).toHaveAttribute('data-look-alt', '35');
    const narrowed = await placedAt(zenith(w));
    expect(narrowed.x).toBeCloseTo(before.x, 0);
    expect(narrowed.y).toBeLessThan(before.y - 50);
    // The capture for the PR: the live page's window at 30°, the same stars spread about the centre.
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r125-live-1280-window-30-dark-en.png` });
    // `-` widens by the same factor; `0` restores the default and the drawing with it.
    await page.keyboard.press('-');
    await expect(w).toHaveAttribute('data-fov', '38');
    await page.keyboard.press('0');
    await expect(w).toHaveAttribute('data-fov', '60');
    expect(await placedAt(zenith(w))).toEqual(before);
    expect(await readout(page).textContent()).toBe(line);

    // ctrl + wheel, one notch of 100 px down: exp(0.2) wider, 73°; two up: back under 60°.
    await page.mouse.move(centre.x + centre.width / 2, centre.y + centre.height / 2);
    await ctrlWheel(page, 100);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '73');
    await ctrlWheel(page, -100);
    await ctrlWheel(page, -100);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '49');
    // A plain wheel is not the window's: the browser keeps its default and the field stands.
    expect(await wheel(box(w), 100, false)).toBe(true);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '49');
    expect(await wheel(box(w), 100, true)).toBe(false);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '60');

    // The pinch: two pointers from 100 px to 200 px apart halve the field, together to 50 px double it, held at 90°.
    await pinch(box(w), 100, 200);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '30');
    await expect(w).toHaveAttribute('data-look-az', '0');
    await expect(w).toHaveAttribute('data-look-alt', '35');
    await pinch(box(w), 200, 50);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '90');
    await pinch(box(w), 50, 500);
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', '20');
    // Picking a facing point keeps the zoom (FR-SKY-14).
    await page.getByTestId('live-layout').locator('[data-slot="picker"]').getByRole('group', { name: 'Facing' }).locator('[data-option="E"]').click();
    await expect(w).toHaveAttribute('data-look-az', '90');
    await expect(w).toHaveAttribute('data-fov', '20');

    // At the narrowest field the drag is still the dome's 4 px per degree: 120 px right turns the view 30° left (`live-perf`'s rate, unchanged).
    await page.mouse.move(centre.x + centre.width / 2, centre.y + centre.height / 2);
    await page.mouse.down();
    await page.mouse.move(centre.x + centre.width / 2 + 120, centre.y + centre.height / 2, { steps: 5 });
    await page.clock.runFor(FRAME_MS);
    await page.mouse.up();
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-look-az', '60');
    await expect(w).toHaveAttribute('data-fov', '20');
    // The dome and back keeps the camera (the chart's slot, D-789), the field with it; nothing of it is saved.
    const toggle = page.getByRole('group', { name: 'Chart view' });
    await toggle.getByRole('button', { name: 'Dome' }).click();
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(page.getByTestId('sky-chart').locator('[data-look-az]')).toHaveAttribute('data-fov', '20');
    expect(JSON.stringify(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)))).not.toMatch(/fov/i);
  });
});

test.describe('the deep chunk on the live page (R155, FR-LOOK-8 as amended)', () => {
  test.use({ viewport: DESK, hasTouch: false });

  test('with [ ] stars the chunk is never requested; turning the stars on requests it once, after the stars chunk', async ({ page }) => {
    const chunks = watchStarChunks(page);
    const w = await openLiveWindow(page, { observer: PARIS, chartView: 'window', starsLayer: false });
    await expect(page.getByTestId('stars-toggle')).toHaveAttribute('aria-pressed', 'false');
    // The stars chunk is prefetched on idle with the layer off (D-791); the deep one is not, since no field draws stars.
    await page.clock.runFor(6_000);
    await expect.poll(() => chunks.filter((name) => name === 'Stars').length).toBe(1);
    expect(chunks).not.toContain('deep');
    await page.getByTestId('stars-toggle').click();
    await expect(page.getByTestId('stars-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(w.locator('[data-layer="stars"]')).toBeAttached();
    await page.clock.runFor(6_000);
    await expect(w.locator('[data-layer="stars"]')).toHaveAttribute('data-deep', /^[1-9]\d*$/, { timeout: 30_000 });
    expect(chunks).toEqual(['Stars', 'deep']);
    // Once per visit: a second field (the dome and back) asks for nothing again.
    const toggle = page.getByRole('group', { name: 'Chart view' });
    await toggle.getByRole('button', { name: 'Dome' }).click();
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(6_000);
    expect(chunks).toEqual(['Stars', 'deep']);
  });
});

test.describe('zoom on the stars page', () => {
  test.use({ viewport: DESK, hasTouch: false });

  test('+ narrows the field and the list with it, 0 restores it, the pinch and ctrl + wheel work on the box, and a reload opens at 60°', async ({ page }) => {
    const w = await openStars(page);
    await expect(w).toHaveAttribute('data-fov', '60');
    await expect(readout(page)).toHaveText(READOUT);
    const rows = page.getByRole('list', { name: 'In this field' }).getByRole('button');
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    const listed = await rows.count();
    const before = await placedAt(zenith(w));
    // The page opens with the box focused (FR-A11Y-1..3): the keys reach it at once.
    await expect(box(w)).toBeFocused();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('+');
    await expect(w).toHaveAttribute('data-fov', '31');
    await expect(readout(page)).toHaveText(READOUT);
    await expect(w).toHaveAttribute('data-look-az', '180');
    await expect(w).toHaveAttribute('data-look-alt', '35');
    expect((await placedAt(zenith(w))).y).toBeLessThan(before.y - 50);
    // `In this field` lists what the narrowed box shows: never more than at 60°.
    await expect.poll(async () => rows.count()).toBeLessThanOrEqual(listed);
    await page.keyboard.press('0');
    await expect(w).toHaveAttribute('data-fov', '60');
    await expect.poll(async () => rows.count()).toBe(listed);
    // The pinch and the wheel on this box too; the picker's point keeps the zoom.
    await pinch(box(w), 100, 200);
    await expect(w).toHaveAttribute('data-fov', '30');
    const centre = await box(w).boundingBox();
    if (!centre) throw new Error('no box');
    await page.mouse.move(centre.x + centre.width / 2, centre.y + centre.height / 2);
    await ctrlWheel(page, -100);
    await expect(w).toHaveAttribute('data-fov', '25');
    await page.getByRole('group', { name: 'Facing' }).locator('[data-option="W"]').click();
    await expect(w).toHaveAttribute('data-look-az', '270');
    await expect(w).toHaveAttribute('data-fov', '25');
    expect(await wheel(box(w), 100, false)).toBe(true);
    await expect(w).toHaveAttribute('data-fov', '25');
    // Never saved: the reload opens at the default field.
    await page.reload();
    await expect(page.getByTestId('stars-sky').locator('[data-look-az]')).toHaveAttribute('data-fov', '60');
    expect(await page.evaluate((key) => localStorage.getItem(key) ?? '', PREFS_KEY)).not.toMatch(/fov/i);
  });
});

test.describe('zoom on a compact page without a sensor', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  /**
   * R155 (FR-LOOK-8 as amended, FR-LOOK-9; US-47 AC5): detail follows the field. At 60° the window draws the
   * bright catalogue and the deep stars to 5.3; a pinch to 20° draws to 6.5 and names to 3.2, so a designation
   * stands beside a star with no proper name. The deep chunk is requested once, after the stars chunk.
   */
  test('a pinch from 60° to 20° brings in the deep stars and names a designation, with the deep chunk requested once after stars', async ({ page }) => {
    const chunks = watchStarChunks(page);
    const w = await openStars(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(w).toHaveAttribute('data-fov', '60');
    // Turned to SW 35° up, where Ara's three bright stars with no proper name stand on the fixture night (Alp, Bet and Zet Ara, V 2.8–3.1).
    await box(w).focus();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
    await expect(w).toHaveAttribute('data-look-az', '225');
    await expect(w).toHaveAttribute('data-look-alt', '35');
    await expect(w.locator('[data-layer="stars"]')).toHaveAttribute('data-deep', /^[1-9]\d*$/, { timeout: 30_000 });
    expect(chunks).toEqual(['Stars', 'deep']);
    const deep = w.locator('[data-layer="stars"] [data-deep-pool] > circle:not([visibility="hidden"])');
    await expect.poll(() => deep.count()).toBeGreaterThan(0);
    const at60 = await drawnStars(w).count();
    const deepAt60 = await deep.count();
    const names60 = await w.locator('[data-star-name][visibility="visible"]').allTextContents();
    expect(names60.filter((name) => DESIGNATION.test(name))).toEqual([]);
    await pinch(box(w), 40, 120);
    await expect(w).toHaveAttribute('data-fov', '20');
    const at20 = await drawnStars(w).count();
    const deepAt20 = await deep.count();
    expect(deepAt20).toBeGreaterThan(0);
    const names20 = await w.locator('[data-star-name][visibility="visible"]').allTextContents();
    console.log(`[FR-LOOK-9] 390 px, SW 35° up over Neuquén on the fixture night: ${String(at60)} stars drawn at 60° (${String(deepAt60)} deep), ${String(at20)} at 20° (${String(deepAt20)} deep); names at 60°: ${names60.join(', ')}; at 20°: ${names20.join(', ')}`);
    expect(names20.some((name) => DESIGNATION.test(name)), names20.join(', ')).toBe(true);
    expect(chunks).toEqual(['Stars', 'deep']);
  });

  test('the pinch narrows the stars page’s box on a phone-sized window', async ({ page }) => {
    const w = await openStars(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(w).toHaveAttribute('data-fov', '60');
    await pinch(box(w), 80, 160);
    await expect(w).toHaveAttribute('data-fov', '30');
    await expect(w).toHaveAttribute('data-look-az', '180');
    await page.screenshot({ path: `${CAPTURE_DIR}/r125-stars-390-window-30-dark-en.png` });
    await pinch(box(w), 160, 40);
    await expect(w).toHaveAttribute('data-fov', '90');
    await expect(readout(page)).toHaveText(READOUT);
  });
});
