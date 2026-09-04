/**
 * R22 captures (FR-DOME-5, FR-DOME-6, FR-DOME-7): both chart views with the
 * satellite on its arc, the flown part behind it, the Sun's glow on the
 * horizon and the Moon where it is — at both widths, in both themes and in
 * both languages. Evidence for the PR, not a test: the assertions here only
 * make sure the capture shows the thing it is named after.
 *
 * The observer and the clock are `moon.spec.ts`'s Paris fixture, twenty
 * seconds into the ISS pass whose peak the Moon stands 8° from: the one
 * instant in the committed fixtures where a pass is happening, the Moon is
 * 60° up and the Sun is inside FR-DOME-6's twilight band all at once.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

const FIXTURE_DATE = '2026-09-02';
const PARIS = '48.86, 2.35';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
/**
 * The page is loaded at `moon.spec.ts`'s clock, which is the one the committed
 * pass ids were computed at (a pass already under way is not in the list at
 * all: the search window starts at `now`). The clock is then *set* forward to
 * ten seconds before the instant wanted and one tick is run, so the sheet
 * arrives there through its own 10 s tick rather than through three hundred of
 * them. Three minutes into a six-minute pass puts the marker near the peak
 * with half the arc behind it, which is where FR-DOME-5's two colours read.
 */
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;

type View = 'dome' | 'polar';

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function openChart(page: Page, width: 390 | 1280, locale: 'en' | 'es', view: View): Promise<void> {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
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
  // The choice is remembered (FR-I18N-5), so the group's own name is already
  // Spanish on the second pass; the option's label is the same in both.
  if (locale === 'es') await page.getByRole('banner').getByRole('button', { name: 'Español' }).click();
  await page.getByLabel(locale === 'es' ? 'Coordenadas (lat, lon)' : 'Coordinates (lat, lon)').fill(PARIS);
  const passes = page.getByRole('region', { name: locale === 'es' ? 'Próximos pases' : 'Upcoming passes' });
  await expect(passes.getByRole('status')).toHaveText(/\d+ (visible passes in the next 72 h|pases visibles en las próximas 72 h)/, { timeout: 60_000 });
  await page.locator(`article[data-pass-id="${GLARE_PASS}"]`).getByRole('button', { name: locale === 'es' ? /Abrir la guía/ : /Open guide/ }).click();

  const figure = guide(page).getByRole('figure');
  if (view === 'polar') {
    await guide(page)
      .getByRole('group', { name: locale === 'es' ? 'Vista del gráfico' : 'Chart view' })
      .getByRole('button', { name: locale === 'es' ? 'Polar' : 'Polar' })
      .click();
  }
  await expect(figure).toHaveAttribute('data-view', view);
  // The chart chunk, the raster font and glyphcss's first rasterisation all
  // wait on timers the installed clock is holding; a second of it lets them go.
  await page.clock.runFor(1000);
  if (view === 'dome') await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });

  // …and then into the pass, arriving on the tick the sheet lives by.
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);

  // What the capture is named after: the live marker, the flown arc, the Sun
  // and the Moon. In the dome they live in the raster, so the labels stand for
  // the two bodies there and the polar view carries the markers as elements.
  await expect(figure.locator('[data-anchor="sun"]')).toHaveCount(1);
  await expect(figure.locator('[data-anchor="moon"]')).toHaveCount(1);
  if (view === 'polar') {
    await expect(figure.locator('[data-marker="now"]')).toHaveCount(1);
    await expect(figure.locator('[data-marker="flown"]')).toHaveCount(1);
  }
  await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
}

/** The theme is remembered (US-19), so a capture run has to put it back before the next one starts. */
async function setTheme(page: Page, theme: 'dark' | 'night'): Promise<void> {
  const inGuide = guide(page).getByRole('group', { name: 'Theme' });
  const themes = (await inGuide.count()) > 0 ? inGuide : page.getByRole('banner').getByRole('group', { name: 'Theme' });
  await themes.getByRole('button', { name: theme === 'night' ? 'Night' : 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await guide(page).getByRole('figure').locator('[data-drawing]').scrollIntoViewIfNeeded();
}

for (const width of [390, 1280] as const) {
  for (const view of ['dome', 'polar'] as const) {
    test(`the ${view} view mid-pass at ${String(width)} px, in both themes`, async ({ page }) => {
      await openChart(page, width, 'en', view);
      await page.screenshot({ path: `docs/screenshots/r22-${view}-${String(width)}-dark-en.png` });
      await setTheme(page, 'night');
      await page.screenshot({ path: `docs/screenshots/r22-${view}-${String(width)}-night-en.png` });
      await setTheme(page, 'dark');
    });
  }
}

test('both views mid-pass in Spanish at 390 px: the Sun and the Moon are named in the page language', async ({ page }) => {
  for (const view of ['dome', 'polar'] as const) {
    await openChart(page, 390, 'es', view);
    await expect(guide(page).locator('[data-anchor="sun"]')).toHaveText('Sol');
    await expect(guide(page).locator('[data-anchor="moon"]')).toContainText('Luna');
    await page.screenshot({ path: `docs/screenshots/r22-${view}-390-dark-es.png` });
  }
});
