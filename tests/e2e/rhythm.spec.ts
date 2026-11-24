/**
 * R134 (FR-FLOW-10, F9; D-851): three gaps. At 390 × 844, in both languages, the vertical gap between consecutive
 * marked blocks (`data-rhythm="row" | "group" | "section"`) on the home, the live page, the pass
 * detail and the settings page is the lower block's token — `--space-1`, `--space-3` or `--space-5`, read off the
 * page — to a pixel, and no row gap is larger than a group gap, nor a group gap than a section gap.
 *
 * "Consecutive" is in document order among the blocks that share their nearest marked ancestor (or have none), so
 * the home's readings count across its two columns and a sky view's slots among themselves. A block the page has
 * not drawn (no box) is not one.
 *
 * R139 (FR-FLOW-10 as amended, D-885): the live page and the pass detail are measured in both views a phone opens
 * them on, the window (a fresh profile) and the dome (a saved `chartView`), and no gap is a known exception: the
 * dome's empty `picker` slot takes no gap, so its drawing and its hint stand one row apart.
 *
 * R165 (FR-CLEAN-8, D-1000): the pass detail (and until R222 the stars page) is the sky with a sheet on the phone, upright and
 * turned, so their rows are measured with the sheet open and with it closed at 390 × 844 and at 844 × 390. With the
 * sheet closed what stands over the sky may carry no mark at all; whatever is marked and drawn keeps the gaps.
 *
 *   npx playwright test rhythm --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDeskPage } from './deskPages';
import { caseName, FLOW_CASES, LOCALES, openFlowPage, PHONE, SHEET_CASES, TURNED, type SheetState } from './flowPages';

type Rhythm = 'row' | 'group' | 'section';
const TOKEN: Record<Rhythm, string> = { row: '--space-1', group: '--space-3', section: '--space-5' };
/** R225 (FR-DS-12, D-1304): the settings page's groups are `--gap-group` apart, FR-DS-12's gap, at every width. */
const SETTINGS_TOKEN: Record<Rhythm, string> = { ...TOKEN, group: '--gap-group' };

interface Gap {
  above: string;
  below: string;
  rhythm: Rhythm;
  gap: number;
}

/** The tokens' values in px, and every gap between consecutive marked blocks under `root`. */
async function measure(root: Locator, tokenNames: Record<Rhythm, string>): Promise<{ tokens: Record<Rhythm, number>; gaps: Gap[] }> {
  return root.evaluate((el, tokenNames) => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const tokens = Object.fromEntries(
      Object.entries(tokenNames).map(([rhythm, token]) => {
        probe.style.height = `var(${token})`;
        return [rhythm, probe.getBoundingClientRect().height];
      }),
    ) as Record<'row' | 'group' | 'section', number>;
    probe.remove();
    const label = (b: Element): string => b.getAttribute('data-slot') ?? b.getAttribute('data-testid') ?? b.getAttribute('data-reading') ?? b.tagName.toLowerCase();
    const drawn = (b: Element): boolean => {
      const r = b.getBoundingClientRect();
      return r.height > 0 && b.checkVisibility();
    };
    const blocks = Array.from(el.querySelectorAll('[data-rhythm]')).filter(drawn);
    const scopes = new Map<Element | null, Element[]>();
    for (const b of blocks) {
      const scope = b.parentElement?.closest('[data-rhythm]') ?? null;
      scopes.set(scope, [...(scopes.get(scope) ?? []), b]);
    }
    const gaps: { above: string; below: string; rhythm: 'row' | 'group' | 'section'; gap: number }[] = [];
    for (const list of scopes.values()) {
      for (let i = 1; i < list.length; i++) {
        const above = list[i - 1];
        const below = list[i];
        if (!above || !below) continue;
        gaps.push({
          above: label(above),
          below: label(below),
          rhythm: below.getAttribute('data-rhythm') as 'row' | 'group' | 'section',
          gap: below.getBoundingClientRect().top - above.getBoundingClientRect().bottom,
        });
      }
    }
    return { tokens, gaps };
  }, tokenNames);
}

