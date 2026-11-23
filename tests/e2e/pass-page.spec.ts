/**
 * v2.14.1 (FR-WIDE-1, FR-CLEAN-14, FR-WIDE-3 as amended; D-1134..D-1137): the wide pass page from the owner's desk
 * review — a header page with `[ ← ]` and `[ satellites ]`, its rail tonight's passes opened in place and never wider
 * than the page, and its arc the whole path, faced at open, playing from the rise (R208, FR-STRIP-4). Every *Verification* line of the three
 * amended requirements, at 1024 × 640, 1280 × 800 and 1920 × 1080, in both languages.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { shownInstant } from './deskPages';
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

/**
 * The live page on a desk, the stored run's list settled, nothing saved but the language (a fresh desk opens the globe).
 * R212 (FR-LAND-1): the seed settles on the satellites page; the live page is a header link from there.
 */
async function home(page: Page, locale: Locale): Promise<void> {
  await seedStoredRun(page, { locale, settled: true, prefs: { chartView: undefined, theme: 'dark' } });
  await page.locator('#root > header').getByTestId('live-link').click();
  await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
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

type Point = [number, number];

/** An arc path's polyline (its `M`/`L` points) and its marker's centre (the ring, `M x−r y a…`), px of the drawing. */
async function geometryOf(arc: Locator): Promise<{ line: Point[]; marker: Point | null }> {
  const d = (await arc.getAttribute('d')) ?? '';
  const ringAt = d.search(/M[-\d.]+ [-\d.]+a/);
  const line = [...(ringAt === -1 ? d : d.slice(0, ringAt)).matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m): Point => [Number(m[1]), Number(m[2])]);
  const ring = /M(-?[\d.]+) (-?[\d.]+)a([\d.]+)/.exec(d);
  return { line, marker: ring ? [Number(ring[1]) + Number(ring[3]), Number(ring[2])] : null };
}

const distance = (a: Point | null | undefined, b: Point | null | undefined): number => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN);

/** How far a point is from the nearest segment of a polyline, px. */
function offLine(p: Point | null, line: readonly Point[]): number {
  if (!p) return NaN;
  let best = Infinity;
  for (let k = 0; k + 1 < line.length; k += 1) {
    const [a, b] = [line[k] as Point, line[k + 1] as Point];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    const f = len > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - f * dx, p[1] - a[1] - f * dy));
  }
  return best;
}

