/**
 * FR-PUB-14, FR-PUB-15 (V214-18, D-1107): the README written for the release it prepares, and the reading order laid
 * out as the repository is since v2.13. It checks what a stale README gets wrong — the version, a feature still
 * "in progress", a link to a file that moved, a figure with no date — not whether the prose is good.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const built = readFileSync('docs/HOW-THIS-WAS-BUILT.md', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

const LINK = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)|!\[[^\]]*\]\(([^)\s]+)\)/g;
const prologue = readme.split(/^## /m)[0] ?? '';

/** A `## ` section by the start of its heading, up to the next `## `. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  expect(start, `no "## ${heading}" heading`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Every link in a file that points at a path, resolved from the file's own folder, without its anchor. */
function relativeLinks(text: string, from: string): string[] {
  return [...text.matchAll(LINK)]
    .map((match) => match[1] ?? match[2] ?? '')
    .filter((target) => target !== '' && !/^(https?:|mailto:|#)/.test(target))
    .map((target) => normalize(join(dirname(from), target.split('#')[0] ?? '')));
}

describe('FR-PUB-14: the README for the release', () => {
  it('FR-PUB-14: the live line names the version package.json carries', () => {
    const live = /^\*\*Live:\*\* <https:\/\/inyoursky\.app> \((\d+\.\d+\.\d+)\)$/m.exec(readme);
    expect(live?.[1]).toBe(pkg.version);
  });

  it('FR-PUB-14: describes nothing as in progress', () => {
    expect(readme).not.toMatch(/in progress/i);
    expect(readme).not.toMatch(/under way/i);
  });

  it("FR-PUB-14: the prologue names the satellites, the stars, the planets and the desk's globe", () => {
    for (const word of ['satellites', 'stars', 'planets', 'globe']) expect(prologue).toContain(word);
  });

  it('FR-PUB-14: "How it is built" names the v2.13 layout and that any agent a config entry describes can run it', () => {
    const how = readme.slice(readme.indexOf('**How it is built.**'));
    for (const named of ['AGENTS.md', 'SPEC.md', 'PLAN.md', 'TASKS.md', 'docs/sdd/phases/', 'Decision Log', 'docs/sdd/ids.md', 'sdd.agents.json']) expect(how).toContain(named);
    for (const tier of ['`hard`', '`standard`', '`light`']) expect(how).toContain(tier);
    expect(how).toMatch(/any agent a config entry describes/);
  });

  it('FR-PUB-14: "Stack" describes the views as they are: the globe on a desk, the window, the polar chart on a phone, the dome by choice; SVG and DOM, no canvas or WebGL', () => {
    const stack = section(readme, 'Stack');
    for (const named of ['globe', 'window', 'polar chart', 'dome by choice', 'SVG and DOM', 'no canvas or WebGL']) expect(stack).toContain(named);
  });

  it('FR-PUB-14: every relative link in README.md resolves', () => {
    const broken = [...new Set(relativeLinks(readme, 'README.md'))].filter((target) => !existsSync(target));
    expect(broken).toEqual([]);
  });

  it('FR-PUB-14: each "By the numbers" figure carries the release date, the one the preamble names', () => {
    const table = section(readme, 'By the numbers');
    const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(table.slice(0, table.indexOf('|')))?.[1];
    expect(date, 'no date in the preamble').toBeTruthy();
    const rows = table
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .slice(2);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) expect(row, row).toMatch(new RegExp(`\\| ${date ?? ''} \\|$`));
    // The long table in the reading order was read on the same day.
    expect(section(built, 'By the numbers')).toContain(date);
  });
});

describe('FR-PUB-15: the reading order follows the layout', () => {
  it('FR-PUB-15: starts at AGENTS.md, then SPEC.md and PLAN.md as indexes, a phase folder, ids.md and sdd:id, the driver and one task', () => {
    const headings = [...built.matchAll(/^## (\d+)\. (.*)$/gm)].map((match) => match[2] ?? '');
    const at = (pattern: RegExp): number => headings.findIndex((heading) => pattern.test(heading));
    const order = [at(/AGENTS\.md/), at(/SPEC\.md.*PLAN\.md.*index/), at(/phase folder/), at(/ids\.md.*sdd:id/), at(/sdd-run\.ts.*driver/), at(/One task, end to end/)];
    expect(order.every((index) => index >= 0), JSON.stringify(headings)).toBe(true);
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('FR-PUB-15: every relative link in the reading order resolves, the example task among them', () => {
    const links = relativeLinks(built, 'docs/HOW-THIS-WAS-BUILT.md');
    const broken = [...new Set(links)].filter((target) => !existsSync(target));
    expect(broken).toEqual([]);
    // The example task's entry is in its phase's tasks.md since the split, and the link goes there.
    const task = section(built, '6. One task, end to end');
    expect(relativeLinks(task, 'docs/HOW-THIS-WAS-BUILT.md')).toContain('docs/sdd/phases/v1/tasks.md');
    expect(readFileSync('docs/sdd/phases/v1/tasks.md', 'utf8')).toMatch(/\*\*R28 — /);
  });
});