/** The gaps under `root` are the three tokens, and row ≤ group ≤ section as measured; `some` asks for at least one gap. */
async function threeGaps(root: Locator, some: boolean, tokenNames: Record<Rhythm, string> = TOKEN): Promise<void> {
  const { tokens, gaps } = await measure(root, tokenNames);
  if (some) expect(gaps.length, 'marked blocks on the page').toBeGreaterThan(0);
  const wrong = gaps.filter(({ rhythm, gap }) => Math.abs(gap - tokens[rhythm]) > 1).map(({ above, below, rhythm, gap }) => `${above} → ${below}: ${gap.toFixed(1)} px, ${rhythm} is ${String(tokens[rhythm])} px`);
  expect(wrong).toEqual([]);
  // row ≤ group ≤ section, as measured.
  const widest = (r: Rhythm): number => Math.max(-Infinity, ...gaps.filter((g) => g.rhythm === r).map((g) => g.gap));
  const narrowest = (r: Rhythm): number => Math.min(Infinity, ...gaps.filter((g) => g.rhythm === r).map((g) => g.gap));
  expect(widest('row')).toBeLessThanOrEqual(narrowest('group') + 1);
  expect(widest('row')).toBeLessThanOrEqual(narrowest('section') + 1);
  expect(widest('group')).toBeLessThanOrEqual(narrowest('section') + 1);
}

for (const locale of LOCALES) {
  test.describe(`FR-FLOW-10 at 390 × 844, ${locale}`, () => {
    test.use({ viewport: PHONE });

    for (const flow of FLOW_CASES) {
      test(`the ${caseName(flow)} page keeps three gaps`, async ({ page }) => {
        await threeGaps(await openFlowPage(page, flow.page, locale, flow.view), true, flow.page === 'settings' ? SETTINGS_TOKEN : TOKEN);
      });
    }
  });
}

/** R165 (FR-CLEAN-8): the two sheets, open and closed, upright and turned (the open sheet upright is the case above). */
const SHEET_RUNS: readonly { viewport: typeof PHONE; sheet: SheetState }[] = [
  { viewport: PHONE, sheet: 'closed' },
  { viewport: TURNED, sheet: 'open' },
  { viewport: TURNED, sheet: 'closed' },
];

for (const locale of LOCALES) {
  for (const { viewport, sheet } of SHEET_RUNS) {
    test.describe(`FR-CLEAN-8 at ${String(viewport.width)} × ${String(viewport.height)}, the sheet ${sheet}, ${locale}`, () => {
      test.use({ viewport });

      for (const flow of SHEET_CASES) {
        test(`the ${caseName(flow)} page keeps three gaps`, async ({ page }) => {
          await threeGaps(await openFlowPage(page, flow.page, locale, flow.view, sheet), sheet === 'open');
        });
      }
    });
  }
}

/**
 * R166 (FR-CLEAN-15, V211-10): the settings page breathes on a desk. At 1280 × 800 in both languages the three
 * sections stand `--space-5` apart, each heading's rule `--space-2` above its first row, the rows inside a section
 * `--space-3` apart, and the footer's rule at least `--space-5` under the last section once the page is read to its
 * end. The phone's case above is unchanged (FR-SET-2's fit).
 * R225 (FR-DS-12, D-1304): the sections are `--gap-group` apart, and the browser's rows are FR-DS-12's case below.
 */
