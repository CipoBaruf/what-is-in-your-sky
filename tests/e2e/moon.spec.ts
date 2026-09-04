/**
 * R30 (US-18, FR-MOON-2/3/4/5): the Moon on the page, from the real worker.
 *
 * The observer is the Paris fixture and the clock is fixed at
 * 2026-09-02T03:00Z, an hour before an ISS pass whose peak the Moon stands
 * 8° from, 60° up and 74 % lit — all three of FR-MOON-2's conditions, on the
 * committed OMM fixtures, which is why this observer and not the R1 one:
 * Neuquén has no glare pass anywhere in the fixture window. The negative is
 * the Tiangong pass sixteen hours later, whose Moon is below the horizon and
 * 118° away, so it fails the altitude condition on its own terms and the
 * separation with it; each condition failing alone is `physics/moon.test.ts`.
 *
 * The pass ids are `<norad>-<start ms>`, the ids the physics computes from
 * those fixtures at that clock. If a change to the search moves a start time,
 * these fail loudly here rather than quietly showing the wrong card.
 */
import { expect, test, type Page } from '@playwright/test';

const FIXTURE_DATE = '2026-09-02';
const PARIS = '48.86, 2.35';
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const GLARE_PASS = `25544-${String(Date.parse('2026-09-02T03:52:46.469Z'))}`; // ISS (Zarya)
const NO_GLARE_PASS = `48274-${String(Date.parse('2026-09-02T19:33:30.938Z'))}`; // Tiangong (Tianhe)

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(CLOCK);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // No forecast: the zone stays unknown and times stay in UTC, as in the other specs.
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
});

/** Enter the observer and wait for the finished list (D-105: the 72 h search takes three nights). */
async function listed(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(PARIS);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 60_000 });
}

test('the pass whose Moon is up, bright and close wears the label and the guide adds the sentence', async ({ page }) => {
  await listed(page);

  // The hero card shows the same ISS pass, so this id matches twice; both are the label's place.
  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`).first();
  await expect(card).toContainText('moon glare');
  // FR-MOON-2: the thresholds are in the tooltip, so the label can be judged.
  await expect(card.getByText('moon glare').first()).toHaveAccessibleDescription(/74 % lit and 8° from the pass peak.*at least 50 % lit and closer than 30°/);

  await card.getByRole('button', { name: /Open guide/ }).click();
  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(dialog).toContainText('The Moon is bright and close to the track.');
});

test('a pass that fails a condition shows neither the label nor the sentence', async ({ page }) => {
  await listed(page);

  const card = page.locator(`article[data-pass-id="${NO_GLARE_PASS}"]`);
  await expect(card).toHaveCount(1);
  await expect(card).not.toContainText('moon glare');

  await card.getByRole('button', { name: /Open guide/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Tiangong (Tianhe)' });
  await expect(dialog.getByTestId('guide-sentence')).toBeVisible(); // the guide is up…
  await expect(dialog).not.toContainText('The Moon is bright'); // …and says nothing about the Moon
});

test('the Now panel carries the Moon’s facts and the tradition line is a separate, labelled section', async ({ page }) => {
  await listed(page);

  const now = page.getByRole('region', { name: 'Right now' });
  await expect(now.getByTestId('moon-line')).toHaveText('Moon: waning gibbous, 74 % lit, SSE 164°, 60° up.');

  // FR-MOON-5: the lore is outside the facts, in a region whose own name says it is tradition.
  // (The section heading is drawn as a character rule, so the accessible name carries those
  // characters too — hence the substring matching Playwright does by default.)
  const lore = page.getByRole('region', { name: 'Moon tonight' });
  await expect(lore).toContainText('lore');
  await expect(lore).toContainText('The Moon is in Taurus');
  await expect(lore).toHaveAccessibleName(/Moon tonight.*\[lore\]/);
  await expect(now).not.toContainText('The Moon is in Taurus');
  await expect(page.getByRole('region', { name: 'Upcoming passes' })).not.toContainText('The Moon is in Taurus');

  // Both languages carry the tradition label (FR-MOON-5, FR-I18N-2).
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  const tradicion = page.getByRole('region', { name: 'La Luna esta noche' });
  await expect(tradicion).toContainText('tradición');
  await expect(tradicion).toContainText('La Luna está en Tauro');
  await expect(page.getByTestId('moon-line')).toContainText('Luna: gibosa menguante, 74 % iluminada');
});
