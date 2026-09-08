/**
 * P1 (FR-PUB-1..FR-PUB-11, D-368): what this repository claims about itself,
 * checked against the repository.
 *
 * It joins `hygiene.test.ts` and `ci.test.ts` in `tests/docs/` and runs in the
 * `node` project, so `npm test` on any branch catches a README that lost its
 * live URL, a `LICENSE` that stopped agreeing with `package.json`, a hero image
 * whose source capture was renamed, or a dependency added without its notice.
 * The failure mode these files actually have is silent drift months later, and
 * a checklist in `RELEASE.md` is read once.
 *
 * What it cannot assert — is the first screen *good*, is the hero legible — is
 * the owner's gate on the task, and is named there rather than approximated
 * here.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

import { HERO, PREVIEW, SOURCES } from '../../scripts/readme-hero';
import { productionPackages, RULE } from '../../scripts/third-party-notices';

const readme = readFileSync('README.md', 'utf8');
const contributing = readFileSync('CONTRIBUTING.md', 'utf8');
const license = readFileSync('LICENSE', 'utf8');
const built = readFileSync('docs/HOW-THIS-WAS-BUILT.md', 'utf8');
const release = readFileSync('docs/RELEASE.md', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { license?: string; private?: boolean };

/** The live site, which is the one URL the first screen has to carry. */
const LIVE = 'https://in-your-sky.ezequiel-baruf.workers.dev';

/** `![alt](url)`, the only image syntax either document uses. */
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
/** `[text](target)` that is not an image: the leading `!` is excluded by the lookbehind. */
const LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Everything above the first `##`: the one screen FR-PUB-1 is about. */
const prologue = readme.split(/^## /m)[0] ?? '';

/** A `## ` section of a document, by its exact heading, up to the next `## `. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  expect(start, `no "## ${heading}" heading`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Every match of a global regex, with the regex's own index reset. */
function all(pattern: RegExp, text: string): RegExpExecArray[] {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)] as RegExpExecArray[];
}

describe('the first screen (FR-PUB-1)', () => {
  it('is one screen: at most 25 lines above the first heading', () => {
    expect(prologue.split('\n').length).toBeLessThanOrEqual(25);
  });

  it('answers where the live site is', () => {
    expect(prologue).toContain(LIVE);
  });

  it('carries exactly one image, with alt text (FR-PUB-2)', () => {
    const images = all(IMAGE, prologue);
    expect(images.map((image) => image[2])).toEqual(['docs/readme/hero.png']);
    expect(images[0]?.[1]?.length ?? 0).toBeGreaterThan(20);
  });

  it('names spec-driven development, the worktree, CI and the review', () => {
    // The four words that pin the build paragraph: a rewrite that drops any of
    // them has dropped the part a reader came for.
    for (const word of ['SPEC.md', 'worktree', 'CI', 'review']) expect(prologue).toContain(word);
    expect(prologue).toContain('scripts/sdd-run.ts');
  });

  it('links the three documents a visitor is sent to (FR-PUB-3, FR-PUB-6, FR-PUB-10)', () => {
    const targets = all(LINK, prologue).map((link) => link[2]);
    expect(targets).toContain('docs/HOW-THIS-WAS-BUILT.md');
    expect(targets).toContain('CONTRIBUTING.md');
    expect(targets).toContain('LICENSE');
  });

  it('keeps the four operational headings below it', () => {
    for (const heading of ['## Run', '## Deploy', '## Data sources and attributions', '## Catalog maintenance']) {
      expect(readme.indexOf(heading)).toBeGreaterThan(prologue.length - 1);
    }
  });

  it('states the two prerequisites a clean clone needs (FR-PUB-8)', () => {
    const run = section(readme, 'Run');
    expect(run).toMatch(/Node 24/);
    expect(run).toContain('.node-version');
    // Its own step in the block, not a comment at the foot of it.
    expect(run).toMatch(/^npx playwright install chromium$/m);
    for (const command of ['npm ci', 'npm test', 'npm run build', 'npm run bundle:budget']) {
      expect(run).toContain(command);
    }
  });
});

