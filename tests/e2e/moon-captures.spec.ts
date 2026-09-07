/**
 * R30 captures (FR-MOON-2/3/4/5): the Moon line and the tradition section on
 * the page, the `[moon glare]` label with its tooltip open, and the guide's
 * one-sentence warning — both widths, both languages, both themes. Evidence
 * for the PR, not a test: the assertions here only make sure the capture
 * shows the thing it is named after.
 *
 * Same fixture and clock as `moon.spec.ts`: Paris at 2026-09-02T03:00Z, an
 * hour before the ISS pass whose peak the Moon stands 8° from.
 */
import { expect, test, type Page } from '@playwright/test';
import { withSettings } from './liveHelpers';

/*
 * FR-CI-2 (R37, D-195): off the pull-request path. These are evidence, as the
 * comment above says, and re-shooting them on every pull request bought
 * nothing and cost the FR-CI-1 budget the minute R52 needed. R37 moved the
 * `v1-*` set and four page specs and listed the rest as follow-ups; this is
 * the rest. The files stay committed and a task that changes these screens
 * re-shoots them on purpose:
 *
 *   CAPTURES=1 npx playwright test <this spec> --project=chromium
 */
test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');


const FIXTURE_DATE = '2026-09-02';
const PARIS = '48.86, 2.35';
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const GLARE_PASS = `25544-${String(Date.parse('2026-09-02T03:52:46.469Z'))}`;

async function open(page: Page, width: 390 | 1280, locale: 'en' | 'es'): Promise<void> {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await page.clock.setFixedTime(CLOCK);
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
  if (locale === 'es') await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  await withSettings(page, async () => {
    await page.getByLabel(locale === 'es' ? 'Coordenadas (lat, lon)' : 'Coordinates (lat, lon)').fill(PARIS);
  });
  const passes = page.getByRole('region', { name: locale === 'es' ? 'Próximos pases' : 'Upcoming passes' });
  await expect(passes.getByRole('status')).toHaveText(/\d+ (visible passes in the next 72 h|pases visibles en las próximas 72 h)/, { timeout: 60_000 });
  await expect(page.getByTestId('moon-line')).toBeVisible();
}

/** The theme is remembered (US-19), so a capture run has to put it back before the next language starts. */
async function setTheme(page: Page, theme: 'dark' | 'night'): Promise<void> {
  await page.getByRole('banner').getByRole('group', { name: 'Theme' }).getByRole('button', { name: theme === 'night' ? 'Night' : 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

for (const width of [390, 1280] as const) {
  test(`the Moon's facts and the tradition line at ${String(width)} px, in both languages and both themes`, async ({ page }) => {
    for (const locale of ['en', 'es'] as const) {
      await open(page, width, locale);
      await page.getByTestId('moon-lore').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/r30-home-${String(width)}-dark-${locale}.png` });
      if (locale === 'en') {
        await setTheme(page, 'night');
        await page.getByTestId('moon-lore').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/r30-home-${String(width)}-night-${locale}.png` });
        await setTheme(page, 'dark');
      }
    }
  });
}

test('the glare label with its tooltip open, and the guide sentence, at 390 px', async ({ page }) => {
  for (const locale of ['en', 'es'] as const) {
    await open(page, 390, locale);
    const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`).first();
    await card.scrollIntoViewIfNeeded();
    // The tooltip opens on focus as well as on hover (FR-X-5), which is what a capture can hold still.
    await card.getByText(locale === 'es' ? 'resplandor lunar' : 'moon glare').first().focus();
    await expect(card.getByRole('tooltip').first()).toBeVisible();
    await page.screenshot({ path: `test-results/r30-glare-390-dark-${locale}.png` });

    await card.getByRole('button', { name: locale === 'es' ? /Abrir la guía/ : /Open guide/ }).click();
    const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
    // Let the dome finish drawing, or the capture shows its loading line above the sentence.
    await expect(dialog.locator('[data-layer="base"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
    const note = dialog.getByTestId('moon-glare-note');
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeVisible();
    await page.screenshot({ path: `test-results/r30-guide-390-dark-${locale}.png` });
    if (locale === 'en') {
      // D-99: the compact sheet carries its own theme switch, because it covers the header's.
      const themes = dialog.getByRole('group', { name: 'Theme' });
      await themes.getByRole('button', { name: 'Night' }).click();
      await note.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/r30-guide-390-night-${locale}.png` });
      await themes.getByRole('button', { name: 'Dark' }).click();
    }
  }
});
