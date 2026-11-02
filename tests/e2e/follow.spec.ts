/**
 * R152 (FR-GYRO-1..6; US-44 AC1..AC4; PLAN D-941..D-946): `[ follow the phone ]` on the production build, on
 * the live page, the stars page and the pass detail, at 390 × 844 and 844 × 390 in both languages, under
 * `stubOrientation` (D-946: the spec brings its own `requestPermission` and its own readings, so a Chromium that
 * implements the request shoots the same set).
 *
 * The jsdom tests own the toggle (`FollowToggle.test.tsx`), the window's follow mode (`SkyWindow.follow.test.tsx`)
 * and each page's mount of it; what only a browser can answer is here — that the tap asks once and the page's own
 * window then turns with injected readings with nothing drawn over it, that a drag on the sky hands the camera
 * back and turns the toggle off, that the refusal line reads in the page's language, and that nothing opens a sky
 * screen any more (FR-GYRO-6). It replaces `sky-screen.spec.ts` and `stars-screen.spec.ts`.
 *
 * R163 (FR-CLEAN-3, FR-CLEAN-4; D-997): the stars page is the full form too — its toggle the sheet's row after the view
 * row and `[ follow ]` the bottom row's — so it is opened and read as the live page is; the pass detail keeps its
 * action slot until R164.
 *
 * R159 (FR-PHONE-1, FR-PHONE-2; US-45 AC1, AC2; D-962, D-963, D-986, D-987): following by default, at both sizes in
 * both languages on the three pages — with no request (`stubOrientation`'s `request: false`) the page follows from
 * load with no tap, and a drag ends it; with a saved grant nothing is asked at load and the first touch on the sky
 * asks once and follows; a refusal there leaves it off with the line and clears the grant. The cases above, which
 * tap the toggle on a first visit, are an iPhone's first visit: the stub's request is there and nothing is saved.
 *
 *   npx playwright test follow --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { FULL_OVERLAY_MAX_SHARE } from '../../src/lib/layout';
import { openSheet, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';
import { aimedAt, orientationAsks, setReadings, stubOrientation } from './orientation';

type Locale = 'en' | 'es';
type Which = 'live' | 'stars' | 'detail';

const SIZES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
] as const;
const LOCALES: readonly Locale[] = ['en', 'es'];
const PAGES: readonly Which[] = ['live', 'stars', 'detail'];

/** The toggle's words and the refusal's line (`i18n/{en,es}/window.ts`). */
const TOGGLE: Record<Locale, string> = { en: 'follow the phone', es: 'seguir el teléfono' };
const REFUSED: Record<Locale, string> = { en: "Motion access is off. Allow it in the browser's settings, then tap again.", es: 'El acceso al movimiento está desactivado. Permitilo en los ajustes del navegador y volvé a tocar.' };
const OPEN_GUIDE: Record<Locale, RegExp> = { en: /Open guide/, es: /Abrir la guía/ };

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

/** A reader with a place and no stored run, which is all the stars page needs (`flowPages.ts`'s seed). */
async function seedReader(page: Page, locale: Locale, prefs: Record<string, unknown> = {}): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN, ...prefs })] as [string, string],
  );
}

/**
 * The page, drawn, with the dome saved as the view — so following has a view to switch from and the saved view to
 * leave alone (FR-GYRO-2) — and returns the root the toggle and the window are found under. The live page's card
 * is answered and its sheet opened, since the toggle is the sheet's row.
 */
