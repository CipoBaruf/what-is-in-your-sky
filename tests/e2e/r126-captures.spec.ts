/**
 * R126 (FR-SKY-6, FR-FSC-1 as amended v2.5, FR-STAR-10 as amended v2.5; US-40
 * AC5, AC8; D-794, D-823..D-825): the stars page with `[ passes ]` on, for the
 * review, under `docs/screenshots/r126/` — the page at 390 × 844 and 1280 ×
 * 800 in both languages, facing the ISS's arc so `In this field` lists it
 * ahead of the stars, and the screen it opens at 844 × 390 with the stars and
 * the pass together. Neuquén at the fixture's instant with the ISS up (`T`),
 * reached from the home screen so the store holds the night's run.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { heading, homeAt, pose, stubCompass, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const PASSES = { en: 'passes', es: 'pases' } as const;
const FACING = { en: 'Facing', es: 'Mirando' } as const;
const HOLD_UP = { en: 'hold up to the sky', es: 'apuntá al cielo' } as const;
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** The stars page from the home screen, `[ passes ]` on, faced to the first point whose field lists a pass. */
async function starsWithPasses(page: Page, locale: 'en' | 'es'): Promise<number> {
  await homeAt(page, T, locale);
  await page.evaluate(() => {
    window.location.hash = '#stars';
  });
  await expect
    .poll(async () => {
      await page.clock.runFor(500);
      return page.getByTestId('stars-sky').locator('[data-drawing="window"]').count();
    }, { timeout: 15_000 })
    .toBe(1);
  await page.getByTestId('stars-layers').getByRole('button', { name: PASSES[locale] }).click();
  const picker = page.getByRole('group', { name: FACING[locale] });
  let azDeg = 0;
  for (const [index, point] of POINTS.entries()) {
    azDeg = index * 45;
    await picker.getByRole('button', { name: point, exact: true }).click();
    let found = 0;
    for (let step = 0; step < 10 && found === 0; step += 1) {
      await page.clock.runFor(100);
      found = await page.getByTestId('field-list').locator('[data-kind="pass"]').count();
    }
    if (found > 0) break;
  }
  await expect(page.getByTestId('field-list').locator('[data-kind="pass"]').first()).toBeAttached();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  return azDeg;
}

for (const locale of ['en', 'es'] as const) {
  for (const size of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`the stars page with [ passes ] at ${String(size.width)}, ${locale}`, async ({ page }) => {
      await page.setViewportSize(size);
      await starsWithPasses(page, locale);
      await page.screenshot({ path: `${CAPTURE_DIR}/r126/r126-stars-passes-${String(size.width)}-dark-${locale}.png`, fullPage: true });
    });
  }

  test(`the screen from the stars page with [ passes ] at 844 × 390, ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    await stubCompass(page);
    const azDeg = await starsWithPasses(page, locale);
    await page.getByRole('button', { name: HOLD_UP[locale] }).click();
    await expect
      .poll(async () => {
        await heading(page, 270);
        return page.getByTestId('sky-screen').count();
      }, { timeout: 15_000 })
      .toBe(1);
    await page.clock.runFor(1000);
    const face = { alpha: (360 - azDeg) % 360, beta: 125, gamma: 0 };
    await expect
      .poll(async () => {
        await pose(page, face);
        return page.getByTestId('sky-screen').getByTestId('window-readout').count();
      }, { timeout: 15_000 })
      .toBe(1);
    // Facing the point the page found the arc at, 35° up, as the page's camera was.
    await pose(page, face);
    await page.clock.runFor(500);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.screenshot({ path: `${CAPTURE_DIR}/r126/r126-stars-screen-passes-844-dark-${locale}.png` });
    await context.close();
  });
}
