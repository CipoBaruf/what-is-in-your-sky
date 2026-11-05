/**
 * R188 (FR-FACT-2, FR-FACT-3, FR-WIDE-7): the facts group and the hover in a browser — where a pass's arc is drawn on
 * the globe, where the stars list's first row's mark is, and the live page with `threePasses.ts`'s three arcs.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { seedThreePasses } from './threePasses';

/** The live page on a desk with three passes up, the globe drawing all three. */
export async function openLiveThreePasses(page: Page): Promise<void> {
  await seedThreePasses(page);
  await page.goto('/#live');
  await page.reload();
  await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'globe', { timeout: 30_000 });
  await expect.poll(() => page.locator('[data-globe] [data-arc-series][data-pass-ids]:not([data-pass-ids=""])').count(), { timeout: 30_000 }).toBe(3);
}

/** A pass's arc path on the globe. */
export const arcOf = (page: Page, passId: string): Locator => page.locator(`[data-globe] [data-arc-series][data-pass-ids="${passId}"]`);

/**
 * A point on the page on a pass's drawn line, `share` of the way along its first drawn run (not on the marker's or
 * the rise's ring, which the path also holds), mapped from the SVG's user space by its screen matrix.
 */
export function arcPoint(page: Page, passId: string, share = 0.5): Promise<{ x: number; y: number }> {
  return arcOf(page, passId).evaluate((path, at) => {
    const run = (path.getAttribute('d') ?? '').split(/(?=M)/)[0] ?? '';
    const numbers = (run.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const points: [number, number][] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i] ?? 0, numbers[i + 1] ?? 0]);
    const [x, y] = points[Math.min(points.length - 1, Math.floor(points.length * at))] ?? [0, 0];
    const m = (path as SVGGraphicsElement).getScreenCTM();
    if (!m) throw new Error('the arc has no screen matrix');
    return { x: x * m.a + y * m.c + m.e, y: x * m.b + y * m.d + m.f };
  }, share);
}

/**
 * A point on a pass's line with no star, planet or figure under it — a click there picks the pass and not the mark
 * (`SkyGlobe` tests the marks first): the pointer rests on each candidate until the arc's row answers the hover and
 * the globe names nothing.
 */
export async function clearArcPoint(page: Page, passId: string): Promise<{ x: number; y: number }> {
  const row = page.getByTestId('chart-legend').locator(`button[data-pass-id="${passId}"]`);
  for (const share of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]) {
    const at = await arcPoint(page, passId, share);
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(150);
    if ((await row.getAttribute('data-hovered')) === 'true' && (await page.getByTestId('globe-named').count()) === 0) return at;
  }
  throw new Error(`no clear point on ${passId}'s arc`);
}

/** The legend's ids in list order. */
export function legendIds(page: Page): Promise<string[]> {
  return page.getByTestId('chart-legend').locator('button[data-pass-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-pass-id') ?? ''));
}

/** A node's centre on the page. */
async function centre(node: Locator): Promise<{ x: number; y: number }> {
  const rect = await node.boundingBox();
  if (!rect) throw new Error('the node has no box');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;

/**
 * FR-FACT-3: click the drawn mark of the stars list's first row on the globe — the star's glyph by its catalogue
 * index, or the planet's disc by its name — and answer what was clicked.
 */
export async function clickFirstRowMark(page: Page): Promise<'star' | 'planet'> {
  const row = page.getByTestId('stars-field').locator('button[data-index]').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const index = (await row.getAttribute('data-index')) ?? '';
  const words = (await row.textContent()) ?? '';
  const star = page.locator(`[data-globe] [data-star="${index}"]`);
  const planet = PLANETS.find((name) => words.includes(name));
  const mark = (await star.count()) > 0 ? star : page.locator(`[data-globe] [data-planet="${planet ?? ''}"]`);
  await expect(mark).toHaveAttribute('visibility', 'visible');
  const at = await centre(mark);
  await page.mouse.click(at.x, at.y);
  return (await star.count()) > 0 ? 'star' : 'planet';
}
