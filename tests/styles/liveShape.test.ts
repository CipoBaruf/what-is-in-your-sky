/**
 * R69 (FR-SHP-1, FR-SHP-2; F-65; D-379): the live page's stylesheet, read as
 * text, the way `breakpoint.test.ts` reads px literals out of the stylesheets.
 *
 * Two decisions lay out the live page and they are independent: the **mode**
 * (compact or wide, FR-DESK-1's 100 cells, written on the page as
 * `data-compact`) and the **shape** (portrait, or the landscape phone — wider
 * than tall and no more than 500 px high, D-173). A shape rule that names no
 * mode matches a wide window dragged short as well as a phone, and that is
 * F-65: the landscape block set the phone's two column *tracks* on a page
 * whose one-column *areas* came from the wide rule, which won on specificity,
 * so the whole page was drawn in the left `2fr` column with a drawing of zero
 * height and a scrollbar. Two checks stop it from coming back:
 *
 *   1. every `@media` block in the file carries `[data-compact=` in each of its
 *      selectors — the mode is a selector, the shape a media query, and no
 *      rule has one without the other. This is the half that fails on the old
 *      file.
 *   2. no block that re-cuts the page's grid sets one half of it and leaves the
 *      other to a rule of different specificity: a block that sets
 *      `grid-template-columns` on `.page` sets `grid-template-areas` in the
 *      same block, and a block whose areas are more than one column wide sets
 *      the columns. A one-column `grid-template-areas` without a columns
 *      declaration is the grid's own default and is not a re-cut, which is
 *      why the base `.page` rule passes. This half passes on the old file —
 *      F-65 was two rules at different specificity, not one incomplete block —
 *      and is here to stop the next one.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LIVE_CSS = 'src/ui/screens/Live.module.css';
const css = readFileSync(LIVE_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  selector: string;
  body: string;
  /** The `@media (…)` prelude of the block the rule is in, or `null` at the top level. */
  media: string | null;
}

/** Every style rule in the sheet, with the media block (if any) each is inside; `@media` preludes are not rules. */
function rules(sheet: string, media: string | null = null): Rule[] {
  const found: Rule[] = [];
  let i = 0;
  while (i < sheet.length) {
    const open = sheet.indexOf('{', i);
    if (open < 0) break;
    const prelude = sheet.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < sheet.length && depth > 0) {
      if (sheet[j] === '{') depth += 1;
      else if (sheet[j] === '}') depth -= 1;
      j += 1;
    }
    const body = sheet.slice(open + 1, j - 1);
    if (prelude.startsWith('@media')) found.push(...rules(body, prelude));
    else found.push({ selector: prelude, body, media });
    i = j;
  }
  return found;
}

const all = rules(css);
const inMedia = all.filter((rule) => rule.media !== null);

/** The rule's subject is the page element itself: the selector's last compound is `.page…`, with nothing after it. */
function onPage(selector: string): boolean {
  return selector.split(',').some((part) => /(^|[\s>+~])\.page(\[[^\]]*\])*$/.test(part.trim()));
}

const declares = (body: string, property: string): boolean => new RegExp(`(^|[;\\s])${property}\\s*:`).test(body);

/** How many columns the `grid-template-areas` value describes: the names in its widest row. */
function areaColumns(body: string): number {
  const value = /grid-template-areas\s*:\s*([^;]+);/.exec(body)?.[1] ?? '';
  const rows = [...value.matchAll(/'([^']*)'/g)].map((m) => m[1]?.trim().split(/\s+/).length ?? 0);
  return Math.max(0, ...rows);
}

describe('the live stylesheet: the mode in every shape rule (FR-SHP-1, FR-SHP-2, D-379)', () => {
  it('has a shape rule to check', () => {
    expect(inMedia.length, `${LIVE_CSS} has no @media block — the landscape phone rule is not there`).toBeGreaterThan(0);
    expect(inMedia.map((rule) => rule.media)).toContain('@media (orientation: landscape) and (max-height: 500px)');
  });

  it('names the mode in the selector of every rule inside a media query (FR-SHP-1)', () => {
    for (const rule of inMedia) {
      for (const part of rule.selector.split(',')) {
        expect(part, `${LIVE_CSS}: \`${part.trim()}\` in \`${rule.media ?? ''}\` names no mode — a wide window dragged short matches the shape too (F-65)`).toContain('[data-compact=');
      }
    }
  });

  /**
   * R71 (the owner's finding on a phone): every track the page lays must be able to go under its content's
   * minimum. An `auto` or bare `1fr` track cannot — a row at FR-COMP-4's 36 cells is wider than a 344 px
   * screen, so the track grew past the page's content box and the full-bleed drawing broke out of a pane
   * already too wide, and the page scrolled sideways (`tests/e2e/narrow.spec.ts` measures it).
   */
  it('gives every column track a zero floor, so no row can widen the page (FR-COMP-5)', () => {
    const tracks = all.filter((rule) => onPage(rule.selector) && declares(rule.body, 'grid-template-columns'));
    expect(tracks.length).toBeGreaterThan(0);
    for (const rule of tracks) {
      const value = /grid-template-columns:([^;]*);/.exec(rule.body)?.[1]?.trim() ?? '';
      const where = `${LIVE_CSS}: \`${rule.selector}\`${rule.media ? ` in \`${rule.media}\`` : ''}`;
      for (const track of value.split(/\s+(?![^(]*\))/)) {
        if (track === '') continue;
        expect(track.startsWith('minmax(0,'), `${where}: the track \`${track}\` has no zero floor`).toBe(true);
      }
    }
  });

  it('re-cuts both halves of the grid in the same block, or neither (FR-SHP-2)', () => {
    const pageRules = all.filter((rule) => onPage(rule.selector));
    expect(pageRules.length).toBeGreaterThan(0);
    for (const rule of pageRules) {
      const where = `${LIVE_CSS}: \`${rule.selector}\`${rule.media ? ` in \`${rule.media}\`` : ''}`;
      const columns = declares(rule.body, 'grid-template-columns');
      const areas = declares(rule.body, 'grid-template-areas');
      if (columns) expect(areas, `${where} sets the tracks and leaves the areas to another rule`).toBe(true);
      if (areas && areaColumns(rule.body) > 1) expect(columns, `${where} lays areas across more than one column and leaves the tracks to another rule`).toBe(true);
    }
  });
});