for (const [width, height] of SIZES) {
  test.describe(`${String(width)} × ${String(height)}`, () => {
    test.use({ viewport: { width, height } });
    for (const locale of LOCALES) {
      test.describe(locale, () => {
        test('FR-WIDE-1, FR-CLEAN-14, FR-LAND-6: the header is a sub-page’s — [ ← ] first, [ satellites ] current — and [ ← ] returns to the live page (D-1134)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          await openFromHeader(page);
          const header = page.locator('#root > header');
          const back = header.getByRole('button', { name: WORD[locale].back });
          await expect(back).toBeVisible();
          const links = header.getByRole('navigation').locator('[data-testid$="-link"]');
          await expect(links).toHaveText(locale === 'es' ? ['en vivo', 'satélites', 'ajustes'] : ['live', 'satellites', 'settings']);
          await expect(header.getByTestId('pass-link')).toHaveAttribute('aria-current', 'page');
          await expect(header.getByTestId('pass-link')).toHaveText(WORD[locale].satellites);
          await back.click();
          await expect(page).toHaveURL(/#live$/);
          await expect(page.getByTestId('live-layout')).toBeVisible();
        });

        test('FR-WIDE-1, FR-CTRL-10: the rail’s last group is tonight’s passes, uncapped, this one aria-current; a second row opens its pass in place (D-1135, D-1239)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          const layout = await openFromHeader(page);
          const rail = layout.locator('[data-slot="upFrom"]');
          // R216 (FR-NOW-1, D-1239): the list is the rail's last group, after `View`, `Time` and the pass's own group.
          const order = await layout.locator('[data-rail] > [data-slot]').evaluateAll((slots) => slots.map((el) => el.getAttribute('data-slot')));
          expect(order.slice(0, 3)).toEqual(['strip', 'view', 'time']);
          expect(order.at(-1)).toBe('upFrom');
          // FR-CTRL-10: V214-33's cap is gone — the list is as tall as its cards and does not scroll inside itself.
          const fits = await rail.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
          expect(fits, 'the list holds all its cards').toBe(true);
          const play = layout.getByTestId('live-play');
          if (height >= 800) await expect(play).toBeInViewport({ ratio: 1 });
          else {
            await play.scrollIntoViewIfNeeded();
            await expect(play).toBeInViewport({ ratio: 1 });
          }
          await rail.locator('article[data-selected]').scrollIntoViewIfNeeded();
          await expect(rail.locator('article[data-selected]')).toBeInViewport();
          const rows = rail.locator('article[data-pass-id]');
          const first = (await page.getByTestId('guide-panel').getAttribute('data-pass-id')) ?? '';
          const ids = await rows.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pass-id') ?? ''));
          expect(ids.length).toBeGreaterThan(1);
          // Tonight's: every row inside the 24 h from now (D-1135), the open pass the marked one.
          for (const id of ids) expect(startOf(id), id).toBeLessThanOrEqual(NINE_DAYS_ON + LIVE_WINDOW_MS);
          await expect(rail.locator('article[data-selected]')).toHaveCount(1);
          await expect(rail.locator(`article[data-pass-id="${first}"]`)).toHaveAttribute('data-selected', 'true');
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
          await expect(rail.locator(`article[data-pass-id="${second}"]`)).toHaveAttribute('data-selected', 'true');
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
          const rail = layout.locator('[data-rail]');
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
              // A visually hidden heading is a 1 px clip by design and draws nothing; an inline box has no client width;
              // a one-line row's name (V214-38) gives with its ellipsis, which is the clip drawn, not a box run over.
              const wide = [element, ...element.querySelectorAll<HTMLElement>('*')]
                .filter((el) => el.clientWidth > 1 && el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow !== 'ellipsis')
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

        test('FR-WIDE-3, FR-STRIP-4: opens playing past the rise; the rise holds it, the whole arc drawn on the near side; Play moves the marker along it (D-1137, D-1233)', async ({ page }, info) => {
          test.skip(info.project.name !== 'chromium', 'the sizes are this file’s own');
          await home(page, locale);
          const layout = await openFromHeader(page);
          const id = (await page.getByTestId('guide-panel').getAttribute('data-pass-id')) ?? '';
          await expect(layout.getByTestId('live-play')).toHaveAttribute('data-playing', 'true');
          await expect.poll(() => shownInstant(layout), { timeout: 10_000 }).toBeGreaterThan(startOf(id));
          // The rise's button is a move, so the loop ends there (D-1254): the overview's instant and the time control's state.
          await layout.locator('[data-set="rise"]').click();
          await expect.poll(() => shownInstant(layout)).toBe(startOf(id));
          await expect(layout.getByTestId('time-control')).toHaveAttribute('data-state', 'scrubbing');
          await expect(layout.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
          const arc = layout.locator(`[data-arc-series][data-pass-ids~="${id}"]`);
          await expect(arc).toHaveAttribute('data-near', /^\d+\/\d+$/);
          const [near, total] = ((await arc.getAttribute('data-near')) ?? '').split('/').map(Number);
          expect(total, 'the whole track is the polyline').toBeGreaterThan(2);
          expect(near, 'every point of the arc on the near side').toBe(total);
          // Polled: the drawing can still hold the loop's last frame when the instant reads the rise.
          await expect.poll(async () => { const g = await geometryOf(arc); return distance(g.marker, g.line[0]); }, { message: 'the marker at the rise' }).toBeLessThan(2);
          const before = await geometryOf(arc);
          await layout.getByTestId('live-play').click();
          await expect.poll(async () => distance((await geometryOf(arc)).marker, before.marker), { timeout: 10_000 }).toBeGreaterThan(3);
          const after = await geometryOf(arc);
          // Along the drawn path: the line is the same, and the marker stands on it.
          expect(after.line).toEqual(before.line);
          expect(offLine(after.marker, after.line)).toBeLessThan(3);
          expect(await shownInstant(layout)).toBeGreaterThan(startOf(id));
        });
      });
    }
  });
}

/*
 * V214-35 (D-1134): `[ ← ]` is the browser's back — to the page the reader came from. From the live page that is the
 * live page (above); from the stars page, the stars page. A bare `#pass`, opened before the passes are known,
 * becomes the pass `[ satellites ]` names once they arrive, in its own entry.
 */
test.describe('FR-WIDE-1: [ ← ] goes back to where the reader came from; a bare #pass finds its pass (V214-35)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const locale of LOCALES) {
    test(`from the stars page, [ satellites ] then [ ← ] is the stars page again, in ${locale}`, async ({ page }) => {
      await home(page, locale);
      // R215 (FR-LAND-6): the header's tabs are live, satellites and settings; the stars page is reached by address.
      await page.evaluate(() => {
        location.hash = '#stars';
      });
      await expect(page).toHaveURL(/#stars/);
      await expect(page.getByTestId('stars-page')).toBeVisible({ timeout: 30_000 });
      await openFromHeader(page);
      await expect(page).toHaveURL(/#pass=\d+-\d+$/);
      await page.locator('#root > header').getByRole('button', { name: WORD[locale].back }).click();
      await expect(page).toHaveURL(/#stars/);
      await expect(page.getByTestId('stars-page')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('pass-layout')).toHaveCount(0);
    });
  }

  test('a bare #pass loaded before the passes are known becomes [ satellites ]’ pass, in place', async ({ page }) => {
    await home(page, 'en');
    const href = (await page.getByTestId('pass-link').getAttribute('href')) ?? '';
    expect(href).toMatch(/^#pass=\d+-\d+$/);
    // A hash-only goto stays in the document; the reload is a fresh start on `#pass` (gotchas).
    await page.goto('/#pass');
    await page.reload();
    const entries = await page.evaluate(() => window.history.length);
    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 30_000 });
    await expect(page.getByTestId('guide-panel')).toHaveAttribute('data-pass-id', href.slice('#pass='.length));
    await expect(page.getByTestId('pass-empty')).toHaveCount(0);
    // Replaced, not pushed: the history is as long as it was on `#pass`.
    expect(await page.evaluate(() => window.history.length)).toBe(entries);
  });
});

test.describe('FR-CLEAN-14: [ satellites ] opens the pass up, else the next, else the page with no pass (D-1134)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('with one ahead: the first rise after now', async ({ page }) => {
    await home(page, 'en');
    const href = (await page.getByTestId('pass-link').getAttribute('href')) ?? '';
    expect(href).toMatch(/^#pass=\d+-\d+$/);
    const layout = await openFromHeader(page);
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    // R212: the list the home drew is the pass page's rail now; the rail lists what is shown, so the next is its first ahead.
    const ids = await layout.locator('[data-slot="upFrom"] article[data-pass-id]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pass-id') ?? ''));
    const ahead = ids.map(startOf).filter((t) => t > NINE_DAYS_ON);
    expect(startOf(href)).toBe(Math.min(...ahead));
  });

  test('with a pass up: that pass', async ({ page }) => {
    const target = RUN_PASSES.filter((pass) => pass.start.t > NINE_DAYS_ON).sort((a, b) => a.start.t - b.start.t)[0];
    if (!target) throw new Error('the stored run has no pass ahead');
    const at = target.start.t + 60_000;
    await home(page, 'en');
    // The clock set again before the load: the pass is up; the recompute from that instant clips its rise (gotchas).
    await page.clock.setFixedTime(at);
    await page.reload();
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
    // R212 (FR-LAND-1): `/` is the live page; the computed span's empty line is read on the pass page's rail.
    await page.goto('/');
    await expect(page).toHaveURL(/#live$/);
    await expect(page.getByTestId('pass-link')).toHaveAttribute('href', '#pass');
    const layout = await openFromHeader(page);
    // D-1135: the rail's list is the span's, and the span holds none: its empty line, over 24 h.
    await expect(layout.locator('[data-slot="upFrom"]').getByRole('status')).toHaveText(/in the next 24 h/, { timeout: 60_000 });
    await expect(page).toHaveURL(/#pass$/);
    await expect(page.getByTestId('pass-empty')).toBeVisible();
    await expect(page.getByTestId('pass-link')).toHaveAttribute('aria-current', 'page');
    await expect(layout.locator('[data-slot="upFrom"] article[data-pass-id]')).toHaveCount(0);
    await expect(layout.locator('[data-arc-series][data-pass-ids]:not([data-pass-ids=""])')).toHaveCount(0);
  });
});