async function openPage(page: Page, which: Which, locale: Locale): Promise<Locator> {
  switch (which) {
    case 'live': {
      await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome' } });
      await page.goto('/#live');
      await page.reload();
      const layout = page.getByTestId('live-layout');
      await expect(layout).toBeVisible({ timeout: 30_000 });
      await expect(layout.locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
      const card = page.getByTestId('live-card');
      if ((await card.count()) > 0) await card.getByTestId('live-card-now').click();
      await openSheet(page);
      return layout;
    }
    case 'stars': {
      await seedReader(page, locale);
      await page.goto('/#stars');
      const layout = page.getByTestId('stars-layout');
      await expect(layout).toBeVisible();
      await expect(layout.locator('[data-drawing="window"]')).toBeAttached();
      // R163 (FR-CLEAN-4): the stars page's toggle is its sheet's row too.
      await openSheet(page);
      return layout;
    }
    case 'detail': {
      await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome' } });
      await page.locator('article[data-pass-id]').first().getByRole('button', { name: OPEN_GUIDE[locale] }).click();
      const layout = page.getByTestId('pass-layout');
      await expect(layout).toBeVisible();
      await expect(layout.locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
      return layout;
    }
  }
}

/** R163: the two pages in the full form, whose toggle is the sheet's row and whose `[ follow ]` is the bottom row's. */
const inSheet = (which: Which): boolean => which !== 'detail';

/** The window's root — the element that carries `data-look-az`, `data-look-alt`, `data-state` and `data-follow`. */
const windowRoot = (root: Locator): Locator => root.locator('[data-look-az][data-fov]');

const look = async (w: Locator): Promise<{ az: number; alt: number }> => ({ az: Number(await w.getAttribute('data-look-az')), alt: Number(await w.getAttribute('data-look-alt')) });

/** Whether two azimuths are within `tolDeg` round the circle: the look is the reading less the local declination (FR-WIN-3), a degree or two over Neuquén. */
const azClose = (a: number, b: number, tolDeg = 6): boolean => Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= tolDeg;

/** The window following, settled on a reading aimed at `azDeg`, `altDeg`: the sensor on, the tilt the reading's, the facing within the declination of it. */
async function settledOn(w: Locator, azDeg: number, altDeg: number): Promise<void> {
  await expect(w).toHaveAttribute('data-state', 'on', { timeout: 15_000 });
  await expect.poll(async () => (await look(w)).alt, { timeout: 15_000 }).toBe(altDeg);
  await expect.poll(async () => azClose((await look(w)).az, azDeg), { timeout: 15_000 }).toBe(true);
}

/** Where the toggle stands on each page (FR-GYRO-1, D-944; R163, FR-CLEAN-4): the sheet's own row after the view row on the live page and the stars page; the action slot where `[ hold up to the sky ]` stood on the pass detail. */
async function expectPlaced(page: Page, root: Locator, which: Which, locale: Locale): Promise<Locator> {
  const toggle = root.getByTestId('follow-toggle');
  await expect(toggle).toHaveText(TOGGLE[locale]);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  if (inSheet(which)) {
    const rows = await page.getByTestId('sheet-body').locator(':scope > *').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    const [view, follow, facing] = which === 'live' ? ['live-view-row', 'live-follow', 'live-facing'] : ['stars-view-row', 'stars-follow', 'stars-facing'];
    expect(rows.indexOf(follow)).toBe(rows.indexOf(view) + 1);
    expect(rows.indexOf(facing)).toBe(rows.indexOf(follow) + 1);
  } else {
    await expect(root.locator('[data-slot="action"]').getByTestId('follow-toggle')).toBeVisible();
  }
  // FR-GYRO-6: nothing of the screen is on any page.
  await expect(page.getByTestId('window-hold-up')).toHaveCount(0);
  await expect(page.getByTestId('stars-hold-up')).toHaveCount(0);
  await expect(page.getByTestId('sky-screen')).toHaveCount(0);
  return toggle;
}

for (const size of SIZES) {
  for (const locale of LOCALES) {
    test.describe(`[ follow the phone ] at ${String(size.width)} × ${String(size.height)}, ${locale}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

      for (const which of PAGES) {
        test(`${which}: the tap asks once and the page's own window turns with the phone, nothing over it, the saved view untouched (FR-GYRO-1, FR-GYRO-2, FR-GYRO-5)`, async ({ page }) => {
          await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)] });
          const root = await openPage(page, which, locale);
          const toggle = await expectPlaced(page, root, which, locale);
          expect(await orientationAsks(page)).toBe(0);
          const chart = which === 'stars' ? null : root.getByTestId('sky-chart');
          if (chart) await expect(chart).toHaveAttribute('data-view', 'dome');

          // FR-GYRO-2: the request is the tap's, and the view becomes the window without the preference being written.
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-pressed', 'true');
          expect(await orientationAsks(page)).toBe(1);
          if (chart) {
            await expect(chart).toHaveAttribute('data-view', 'window');
            await expect(chart).toHaveAttribute('data-follow', 'true');
          }
          const w = windowRoot(root);
          await expect(w).toHaveAttribute('data-follow', 'true', { timeout: 15_000 });
          await settledOn(w, 90, 30);
          expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject(which === 'stars' ? {} : { chartView: 'dome' });

          // FR-GYRO-5: nothing over the drawing — no readout, no note, no chip, no advice, no gutter.
          await expect(page.getByTestId('window-readout')).toHaveCount(0);
          await expect(page.getByTestId('window-note')).toHaveCount(0);
          await expect(page.getByTestId('window-chip')).toHaveCount(0);
          await expect(page.getByTestId('window-turn-advice')).toHaveCount(0);
          await expect(page.getByTestId('compass-gutter')).toHaveCount(0);
          await expect(page.getByTestId('sky-screen')).toHaveCount(0);
          await expect(page.getByTestId('chart-view-note')).toHaveCount(0);
          // D-957: the sheet's facing row goes while following and is back when it ends (R163: the stars sheet's too).
          if (which === 'live') await expect(page.getByTestId('live-facing')).toHaveCount(0);
          if (which === 'stars') await expect(page.getByTestId('stars-facing')).toHaveCount(0);

          // The phone turned: the window follows to the new pose.
          await setReadings(page, [aimedAt(200, 50)]);
          await settledOn(w, 200, 50);
          expect(await orientationAsks(page)).toBe(1);

          // Off: no ask, the window stays the view where the phone last pointed, and nothing is written.
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-pressed', 'false');
          expect(await orientationAsks(page)).toBe(1);
          await expect(w).not.toHaveAttribute('data-follow', 'true');
          await expect(w).toHaveAttribute('data-state', 'hand');
          expect((await look(w)).alt).toBe(50);
          if (which === 'live') await expect(page.getByTestId('live-facing')).toBeVisible();
          if (which === 'stars') await expect(page.getByTestId('stars-facing')).toBeVisible();
          if (chart) {
            await expect(chart).toHaveAttribute('data-view', 'window');
            await expect(chart).not.toHaveAttribute('data-follow', 'true');
            expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'dome' });
          }
        });
      }
    });
  }
}