describe('no emoji, and no badge but a workflow badge (FR-PUB-1)', () => {
  /**
   * The emoji blocks: Miscellaneous Symbols and Dingbats (U+2600..U+27BF),
   * Miscellaneous Symbols and Arrows (U+2B00..U+2BFF) and the Supplemental
   * planes (U+1F000..U+1FAFF), plus the emoji variation selector. The arrow
   * block (U+2190..U+21FF) is deliberately not here: the deploy steps are
   * written with `→`, which is punctuation, not decoration.
   */
  const EMOJI = /[\u2600-\u27BF\u2B00-\u2BFF]|\uFE0F|[\u{1F000}-\u{1FAFF}]/u;

  it('holds no emoji codepoint anywhere in README.md', () => {
    const found = EMOJI.exec(readme);
    expect(found?.[0] ?? null).toBeNull();
  });

  it('and the ranges are the ranges: a check mark is an emoji, an arrow is not', () => {
    expect(EMOJI.test('✅')).toBe(true);
    expect(EMOJI.test('\u{1F680}')).toBe(true);
    expect(EMOJI.test('→')).toBe(false);
    expect(EMOJI.test('· — © §')).toBe(false);
  });

  it('every remote image is a badge for a workflow this repository has', () => {
    const remote = all(IMAGE, readme).filter((image) => (image[2] ?? '').startsWith('http'));
    expect(remote.length).toBeGreaterThan(0);
    for (const image of remote) {
      const badge = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/workflows\/([\w.-]+)\/badge\.svg$/.exec(image[2] ?? '');
      expect(badge, `not a workflow badge: ${image[2] ?? ''}`).not.toBeNull();
      expect(existsSync(join('.github/workflows', badge?.[1] ?? ''))).toBe(true);
    }
  });
});

describe('the hero and the social preview (FR-PUB-2, FR-PUB-11, D-370)', () => {
  /** A PNG's IHDR: width and height are the two big-endian words at byte 16. */
  function size(path: string): { width: number; height: number } {
    const header = readFileSync(path).subarray(0, 24);
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  }

  it('is composed from captures that are in the committed set', () => {
    expect(SOURCES.length).toBe(3);
    for (const source of SOURCES) {
      expect(existsSync(join('docs/screenshots', source.file)), `missing capture ${source.file}`).toBe(true);
    }
  });

  it('and writes nothing into docs/screenshots/, which captures.test.ts owns', () => {
    expect(HERO.path.includes('docs/screenshots')).toBe(false);
    expect(PREVIEW.path.includes('docs/screenshots')).toBe(false);
  });

  it('the hero is 1200 px wide and not empty', () => {
    expect(existsSync(HERO.path)).toBe(true);
    expect(statSync(HERO.path).size).toBeGreaterThan(0);
    expect(size(HERO.path).width).toBe(1200);
  });

  it('the social preview is exactly 1280 x 640, which is what GitHub asks for', () => {
    expect(existsSync(PREVIEW.path)).toBe(true);
    expect(size(PREVIEW.path)).toEqual({ width: 1280, height: 640 });
  });
});

