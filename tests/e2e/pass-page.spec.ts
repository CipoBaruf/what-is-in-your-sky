/**
 * v2.14.1 (FR-WIDE-1, FR-CLEAN-14, FR-WIDE-3 as amended; D-1134..D-1137): the wide pass page from the owner's desk
 * review — a header page with `[ ← ]` and `[ satellites ]`, its rail tonight's passes opened in place and never wider
 * than the page, and its arc the whole path, faced at open, paused at the rise. Every *Verification* line of the three
 * amended requirements, at 1024 × 640, 1280 × 800 and 1920 × 1080, in both languages.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { NINE_DAYS_ON, seedStoredRun, STORED_RUN, stubNetwork } from './liveHelpers';

type Locale = 'en' | 'es';
const SIZES = [
  [1024, 640],
  [1280, 800],
  [1920, 1080],
] as const;
const LOCALES: readonly Locale[] = ['en', 'es'];
const WORD = { en: { satellites: 'satellites', back: 'Back' }, es: { satellites: 'satélites', back: 'Volver' } } as const;
const LIVE_WINDOW_MS = 24 * 3_600_000;

/** A stored pass's id and times, as the run file holds them. */
interface RunPass {
  id: string;
  start: { t: number };
  end: { t: number };
}
const RUN_PASSES = STORED_RUN.passes as RunPass[];

/** The home on a desk, the stored run's list settled, nothing saved but the language (a fresh desk opens the globe). */
async function home(page: Page, locale: Locale): Promise<void> {
  await seedStoredRun(page, { locale, settled: true, prefs: { chartView: undefined, theme: 'dark' } });
}

/** `[ satellites ]` from the header, and the pass page drawn. */
async function openFromHeader(page: Page): Promise<Locator> {
  await page.getByTestId('pass-link').click();
  return passPage(page);
}

async function passPage(page: Page): Promise<Locator> {
  const layout = page.getByTestId('pass-layout');
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await expect(layout.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
  return layout;
}

const startOf = (id: string): number => Number(/-(\d+)$/.exec(id)?.[1] ?? NaN);

for (const [width, height] of SIZES) {
  test.describe(`${String(width)} × ${String(height)}`, () => {
    test.use({ viewport: { width, height } });
    for (const locale of LOCALES) {
      test.describe(locale, () => {
        test('FR-WIDE-1, FR-CLEAN-14: the header is a sub-page’s — [ ← ] first, [ satellites ] current — and [ ← ] returns home with the card in view (D-1134)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          await openFromHeader(page);
          const header = page.locator('#root > header');
          const back = header.getByRole('button', { name: WORD[locale].back });
          await expect(back).toBeVisible();
          const links = header.getByRole('navigation').locator('[data-testid$="-link"]');
          await expect(links).toHaveText(locale === 'es' ? ['inicio', 'en vivo', 'satélites', 'estrellas'] : ['home', 'live', 'satellites', 'stars']);
          await expect(header.getByTestId('pass-link')).toHaveAttribute('aria-current', 'page');
          await expect(header.getByTestId('pass-link')).toHaveText(WORD[locale].satellites);
          const id = await page.getByTestId('guide-panel').getAttribute('data-pass-id');
          await back.click();
          await expect(page).not.toHaveURL(/#pass/);
          const card = page.locator(`article[data-pass-id="${id ?? ''}"]`);
          await expect(card).toBeInViewport();
          await expect(card).toBeFocused();
        });

        test('FR-WIDE-1: the rail’s list is tonight’s passes, this one aria-current; a second row opens its pass in place (D-1135)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          const layout = await openFromHeader(page);
          const rail = layout.locator('[data-slot="list"]');
          const rows = rail.locator('article[data-pass-id]');
          const first = (await page.getByTestId('guide-panel').getAttribute('data-pass-id')) ?? '';
          const ids = await rows.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pass-id') ?? ''));
          expect(ids.length).toBeGreaterThan(1);
          // Tonight's: every row inside the 24 h from now (D-1135), the open pass the marked one.
          for (const id of ids) expect(startOf(id), id).toBeLessThanOrEqual(NINE_DAYS_ON + LIVE_WINDOW_MS);
          await expect(rail.locator('article[aria-current]')).toHaveCount(1);
          await expect(rail.locator(`article[data-pass-id="${first}"]`)).toHaveAttribute('aria-current', 'true');
          // No home in between: every hash the page passes through, and whether the home's main was ever mounted.
          await page.evaluate(() => {
            const w = window as unknown as { hashes: string[]; homeSeen: boolean };
            w.hashes = [];
            w.homeSeen = false;
            window.addEventListener('hashchange', () => w.hashes.push(window.location.hash));
            new MutationObserver(() => {
              if (document.querySelector('main[data-home]')) w.homeSeen = true;
            }).observe(document.body, { subtree: true, childList: true });
          });
          const second = ids.find((id) => id !== first) ?? '';
          const row = rail.locator(`article[data-pass-id="${second}"]`);
          if (ids.indexOf(second) % 2 === 0) await row.getByRole('button').click();
          else {
            await row.getByRole('button').focus();
            await page.keyboard.press('Enter');
          }
          await expect(page).toHaveURL(new RegExp(`#pass=${second}$`));
          await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', second);
          await expect(rail.locator(`article[data-pass-id="${second}"]`)).toHaveAttribute('aria-current', 'true');
          const seen = await page.evaluate(() => {
            const w = window as unknown as { hashes: string[]; homeSeen: boolean };
            return { hashes: w.hashes, homeSeen: w.homeSeen };
          });
          expect(seen.hashes.every((hash) => hash.startsWith('#pass=')), seen.hashes.join(' ')).toBe(true);
          expect(seen.homeSeen).toBe(false);
        });

        test('FR-WIDE-1: nothing scrolls sideways — the document and every element in the rail — and the rail stays inside the header (D-1136)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          const layout = await openFromHeader(page);
          const rail = layout.locator('[data-slot="list"]').locator('xpath=..');
          const ids = await rail.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pass-id') ?? ''));
          // Every pass of the list in turn: its table, its names and its facts are what widen a rail.
          for (const id of ids) {
            await page.evaluate((hash) => {
              window.location.hash = hash;
            }, `#pass=${id}`);
            await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', id);
            await expect(rail.locator('table')).toBeVisible();
            const m = await rail.evaluate((element) => {
              const doc = document.documentElement;
              // A visually hidden heading is a 1 px clip by design and draws nothing; an inline box has no client width.
              const wide = [element, ...element.querySelectorAll<HTMLElement>('*')]
                .filter((el) => el.clientWidth > 1 && el.scrollWidth > el.clientWidth)
                .map((el) => `${el.tagName}.${String(el.className)} "${(el.textContent ?? "").slice(0, 30)}" ${String(el.scrollWidth)} > ${String(el.clientWidth)}`);
              const header = document.querySelector('#root > header')?.getBoundingClientRect();
              return { doc: doc.scrollWidth - doc.clientWidth, docY: doc.scrollHeight - doc.clientHeight, wide, right: element.getBoundingClientRect().right, headerRight: header?.right ?? NaN };
            });
            expect(m.doc, `${id}: the document scrolls sideways`).toBe(0);
            expect(m.wide, `${id}: elements in the rail wider than their box`).toEqual([]);
            expect(m.right, `${id}: the rail runs past the header`).toBeLessThanOrEqual(m.headerRight + 0.5);
            // The rail alone scrolls down: the page does not, and the sky's box stays in view.
            expect(m.docY, `${id}: the page scrolls`).toBeLessThanOrEqual(1);
            await expect(layout.locator('[data-slot="drawing"]').first()).toBeInViewport({ ratio: 0.9 });
          }
        });
      });
    }
  });
}