test.describe('the refusal and the finger, at 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const locale of LOCALES) {
    for (const which of PAGES) {
      /** FR-GYRO-3 (US-44 AC2): refused, the toggle stays off and one line under it says how to allow it, in the page's language. */
      test(`${which}, ${locale}: a refusal leaves the toggle off with the one line under it, and the page on its view (FR-GYRO-3)`, async ({ page }) => {
        await stubOrientation(page, { answer: 'denied', readings: [aimedAt(90, 30)] });
        const root = await openPage(page, which, locale);
        const toggle = await expectPlaced(page, root, which, locale);
        await toggle.click();
        expect(await orientationAsks(page)).toBe(1);
        await expect(root.getByTestId('follow-refused')).toHaveText(REFUSED[locale]);
        await expect(root.getByTestId('follow-refused')).toHaveAttribute('role', 'status');
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        if (which !== 'stars') await expect(root.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
        // The stars page's window is there whatever the toggle says; the other two are on the dome, with no window to follow.
        if (which === 'stars') await expect(windowRoot(root)).not.toHaveAttribute('data-follow', 'true');
        await expect(page.getByTestId('sky-screen')).toHaveCount(0);
        // The next tap asks again — the stub refuses again — and the toggle is still off; the line's going between taps is `FollowToggle.test.tsx`'s.
        await toggle.click();
        expect(await orientationAsks(page)).toBe(2);
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      });
    }
  }

  for (const which of PAGES) {
    /** FR-GYRO-4 (US-44 AC3): while following, a drag on the sky turns following off and hands the camera to the finger from where it is. */
    test(`${which}: a drag on the sky ends following and hands the camera to the finger, on the window (FR-GYRO-4)`, async ({ page }) => {
      await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)] });
      const root = await openPage(page, which, 'en');
      const toggle = await expectPlaced(page, root, which, 'en');
      await toggle.click();
      const w = windowRoot(root);
      await expect(w).toHaveAttribute('data-follow', 'true', { timeout: 15_000 });
      await settledOn(w, 90, 30);
      const before = await look(w);

      // The box the hand's handlers are on, dragged 60 px to the right — past the tap's slop (D-955) — where the sky is.
      const box = root.locator('[data-follow="true"] [tabindex="0"]');
      await box.scrollIntoViewIfNeeded();
      const rect = (await box.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
      // On the live page and the stars page the open sheet covers the lower 70 % of the sky and the head the top-left corner, so the drag is a fifth of the way down.
      const y = inSheet(which) ? rect.y + rect.height * 0.2 : rect.y + rect.height / 2;
      const x = rect.x + rect.width / 2 - 30;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 60, y, { steps: 4 });
      await page.mouse.up();

      // Following is off, the toggle reads off with no note, and the camera is the finger's: the window stays, moved from the phone's pose.
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(root.getByTestId('follow-refused')).toHaveCount(0);
      await expect(w).not.toHaveAttribute('data-follow', 'true');
      await expect(w).toHaveAttribute('data-state', 'hand');
      if (which !== 'stars') {
        await expect(root.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
        await expect(root.getByTestId('sky-chart')).not.toHaveAttribute('data-follow', 'true');
      }
      const after = await look(w);
      expect(after.alt).toBe(before.alt);
      expect(azClose(after.az, before.az, 25)).toBe(true);
      expect(after.az).not.toBe(before.az);
      // The readings keep coming and move nothing now: the sensor is the toggle's again, not the camera's.
      await setReadings(page, [aimedAt(200, 50)]);
      await page.waitForTimeout(400);
      expect(await look(w)).toEqual(after);
      expect(await orientationAsks(page)).toBe(1);
    });
  }
});