for (const locale of LOCALES) {
  test.describe(`FR-CLEAN-15 at 1280 × 800, ${locale}`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the settings page: sections --gap-group apart, the heading --space-2 over its first row, rows --space-3 apart', async ({ page }) => {
      await openFlowPage(page, 'settings', locale);
      const main = page.locator('#root > main');
      await main.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const measured = await main.evaluate((el) => {
        const probe = document.createElement('div');
        document.body.append(probe);
        const px = (token: string): number => {
          probe.style.height = `var(${token})`;
          return probe.getBoundingClientRect().height;
        };
        const tokens = { s2: px('--space-2'), s3: px('--space-3'), s5: px('--space-5'), group: px('--gap-group') };
        probe.remove();
        const drawn = (b: Element): boolean => b.getBoundingClientRect().height > 0 && b.checkVisibility();
        const gapsOf = (list: Element[]): number[] => list.slice(1).map((b, i) => b.getBoundingClientRect().top - (list[i] as Element).getBoundingClientRect().bottom);
        const groups = Array.from(el.querySelectorAll('[data-rhythm="group"]')).filter(drawn);
        const sections = Array.from(el.querySelectorAll('section')).filter(drawn);
        const headings: number[] = [];
        const rows: number[] = [];
        for (const section of sections) {
          const children = Array.from(section.children).filter(drawn);
          const [heading, ...rest] = children;
          if (!heading || heading.tagName !== 'H2' || !rest[0]) continue;
          headings.push(rest[0].getBoundingClientRect().top - heading.getBoundingClientRect().bottom);
          rows.push(...gapsOf(rest));
        }
        const last = groups.at(-1)?.getBoundingClientRect().bottom ?? NaN;
        // D-1023: the foot is the app's footer, its one row on a desk; measured to its rule, its first drawn line.
        const rule = document.querySelector('#root > footer > hr')?.getBoundingClientRect().top ?? NaN;
        return { tokens, sectionGaps: gapsOf(groups), headings, rows, foot: rule - last, scrolls: document.documentElement.scrollHeight - document.documentElement.clientHeight };
      });
      const { tokens } = measured;
      expect(measured.sectionGaps).toHaveLength(2);
      for (const gap of measured.sectionGaps) expect(Math.abs(gap - tokens.group), `a section gap of ${String(gap)} px`).toBeLessThanOrEqual(1);
      expect(measured.headings).toHaveLength(3);
      for (const gap of measured.headings) expect(Math.abs(gap - tokens.s2), `a heading gap of ${String(gap)} px`).toBeLessThanOrEqual(1);
      expect(measured.rows.length).toBeGreaterThan(3);
      for (const gap of measured.rows) expect(Math.abs(gap - tokens.s3), `a row gap of ${String(gap)} px`).toBeLessThanOrEqual(1);
      expect(measured.foot).toBeGreaterThanOrEqual(tokens.s5 - 1);
      // The page itself does not scroll: the pane does, where a short window asks it to.
      expect(measured.scrolls).toBeLessThanOrEqual(0);
    });

    test('the column is 60 cells inside the shell’s row: a saved place’s remove sits by its name', async ({ page }) => {
      await openFlowPage(page, 'settings', locale);
      const measured = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.width = 'calc(60 * var(--cell))';
        document.body.append(probe);
        const column = probe.getBoundingClientRect().width;
        probe.remove();
        const main = document.querySelector('#root > main');
        if (!main) throw new Error('no main');
        const left = main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft);
        // D-1023: the footer is the shell's row now, D-120's one row across it like the home's, so only `main`'s blocks keep the column.
        const blocks = Array.from(main.querySelectorAll('[data-rhythm="group"]')).filter((b) => b.getBoundingClientRect().height > 0);
        return { column, left, rights: blocks.map((b) => b.getBoundingClientRect().right) };
      });
      expect(measured.rights.length).toBeGreaterThanOrEqual(3);
      for (const right of measured.rights) expect(right, 'a block runs past the 60-cell column').toBeLessThanOrEqual(measured.left + measured.column + 1);
    });

    test('the place field’s focus ring clears its label and its help line', async ({ page }) => {
      await openFlowPage(page, 'settings', locale);
      const input = page.locator('#root > main input').first();
      await input.focus();
      // The field's rows (its label, its box, the help line once a place is picked) stand its row gap apart.
      const clear = await input.evaluate((el) => {
        const style = getComputedStyle(el);
        // R209 (D-1226): the input stands in its box, which is the field's row.
        const box = el.parentElement;
        const field = box?.parentElement;
        if (!field) throw new Error('the input has no field');
        return {
          ring: parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
          gap: parseFloat(getComputedStyle(field).rowGap),
          above: el.getBoundingClientRect().top - (box?.previousElementSibling?.getBoundingClientRect().bottom ?? -Infinity),
        };
      });
      expect(clear.ring).toBeGreaterThan(0);
      expect(clear.above, 'the ring lies over the label').toBeGreaterThanOrEqual(clear.ring);
      expect(clear.gap, 'the ring lies over the help line').toBeGreaterThanOrEqual(clear.ring);
    });
  });
}

/**
 * R225 (FR-DS-12, US-65 AC8; D-1304): one rhythm. In a column — the settings page's `main`, a wide page's rail, a
 * phone's sheet — every group's first box stands at the column's left edge, and every run of rows (the `SettingRow`s
 * of one parent, the layer toggles) has equal heights and `--gap-row` between rows, to the pixel; a `SettingRow`'s
 * control stands `--label-col` right of its label, so the labels are one column.
 */
interface OneRhythm {
  problems: string[];
  rows: number;
}

