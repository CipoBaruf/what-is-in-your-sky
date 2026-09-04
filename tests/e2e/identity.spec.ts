/**
 * R12 (FR-X-1, FR-X-5, FR-X-6, US-5 AC2, spec §8 rank 1) at 390 px: on the
 * Home screen with passes, Tab reaches every control in DOM order and comes
 * back to the start; on every screen (Home empty, Home with passes, the
 * detail sheet) the ground is dark, every element is monospace, nothing
 * scrolls sideways and every control is at least 44 px tall and wide. The
 * hero card pins the next ISS pass, "best first" reorders the list and the
 * choice survives a reload. Screenshots of the three screens are saved for
 * the PR.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const DAY_MS = 86_400_000;
const MIN_TAP_PX = 44;
const GROUND = 'rgb(11, 15, 20)';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
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
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
});

/** The FR-X-1 / FR-X-6 / G6 checks every screen must pass at 390 px. */
async function expectIdentity(page: Page, screenshot: string, { fullPage = true } = {}): Promise<void> {
  // R20: the ground moved from `body` to `html[data-theme]`, so that a night reader gets no dark frame before `main.tsx` runs (FR-THEME-1).
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(GROUND);
  expect(await page.evaluate(() => document.querySelector('canvas'))).toBeNull(); // FR-GUIDE-5 (R13): DOM and SVG only, on every screen
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const nonMono = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .filter((el) => el.checkVisibility() && /\S/.test(el.textContent ?? ''))
      .map((el) => getComputedStyle(el).fontFamily)
      .filter((family) => !/monospace/i.test(family)),
  );
  expect(nonMono).toEqual([]);
  const small = await page.evaluate(
    (min) =>
      Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, [tabindex="0"]'))
        .filter((el) => el.checkVisibility() && !el.closest('[inert]'))
        .map((el) => {
          const { width, height } = el.getBoundingClientRect();
          return { control: `${el.tagName.toLowerCase()} ${el.textContent?.trim() || el.getAttribute('aria-label') || el.id}`, width: Math.round(width), height: Math.round(height) };
        })
        .filter(({ width, height }) => width < min || height < min),
    MIN_TAP_PX,
  );
  expect(small).toEqual([]);
  await page.screenshot({ path: `test-results/${screenshot}`, fullPage });
}

