/**
 * R76 captures (FR-FIRST-7): the first run and the three readings.
 *
 *   CAPTURES=1 npx playwright test r76-captures --project=chromium
 *
 * The cold open at 390 × 844 and 1280 × 800; the populated home at 390 × 844
 * with the location line collapsed and once `[ change ]` has opened it, at
 * 1024 × 768 (two columns) and at 1280 × 800 (three panes) — each in both
 * themes and both languages; and the three-pane page with a pass open at
 * 1280 × 800, one theme, both languages. The phone captures are the whole
 * page, since the readings are one column that scrolls; the desk ones are the
 * viewport, which is the whole page there (D-119).
 *
 * R81 (FR-FIRST-7, D-514): the populated states are R81's panes now — tonight's
 * stripe, the conditions table, the next event, the one-line cards and the
 * Where reading with its dome — filed as `r81-*`, and one test measures the
 * 1280 px panes in the browser against the numbers FR-FIRST-3..11 give
 * (D-504's method).
 *
 * R82 (FR-FIRST-7, D-514): the phone's first visit — the when and the what
 * steps at 390 × 844, each in both themes and both languages, filed as
 * `r82-*`, and one test measures the two steps in the browser against the
 * numbers FR-FIRST-4 gives. The place comes from the device button, as a first
 * visit's does, and the finished run for it is in IndexedDB before it is set,
 * so the steps show the same passes every time.
 *
 * Evidence for the PR, not a test. Off the pull-request path (FR-CI-1's
 * budget), like every other capture spec. The theme and the language are
 * seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';
import { NEUQUEN, STORED_RUN_FILE } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

type Theme = 'dark' | 'night';
type Locale = 'en' | 'es';

const THEMES: readonly Theme[] = ['dark', 'night'];
const LOCALES: readonly Locale[] = ['en', 'es'];

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}

async function coldOpen(page: Page, theme: Theme, locale: Locale): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    ['wiys:prefs:v1', JSON.stringify({ locale, theme })] as [string, string],
  );
  await page.goto('/');
  await expect(page.getByTestId('cold-open')).toBeVisible();
  await settle(page);
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the cold open at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await coldOpen(page, theme, locale);
        await page.screenshot({ path: `${CAPTURE_DIR}/r76-cold-${label}-${theme}-${locale}.png`, fullPage: label === '390' });
      });
    }
  }
}

for (const [label, size, expand] of [
  ['390-collapsed', { width: 390, height: 844 }, false],
  ['390-expanded', { width: 390, height: 844 }, true],
  ['1024', { width: 1024, height: 768 }, false],
  ['1280', { width: 1280, height: 800 }, false],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the populated home at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await seedStoredRun(page, { locale, prefs: { theme }, settled: true });
        await expect(page.getByTestId('next-event-label')).toBeVisible();
        // On wide the Where dome is loaded after the page (D-512); the capture waits for its drawing.
        if (size.width > 390) await expect(page.getByTestId('where-dome').locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
        if (expand) {
          await page.getByTestId('location-summary-change').click();
          await expect(page.getByTestId('location-group')).toBeVisible();
          await page.mouse.move(0, 0);
        }
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r81-home-${label}-${theme}-${locale}.png`, fullPage: size.width === 390 });
      });
    }
  }
}

for (const locale of LOCALES) {
  test(`the three panes with a pass open at 1280, dark, ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStoredRun(page, { locale, settled: true });
    await page.locator('article[data-pass-card]', { has: page.getByTestId('next-tag') }).getByRole('button').first().click();
    const panel = page.getByTestId('guide-panel');
    await expect(panel).toBeVisible();
    // The capture is only evidence once the lazy chart chunk has drawn.
    await expect(panel.locator('[data-layer="lines"] [data-anchor="key"]').first()).toHaveText('A', { timeout: 30_000 });
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: `${CAPTURE_DIR}/r81-pane-1280-dark-${locale}.png` });
  });
}

/**
 * R81 (FR-FIRST-7, D-504's method): the populated panes at 1280 × 800, each
 * element's size, spacing, type and colour read from the browser and held to
 * the numbers FR-FIRST-3, FR-FIRST-5 and FR-FIRST-8..11 give. Colours are
 * compared as the browser resolves the tokens, so a theme's values are the
 * stylesheet's business and the rule — which token — is this test's.
 */
