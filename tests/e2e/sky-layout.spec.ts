/**
 * R132 (FR-FLOW-4, FR-FLOW-6, FR-FLOW-7, FR-FLOW-8; D-842, D-846, D-848, D-849): one order for every sky view,
 * measured by bounding boxes at 390 × 844 and 1280 × 800 in both languages.
 *
 * - The live page (each view), the stars page and the pass detail lay their slots out in FR-FLOW-4's order: top to
 *   bottom on the phone; on a desk the box at the left with the readout on its corner and the hint under it, the
 *   rail at the right in the same order (the pass detail's panel: the head band, the one control line, the drawing
 *   at the panel's width, the prose and the table under it).
 * - The view row is one line, the view control first and `[x] stars` at its end.
 * - No hint text intersects the drawing's box (FR-FLOW-6).
 * - The pass detail's drawing has its top at or above `DETAIL_DRAWING_TOP_PX` on the phone and is at least
 *   `DETAIL_DRAWING_MIN_SHARE` of the guide panel's area on the desk (FR-FLOW-7).
 * - On the stars page `In this field`'s heading and first row are inside 390 × 844 with `[ passes ]` off and on (FR-FLOW-8).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DETAIL_DRAWING_MIN_SHARE, DETAIL_DRAWING_TOP_PX } from '../../src/lib/layout';
import { seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };
const LOCALES = ['en', 'es'] as const;
type Locale = (typeof LOCALES)[number];

const WORDS = {
  en: { openGuide: /Open guide/, viewGroup: 'Chart view', views: { polar: 'Polar', dome: 'Dome', window: 'Window' }, field: 'In this field', passes: 'passes', stars: 'Stars under the arcs' },
  es: { openGuide: /Abrir la guía/, viewGroup: 'Vista del gráfico', views: { polar: 'Polar', dome: 'Domo', window: 'Ventana' }, field: 'En este campo', passes: 'pases', stars: 'Estrellas bajo los arcos' },
} as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const box = async (locator: Locator): Promise<Box> => {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${String(locator)}`);
  return found;
};

/** Every rendered slot of a layout, in DOM order, with its box. */
async function slotBoxes(layout: Locator): Promise<{ name: string; box: Box }[]> {
  const slots = layout.locator('[data-slot]');
  const count = await slots.count();
  const out: { name: string; box: Box }[] = [];
  for (let i = 0; i < count; i++) {
    const slot = slots.nth(i);
    out.push({ name: (await slot.getAttribute('data-slot')) ?? '', box: await box(slot) });
  }
  return out;
}

/** FR-FLOW-4 on compact: each slot starts where the one above it ends, or lower. */
function expectStacked(slots: { name: string; box: Box }[]): void {
  for (let i = 1; i < slots.length; i++) {
    const above = slots[i - 1];
    const below = slots[i];
    if (!above || !below) continue;
    expect(below.box.y, `${below.name} under ${above.name}`).toBeGreaterThanOrEqual(above.box.y + above.box.height - 1);
  }
}

const inside = (inner: Box, outer: Box, slack = 1): boolean => inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.width <= outer.x + outer.width + slack && inner.y + inner.height <= outer.y + outer.height + slack;
const intersects = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The view row is one line: the control and `[x] stars` share it, the toggle at the row's right end. */
async function expectViewRowOneLine(layout: Locator, locale: Locale): Promise<void> {
  const row = layout.locator('[data-slot="viewRow"]');
  const control = await box(row.getByRole('group', { name: WORDS[locale].viewGroup }));
  const stars = await box(row.getByRole('button', { name: WORDS[locale].stars }));
  expect(Math.abs(control.y + control.height / 2 - (stars.y + stars.height / 2))).toBeLessThanOrEqual(4);
  expect(stars.x).toBeGreaterThan(control.x + control.width);
  const rowBox = await box(row);
  expect(stars.x + stars.width).toBeGreaterThan(rowBox.x + rowBox.width - 4);
}

/** FR-FLOW-6: the hint, where there is one, stands clear of the drawing's box. */
async function expectHintOffTheDrawing(layout: Locator): Promise<void> {
  const hint = layout.getByTestId('sky-hint');
  if ((await hint.count()) === 0) return;
  const drawing = await box(layout.getByTestId('chart-box'));
  expect(intersects(await box(hint), drawing)).toBe(false);
  await expect(hint).toHaveText(/\S/);
}