test.describe('FR-CLEAN-14: [ satellites ] opens the pass up, else the next, else the page with no pass (D-1134)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('with one ahead: the first rise after now', async ({ page }) => {
    await home(page, 'en');
    const href = (await page.getByTestId('pass-link').getAttribute('href')) ?? '';
    const ids = await page.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pass-id') ?? ''));
    const ahead = ids.map(startOf).filter((t) => t > NINE_DAYS_ON);
    expect(href).toMatch(/^#pass=\d+-\d+$/);
    expect(startOf(href)).toBe(Math.min(...ahead));
    await openFromHeader(page);
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('with a pass up: that pass', async ({ page }) => {
    const target = RUN_PASSES.filter((pass) => pass.start.t > NINE_DAYS_ON).sort((a, b) => a.start.t - b.start.t)[0];
    if (!target) throw new Error('the stored run has no pass ahead');
    const at = target.start.t + 60_000;
    await home(page, 'en');
    // The clock set again before the load: the pass is up; the recompute from that instant clips its rise (gotchas).
    await page.clock.setFixedTime(at);
    await page.reload();
    await expect(page.locator('article[data-pass-id]').first()).toBeAttached({ timeout: 30_000 });
    const norad = target.id.split('-')[0] ?? '';
    await expect.poll(async () => (await page.getByTestId('pass-link').getAttribute('href')) ?? '', { timeout: 30_000 }).toMatch(new RegExp(`^#pass=${norad}-\\d+$`));
    const href = (await page.getByTestId('pass-link').getAttribute('href')) ?? '';
    expect(startOf(href)).toBeGreaterThanOrEqual(target.start.t - 1000);
    expect(startOf(href)).toBeLessThanOrEqual(at);
    await openFromHeader(page);
  });

  test('with none in the span: `#pass`, the list’s empty line and no arc', async ({ page }) => {
    // A place with no pass to see: near the pole on the day the specs run at, the Sun never sets (the run is computed).
    await page.clock.setFixedTime(NINE_DAYS_ON);
    await stubNetwork(page);
    await page.addInitScript(
      ([key, value]: [string, string]) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      },
      ['wiys:prefs:v1', JSON.stringify({ locale: 'en', observer: { lat: 89.9, lon: 0, altM: 0, label: 'North Pole', source: 'coords', timeZone: 'UTC' } })] as [string, string],
    );
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/No darkness/, { timeout: 60_000 });
    await expect(page.getByTestId('pass-link')).toHaveAttribute('href', '#pass');
    const layout = await openFromHeader(page);
    await expect(page).toHaveURL(/#pass$/);
    await expect(page.getByTestId('pass-empty')).toBeVisible();
    await expect(page.getByTestId('pass-link')).toHaveAttribute('aria-current', 'page');
    // D-1135: the rail's list is the span's, and the span holds none: its empty line, over 24 h.
    await expect(layout.locator('[data-slot="list"] article[data-pass-id]')).toHaveCount(0);
    await expect(layout.locator('[data-slot="list"]').getByRole('status')).toHaveText(/in the next 24 h/);
    await expect(layout.locator('[data-arc-series][data-pass-ids]:not([data-pass-ids=""])')).toHaveCount(0);
  });
});
