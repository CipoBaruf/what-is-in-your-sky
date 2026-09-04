/**
 * R31 (US-12, FR-SHARE-1, FR-SHARE-2): the whole round trip, on two devices.
 * The sender opens the golden ISS pass at Neuquén, shares it, and the link
 * lands on the clipboard; a fresh browser context — no storage, no
 * preferences, nothing of the sender's — opens that link and shows the same
 * pass, from the observer the link carried. Nothing in that path talks to a
 * server of ours: the assertion is the recipient's own request list.
 *
 * `navigator.share` is deleted before the page loads, so the clipboard branch
 * is the one under test. It is also the branch that has anything to assert:
 * a share sheet is the operating system's, and a headless browser has none.
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
const CLOCK = Date.parse(ha.capturedAt) + 9 * DAY_MS;
const COORDS = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;

const LABEL = {
  en: { coords: 'Coordinates (lat, lon)', passes: 'Upcoming passes', count: /\d+ visible passes in the next 72 h/, open: /Open guide/, share: 'Share this pass', copied: 'Link copied' },
  es: { coords: 'Coordenadas (lat, lon)', passes: 'Próximos pases', count: /\d+ pases visibles en las próximas 72 h/, open: /Abrir la guía/, share: 'Compartir este paso', copied: 'Enlace copiado' },
} as const;

/** Every network call this app can make, answered from a fixture or refused; nothing reaches the internet (PLAN §9.1). */
async function stubNetwork(page: Page): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.addInitScript(() => {
    // FR-SHARE-2's second branch: no share sheet, so the URL goes to the clipboard.
    Reflect.deleteProperty(Navigator.prototype, 'share');
    Reflect.deleteProperty(navigator, 'share');
  });
}

async function listPasses(page: Page, locale: 'en' | 'es'): Promise<void> {
  await page.getByLabel(LABEL[locale].coords).fill(COORDS);
  await expect(page.getByRole('region', { name: LABEL[locale].passes }).getByRole('status')).toHaveText(LABEL[locale].count, { timeout: 60_000 });
}

test.use({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });

test('the share action copies a link, and a fresh device opens the same pass from it with no server of ours in the path', async ({ page, browser, baseURL }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(golden.start.t)}`;

  await page.clock.setFixedTime(CLOCK);
  await stubNetwork(page);
  await page.goto('/');
  await listPasses(page, 'en');

  await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: LABEL.en.open }).click();
  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(dialog).toBeVisible();
  const sentence = await dialog.getByTestId('guide-sentence').first().innerText();

  const share = dialog.getByRole('button', { name: LABEL.en.share });
  await share.scrollIntoViewIfNeeded();
  await share.click();
  await expect(dialog.getByTestId('share-status')).toHaveText(LABEL.en.copied);

  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(`${String(baseURL)}/#pass?lat=-38.93&lon=-67.99&alt=0&norad=25544&start=${new Date(golden.start.t).toISOString().replace('.000Z', 'Z')}`);

  // ---- the recipient: another browser context, so no localStorage, no saved observer, no preferences ----
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recipient = await context.newPage();
  const requests: { url: string; method: string }[] = [];
  recipient.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  await recipient.clock.setFixedTime(CLOCK);
  await stubNetwork(recipient);
  await recipient.goto(link);

  const opened = recipient.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(opened).toBeVisible({ timeout: 60_000 });
  await expect(opened).toHaveAttribute('data-pass-id', passId);
  await expect(opened.getByTestId('guide-sentence').first()).toHaveText(sentence);
  // The observer came out of the link: the same coordinates, as a typed pair (FR-LOC-4 label, source `coords`).
  await expect(recipient.getByTestId('active-location')).toContainText('−38.93, −67.99');
  await expect(recipient.getByTestId('share-fallback')).toHaveCount(0);
  await recipient.screenshot({ path: 'test-results/r31-received-390-en.png' });

  // FR-SHARE-1: no server, no shortener, no tracking. Every same-origin request is a static file of the build,
  // and nothing anywhere carries the shared pass — a fragment is never sent, and nothing here copies it into one.
  const origin = new URL(String(baseURL)).origin;
  const ours = requests.filter((r) => r.url.startsWith(origin));
  expect(ours.length).toBeGreaterThan(0);
  for (const request of ours) {
    expect(request.method, request.url).toBe('GET');
    expect(new URL(request.url).pathname, request.url).toMatch(/^\/(?:[\w./-]*\.(?:js|css|json|webmanifest|png|svg|ico|txt|html|otf|ttf|woff2?))?$/);
  }
  for (const request of requests) expect(request.url, request.url).not.toContain('norad=');

  await context.close();
});

/**
 * The captures for the PR, in both languages and both widths: the compact
 * sheet carries the action at the end of the guide, and so does the wide
 * panel (D-72's second shell). One theme only — R31 adds no colour of its own.
 */
for (const width of [390, 1280] as const) {
  test(`the share action and its confirmation at ${String(width)} px, in both languages (FR-I18N-2)`, async ({ page }) => {
    const golden = reference.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');

    for (const locale of ['en', 'es'] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.clock.setFixedTime(CLOCK);
      await stubNetwork(page);
      await page.goto('/');
      if (locale === 'es') await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
      await listPasses(page, locale);

      await page.locator(`article[data-pass-id="25544-${String(golden.start.t)}"]`).getByRole('button', { name: LABEL[locale].open }).click();
      const guide = width === 390 ? page.getByRole('dialog', { name: 'ISS (Zarya)' }) : page.getByRole('region', { name: /ISS \(Zarya\)/ });
      // Let the dome finish drawing, or the capture shows its loading line where the chart should be.
      await expect(guide.locator('[data-layer="base"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
      const share = guide.getByRole('button', { name: LABEL[locale].share });
      await share.scrollIntoViewIfNeeded();
      await share.click();
      await expect(guide.getByTestId('share-status')).toHaveText(LABEL[locale].copied);
      // The confirmation wraps under the button in the narrow wide-panel; the capture is of the confirmation.
      await guide.getByTestId('share-status').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/r31-share-${String(width)}-${locale}.png` });
    }
  });
}