async function homeWithPasses(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 24 h/, { timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Right now' }).getByText(/as of /)).toBeVisible();
}

test('Home: dark monospace frame, no sideways scroll, every control ≥ 44 px, empty and with passes; the detail sheet likewise', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText('What is in your sky right now');
  await expect(page.getByRole('contentinfo')).toContainText('Orbital elements by CelesTrak.');
  await expect(page.getByRole('contentinfo')).toContainText('Weather data by Open-Meteo.com (CC BY 4.0).');
  await expect(page.getByRole('contentinfo')).toContainText('Place search by Open-Meteo geocoding, with data from GeoNames (CC BY 4.0).');
  await expectIdentity(page, 'r12-home-390.png');

  await homeWithPasses(page);
  await expectIdentity(page, 'r12-home-passes-390.png');

  await page.getByTestId('iss-hero').getByRole('button', { name: /Open guide/ }).click();
  await expect(page.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeVisible();
  await expectIdentity(page, 'r12-detail-390.png', { fullPage: false }); // the sheet is fixed to the viewport; a full-page capture would show the list behind it
});

test.describe('cloud badge tooltip (R12 review)', () => {
  test.use({ hasTouch: true }); // for the tap step

  test('is a box under the badge that moves nothing, opens on hover, focus and tap, and stays inside the screen', async ({ page }) => {
    await homeWithPasses(page);
    const panel = page.getByRole('region', { name: 'Right now' });
    const badge = panel.getByText('Weather unknown');
    const tip = panel.getByRole('tooltip');
    await expect(tip).toBeHidden();
    await badge.scrollIntoViewIfNeeded();
    const before = await badge.boundingBox();
    if (!before) throw new Error('badge has no box');

    await badge.hover();
    await expect(tip).toBeVisible();
    expect(await badge.boundingBox()).toEqual(before); // the badge did not jump
    const box = await tip.boundingBox();
    if (!box) throw new Error('tooltip has no box');
    expect(box.y).toBeGreaterThanOrEqual(before.y + before.height - 12); // right under the badge (the inline-control box carries 12 px of padding)
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const style = await tip.evaluate((el) => ({ border: getComputedStyle(el).borderTopStyle, background: getComputedStyle(el).backgroundColor }));
    expect(style).toEqual({ border: 'solid', background: 'rgb(22, 28, 36)' });
    await expect(tip).toContainText('Clear below 30 %');

    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();
    await badge.focus();
    await expect(tip).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(tip).toBeHidden();
    await badge.tap();
    await expect(tip).toBeVisible();
  });
});

test('Tab reaches every control on the Home screen in DOM order, then wraps to the first', async ({ page }) => {
  await homeWithPasses(page);
  const expected = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex="0"]')).filter((el) => el.checkVisibility()).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent?.trim() || el.getAttribute('aria-label') || el.id).slice(0, 40)}`),
  );
  // Place, coordinates, altitude, device button, clear, Now-panel badge, hero (open guide, cloud badge), two sort buttons, ≥ 1 card × (open guide, badge), 3 footer links.
  expect(expected.length).toBeGreaterThanOrEqual(15);
  expect(expected).toContain('input:place');
  // R17 and R20: the header's language and theme switches are the first four controls on the page, in that order.
  expect(expected.slice(0, 4)).toEqual(['button:English', 'button:Español', 'button:Dark', 'button:Night']);
  expect(expected).toContain('button:Use my location');
  expect(expected).toContain('button:Clear saved location');
  expect(expected).toContain('button:Soonest first');
  expect(expected).toContain('button:Best first');
  expect(expected).toContain('a:CelesTrak');
  expect(expected.filter((c) => c.startsWith('button:Open guide')).length).toBeGreaterThanOrEqual(2);

  // Start from the top: a click on the title moves Chromium's sequential-focus starting point there (a blur alone leaves it at the coordinates field the fill focused).
  await page.getByRole('banner').getByRole('heading', { level: 1 }).click();
  const reached: { control: string; ring: boolean }[] = [];
  for (const _step of expected) {
    await page.keyboard.press('Tab');
    reached.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { control: 'none', ring: false };
        // The focused control shows the accent ring (FR-X-5); a card's open control hands its ring to the card.
        const outlined = (node: Element): boolean => getComputedStyle(node).outlineStyle !== 'none' && getComputedStyle(node).outlineWidth !== '0px';
        const card = el.closest('article');
        return { control: `${el.tagName.toLowerCase()}:${(el.textContent?.trim() || el.getAttribute('aria-label') || el.id).slice(0, 40)}`, ring: outlined(el) || (card !== null && outlined(card)) };
      }),
    );
  }
  expect(reached.map((r) => r.control)).toEqual(expected);
  expect(reached.filter((r) => !r.ring).map((r) => r.control)).toEqual([]);
  // Past the last link focus leaves the document (body), and the next Tab wraps to the first control.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('English');
});

test('the hero card pins the next ISS pass; "best first" reorders the list and the choice survives a reload (US-5 AC2)', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  await homeWithPasses(page);
  const hero = page.getByTestId('iss-hero');
  await expect(hero).toContainText('Next ISS pass');
  await expect(hero.getByRole('timer')).toHaveText(/Appears in \d+:\d\d/);
  expect(Math.abs(Number((await hero.getAttribute('data-pass-id'))?.split('-')[1]) - golden.start.t)).toBeLessThanOrEqual(5_000);
  await expect(page.getByRole('article', { name: 'ISS (Zarya)' })).toHaveCount(1);

  const list = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('list');
  const scores = async (): Promise<number[]> =>
    list.locator('article').evaluateAll((cards) =>
      cards.map((card) => {
        const value = (label: string): string => Array.from(card.querySelectorAll('dt')).find((dt) => dt.textContent === label)?.nextElementSibling?.textContent ?? '';
        const mag = Number(value('Magnitude').split(',')[0]?.replace('−', '-').replace('+', ''));
        const el = Number(value('Max elevation').replace('°', ''));
        return 10 ** (-0.4 * mag) * el;
      }),
    );
  const starts = async (): Promise<string[]> => list.locator('article').evaluateAll((cards) => cards.map((card) => Array.from(card.querySelectorAll('dt')).find((dt) => dt.textContent === 'Start')?.nextElementSibling?.textContent ?? ''));
  const chronological = await starts();
  expect(chronological.length).toBeGreaterThan(2);
  expect([...chronological].sort()).toEqual(chronological);

  await page.getByRole('button', { name: 'Best first' }).click();
  await expect(page.getByRole('button', { name: 'Best first' })).toHaveAttribute('aria-pressed', 'true');
  const best = await scores();
  expect([...best].sort((a, b) => b - a)).toEqual(best);
  expect(await starts()).not.toEqual(chronological);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'))) ?? '{}')).toMatchObject({ sort: 'best' });

  await page.reload();
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 24 h/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Best first' })).toHaveAttribute('aria-pressed', 'true');
  expect([...(await scores())].sort((a, b) => b - a)).toEqual(await scores());
});
