/**
 * R115 (FR-STAR-3, FR-STAR-4, FR-STAR-7, FR-STAR-8, FR-STAR-10, FR-DESK-4,
 * FR-A11Y-1..3; US-39 AC1–AC4, US-38 AC7; D-756): the `#stars` page in a
 * browser — the ways in (the wide header's `[ stars ]`, the compact When
 * pane's `[ look up ]`, the `s` key) and the way out (`Esc`), the title, the
 * `h1` and the focus, the two layouts, the facing picker and the hand camera,
 * the layers, `In this field` naming a mark and clearing it, both languages,
 * and the offline reload with a saved observer.
 *
 * The page needs a place and nothing else: the observer is seeded in the
 * preferences and every provider is refused, since the sky the page draws is
 * the catalogue's and the clock's (FR-STAR-8).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };

const WORDS = {
  en: { app: 'What is in your sky right now', heading: 'Stars tonight', link: 'stars', facing: 'Facing', layers: 'Layers', field: 'In this field', up: 'up', drawing: 'The sky: drag it, or use the arrow keys', lookUp: 'look up', layerNames: ['stars', 'figures', 'planets', 'names', 'passes'], row: /^.+ · mag −?\d\.\d · \d+° up · [NESW]{1,3}$/ },
  es: { app: 'Qué hay en el cielo ahora mismo', heading: 'Estrellas esta noche', link: 'estrellas', facing: 'Mirando', layers: 'Capas', field: 'En este campo', up: 'arriba', drawing: 'El cielo: arrastralo o usá las flechas', lookUp: 'mirá arriba', layerNames: ['estrellas', 'figuras', 'planetas', 'nombres', 'pases'], row: /^.+ · mag −?\d,\d · \d+° de altura · [NESW]{1,3}$/ },
} as const;

/** A reader with a saved place and a language, every provider refused, at the fixture's instant. */
async function asReader(page: Page, locale: 'en' | 'es' = 'en'): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN })] as [string, string],
  );
}

const box = (locator: Locator) => locator.evaluate((el: HTMLElement) => el.getBoundingClientRect().toJSON() as DOMRect);
const page$ = (page: Page) => page.getByTestId('stars-page');
const drawing = (page: Page) => page.getByTestId('stars-sky').locator('[data-testid="chart-box"]');