describe('the reading order (FR-PUB-3)', () => {
  /** Every link in the file that points at a path rather than at the network. */
  const relative = all(LINK, built)
    .map((link) => link[2] ?? '')
    .filter((target) => !/^(https?:|mailto:|#)/.test(target))
    .map((target) => normalize(join('docs', target.split('#')[0] ?? '')));

  it('every relative link resolves to something that exists', () => {
    const broken = [...new Set(relative)].filter((target) => !existsSync(target));
    expect(broken).toEqual([]);
  });

  it('links the four documents, the driver and the four skills', () => {
    const targets = new Set(relative);
    for (const target of [
      'SPEC.md',
      'PLAN.md',
      'TASKS.md',
      'scripts/sdd-run.ts',
      '.claude/skills/sdd-spec/SKILL.md',
      '.claude/skills/sdd-breakdown/SKILL.md',
      '.claude/skills/sdd-implement/SKILL.md',
      '.claude/skills/visual-review/SKILL.md',
    ]) {
      expect(targets, `not linked: ${target}`).toContain(target);
    }
  });

  it('and the example task: its pull request, absolute and to this repository, and its captures', () => {
    // The repository is read out of the README's own badge, so the two cannot
    // disagree about which repository this is.
    const badge = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/actions\//.exec(readme);
    expect(badge?.[1]).toBeTruthy();
    const pulls = all(LINK, built)
      .map((link) => link[2] ?? '')
      .filter((target) => target.includes('/pull/'));
    expect(pulls.length).toBeGreaterThan(0);
    for (const pull of pulls) expect(pull).toMatch(new RegExp(`^https://github\\.com/${badge?.[1] ?? ''}/pull/\\d+$`));
    expect(relative.filter((target) => target.startsWith('docs/screenshots/')).length).toBeGreaterThan(0);
  });

  it('says why docs/ is as big as it is', () => {
    expect(built).toMatch(/53 MB/);
    expect(built).toContain('docs/screenshots/');
  });

  it('is linked from the first screen and reachable as a file', () => {
    expect(existsSync('docs/HOW-THIS-WAS-BUILT.md')).toBe(true);
  });
});

describe('credits (FR-PUB-4)', () => {
  const attributions = section(readme, 'Data sources and attributions');

  /** The six sources, with the terms each is used under. */
  const SOURCES_AND_TERMS: readonly [string, RegExp][] = [
    ['CelesTrak', /free for any use with attribution/i],
    ['Open-Meteo', /CC BY 4\.0/],
    ['GeoNames', /CC BY 4\.0/],
    ["Mike McCants'", /published data table, used with attribution/i],
    ['Heavens-Above', /development use only/i],
    ['glyphcss', /MIT/],
  ];

  for (const [name, terms] of SOURCES_AND_TERMS) {
    it(`names ${name} with the terms it is used under`, () => {
      expect(attributions).toContain(name);
      expect(attributions).toMatch(terms);
    });
  }

  it('credits glyphcss to its author and its copyright holder, and says why it was chosen', () => {
    expect(attributions).toContain('Juan Cruz Fortunatti');
    expect(attributions).toContain('https://glyphcss.com');
    expect(attributions).toMatch(/©\s*2025 Layoutit/);
    expect(attributions).toMatch(/monospace/);
  });
});

describe('third-party notices (FR-PUB-5)', () => {
  const NOTICES = 'public/third-party-notices.txt';
  const text = readFileSync(NOTICES, 'utf8');
  /** One entry per rule: `name@version`, the licence, the source, then the verbatim text. */
  const entries = new Map<string, string>(
    text
      .split(RULE)
      .slice(1)
      .map((chunk) => {
        const lines = chunk.trim().split('\n');
        return [lines[0] ?? '', lines.slice(1).join('\n')] as const;
      }),
  );

  it('names every package that can reach the production bundle, and only those', { timeout: 60_000 }, () => {
    const installed = [...productionPackages().keys()].sort();
    expect([...entries.keys()].sort()).toEqual(installed);
  });

  it('carries a licence identifier and a verbatim licence for each', () => {
    for (const [name, body] of entries) {
      expect(body, `${name} has no licence identifier`).toMatch(/^Licence: \S+/m);
      const licenceText = body.split('\n').slice(3).join('\n').trim();
      expect(licenceText.length, `${name} has a licence body of ${String(licenceText.length)} characters`).toBeGreaterThanOrEqual(100);
    }
  });

  it('ships with the code it covers: Vite copies public/ into dist/, and the service worker ignores .txt', () => {
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(/globPatterns: \[[^\]]*\]/.exec(vite)?.[0] ?? '').not.toContain('txt');
  });
});

describe('the licence (FR-PUB-6)', () => {
  it('is the MIT licence, named after the owner and the year', () => {
    expect(license.split('\n')[0]).toBe('MIT License');
    expect(license).toContain('Copyright (c) 2026 Ezequiel Baruf');
  });

  it('carries the notice-retention sentence verbatim', () => {
    const flat = license.replace(/\s+/g, ' ');
    expect(flat).toContain(
      'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
    );
  });

  it('and package.json agrees, while staying private', () => {
    expect(pkg.license).toBe('MIT');
    expect(pkg.private).toBe(true);
  });
});

describe('hygiene (FR-PUB-7, D-372)', () => {
  /** Every tracked path, relative to the root — the same source `hygiene.test.ts` reads. */
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((path) => path !== '');

  /** The shapes a secret arrives in. None of these has ever been tracked here; this is what keeps it that way. */
  const SECRETS = [/(^|\/)\.env($|\.)/, /\.pem$/, /\.key$/, /(^|\/)\.npmrc$/, /(^|\/)\.vscode\//, /(^|\/)\.idea\//, /\.iml$/];

  /** Not text, so not scanned: a PNG's bytes are not a document. */
  const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|otf|ttf|woff2?|wasm)$/i;

  /**
   * Two tracked files are verbatim third-party metadata rather than text this
   * repository wrote: the lockfile, which quotes npm's own deprecation notices,
   * and the notices file, which quotes package authors' licence headers. Both
   * carry addresses their authors published, and editing either to remove one
   * would falsify the record — the notices file is a licence obligation whose
   * whole point is that the text is unaltered.
   */
  const THIRD_PARTY = new Set(['package-lock.json', 'public/third-party-notices.txt']);

  /** An address, RFC-5322 shaped and kept simple: a local part, an `@`, a host with a dot. */
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

  /**
   * A path into somebody's machine. Three segments below the root at least, so
   * that the three documents can keep discussing the finding — SPEC §4.24 and
   * PLAN D-373 quote the prefixes and an elided `/Volumes/Data/Projects/…`,
   * and a rule that fired on those could only be satisfied by editing the
   * record of the audit that made it.
   */
  const ABSOLUTE = /\/(?:Users|home|Volumes)(?:\/[A-Za-z0-9._-]+){3,}/;

  const text = tracked.filter((path) => !BINARY.test(path) && !THIRD_PARTY.has(path));

  it('tracks nothing shaped like a secret or an editor configuration', () => {
    expect(tracked.filter((path) => SECRETS.some((shape) => shape.test(path)))).toEqual([]);
  });

  it('holds no email address in any text file it wrote', () => {
    const found = text.filter((path) => EMAIL.test(readFileSync(path, 'utf8')));
    expect(found).toEqual([]);
  });

  it('holds no absolute path into the machine it was built on', () => {
    const found = text.filter((path) => ABSOLUTE.test(readFileSync(path, 'utf8')));
    expect(found).toEqual([]);
  });

  it('and the shapes are the shapes: the R14 attribute would fail, the documents that discuss it do not', () => {
    // The two positives are assembled rather than written out, because this
    // file is tracked and the two assertions above read it: a test that spells
    // out the thing it forbids is the thing it forbids.
    const path = (...segments: string[]): string => `/${segments.join('/')}`;
    expect(ABSOLUTE.test(path('Volumes', 'Data', 'Projects', 'app', 'spike', 'spike.css'))).toBe(true);
    expect(ABSOLUTE.test(path('Users', 'someone', 'src', 'app', 'vite.config.ts'))).toBe(true);
    expect(ABSOLUTE.test(path('Volumes', 'Data', 'Projects'))).toBe(false);
    expect(ABSOLUTE.test('`/Users/`, `/home/` or `/Volumes/`')).toBe(false);
    expect(EMAIL.test(['someone', 'example.com'].join('@'))).toBe(true);
    expect(EMAIL.test('@glyphcss/react')).toBe(false);
  });

  it('and the R14 measurements name the stylesheet, not the machine (D-373)', () => {
    const measurements = readFileSync('docs/spike-glyphcss/measurements.json', 'utf8');
    expect(measurements).toContain('data-vite-dev-id=spike/spike.css');
    const findings = readFileSync('docs/spike-glyphcss/FINDINGS.md', 'utf8');
    expect(findings).toMatch(/D-373/);
  });
});

describe('the contribution stance (FR-PUB-10)', () => {
  it('exists and is linked from the first screen', () => {
    expect(existsSync('CONTRIBUTING.md')).toBe(true);
    expect(prologue).toContain('](CONTRIBUTING.md)');
  });

  it('names the three documents a change has to go through', () => {
    for (const document of ['SPEC.md', 'PLAN.md', 'TASKS.md']) expect(contributing).toContain(document);
  });

  it('says a change starts as a task, not as a pull request against main', () => {
    expect(contributing.replace(/\s+/g, ' ')).toContain('bare pull request against `main`');
  });
});

describe('repository metadata, ready to paste (FR-PUB-11)', () => {
  const metadata = section(release, '10. Repository metadata (FR-PUB-11)');

  it('carries the description', () => {
    expect(metadata).toMatch(/\*\*Description\*\*/);
    expect(metadata).toMatch(/Naked-eye satellite spotting/);
  });

  it('carries at most twelve topics', () => {
    // The item runs from its own bullet to the next one.
    const topics = /\*\*Topics\*\*[\s\S]*?(?=\n- \[ \]|$)/.exec(metadata)?.[0] ?? '';
    const names = [...topics.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThanOrEqual(12);
  });

  it('carries the homepage URL, which is the live site the README names', () => {
    expect(metadata).toContain(LIVE);
  });

  it('carries the path of the social preview image', () => {
    expect(metadata).toContain('docs/readme/social-preview.png');
  });
});