/**
 * R159: each page as a reader opens it, the sheet closed, the card answered, `prefs` merged into the seed, the dome the
 * saved view. Returns the page's layout and the element a touch on the sky lands on.
 */
async function openPlain(page: Page, which: Which, locale: Locale, prefs: Record<string, unknown> = {}): Promise<{ root: Locator; sky: Locator }> {
  switch (which) {
    case 'live': {
      await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome', ...prefs } });
      await page.goto('/#live');
      await page.reload();
      const root = page.getByTestId('live-layout');
      await expect(root).toBeVisible({ timeout: 30_000 });
      await expect(root.locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
      const card = page.getByTestId('live-card');
      if ((await card.count()) > 0) await card.getByTestId('live-card-now').click();
      return { root, sky: root.getByTestId('sky-chart') };
    }
    case 'stars': {
      await seedReader(page, locale, prefs);
      await page.goto('/#stars');
      const root = page.getByTestId('stars-layout');
      await expect(root.locator('[data-drawing="window"]')).toBeAttached();
      return { root, sky: page.getByTestId('stars-sky') };
    }
    case 'detail': {
      await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome', ...prefs } });
      await page.locator('article[data-pass-id]').first().getByRole('button', { name: OPEN_GUIDE[locale] }).click();
      const root = page.getByTestId('pass-layout');
      await expect(root.locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
      return { root, sky: root.locator('[data-slot="drawing"]') };
    }
  }
}

/** One touch, a tap, on the sky's middle — a third of the way down on the two full-form pages, clear of the head and the bottom row. */
async function touchSky(page: Page, which: Which, sky: Locator): Promise<void> {
  await sky.scrollIntoViewIfNeeded();
  const rect = (await sky.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height * (inSheet(which) ? 0.35 : 0.5));
}

/** The control a page shows the state on with the sheet closed: the overlay's `[ follow ]` on the live page and the stars page (R163), the toggle on the pass detail. */
const shownBy = (root: Locator, which: Which): Locator => root.getByTestId(inSheet(which) ? 'live-follow-control' : 'follow-toggle');

const grantSaved = async (page: Page): Promise<unknown> => (JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { followGranted?: unknown }).followGranted;

for (const size of SIZES) {
  for (const locale of LOCALES) {
    test.describe(`following by default at ${String(size.width)} × ${String(size.height)}, ${locale} (R159)`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

      for (const which of PAGES) {
        /** FR-PHONE-1 (US-45 AC1): no request, no tap — the page follows from load, and a drag hands the sky to the finger. */
        test(`${which}: with no request it follows from load with no tap, the saved view untouched, and a drag ends it (FR-PHONE-1, FR-GYRO-4)`, async ({ page }) => {
          await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)], request: false });
          const { root } = await openPlain(page, which, locale);
          const control = shownBy(root, which);
          await expect(control).toHaveAttribute('aria-pressed', 'true');
          const w = windowRoot(root);
          await expect(w).toHaveAttribute('data-follow', 'true', { timeout: 15_000 });
          await settledOn(w, 90, 30);
          if (which !== 'stars') {
            await expect(root.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
            expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'dome' });
          }
          expect(await grantSaved(page)).toBeUndefined();
          await expect(page.getByTestId('window-readout')).toHaveCount(0);
          await expect(page.getByTestId('sky-corner-readout')).toHaveCount(0);

          const box = root.locator('[data-follow="true"] [tabindex="0"]');
          await box.scrollIntoViewIfNeeded();
          const rect = (await box.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
          const y = rect.y + rect.height * (which === 'live' ? 0.35 : 0.5);
          const x = rect.x + rect.width / 2 - 30;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 60, y, { steps: 4 });
          await page.mouse.up();
          await expect(control).toHaveAttribute('aria-pressed', 'false');
          await expect(w).not.toHaveAttribute('data-follow', 'true');
          await expect(w).toHaveAttribute('data-state', 'hand');
        });

        /** FR-PHONE-2 (US-45 AC2): a saved grant — nothing asked at load, one request inside the first touch, following after. */
        test(`${which}: with a saved grant it asks nothing at load, asks once inside the first touch on the sky, and follows (FR-PHONE-2)`, async ({ page }) => {
          await stubOrientation(page, { answer: 'granted', readings: [aimedAt(200, 40)] });
          const { root, sky } = await openPlain(page, which, locale, { followGranted: true });
          const control = shownBy(root, which);
          await expect(control).toHaveAttribute('aria-pressed', 'false');
          expect(await orientationAsks(page)).toBe(0);
          await touchSky(page, which, sky);
          await expect(control).toHaveAttribute('aria-pressed', 'true');
          expect(await orientationAsks(page)).toBe(1);
          const w = windowRoot(root);
          await expect(w).toHaveAttribute('data-follow', 'true', { timeout: 15_000 });
          await settledOn(w, 200, 40);
          // A second touch asks nothing: the listener went with its one use.
          await touchSky(page, which, sky);
          expect(await orientationAsks(page)).toBe(1);
          expect(await grantSaved(page)).toBe(true);
        });

        /** FR-PHONE-2, FR-GYRO-3: refused on the first touch — off, the one line, the grant cleared, the finger keeps the sky. */
        test(`${which}: a refusal on the first touch leaves it off with the line and clears the saved grant (FR-PHONE-2, FR-GYRO-3)`, async ({ page }) => {
          await stubOrientation(page, { answer: 'denied', readings: [aimedAt(200, 40)] });
          const { root, sky } = await openPlain(page, which, locale, { followGranted: true });
          await touchSky(page, which, sky);
          await expect.poll(() => grantSaved(page)).toBeUndefined();
          expect(await orientationAsks(page)).toBe(1);
          const control = shownBy(root, which);
          await expect(control).toHaveAttribute('aria-pressed', 'false');
          const line = root.getByTestId(inSheet(which) ? 'live-follow-refused' : 'follow-refused');
          await expect(line).toHaveText(REFUSED[locale]);
          await expect(line).toHaveAttribute('role', 'status');
          await expect(line).toBeVisible();
          // The finger keeps the sky: the stars page's window by hand, the other two on their saved dome.
          if (which === 'stars') await expect(windowRoot(root)).toHaveAttribute('data-state', 'hand');
          else await expect(root.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
          await expect(root.locator('[data-follow="true"]')).toHaveCount(0);
          if (inSheet(which)) {
            // D-987: the line stands on the row above the bottom row, inside the box, and the overlay stays inside its share.
            const lineBox = (await line.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
            const row = (await page.getByTestId('live-bottom-row').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
            expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(row.y + 0.5);
            expect(lineBox.x).toBeGreaterThanOrEqual(0);
            expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(size.width + 0.5);
            await expect(page.getByTestId('sky-hint')).toHaveCount(0);
            // The head, the bottom row, the corner readout's line, and the refusal's rows — the surface is painted behind its words only.
            const parts = await Promise.all(['live-head', 'live-bottom-row'].map(async (id) => (await page.getByTestId(id).boundingBox()) ?? { width: 0, height: 0 }));
            const readout = page.getByTestId('sky-corner-readout').locator('p').first();
            if ((await readout.count()) > 0) parts.push((await readout.boundingBox()) ?? { width: 0, height: 0 });
            parts.push(...(await line.locator('span').last().evaluate((rows) => [...rows.getClientRects()].map((rect) => ({ width: rect.width, height: rect.height })))));
            const share = parts.reduce((sum, part) => sum + part.width * part.height, 0) / (size.width * size.height);
            test.info().annotations.push({ type: 'overlay', description: `${which} ${locale} ${String(size.width)}×${String(size.height)} refused: ${share.toFixed(3)} of the box` });
            expect(share, `the overlay with the refusal covers ${share.toFixed(3)} of the box`).toBeLessThanOrEqual(FULL_OVERLAY_MAX_SHARE);
          }
        });
      }
    });
  }
}
