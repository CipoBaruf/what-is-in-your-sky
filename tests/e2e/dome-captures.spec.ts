/**
 * R21 captures (FR-DOME-1..4, FR-DOME-7, FR-DOME-8): the layered dome on the
 * guide sheet at both widths and in both themes, for the PR's visual review.
 * Evidence, not a test — the assertions here only make sure the capture shows
 * a drawn dome rather than a Suspense fallback or an empty box.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

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

/** The golden pass grazes the horizon; the highest pass of the night shows the dome with an arc across it. */
type Which = 'golden' | 'highest';

async function openSheet(page: Page, which: Which): Promise<void> {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
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
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });

  const list = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('list');
  if (which === 'golden') {
    // The next ISS pass is pinned as the hero card, above the list rather than inside it (US-5).
    await page.locator(`article[data-pass-id="25544-${String(pass.start.t)}"]`).getByRole('button', { name: /Open guide/ }).click();
  } else {
    const highest = await list.locator('article').evaluateAll((cards) => {
      const elevation = (card: Element): number =>
        Number(Array.from(card.querySelectorAll('dt')).find((dt) => dt.textContent === 'Max elevation')?.nextElementSibling?.textContent?.replace('°', '') ?? 0);
      return cards.map((card) => ({ id: card.getAttribute('data-pass-id') ?? '', el: elevation(card) })).sort((a, b) => b.el - a.el)[0];
    });
    if (!highest) throw new Error('no passes to choose from');
    await list.locator(`article[data-pass-id="${highest.id}"]`).getByRole('button', { name: /Open guide/ }).click();
  }

  const figure = guide(page).getByRole('figure');
  // FR-DOME-7: no toggle needed — the guide opens on the dome.
  await expect(figure).toHaveAttribute('data-view', 'dome');
  await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await expect(figure.locator('[data-layer="base"] pre.glyph-output')).toBeVisible();
  await showDome(page);
}

/** D-119: the wide guide column is its own scrollport, so the drawing is scrolled into view rather than the page. */
async function showDome(page: Page): Promise<void> {
  await guide(page).locator('[data-drawing="dome"]').scrollIntoViewIfNeeded();
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function setNight(page: Page): Promise<void> {
  // D-99: the compact sheet carries its own switch, because it covers the header's. The wide shell has only the header's.
  const inGuide = guide(page).getByRole('group', { name: 'Theme' });
  const themes = (await inGuide.count()) > 0 ? inGuide : page.getByRole('banner').getByRole('group', { name: 'Theme' });
  await themes.getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  // Bring the drawing back into frame before the capture.
  await showDome(page);
}

for (const width of [390, 1280] as const) {
  for (const which of ['golden', 'highest'] as const) {
    test(`the ${which} pass's dome at ${String(width)} px, in both themes`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await openSheet(page, which);
      await page.screenshot({ path: `test-results/r21-dome-${which}-${String(width)}-dark.png` });
      await setNight(page);
      await page.screenshot({ path: `test-results/r21-dome-${which}-${String(width)}-night.png` });
    });
  }
}
