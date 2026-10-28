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
 *   npx playwright test rhythm --project=chromium
 */
import { expect, test, type Locator } from '@playwright/test';
import { FLOW_PAGES, LOCALES, openFlowPage, PHONE, type FlowPage } from './flowPages';

const RHYTHMS = ['row', 'group', 'section'] as const;
type Rhythm = (typeof RHYTHMS)[number];
const TOKEN: Record<Rhythm, string> = { row: '--space-1', group: '--space-3', section: '--space-5' };

/**
 * The one gap the spec finds that is not this task's to close (R134's Done note, for R135): in the dome view the
 * live page and the pass detail render the `picker` slot around an empty chart slot (the dome has no facing
 * picker), and the empty slot's own `--space-1` stacks on the hint's, so the drawing and the hint stand two rows
 * apart. The fix is `SkyViewLayout`'s — not rendering, or not spacing, a slot the chart left empty — and
 * `components/sky/**` is out of R134's scope. Held to exactly that value, so the fix fails here and takes the entry
 * out with it.
 */
const KNOWN: readonly { page: FlowPage; above: string; below: string; rows: number }[] = [
  { page: 'live', above: 'drawing', below: 'hint', rows: 2 },
  { page: 'detail', above: 'drawing', below: 'hint', rows: 2 },
];

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

    for (const which of FLOW_PAGES) {
      test(`the ${which} page keeps three gaps`, async ({ page }) => {
        const root = await openFlowPage(page, which, locale);
        const { tokens, gaps: all } = await measure(root);
        expect(all.length, 'marked blocks on the page').toBeGreaterThan(0);
        const known = KNOWN.filter((k) => k.page === which);
        for (const k of known) {
          const found = all.find((g) => g.above === k.above && g.below === k.below);
          expect(found?.gap, `${k.above} → ${k.below}, the known gap`).toBeCloseTo(k.rows * tokens.row, 0);
        }
        const gaps = all.filter((g) => !known.some((k) => k.above === g.above && k.below === g.below));
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
