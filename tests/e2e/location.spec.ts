/**
 * R10 (US-2, US-3, US-8, FR-LOC-1 (b, c), FR-LOC-5, FR-LOC-6): at a phone
 * width, the space-separated Neuquén coordinates with an altitude produce the
 * pass list with the golden ISS pass; a reload restores the same list and the
 * pre-filled fields without re-typing (the observer came back from
 * `wiys:prefs:v1`); the clear action empties the storage and the screen. A
 * second test grants geolocation with a 2 km accuracy and checks the device
 * line; a third denies it and checks the message leaves the inputs usable.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const DAY_MS = 86_400_000;
const PREFS_KEY = 'wiys:prefs:v1';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
});

test('coordinates with altitude → pass list; reload restores it without re-typing; clear empties wiys:prefs:v1', async ({ page }) => {
  const golden = reference.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  await page.goto('/');
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/Enter a place name or coordinates/);
  expect(await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)).toBeNull();

  const coords = page.getByLabel('Coordinates (lat, lon)');
  const altitude = page.getByLabel('Altitude (m)');
  await coords.fill(`${String(ha.observer.lat)} ${String(ha.observer.lon)}`); // the space-separated form (US-2 AC1)
  await altitude.fill('270');
  await expect(page.getByTestId('active-location')).toHaveText('Using −38.93, −67.99 at 270 m.');
  await expect(status).toHaveText(/\d+ visible passes in the next 24 h from −38.93, −67.99/, { timeout: 15_000 });
  const listText = await status.textContent();
  const iss = page.getByRole('article', { name: 'ISS (Zarya)' });
  await expect(iss).toHaveCount(1);
  const passId = await iss.getAttribute('data-pass-id');
  expect(Math.abs(Number(passId?.split('-')[1]) - golden.start.t)).toBeLessThanOrEqual(5_000);
  await expect(page.getByText(/Precision is city-level/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear saved location' })).toBeVisible();
  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)) ?? 'null') as { observer?: { lat: number; lon: number; altM: number; source: string } } | null;
  expect(saved?.observer).toMatchObject({ lat: ha.observer.lat, lon: ha.observer.lon, altM: 270, source: 'coords' });
  await page.screenshot({ path: 'test-results/r10-location-390.png' });

  // US-8: reload restores the same list from the saved observer, and the fields are pre-filled.
  await page.reload();
  await expect(coords).toHaveValue(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(altitude).toHaveValue('270');
  await expect(page.getByTestId('active-location')).toHaveText('Using −38.93, −67.99 at 270 m.');
  await expect(status).toHaveText(listText ?? '', { timeout: 15_000 });
  await expect(page.getByRole('article', { name: 'ISS (Zarya)' })).toHaveAttribute('data-pass-id', passId ?? '');

  // US-8 AC2: clear empties the storage and the screen; a further reload starts empty.
  await page.getByRole('button', { name: 'Clear saved location' }).click();
  await expect(status).toHaveText(/Enter a place name or coordinates/);
  await expect(coords).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Place name' })).toBeFocused();
  expect(await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)).toBeNull();
  await expect(page.getByRole('button', { name: 'Clear saved location' })).toHaveCount(0);
  await page.reload();
  await expect(status).toHaveText(/Enter a place name or coordinates/);
  await expect(coords).toHaveValue('');
});

test('the device button uses the browser position: coordinates, accuracy above 1 km, and the list (US-3)', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: ha.observer.lat, longitude: ha.observer.lon, accuracy: 2000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByTestId('active-location')).toHaveText('Using −38.93, −67.99 from your device (accurate to about 2 km).');
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/\d+ visible passes in the next 24 h from −38.93, −67.99/, { timeout: 15_000 });
  await expect(page.getByRole('article', { name: 'ISS (Zarya)' })).toHaveCount(1);
  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)) ?? 'null') as { observer?: { source: string; accuracyM?: number } } | null;
  expect(saved?.observer).toMatchObject({ source: 'device', accuracyM: 2000 });
  await page.screenshot({ path: 'test-results/r10-device-390.png' });

  // A precise fix hides the accuracy (US-3 AC3).
  await context.setGeolocation({ latitude: ha.observer.lat, longitude: ha.observer.lon, accuracy: 300 });
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByTestId('active-location')).toHaveText('Using −38.93, −67.99 from your device.');
});

test('a denied permission shows the message and leaves the inputs usable (US-3 AC2)', async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto('/');
  await page.getByRole('button', { name: 'Use my location' }).click();
  // Scoped to the location section: the elements banners (R11) can add a page-level alert when the fixture elements are old.
  await expect(page.getByRole('region', { name: 'Location' }).getByRole('alert')).toContainText('Location permission was denied');
  await expect(page.getByLabel('Coordinates (lat, lon)')).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Place name' })).toBeEnabled();
  await expect(page.getByTestId('active-location')).toHaveCount(0);
  await page.getByLabel('Coordinates (lat, lon)').fill('38.93 S, 67.99 W');
  await expect(page.getByTestId('active-location')).toHaveText('Using −38.93, −67.99.');
});