/** The desk's rail form: the box at the left, the readout on its corner, the hint under it, the rail's slots stacked at the right. */
async function expectRail(layout: Locator): Promise<void> {
  await expect(layout).toHaveAttribute('data-shape', 'rail');
  const slots = await slotBoxes(layout);
  const drawing = slots.find((slot) => slot.name === 'drawing');
  if (!drawing) throw new Error('no drawing slot');
  const rail = slots.filter((slot) => !['drawing', 'readout', 'hint'].includes(slot.name));
  for (const slot of rail) expect(slot.box.x, `${slot.name} beside the box`).toBeGreaterThanOrEqual(drawing.box.x + drawing.box.width - 1);
  expectStacked(rail);
  const readout = slots.find((slot) => slot.name === 'readout');
  if (readout) {
    expect(readout.box.x).toBeGreaterThanOrEqual(drawing.box.x - 1);
    expect(readout.box.y).toBeGreaterThanOrEqual(drawing.box.y - 1);
    expect(readout.box.y + readout.box.height).toBeLessThan(drawing.box.y + drawing.box.height / 4);
  }
  const hint = slots.find((slot) => slot.name === 'hint');
  if (hint) {
    expect(hint.box.y).toBeGreaterThanOrEqual(drawing.box.y + drawing.box.height - 1);
    expect(Math.abs(hint.box.x - drawing.box.x)).toBeLessThanOrEqual(1);
  }
}

async function seedReader(page: Page, locale: Locale): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN })] as [string, string],
  );
}