async function oneRhythm(page: Page, column: { selector: string; up: number }, groups: string): Promise<OneRhythm> {
  return page.evaluate(
    ({ selector, up, groups }) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      probe.style.height = 'var(--gap-row)';
      probe.style.width = 'var(--label-col)';
      const gapRow = probe.getBoundingClientRect().height;
      const labelCol = probe.getBoundingClientRect().width;
      probe.remove();
      let col = document.querySelector(selector);
      for (let i = 0; i < up; i++) col = col?.parentElement ?? null;
      if (!col) throw new Error(`no column at ${selector}`);
      const drawn = (b: Element): boolean => b.getBoundingClientRect().height > 0 && b.checkVisibility();
      const name = (b: Element): string => b.getAttribute('data-slot') ?? b.getAttribute('data-testid') ?? b.firstElementChild?.getAttribute('data-testid') ?? b.tagName.toLowerCase();
      const left = col.getBoundingClientRect().left + parseFloat(getComputedStyle(col).paddingLeft);
      const problems: string[] = [];
      for (const group of Array.from(col.querySelectorAll(groups)).filter(drawn)) {
        // A slot drawn as `display: contents` (the chart's view control) has no box: its children are the group's.
        const boxes = (el: Element): Element[] => Array.from(el.children).flatMap((c) => (getComputedStyle(c).display === 'contents' ? boxes(c) : [c]));
        const first = boxes(group).find(drawn);
        const x = (first ?? group).getBoundingClientRect().left;
        if (Math.abs(x - left) > 1) problems.push(`${name(group)} starts at ${x.toFixed(1)} px, the column at ${left.toFixed(1)} px`);
      }
      const runs = new Map<Element, Element[]>();
      for (const row of Array.from(col.querySelectorAll('[data-setting-row], [data-testid="stars-layers"] > *')).filter(drawn)) {
        const parent = row.parentElement;
        if (parent) runs.set(parent, [...(runs.get(parent) ?? []), row]);
      }
      let rows = 0;
      for (const run of runs.values()) {
        rows += run.length;
        const boxes = run.map((r) => r.getBoundingClientRect());
        const heights = boxes.map((b) => b.height);
        if (Math.max(...heights) - Math.min(...heights) > 1) problems.push(`${name(run[0] as Element)}'s rows are ${heights.map((h) => h.toFixed(1)).join(', ')} px tall`);
        for (let i = 1; i < boxes.length; i++) {
          const gap = (boxes[i] as DOMRect).top - (boxes[i - 1] as DOMRect).bottom;
          if (Math.abs(gap - gapRow) > 1) problems.push(`${name(run[i] as Element)}: a row gap of ${gap.toFixed(1)} px, --gap-row is ${String(gapRow)} px`);
        }
        for (const row of run.filter((r) => r.hasAttribute('data-setting-row'))) {
          const [label, control] = Array.from(row.children).map((c) => c.getBoundingClientRect().left);
          if (label === undefined || control === undefined) continue;
          if (Math.abs(control - label - labelCol) > 1) problems.push(`${name(row)}: the control stands ${(control - label).toFixed(1)} px right of its label, --label-col is ${String(labelCol)} px`);
          if (Math.abs(label - left) > 1) problems.push(`${name(row)}: the label starts at ${label.toFixed(1)} px, the column at ${left.toFixed(1)} px`);
        }
      }
      return { problems, rows };
    },
    { ...column, groups },
  );
}

const RHYTHM_SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

for (const size of RHYTHM_SIZES) {
  const wide = size.width >= 964;
  for (const locale of LOCALES) {
    test.describe(`FR-DS-12 at ${String(size.width)} × ${String(size.height)}, ${locale}`, () => {
      test.use({ viewport: size });

      test('FR-DS-12: the settings page’s browser group is rows of one height, --gap-row apart, the labels in one column', async ({ page }) => {
        await openFlowPage(page, 'settings', locale);
        const measured = await oneRhythm(page, { selector: '#root > main', up: 0 }, '[data-rhythm="group"]');
        expect(measured.problems).toEqual([]);
        expect(await page.locator('[data-testid="settings-browser"] [data-setting-row]').count()).toBeGreaterThanOrEqual(2);
      });

      for (const which of ['live', 'pass'] as const) {
        test(`FR-DS-12: the ${which} rail’s groups start at its left edge and their rows keep one rhythm`, async ({ page }) => {
          test.skip(wide && locale === 'es', 'the desk pages open in English (deskPages.ts)');
          if (wide) await openDeskPage(page, which);
          else await openFlowPage(page, which === 'live' ? 'live' : 'detail', locale, 'window');
          const column = wide ? { selector: `[data-testid="${which}-layout"] [data-slot="view"]`, up: 1 } : { selector: '[data-testid="sheet-body"]', up: 0 };
          const measured = await oneRhythm(page, column, wide ? ':scope > [data-slot]' : ':scope > *');
          expect(measured.problems).toEqual([]);
          if (which === 'live') expect(measured.rows, 'the layer toggles at least').toBeGreaterThanOrEqual(2);
        });
      }
    });
  }
}
