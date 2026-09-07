/**
 * R49 captures (US-18 AC1 via F-14, and F-30): the Moon's phase and
 * illumination on a pass card and in the guide at 390 px in both languages —
 * the line R30 only ever drew under a glare verdict — and the wide page with
 * both offers up and a guide open beside them, which is the shape F-30 is
 * about. Evidence for the PR, not a test: the assertions only make sure the
 * capture shows the thing it is named after.
 *
 * Same fixture and clock as `moon.spec.ts` and `moon-captures.spec.ts`: Paris
 * at 2026-09-02T03:00Z, where the Moon is 29° up and a waning gibbous, so
 * every pass that night has something to say about it.
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
}

test('the Moon at the peak on a card and in the guide, at 390 px in both languages', async ({ page }) => {
  for (const locale of ['en', 'es'] as const) {
    await open(page, 390, locale);
    const card = page.locator('article').filter({ has: page.getByTestId('moon-at-peak') }).first();
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByTestId('moon-at-peak')).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `docs/screenshots/r49-moon-card-390-dark-${locale}.png` });

    // The finding itself: a pass the worker did not mark, which said nothing
    // about the Moon before this task.
    const plain = page
      .locator('article')
      .filter({ has: page.getByTestId('moon-at-peak') })
      .filter({ hasNot: page.getByTestId('moon-glare-label') })
      .first();
    await plain.scrollIntoViewIfNeeded();
    await expect(plain.getByTestId('moon-at-peak')).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `docs/screenshots/r49-moon-card-no-glare-390-dark-${locale}.png` });

    await card.getByRole('button', { name: locale === 'es' ? /Abrir la guía/ : /Open guide/ }).click();
    const dialog = page.getByRole('dialog');
    // Let the dome finish drawing, or the capture shows its loading line instead.
    await expect(dialog.locator('[data-layer="base"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
    const line = dialog.getByTestId('moon-at-peak');
    await line.scrollIntoViewIfNeeded();
    await expect(line).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/r49-moon-guide-390-dark-${locale}.png` });
  }
});

test('the wide page with both offers up and a guide open beside them (F-30)', async ({ page }) => {
  // The same fake waiting worker as `update-banner.spec.ts`, with no reload to follow.
  await page.addInitScript(() => {
    const container = {
      controller: {},
      addEventListener: () => undefined,
      register: () => Promise.resolve({ waiting: { postMessage: () => undefined }, addEventListener: () => undefined }),
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => container });
  });
  await open(page, 1280, 'en');
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
  });
  await expect(page.getByTestId('update-banner')).toBeVisible();
  await expect(page.getByTestId('install-hint')).toBeVisible();

  await page.getByRole('button', { name: /Open guide/ }).first().click();
  const panel = page.getByRole('region', { name: /Guide:/ });
  await expect(panel).toBeVisible();
  // Both offers are still on the page and still readable; what changed is that
  // nothing in them can be reached (`App.wide.test.tsx` is the assertion).
  await expect(page.getByTestId('update-banner')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('install-hint')).toHaveAttribute('inert', '');
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'docs/screenshots/r49-offers-guide-1280-dark-en.png' });
});
