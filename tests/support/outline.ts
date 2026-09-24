/**
 * R92 (FR-A11Y-2, D-530): a page's heading outline as a screen reader walks it — every `h1`..`h6` in document
 * order, less the ones outside the accessibility tree (inside `hidden` or `aria-hidden="true"`), as
 * `[level, text]`. The component tests assert it per screen; `tests/e2e/structure.ts` asks the same of the
 * browser.
 */
export type Outline = [level: number, text: string][];

export function outline(root: ParentNode = document): Outline {
  return Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
    .filter((heading) => heading.closest('[hidden], [aria-hidden="true"]') === null)
    .map((heading) => [Number(heading.tagName.slice(1)), (heading.textContent ?? '').trim()]);
}

/** The places the outline goes down more than one rank at a time; empty when no level is skipped. */
export function skippedLevels(headings: Outline): string[] {
  const skips: string[] = [];
  let previous = 0;
  for (const [level, text] of headings) {
    if (level > previous + 1) skips.push(`h${String(previous)} → h${String(level)} "${text}"`);
    previous = level;
  }
  return skips;
}
