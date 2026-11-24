/**
 * R170 (FR-GLOBE-1, FR-GLOBE-6, FR-GLOBE-11, FR-GLOBE-15; US-50 AC1, AC4; D-1035, D-1042): the globe in a browser, at
 * 1280 × 800 and 1920 × 1080 — a drag, the box's keys, the hover, the zoom keys; and at 390 × 844 the compact page,
 * which never asks for `SkyGlobe-*.js`. R222 (FR-LAND-3, D-1240): on the live page, the stars page having folded into
 * it; the stars page's own view row, steps, playback and `Place` group went with it.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLiveSky, showGlobe } from './globeHelpers';
import { seedThreePasses } from './threePasses';
import { seedStoredRun } from './liveHelpers';

/** Where the zenith's and the north pole's marks are drawn, to the pixel: the view's turn, read off the renderer's attributes. */
async function zenith(page: Page): Promise<string> {
  const read = async (selector: string): Promise<string> => {
    const mark = page.locator(`[data-globe] ${selector}`);
    return [await mark.getAttribute('x'), await mark.getAttribute('y'), await mark.getAttribute('visibility')].join(',');
  };
  return `${await read('[data-zenith]')} ${await read('[data-pole="north"]')}`;
}

/** A node's centre on the page. */
async function centre(node: Locator): Promise<{ x: number; y: number }> {
  const rect = await node.boundingBox();
  if (!rect) throw new Error('the node has no box');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** The globe's box and its disc's radius: what a hover must leave as it was (V212-13, D-1055). */
async function globeSize(page: Page): Promise<string> {
  const rect = await page.getByTestId('globe-box').boundingBox();
  return JSON.stringify([rect, await page.locator('[data-globe] [data-disc]').getAttribute('r')]);
}

const DESKS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

for (const viewport of DESKS) {
  test.describe(`the globe at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('turns under a drag and the box’s keys, and Home returns to the opening view (FR-GLOBE-6)', async ({ page }) => {
      await openLiveSky(page);
      await showGlobe(page);
      const box = page.getByTestId('globe-box');
      const before = await zenith(page);
      const rect = await box.boundingBox();
      if (!rect) throw new Error('the globe has no box');
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 10; i += 1) await page.mouse.move(cx + i * 8, cy - i * 4);
      await page.mouse.up();
      await expect.poll(() => zenith(page)).not.toBe(before);
      // The first gesture puts the hint away, which can give a height-bound box a few pixels: the opening view is read
      // after it, from Home.
      await box.focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(200);
      const opening = await zenith(page);
      await page.keyboard.press('ArrowUp');
      await expect.poll(() => zenith(page)).not.toBe(opening);
      await page.keyboard.press('Home');
      await expect.poll(() => zenith(page)).toBe(opening);
      await page.keyboard.press('Home');
      await page.keyboard.press('+');
      await expect.poll(() => zenith(page)).not.toBe(opening);
      await page.keyboard.press('Home');
      await expect.poll(() => zenith(page)).toBe(opening);
    });

    test('a hover on a star or a planet names it and never changes the globe’s size (FR-GLOBE-11 as amended, V212-13, D-1055)', async ({ page }) => {
      await openLiveSky(page);
      await showGlobe(page);
      await page.mouse.move(2, 2);
      await expect(page.getByTestId('globe-named')).toHaveCount(0);
      const before = await globeSize(page);
      const star = page.locator('[data-globe] [data-stars] text[visibility="visible"]').first();
      const starAt = await centre(star);
      await page.mouse.move(starAt.x, starAt.y);
      await expect(page.getByTestId('globe-named')).toHaveText(/ · mag /);
      expect(await globeSize(page)).toBe(before);
      await page.mouse.move(2, 2);
      await expect(page.getByTestId('globe-named')).toHaveCount(0);
      const planet = page.locator('[data-globe] [data-planet][visibility="visible"]').first();
      await expect(planet).toBeAttached();
      const planetAt = await centre(planet);
      await page.mouse.move(planetAt.x, planetAt.y);
      await expect(page.getByTestId('globe-named')).toHaveText(/ · mag /);
      expect(await globeSize(page)).toBe(before);
    });

    test('a hovered figure is drawn in the emphasis, its name shown with the names off, and leaving restores it (FR-GLOBE-11 as amended, V212-13)', async ({ page }) => {
      await openLiveSky(page);
      await showGlobe(page);
      await page.getByTestId('live-layers').getByRole('button', { name: 'names' }).click();
      const emphasis = page.locator('[data-globe] [data-figure-named]');
      await expect(emphasis).toHaveAttribute('d', '');
      const before = await globeSize(page);
      // The middles of the figures' drawn lines, in the box's own pixels; the first that names a figure is hovered.
      const middles = await page.locator('[data-globe] [data-figures="above"]').evaluate((path) =>
        [...(path.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: (Number(m[1]) + Number(m[3])) / 2, y: (Number(m[2]) + Number(m[4])) / 2, length: Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])) })).sort((a, b) => b.length - a.length),
      );
      const rect = await page.getByTestId('globe-box').boundingBox();
      if (!rect) throw new Error('the globe has no box');
      let found = false;
      for (const middle of middles.slice(0, 40)) {
        await page.mouse.move(rect.x + middle.x, rect.y + middle.y);
        if (((await emphasis.getAttribute('d')) ?? '') !== '') {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
      await expect(page.locator('[data-globe] [data-label][data-figure]')).toHaveAttribute('visibility', 'visible');
      await expect(page.getByTestId('globe-named')).not.toHaveText(/ · mag /);
      expect(await globeSize(page)).toBe(before);
      await page.mouse.move(2, 2);
      await expect(emphasis).toHaveAttribute('d', '');
      await expect(page.locator('[data-globe] [data-label]')).toHaveAttribute('visibility', 'hidden');
    });

    test('FR-CTRL-9: −, + and ⟲ under the box zoom a step each and back to the opening view; the hint goes at the first zoom and stays gone (D-1241)', async ({ page }) => {
      await openLiveSky(page);
      await showGlobe(page);
      const layout = page.getByTestId('live-layout');
      const hint = layout.getByTestId('sky-hint');
      await expect(hint).toHaveText('drag to turn · scroll to zoom');
      const row = layout.locator('[data-zoom-row]');
      const keys = row.locator('[data-zoom]');
      await expect(keys).toHaveCount(3);
      expect(await keys.evaluateAll((els) => els.map((el) => el.getAttribute('data-zoom')))).toEqual(['out', 'in', 'reset']);
      const disc = page.locator('[data-globe] [data-disc]');
      const r = Number(await disc.getAttribute('r'));
      await row.getByRole('button', { name: 'Zoom in' }).click();
      await expect.poll(async () => Number(await disc.getAttribute('r'))).toBeCloseTo(r * 1.25, 0);
      await expect(hint).toHaveCount(0);
      // The hint gone, the box is read: a zoom key leaves it as it was.
      const box = await page.getByTestId('globe-box').boundingBox();
      await row.getByRole('button', { name: 'Zoom in' }).click();
      await expect.poll(async () => Number(await disc.getAttribute('r'))).toBeCloseTo(r * 1.25 * 1.25, 0);
      await row.getByRole('button', { name: 'Reset view' }).click();
      await expect.poll(async () => Number(await disc.getAttribute('r'))).toBeCloseTo(r, 0);
      const out = row.getByRole('button', { name: 'Zoom out' });
      for (let i = 0; i < 4; i += 1) await out.click();
      await expect(out).toBeDisabled();
      expect(await page.getByTestId('globe-box').boundingBox()).toEqual(box);
      await page.reload();
      await showGlobe(page);
      await expect(page.getByTestId('sky-hint')).toHaveCount(0);
    });
  });
}

test.describe('the compact live page', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the live page never asks for SkyGlobe-*.js (FR-GLOBE-1, FR-GLOBE-15)', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (/SkyGlobe-|GlobeRail-/.test(request.url())) asked.push(request.url());
    });
    await openLiveSky(page);
    // Past the idle the wide page prefetches on.
    await page.waitForTimeout(1_500);
    expect(asked).toEqual([]);
    await expect(page.getByTestId('globe-box')).toHaveCount(0);
  });

  test('R188 (FR-WIDE-11): the compact pages never ask for facts-*.js — a pass and the live page', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (/\/facts-[^/]*\.(js|css)$/.test(request.url())) asked.push(request.url());
    });
    await seedStoredRun(page, { settled: true });
    await page.getByRole('button', { name: 'Open guide' }).first().click();
    await expect(page.locator('[role="dialog"][data-pass-id]')).toBeVisible();
    await page.waitForTimeout(1_500);
    await page.goto('/#live');
    await page.reload();
    await expect(page.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    // Past the idle the wide pages prefetch on.
    await page.waitForTimeout(1_500);
    expect(asked).toEqual([]);
    await expect(page.getByTestId('facts-group')).toHaveCount(0);
  });
});

/*
 * R186 (FR-WIDE-3, FR-WIDE-6; US-52 AC3, AC6; D-1099): the live page's globe on a desk. The capture set's instant has
 * one pass in FR-LIVE-2's set, on the far side of the pole-side opening view, so the three arcs are `threePasses.ts`'s
 * stored run at the suite's instant over Neuquén.
 */
test.describe('the live page’s globe at 1280 × 800', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  const drawnArcs = (page: Page): Promise<[string, string][]> =>
    page.locator('[data-globe] [data-arc-series]').evaluateAll((paths) => paths.filter((path) => (path.getAttribute('d') ?? '') !== '').map((path): [string, string] => [path.getAttribute('data-pass-ids') ?? '', path.getAttribute('data-color') ?? '']));

  test('FR-WIDE-3: three arcs at the instant, each in its legend row’s colour', async ({ page }) => {
    await seedThreePasses(page);
    await page.goto('/#live');
    await page.reload();
    await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'globe', { timeout: 30_000 });
    await expect.poll(async () => (await drawnArcs(page)).length, { timeout: 30_000 }).toBe(3);
    const legend = page.getByTestId('chart-legend');
    for (const [ids, color] of await drawnArcs(page)) {
      const swatch = legend.locator(`button[data-pass-id="${ids}"] [data-color]`);
      await expect(swatch, ids).toHaveAttribute('data-color', color);
    }
  });

  // FR-WIDE-6: the braille font is not asserted absent — the header's mark (FR-MARK-3) draws with it on every page
  // since R74, so the home asks for it before any chart; what the dome alone brings is its chunk, pinned here.
  test('FR-WIDE-6: a desk with nothing saved asks for no SkyDome-*.js; Dome chosen asks for it', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (/\/SkyDome-[^/]*\.(js|css)$/.test(request.url())) asked.push(request.url());
    });
    await seedThreePasses(page);
    await page.goto('/#live');
    await page.reload();
    await expect(page.locator('svg[data-globe][viewBox]')).toBeAttached({ timeout: 30_000 });
    // Past the idle the desk prefetches the globe on.
    await page.waitForTimeout(1_500);
    expect(asked).toEqual([]);
    await page.getByTestId('live-layout').getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Dome', exact: true }).click();
    await expect(page.locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
    expect(asked.length).toBeGreaterThan(0);
  });
});