test('the populated panes at 1280 measured against FR-FIRST-3..11', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStoredRun(page, { settled: true });
  await expect(page.getByTestId('where-dome').locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await settle(page);

  const token = (name: string): Promise<string> =>
    page.evaluate((value) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${value})`;
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    }, name);
  const [fg, dim, accent, rule] = await Promise.all(['--fg', '--fg-dim', '--accent', '--rule'].map(token));
  const style = (testId: string, pick: string) =>
    page
      .getByTestId(testId)
      .first()
      .evaluate((el, selector) => {
        const target = selector === '' ? el : el.querySelector(selector);
        if (!(target instanceof HTMLElement)) throw new Error(`nothing at ${selector}`);
        const css = getComputedStyle(target);
        return { size: css.fontSize, line: css.lineHeight, colour: css.color, borderTop: css.borderTopColor, borderTopWidth: css.borderTopWidth, paddingTop: css.paddingTop };
      }, pick);
  /** The gaps between a container's drawn blocks, top to bottom, its heading left out. */
  const gaps = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => {
      const blocks = Array.from(el.children).filter((child) => child.tagName !== 'H2' && child.getBoundingClientRect().height > 0).map((child) => child.getBoundingClientRect());
      return blocks.slice(1).map((box, i) => Math.round(box.top - (blocks[i]?.bottom ?? 0)));
    });

  // FR-FIRST-5: a pane puts 0.75 rem between its blocks; its heading's title is in --fg.
  for (const pane of ['reading-where', 'reading-when']) {
    const between = await gaps(pane);
    expect(between.length, pane).toBeGreaterThanOrEqual(2);
    for (const gap of between) expect(gap, pane).toBe(12);
    expect((await style(pane, 'h2 > span')).colour, pane).toBe(fg);
  }

  // FR-FIRST-8: the stripe at --small (14 px) on an 18 px line, the labels in --fg.
  const stripe = await style('tonight-stripe', '');
  expect([stripe.size, stripe.line]).toEqual(['14px', '18px']);
  expect((await style('tonight-stripe', '[class*="labels"]')).colour).toBe(fg);

  // FR-FIRST-9: the table's labels in --fg-dim, the values in --fg, the rows 0.75 rem apart.
  expect((await style('conditions', 'dt')).colour).toBe(dim);
  expect((await style('conditions', 'dd')).colour).toBe(fg);
  for (const gap of await gaps('conditions')) expect(gap).toBe(12);

  // FR-FIRST-3: ruled off above in --rule with 0.75 rem inside; the label small and dim; the time in the accent at 32 on 38; the path in --fg.
  const block = await style('next-event', '');
  expect([block.borderTop, block.borderTopWidth, block.paddingTop]).toEqual([rule, '1px', '12px']);
  const label = await style('next-event-label', '');
  expect([label.size, label.colour]).toEqual(['14px', dim]);
  const time = await style('next-event-time', '');
  expect([time.size, time.line, time.colour]).toEqual(['32px', '38px', accent]);
  expect((await style('next-event-path', '')).colour).toBe(fg);

  // FR-FIRST-10: a box ruled in --rule, 12 px inside, 0.75 rem apart; the first line in the accent, the second small and dim.
  const card = await page
    .locator('article[data-pass-card]')
    .first()
    .evaluate((el) => {
      const css = getComputedStyle(el);
      const next = el.closest('li')?.nextElementSibling?.getBoundingClientRect();
      return { border: css.borderTopColor, padding: css.padding, gap: next ? Math.round(next.top - el.getBoundingClientRect().bottom) : null };
    });
  expect(card).toEqual({ border: rule, padding: '12px', gap: 12 });
  expect((await style('card-first-line', '')).colour).toBe(accent);
  const detail = await style('card-detail', '');
  expect([detail.size, detail.colour]).toEqual(['14px', dim]);

  // FR-FIRST-11: the sentence small and dim; the dome the pane's width, square.
  const sentence = await style('where-sentence', '');
  expect([sentence.size, sentence.colour]).toEqual(['14px', dim]);
  // …and the readiness and elements lines at --small too.
  for (const line of ['readiness', 'elements-line']) expect((await style(line, '')).size, line).toBe('14px');
  const [dome, where] = await Promise.all([page.getByTestId('where-dome').boundingBox(), page.getByTestId('reading-where').boundingBox()]);
  if (!dome || !where) throw new Error('the Where pane is not laid out');
  expect(dome.width).toBeGreaterThan(where.width - 2);
  expect(Math.abs(dome.height - dome.width)).toBeLessThanOrEqual(2);
});

const STORED_RUN = JSON.parse(readFileSync(STORED_RUN_FILE, 'utf8')) as unknown;
const USE_MY_LOCATION: Record<Locale, string> = { en: 'Use my location', es: 'Usar mi ubicación' };

/**
 * R82: a first visit on a phone, moved on to the when step by the device
 * button. The stored run for the place is written before the place is set (no
 * observer yet, so the app has nothing to read it for), and the capture waits
 * for the step's count to stop changing: the recompute that follows finds the
 * same passes (`scripts/build-stored-run.ts`), and the Moon's sentence.
 */
async function firstVisit(page: Page, context: BrowserContext, theme: Theme, locale: Locale): Promise<void> {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: NEUQUEN.lat, longitude: NEUQUEN.lon, accuracy: 300 });
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    ['wiys:prefs:v1', JSON.stringify({ locale, theme })] as [string, string],
  );
  await page.goto('/');
  await page.evaluate(async (run: unknown) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('wiys', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('elementGroups')) db.createObjectStore('elementGroups', { keyPath: 'group' });
        if (!db.objectStoreNames.contains('passRuns')) db.createObjectStore('passRuns', { keyPath: 'cellKey' });
      };
      request.onerror = () => {
        reject(new Error('could not open the wiys database'));
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('passRuns', 'readwrite');
        tx.objectStore('passRuns').put(run);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          reject(new Error('could not store the run'));
        };
      };
    });
  }, STORED_RUN);
  await expect(page.getByTestId('cold-open')).toBeVisible();
  await page.getByRole('button', { name: USE_MY_LOCATION[locale] }).click();
  const when = page.getByTestId('step-when');
  await expect(when).toBeVisible();
  await expect(when.getByTestId('tonight-stripe')).toBeVisible({ timeout: 30_000 });
  await expect(when.getByTestId('moon-note')).toBeVisible({ timeout: 30_000 });
  let last = '';
  await expect
    .poll(
      async () => {
        const text = (await when.getByTestId('when-passes').textContent()) ?? '';
        const steady = text === last && /^\d/.test(text);
        last = text;
        return steady;
      },
      { timeout: 90_000, intervals: [2_000] },
    )
    .toBe(true);
  await page.mouse.move(0, 0);
  await settle(page);
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the phone's when and what steps at 390, ${theme}, ${locale}`, async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await firstVisit(page, context, theme, locale);
      await page.screenshot({ path: `${CAPTURE_DIR}/r82-when-390-${theme}-${locale}.png`, fullPage: true });
      await page.getByTestId('see-what').click();
      await expect(page.getByTestId('step-what')).toBeVisible();
      await page.mouse.move(0, 0);
      await settle(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r82-what-390-${theme}-${locale}.png`, fullPage: true });
    });
  }
}

/**
 * R82 (FR-FIRST-7, D-504's method): the when and what steps at 390 × 844, each
 * element's size, spacing, type and colour read from the browser and held to
 * the numbers FR-FIRST-4 gives — a heading at 22 px on 28 and its sentence at
 * `--small` half a rem under it, 1.2 rem between blocks, boxes ruled in
 * `--rule` 12 px by a cell inside, `[ See what crosses ]` in the accent's
 * border at the foot of the screen, the first card ruled in the accent and the
 * foot line ruled off in `--rule` at `--small`.
 */
test("the phone's steps at 390 measured against FR-FIRST-4", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await firstVisit(page, context, 'dark', 'en');

  const token = (name: string): Promise<string> =>
    page.evaluate((value) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${value})`;
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    }, name);
  const [fg, dim, accent, rule] = await Promise.all(['--fg', '--fg-dim', '--accent', '--rule'].map(token));
  const style = (testId: string, pick: string) =>
    page
      .getByTestId(testId)
      .first()
      .evaluate((el, selector) => {
        const target = selector === '' ? el : el.querySelector(selector);
        if (!(target instanceof HTMLElement)) throw new Error(`nothing at ${selector}`);
        const css = getComputedStyle(target);
        const box = target.getBoundingClientRect();
        return { size: css.fontSize, line: css.lineHeight, colour: css.color, border: css.borderTopColor, borderWidth: css.borderTopWidth, paddingLeft: css.paddingLeft, paddingTop: css.paddingTop, bottom: box.bottom, height: box.height };
      }, pick);
  /** The gaps between a step's drawn blocks, top to bottom. */
  const gaps = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => {
      const blocks = Array.from(el.children)
        .filter((child) => child.getBoundingClientRect().height > 0)
        .map((child) => child.getBoundingClientRect());
      return blocks.slice(1).map((box, i) => Math.round(box.top - (blocks[i]?.bottom ?? 0)));
    });

  // The when step: the step line, the heading, the sentence, the two boxes 1.2 rem (19 px) apart, the sentence half a rem under the heading.
  const whenGaps = await gaps('step-when');
  expect(whenGaps.slice(0, 4)).toEqual([19, 8, 19, 19]);
  expect(whenGaps[4] ?? 0).toBeGreaterThanOrEqual(19);
  const line = await style('step-line', '');
  expect([line.size, line.colour]).toEqual(['14px', dim]);
  expect((await style('step-line', '[aria-current="step"]')).colour).toBe(accent);
  const heading = await style('step-when', 'h2');
  expect([heading.size, heading.line, heading.colour]).toEqual(['22px', '28px', fg]);
  const sentence = await style('step-when', 'h2 + p');
  expect([sentence.size, sentence.line, sentence.colour]).toEqual(['14px', '20px', dim]);
  for (const box of ['when-night', 'when-sky']) {
    const ruled = await style(box, '');
    expect([ruled.border, ruled.borderWidth, ruled.paddingTop], box).toEqual([rule, '1px', '12px']);
    // A cell at the sides: the board's 9.6 px, as this browser resolves the monospace advance.
    expect(Math.abs(parseFloat(ruled.paddingLeft) - 9.6), box).toBeLessThan(0.1);
  }
  expect((await style('when-night', 'dt')).colour).toBe(dim);
  expect((await style('when-passes', '')).colour).toBe(accent);
  const note = await style('moon-note', '');
  expect([note.size, note.colour]).toEqual(['14px', dim]);
  const next = await style('see-what', '');
  expect([next.border, next.colour]).toEqual([accent, accent]);
  expect(next.height).toBeGreaterThanOrEqual(56);
  // At the foot of the screen: the shell's bottom row under it and nothing else.
  expect(next.bottom).toBeLessThanOrEqual(844);
  expect(next.bottom).toBeGreaterThan(844 - 30);

  await page.getByTestId('see-what').click();
  await expect(page.getByTestId('step-what')).toBeVisible();
  const whatGaps = await gaps('step-what');
  expect(whatGaps.slice(0, 3)).toEqual([19, 8, 19]);
  const whatHeading = await style('step-what', 'h2');
  expect([whatHeading.size, whatHeading.line]).toEqual(['22px', '28px']);
  // The first card ruled in the accent, the cards 12 px apart.
  const first = await style('next-event', '');
  expect([first.border, first.borderWidth]).toEqual([accent, '1px']);
  const cardGap = await page.getByTestId('what-cards').evaluate((el) => {
    const [a, b] = Array.from(el.children).map((child) => child.getBoundingClientRect());
    return a && b ? Math.round(b.top - a.bottom) : null;
  });
  expect(cardGap).toBe(12);
  // The foot: ruled off in --rule, 12 px above its text, at --small in --fg-dim, at the bottom of the screen.
  const foot = await style('what-foot', '');
  expect([foot.border, foot.borderWidth, foot.paddingTop, foot.size, foot.colour]).toEqual([rule, '1px', '12px', '14px', dim]);
  expect(foot.bottom).toBeGreaterThan(844 - 60);
});
