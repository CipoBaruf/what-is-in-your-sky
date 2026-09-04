/**
 * R21 captures (FR-DOME-1..4, FR-DOME-7, FR-DOME-8): the layered dome on the
 * guide sheet at both widths and in both themes, for the PR's visual review.
 * Evidence, not a test — the assertions here only make sure the capture shows
 * a drawn dome rather than a Suspense fallback or an empty box.
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

  const figure = page.getByRole('dialog').getByRole('figure');
  // FR-DOME-7: no toggle needed — the sheet opens on the dome.
  await expect(figure).toHaveAttribute('data-view', 'dome');
  await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await expect(figure.locator('[data-layer="base"] pre.glyph-output')).toBeVisible();
  await figure.evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

async function setNight(page: Page): Promise<void> {
  await page.getByRole('dialog').getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  // The switch is at the top of the sheet, so bring the drawing back into frame before the capture.
  await page.getByRole('dialog').getByRole('figure').evaluate((el) => el.scrollIntoView({ block: 'start' }));
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