/** The live page with the stored run's sky, the drawing arrived. */
async function openLive(page: Page, locale: Locale): Promise<Locator> {
  await seedStoredRun(page, { locale, settled: true });
  await page.goto('/#live');
  await page.reload();
  const layout = page.getByTestId('live-layout');
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await expect(layout.locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
  return layout;
}

/** The golden pass's guide, the drawing arrived. */
async function openDetail(page: Page, locale: Locale): Promise<Locator> {
  await seedStoredRun(page, { locale, settled: true });
  await page.locator('article[data-pass-id]').first().getByRole('button', { name: WORDS[locale].openGuide }).click();
  const layout = page.getByTestId('pass-layout');
  await expect(layout).toBeVisible();
  await expect(layout.locator('[data-drawing]')).toBeAttached({ timeout: 30_000 });
  return layout;
}

async function openStars(page: Page, locale: Locale): Promise<Locator> {
  await seedReader(page, locale);
  await page.goto('/#stars');
  const layout = page.getByTestId('stars-layout');
  await expect(layout).toBeVisible();
  await expect(layout.locator('[data-drawing="window"]')).toBeAttached();
  return layout;
}

/** Switches the live page's view and waits for its drawing. */
async function chooseView(page: Page, layout: Locator, locale: Locale, view: 'polar' | 'dome' | 'window'): Promise<void> {
  await layout.getByRole('group', { name: WORDS[locale].viewGroup }).getByRole('button', { name: WORDS[locale].views[view] }).click();
  await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', view);
  await expect(layout.locator(`[data-drawing="${view}"]`)).toBeAttached({ timeout: 30_000 });
}

const VIEWS = ['polar', 'dome', 'window'] as const;

for (const locale of LOCALES) {
  test.describe(`FR-FLOW-4 on a phone, ${locale}`, () => {
    test.use({ viewport: PHONE, hasTouch: false });

    test('the live page lays its slots out top to bottom in every view, the view row one line, the hint off the drawing', async ({ page }) => {
      const layout = await openLive(page, locale);
      await expect(layout).toHaveAttribute('data-shape', 'column');
      for (const view of VIEWS) {
        await chooseView(page, layout, locale, view);
        const slots = await slotBoxes(layout);
        const names = slots.map((slot) => slot.name);
        // The polar chart has no drag, so it has no hint and no hint slot (D-864).
        expect(names.includes('hint'), view).toBe(view !== 'polar');
        expect(names.slice(0, names.includes('hint') ? 6 : 5), view).toEqual(['answer', 'viewRow', 'readout', 'drawing', 'picker', 'hint'].filter((name) => names.includes(name)));
        expect(names.indexOf('action'), view).toBeGreaterThan(names.indexOf('hint'));
        expect(names.indexOf('list'), view).toBeGreaterThan(names.indexOf('action'));
        expectStacked(slots);
        await expectViewRowOneLine(layout, locale);
        await expectHintOffTheDrawing(layout);
        // The readout directly above the drawing and the picker directly under it (FR-FLOW-4).
        const readout = slots.find((slot) => slot.name === 'readout');
        const drawing = slots.find((slot) => slot.name === 'drawing');
        if (readout && drawing) expect(drawing.box.y - (readout.box.y + readout.box.height)).toBeLessThanOrEqual(8);
      }
    });

    test('the stars page: the h1, the readout, the drawing, the facing row, the hint, the action, the layers, then In this field inside the viewport (FR-FLOW-8)', async ({ page }) => {
      const layout = await openStars(page, locale);
      await expect(layout).toHaveAttribute('data-shape', 'column');
      const check = async (): Promise<void> => {
        const slots = await slotBoxes(layout);
        const names = slots.map((slot) => slot.name);
        expect(names.filter((name) => name !== 'action')).toEqual(['answer', 'readout', 'drawing', 'picker', 'hint', 'layers', 'list']);
        expectStacked(slots);
        await expectHintOffTheDrawing(layout);
        // FR-FLOW-8: the layer toggles are one group of two rows; the heading of `In this field` and its first row are inside 844 px.
        await expect(layout.getByTestId('stars-layers-row')).toHaveCount(2);
        const heading = await box(layout.getByRole('heading', { name: WORDS[locale].field }));
        const firstRow = await box(layout.getByTestId('field-list').getByRole('listitem').first());
        expect(heading.y + heading.height).toBeLessThanOrEqual(PHONE.height);
        expect(firstRow.y + firstRow.height).toBeLessThanOrEqual(PHONE.height);
      };
      await check();
      await layout.getByTestId('stars-layers').getByRole('button', { name: WORDS[locale].passes }).click();
      await expect(layout.locator('[data-layer="passes"]')).toHaveAttribute('aria-pressed', 'true');
      await check();
    });

    test('the first drag on the stars page puts the hint away for good, with no slot and no gap left for it (FR-FLOW-6)', async ({ page }) => {
      const layout = await openStars(page, locale);
      await expect(layout.getByTestId('sky-hint')).toBeVisible();
      const drawing = await box(layout.locator('[data-slot="drawing"]'));
      await page.mouse.move(drawing.x + drawing.width / 2, drawing.y + drawing.height / 2);
      await page.mouse.down();
      await page.mouse.move(drawing.x + drawing.width / 2 + 40, drawing.y + drawing.height / 2, { steps: 4 });
      await page.mouse.up();
      await expect(layout.getByTestId('sky-hint')).toHaveCount(0);
      await expect(layout.locator('[data-slot="hint"]')).toHaveCount(0);
      // The slot under the picker stands its own rhythm's gap from it, and nothing more.
      const picker = await box(layout.locator('[data-slot="picker"]'));
      const next = layout.locator('[data-slot="picker"] + [data-slot]');
      const gap = await next.evaluate((el) => parseFloat(getComputedStyle(el).marginTop));
      expect(Math.abs((await box(next)).y - (picker.y + picker.height) - gap)).toBeLessThanOrEqual(1);
      await page.reload();
      await expect(layout.locator('[data-drawing="window"]')).toBeAttached();
      await expect(layout.getByTestId('sky-hint')).toHaveCount(0);
    });

    test('the pass detail leads with its head and its drawing is on the first screen (FR-FLOW-7)', async ({ page }) => {
      const layout = await openDetail(page, locale);
      await expect(layout).toHaveAttribute('data-shape', 'column');
      const slots = await slotBoxes(layout);
      expect(slots.map((slot) => slot.name).slice(0, 4)).toEqual(['answer', 'viewRow', 'readout', 'drawing']);
      expectStacked(slots);
      await expectViewRowOneLine(layout, locale);
      await expectHintOffTheDrawing(layout);
      // The head: the name as the h1, the countdown, the landmark line where there is one, the three times.
      const head = layout.locator('[data-slot="answer"]');
      await expect(head.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(head.getByRole('timer')).toBeVisible();
      await expect(head.getByTestId('pass-times').locator('[data-cell]')).toHaveCount(3);
      const drawing = await box(layout.getByTestId('chart-box'));
      expect(drawing.y).toBeLessThanOrEqual(DETAIL_DRAWING_TOP_PX);
      // The prose and the table of points after the drawing.
      const prose = await box(layout.getByTestId('guide-sentence'));
      const table = await box(layout.getByRole('table'));
      expect(prose.y).toBeGreaterThanOrEqual(drawing.y + drawing.height - 1);
      expect(table.y).toBeGreaterThanOrEqual(prose.y + prose.height - 1);
    });
  });

  test.describe(`FR-FLOW-4 on a desk, ${locale}`, () => {
    test.use({ viewport: DESK, hasTouch: false });

    test('the live page is the box and the rail in every view, the view row one line, the readout on the corner and the hint under the box', async ({ page }) => {
      const layout = await openLive(page, locale);
      for (const view of VIEWS) {
        await chooseView(page, layout, locale, view);
        await expectRail(layout);
        await expectViewRowOneLine(layout, locale);
        await expectHintOffTheDrawing(layout);
        const names = (await slotBoxes(layout)).map((slot) => slot.name);
        expect(names.filter((name) => !['drawing', 'readout', 'hint', 'picker'].includes(name)), view).toEqual(['answer', 'viewRow', 'list', 'foot']);
      }
      // The rail labels its rows (D-846).
      await expect(layout.locator('[data-slot="viewRow"]').getByRole('heading', { level: 2 })).toHaveText(locale === 'en' ? 'View' : 'Vista');
      await expect(layout.locator('[data-slot="picker"]').getByRole('heading', { level: 2 })).toHaveText(locale === 'en' ? 'Facing' : 'Hacia');
    });

    test('the stars page is the box and the rail: the h1, the facing row, the layers, In this field', async ({ page }) => {
      const layout = await openStars(page, locale);
      await expectRail(layout);
      await expectHintOffTheDrawing(layout);
      const names = (await slotBoxes(layout)).map((slot) => slot.name);
      expect(names.filter((name) => !['drawing', 'readout', 'hint', 'action'].includes(name))).toEqual(['answer', 'picker', 'layers', 'list']);
    });

    test('the pass detail panel: the head band, the one control line, the drawing at the panel’s width and most of its area, the prose and the table under it (FR-FLOW-7)', async ({ page }) => {
      const layout = await openDetail(page, locale);
      await expect(layout).toHaveAttribute('data-shape', 'panel');
      const panel = await box(page.getByTestId('guide-panel'));
      const head = page.getByTestId('guide-head');
      await expect(head.getByRole('heading', { level: 2 })).toBeVisible();
      await expect(head.getByRole('timer')).toBeVisible();
      const times = await box(head.getByTestId('pass-times'));
      const name = await box(head.getByRole('heading', { level: 2 }));
      expect(times.x).toBeGreaterThan(name.x + name.width - 1);
      const headBox = await box(head);
      const viewRow = await box(layout.locator('[data-slot="viewRow"]'));
      const picker = await box(layout.locator('[data-slot="picker"]'));
      expect(viewRow.y).toBeGreaterThanOrEqual(headBox.y + headBox.height - 1);
      // The view control, `[x] stars` and the facing picker on one line.
      expect(Math.abs(viewRow.y + viewRow.height / 2 - (picker.y + picker.height / 2))).toBeLessThanOrEqual(viewRow.height / 2);
      expect(picker.x).toBeGreaterThanOrEqual(viewRow.x + viewRow.width - 1);
      await expectViewRowOneLine(layout, locale);
      const drawing = await box(layout.getByTestId('chart-box'));
      expect(drawing.y).toBeGreaterThanOrEqual(Math.max(viewRow.y + viewRow.height, picker.y + picker.height) - 1);
      // The panel's full width, and at least `DETAIL_DRAWING_MIN_SHARE` of the area the panel has under its head — its
      // body, which the drawing takes the rest of (FR-FLOW-7). At 1280 × 800 the panel is 818 × 442 px, so the share
      // is of the body and not of the whole panel: the head band the requirement itself asks for is a third of it.
      const layoutBox = await box(layout);
      const body = await box(page.getByTestId('guide-body'));
      expect(drawing.width).toBeGreaterThanOrEqual(layoutBox.width - 2);
      expect(body.y).toBeGreaterThan(panel.y);
      expect((drawing.width * drawing.height) / (body.width * body.height)).toBeGreaterThanOrEqual(DETAIL_DRAWING_MIN_SHARE);
      // The readout on the box's corner; the hint under the box; the prose and the table under it.
      const readout = await box(layout.locator('[data-slot="readout"]'));
      expect(inside(readout, { ...drawing, height: drawing.height / 4 }, 1)).toBe(true);
      await expectHintOffTheDrawing(layout);
      const prose = layout.getByTestId('guide-sentence');
      await prose.scrollIntoViewIfNeeded();
      const proseBox = await box(prose);
      expect(proseBox.y).toBeGreaterThanOrEqual((await box(layout.getByTestId('chart-box'))).y + (await box(layout.getByTestId('chart-box'))).height - 1);
    });
  });
}