test.describe('the stars page on a desk, 1280 × 800 (US-39 AC1, AC4)', () => {
  test.use({ viewport: DESK });

  test('opens from the header’s [ stars ], with its title, its one h1 and the box focused; Esc goes back', async ({ page }) => {
    await asReader(page);
    await page.goto('/');
    const link = page.getByTestId('stars-link');
    await expect(link).toHaveText(WORDS.en.link);
    // Beside [ Live sky ] on the title's line (FR-STAR-3).
    const [live, stars] = await Promise.all([box(page.getByTestId('live-link')), box(link)]);
    expect(stars.x).toBeGreaterThan(live.x + live.width - 1);
    expect(Math.abs(stars.y + stars.height / 2 - (live.y + live.height / 2))).toBeLessThanOrEqual(1);
    await link.click();
    await expect(page).toHaveURL(/#stars$/);
    await expect(page).toHaveTitle(`Stars · ${WORDS.en.app}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(WORDS.en.heading);
    expect(await page.locator('h1').count()).toBe(1);
    expect(await page.locator('main').count()).toBe(1);
    expect(await page.getByRole('banner').count()).toBe(1);
    await expect(page.getByTestId('stars-link')).toHaveAttribute('aria-current', 'page');
    // The focus target is the drawing's box, which takes the arrow keys.
    await expect(page.getByRole('group', { name: WORDS.en.drawing }).locator('[tabindex="0"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/#stars/);
    await expect(page.getByTestId('stars-link')).toBeFocused();
  });

  test('is the box at the left, the rail beside it, the readout in the box’s corner, and no scroll', async ({ page }) => {
    await asReader(page);
    await page.goto('/#stars');
    await expect(page$(page)).toBeVisible();
    const sky = drawing(page);
    await expect.poll(async () => (await box(sky)).width).toBeGreaterThan(400);
    const [drawn, rail, readout] = await Promise.all([box(sky), box(page.getByTestId('stars-rail')), box(page.getByTestId('window-readout'))]);
    // The box has the browser window's shape (fitBox), the rail stands beside it at 44 cells or more.
    expect(Math.abs(drawn.width / drawn.height - DESK.width / DESK.height)).toBeLessThan(0.02);
    expect(rail.x).toBeGreaterThanOrEqual(drawn.x + drawn.width);
    expect(rail.width).toBeGreaterThanOrEqual(400);
    expect(rail.x + rail.width).toBeLessThanOrEqual(DESK.width);
    // The readout in the top-left corner over the drawing.
    expect(readout.x).toBeGreaterThanOrEqual(drawn.x - 0.5);
    expect(readout.y).toBeGreaterThanOrEqual(drawn.y - 0.5);
    expect(readout.y + readout.height).toBeLessThan(drawn.y + drawn.height / 4);
    // The rail's three blocks, in order (FR-STAR-3).
    await expect(page.getByTestId('stars-rail').getByRole('heading', { level: 2 })).toHaveText([WORDS.en.facing, WORDS.en.layers, WORDS.en.field]);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('the facing picker turns the camera; the drag and the arrow keys turn it too (FR-STAR-4)', async ({ page }) => {
    await asReader(page);
    await page.goto('/#stars');
    // South of the equator: the pole side is south, at 35°.
    await expect(page$(page)).toHaveAttribute('data-look-az', '180');
    await expect(page$(page)).toHaveAttribute('data-look-alt', '35');
    const picker = page.getByRole('group', { name: WORDS.en.facing });
    // The pressed point's brackets are drawn by the stylesheet (the tight form, D-245); the text is the point's alone.
    await expect(picker.getByRole('button')).toHaveText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', WORDS.en.up]);
    await expect(picker.locator('[data-option="S"]')).toHaveAttribute('aria-pressed', 'true');
    await picker.locator('[data-option="NE"]').click();
    await expect(page$(page)).toHaveAttribute('data-look-az', '45');
    await picker.locator('[data-option="up"]').click();
    await expect(page$(page)).toHaveAttribute('data-look-alt', '90');
    await picker.locator('[data-option="S"]').click();
    // From the zenith a point brings the view back down to the opening tilt, and is the pressed one.
    await expect(page$(page)).toHaveAttribute('data-look-az', '180');
    await expect(page$(page)).toHaveAttribute('data-look-alt', '35');
    await expect(picker.locator('[data-option="S"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.locator('[data-option="up"]')).toHaveAttribute('aria-pressed', 'false');
    // A drag at the dome's 4 px a degree: 80 px right turns the view 20° left.
    const sky = await box(drawing(page));
    const cx = sky.x + sky.width / 2;
    const cy = sky.y + sky.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy, { steps: 4 });
    await page.mouse.move(cx + 80, cy, { steps: 4 });
    await page.mouse.up();
    await expect(page$(page)).toHaveAttribute('data-look-az', '160');
    await expect(picker.locator('[data-option="S"]')).toHaveAttribute('aria-pressed', 'false');
    // The keys, with the box focused: 15° a step across, 5° up and down.
    await page.getByTestId('stars-sky').locator('[tabindex="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page$(page)).toHaveAttribute('data-look-az', '175');
    await page.keyboard.press('ArrowDown');
    await expect(page$(page)).toHaveAttribute('data-look-alt', '30');
  });

  test('the layers are four toggles, all on, and each turns off, and [ passes ] off (FR-STAR-3 as amended v2.4.1, FR-SKY-6)', async ({ page }) => {
    await asReader(page);
    await page.goto('/#stars');
    const layers = page.getByRole('group', { name: WORDS.en.layers });
    await expect(layers.getByRole('button')).toHaveText(WORDS.en.layerNames.map((name) => name));
    for (const name of WORDS.en.layerNames.slice(0, 4)) await expect(layers.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    await expect(layers.getByRole('button', { name: 'passes' })).toHaveAttribute('aria-pressed', 'false');
    await layers.getByRole('button', { name: 'figures' }).click();
    await expect(layers.getByRole('button', { name: 'figures' })).toHaveAttribute('aria-pressed', 'false');
    // Stars off: the list holds the planets alone, or says nothing is drawn.
    await layers.getByRole('button', { name: 'stars' }).click();
    const rows = page.getByTestId('field-list').locator('button[data-kind="star"]');
    await expect(rows).toHaveCount(0);
  });

  test('In this field: the brightest drawn objects, a row names its mark, and the name clears after four seconds (FR-STAR-7)', async ({ page }) => {
    await asReader(page);
    await page.goto('/#stars');
    const list = page.getByRole('list', { name: WORDS.en.field });
    const rows = list.getByRole('button');
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(12);
    for (const label of await rows.evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? ''))) expect(label).toMatch(WORDS.en.row);
    // Brightest first.
    const mags = await rows.evaluateAll((buttons) => buttons.map((b) => Number((/mag (−?\d\.\d)/.exec(b.getAttribute('aria-label') ?? '')?.[1] ?? '0').replace('−', '-'))));
    expect(mags).toEqual([...mags].sort((a, b) => a - b));
    // The drawing is hidden from assistive technology: the list is its text alternative (FR-GUIDE-7).
    await expect(page.locator('svg[data-drawing="window"]')).toHaveAttribute('aria-hidden', 'true');
    await rows.first().focus();
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'false', { timeout: 6_000 });
  });

  test('s opens the page from home, and the ? overlay lists s and the page’s four keys (FR-DESK-4 as amended v2.4)', async ({ page }) => {
    await asReader(page);
    await page.goto('/');
    await expect(page.getByTestId('stars-link')).toBeVisible();
    await page.keyboard.press('?');
    const overlay = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(overlay.locator('[data-shortcut="stars"] kbd')).toHaveText('s');
    await expect(overlay.locator('[data-page-key] kbd')).toHaveText(['← →', '↑ ↓']);
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await page.keyboard.press('s');
    await expect(page).toHaveURL(/#stars$/);
    await expect(page$(page)).toBeVisible();
    // FR-A11Y-1..3: opened by the key, the page places its focus as from the link.
    await expect(page.getByRole('group', { name: WORDS.en.drawing }).locator('[tabindex="0"]')).toBeFocused();
  });
});

test.describe('the stars page on a phone, 390 × 844 (US-39 AC3)', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('opens from the home’s Stars door, and lays out the readout, the box full-bleed and square, then the rows', async ({ page }) => {
    await asReader(page);
    await page.goto('/');
    // R130 (FR-FLOW-1): the When pane's "Stars tonight · [ look up ]" gave way to the Stars door.
    await expect(page.getByTestId('stars-line')).toHaveCount(0);
    await expect(page.getByTestId('stars-link')).toHaveCount(0);
    await page.getByTestId('door-stars').click();
    await expect(page).toHaveURL(/#stars$/);
    const sky = drawing(page);
    await expect.poll(async () => (await box(sky)).width).toBe(PHONE.width);
    const [drawn, readout, facing, layers] = await Promise.all([box(sky), box(page.getByTestId('window-readout')), box(page.getByRole('group', { name: WORDS.en.facing })), box(page.getByTestId('stars-layers'))]);
    expect(drawn.x).toBe(0);
    expect(Math.abs(drawn.height - drawn.width)).toBeLessThanOrEqual(1);
    // The readout above the box, the facing row and the layers' three rows under it (R126's [ passes ] the third), each on one line.
    expect(readout.y + readout.height).toBeLessThanOrEqual(drawn.y + 0.5);
    expect(facing.y).toBeGreaterThanOrEqual(drawn.y + drawn.height - 0.5);
    expect(facing.height).toBeLessThanOrEqual(48 + 1);
    expect(layers.y).toBeGreaterThanOrEqual(facing.y + facing.height - 0.5);
    expect(layers.height).toBeLessThanOrEqual(3 * 48 + 1);
    // The drawing is on the first screen; the list follows under the fold.
    expect(drawn.y + drawn.height).toBeLessThanOrEqual(PHONE.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.locator('h1').count()).toBe(1);
  });
});

test.describe('both languages (FR-STAR-10, FR-A11Y-3)', () => {
  test.use({ viewport: DESK });

  test('is all Spanish in Spanish: the link, the title, the blocks, the picker, the layers and the list', async ({ page }) => {
    await asReader(page, 'es');
    await page.goto('/');
    await expect(page.getByTestId('stars-link')).toHaveText(WORDS.es.link);
    await page.getByTestId('stars-link').click();
    await expect(page).toHaveTitle(`Estrellas · ${WORDS.es.app}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(WORDS.es.heading);
    await expect(page.getByTestId('stars-rail').getByRole('heading', { level: 2 })).toHaveText([WORDS.es.facing, WORDS.es.layers, WORDS.es.field]);
    await expect(page.getByRole('group', { name: WORDS.es.facing }).getByRole('button').last()).toHaveText(WORDS.es.up);
    await expect(page.getByRole('group', { name: WORDS.es.layers }).getByRole('button')).toHaveText(WORDS.es.layerNames.map((name) => name));
    const rows = page.getByRole('list', { name: WORDS.es.field }).getByRole('button');
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    for (const label of await rows.evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? ''))) expect(label).toMatch(WORDS.es.row);
    // No English word of the page's own on it.
    const rail = (await page.getByTestId('stars-rail').textContent()) ?? '';
    for (const word of ['Facing', 'Layers', 'In this field', 'figures', 'planets', ' up ']) expect(rail).not.toContain(word);
  });
});

test.describe('offline (FR-STAR-8, US-38 AC7)', () => {
  test.use({ viewport: DESK });

  test('with a saved place, a reload with the network down draws the page as online', async ({ page }) => {
    await asReader(page);
    await page.goto('/#stars');
    const rows = page.getByRole('list', { name: WORDS.en.field }).getByRole('button');
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    const online = await rows.evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
    // `clientsClaim` is off (D-79): what the reload needs is a worker that finished installing its precache.
    await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
    await page.context().setOffline(true);
    try {
      await page.reload();
      await expect(page$(page)).toBeVisible();
      expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
      await expect.poll(async () => rows.evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')))).toEqual(online);
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('with no place, the page is the inert line and [ set a place ] (FR-LIVE-1)', async ({ page }) => {
    for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
    await page.goto('/#stars');
    await expect(page.getByTestId('stars-inert')).toContainText('The stars need a place.');
    // FR-A11Y-1..3: the page's focus is its one control.
    await expect(page.getByTestId('stars-set-place')).toBeFocused();
    await page.getByTestId('stars-set-place').click();
    await expect(page).not.toHaveURL(/#stars/);
  });
});
