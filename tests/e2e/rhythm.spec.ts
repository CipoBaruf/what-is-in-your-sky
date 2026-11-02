/**
 * R134 (FR-FLOW-10, F9; D-851): three gaps. At 390 × 844, in both languages, the vertical gap between consecutive
 * marked blocks (`data-rhythm="row" | "group" | "section"`) on the home, the live page, the stars page, the pass
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
 *   npx playwright test rhythm --project=chromium
 */
import { expect, test, type Locator } from '@playwright/test';
import { caseName, FLOW_CASES, LOCALES, openFlowPage, PHONE } from './flowPages';

type Rhythm = 'row' | 'group' | 'section';
const TOKEN: Record<Rhythm, string> = { row: '--space-1', group: '--space-3', section: '--space-5' };

interface Gap {
  above: string;
  below: string;
  rhythm: Rhythm;
  gap: number;
}

/** The tokens' values in px, and every gap between consecutive marked blocks under `root`. */
async function measure(root: Locator): Promise<{ tokens: Record<Rhythm, number>; gaps: Gap[] }> {
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
  }, TOKEN);
}

for (const locale of LOCALES) {
  test.describe(`FR-FLOW-10 at 390 × 844, ${locale}`, () => {
    test.use({ viewport: PHONE });

    for (const flow of FLOW_CASES) {
      test(`the ${caseName(flow)} page keeps three gaps`, async ({ page }) => {
        const root = await openFlowPage(page, flow.page, locale, flow.view);
        const { tokens, gaps } = await measure(root);
        expect(gaps.length, 'marked blocks on the page').toBeGreaterThan(0);
        const wrong = gaps.filter(({ rhythm, gap }) => Math.abs(gap - tokens[rhythm]) > 1).map(({ above, below, rhythm, gap }) => `${above} → ${below}: ${gap.toFixed(1)} px, ${rhythm} is ${String(tokens[rhythm])} px`);
        expect(wrong).toEqual([]);
        // row ≤ group ≤ section, as measured.
        const widest = (r: Rhythm): number => Math.max(-Infinity, ...gaps.filter((g) => g.rhythm === r).map((g) => g.gap));
        const narrowest = (r: Rhythm): number => Math.min(Infinity, ...gaps.filter((g) => g.rhythm === r).map((g) => g.gap));
        expect(widest('row')).toBeLessThanOrEqual(narrowest('group') + 1);
        expect(widest('row')).toBeLessThanOrEqual(narrowest('section') + 1);
        expect(widest('group')).toBeLessThanOrEqual(narrowest('section') + 1);
      });
    }
  });
}

/**
 * R166 (FR-CLEAN-15, V211-10): the settings page breathes on a desk. At 1280 × 800 in both languages the three
 * sections stand `--space-5` apart, each heading's rule `--space-2` above its first row, the rows inside a section
 * `--space-3` apart, and the privacy line at least `--space-5` under the last section once the page is read to its
 * end. The phone's case above is unchanged (FR-SET-2's fit).
 */
for (const locale of LOCALES) {
  test.describe(`FR-CLEAN-15 at 1280 × 800, ${locale}`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the settings page: sections --space-5 apart, the heading --space-2 over its first row, rows --space-3 apart', async ({ page }) => {
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
        const tokens = { s2: px('--space-2'), s3: px('--space-3'), s5: px('--space-5') };
        probe.remove();
        const drawn = (b: Element): boolean => b.getBoundingClientRect().height > 0 && b.checkVisibility();
        const gapsOf = (list: Element[]): number[] => list.slice(1).map((b, i) => b.getBoundingClientRect().top - (list[i] as Element).getBoundingClientRect().bottom);
        const groups = Array.from(el.children).filter((b) => b.hasAttribute('data-rhythm') && drawn(b));
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
        // The browser section's label-and-control rows: one label per row.
        const labels = Array.from(el.querySelectorAll('[data-testid="settings-browser"] [aria-hidden="true"]')).filter(drawn);
        rows.push(...gapsOf(labels));
        const last = groups.at(-1)?.getBoundingClientRect().bottom ?? NaN;
        const privacy = document.querySelector('[data-testid="settings-privacy"]')?.getBoundingClientRect().top ?? NaN;
        return { tokens, sectionGaps: gapsOf(groups), headings, rows, foot: privacy - last, scrolls: document.documentElement.scrollHeight - document.documentElement.clientHeight };
      });
      const { tokens } = measured;
      expect(measured.sectionGaps).toHaveLength(2);
      for (const gap of measured.sectionGaps) expect(Math.abs(gap - tokens.s5), `a section gap of ${String(gap)} px`).toBeLessThanOrEqual(1);
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
        const blocks = [...Array.from(main.children), ...Array.from(document.querySelector('[data-testid="settings-privacy"]')?.children ?? [])].filter((b) => b.getBoundingClientRect().height > 0);
        return { column, left, rights: blocks.map((b) => b.getBoundingClientRect().right) };
      });
      expect(measured.rights.length).toBeGreaterThan(3);
      for (const right of measured.rights) expect(right, 'a block runs past the 60-cell column').toBeLessThanOrEqual(measured.left + measured.column + 1);
    });

    test('the place field’s focus ring clears its label and its help line', async ({ page }) => {
      await openFlowPage(page, 'settings', locale);
      const input = page.locator('#root > main input').first();
      await input.focus();
      // The field's rows (its label, its box, the help line once a place is picked) stand its row gap apart.
      const clear = await input.evaluate((el) => {
        const style = getComputedStyle(el);
        const field = el.parentElement;
        if (!field) throw new Error('the input has no field');
        return {
          ring: parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
          gap: parseFloat(getComputedStyle(field).rowGap),
          above: el.getBoundingClientRect().top - (el.previousElementSibling?.getBoundingClientRect().bottom ?? -Infinity),
        };
      });
      expect(clear.ring).toBeGreaterThan(0);
      expect(clear.above, 'the ring lies over the label').toBeGreaterThanOrEqual(clear.ring);
      expect(clear.gap, 'the ring lies over the help line').toBeGreaterThanOrEqual(clear.ring);
    });
  });
}
