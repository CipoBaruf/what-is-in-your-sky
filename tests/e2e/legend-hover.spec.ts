/**
 * R188 (FR-WIDE-7, US-55 AC1): on a desk the list and the drawing answer each other — a hover on a legend row
 * emphasises its arc as the highlight does, a hover on an arc its row; leaving both restores them, and nothing is
 * written: not the hash, not the saved preferences.
 */
import { expect, test } from '@playwright/test';
import { arcOf, arcPoint, legendIds, openLiveThreePasses } from './factsHelpers';

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

test('FR-WIDE-7: hover a row, its arc; hover the arc, its row; leave, both restored; the hash unchanged', async ({ page }) => {
  await openLiveThreePasses(page);
  const ids = await legendIds(page);
  expect(ids).toHaveLength(3);
  const [first = '', second = ''] = ids;
  const hash = await page.evaluate(() => window.location.hash);
  const prefs = await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'));
  const row = (id: string) => page.getByTestId('chart-legend').locator(`button[data-pass-id="${id}"]`);
  // Nothing highlighted on the live page: every arc at full weight.
  for (const id of ids) await expect(arcOf(page, id)).toHaveAttribute('data-dim', 'false');

  await row(second).hover();
  await expect(row(second)).toHaveAttribute('data-hovered', 'true');
  await expect(arcOf(page, second)).toHaveAttribute('data-dim', 'false');
  await expect(arcOf(page, first)).toHaveAttribute('data-dim', 'true');
  await page.mouse.move(2, 2);
  await expect(row(second)).toHaveAttribute('data-hovered', 'false');
  for (const id of ids) await expect(arcOf(page, id)).toHaveAttribute('data-dim', 'false');

  const on = await arcPoint(page, first);
  await page.mouse.move(on.x, on.y);
  await expect(row(first)).toHaveAttribute('data-hovered', 'true');
  await expect(row(first)).toHaveClass(/hovered/);
  await expect(arcOf(page, second)).toHaveAttribute('data-dim', 'true');
  await page.mouse.move(2, 2);
  await expect(row(first)).toHaveAttribute('data-hovered', 'false');
  for (const id of ids) await expect(arcOf(page, id)).toHaveAttribute('data-dim', 'false');

  expect(await page.evaluate(() => window.location.hash)).toBe(hash);
  expect(await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'))).toBe(prefs);
  // A hover pins nothing: no row pressed, no facts open.
  await expect(page.getByTestId('chart-legend').locator('button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId('facts-group')).toHaveCount(0);
});

test('FR-CTRL-15: a pressed row is picked — aria-pressed, the 2 px accent line down its left edge, its name in its own ink', async ({ page }) => {
  await openLiveThreePasses(page);
  const [, second = ''] = await legendIds(page);
  const row = page.getByTestId('chart-legend').locator(`button[data-pass-id="${second}"]`);
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  const look = () =>
    row.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.style.color = 'var(--fg)';
      const fg = getComputedStyle(probe).color;
      probe.remove();
      const line = getComputedStyle(el, '::before');
      const name = el.querySelector('[class*="nameText"]');
      return { width: line.borderLeftWidth, colour: line.borderLeftColor, content: line.content, accent, fg, name: name ? getComputedStyle(name).color : '' };
    });
  expect((await look()).content).toBe('none');
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  const picked = await look();
  expect(picked.width).toBe('2px');
  expect(picked.colour).toBe(picked.accent);
  expect(picked.name).toBe(picked.fg);
  await expect(page.getByTestId('chart-legend').locator('button[aria-pressed="true"]')).toHaveCount(1);
  // The pick moves the row to the top, so the pointer is often left over another row: a hover elsewhere dims the
  // picked row's arc, but its name keeps its ink (FR-CTRL-15).
  const other = page.getByTestId('chart-legend').locator(`button[data-pass-id]:not([data-pass-id="${second}"])`).first();
  await other.hover();
  await expect(other).toHaveAttribute('data-hovered', 'true');
  await expect(row).toHaveAttribute('data-highlighted', 'false');
  expect((await look()).name).toBe(picked.fg);
});
