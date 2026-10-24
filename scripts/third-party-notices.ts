/**
 * FR-PUB-5: `public/third-party-notices.txt`, the licence notices of every
 * package that reaches the production bundle.
 *
 *   npx tsx scripts/third-party-notices.ts
 *
 * MIT, ISC and BSD all require the copyright notice and the permission notice
 * to travel with the code. Vite minifies both away and copies `public/` into
 * `dist/`, so this file is how the deployed site keeps them: it is served at
 * `/third-party-notices.txt` beside the bundle it covers. Nothing in the UI
 * links it and `.txt` is not in the service worker's `globPatterns`, so the
 * precache is unchanged.
 *
 * The list is `npm ls --omit=dev --all`, which is `dependencies` and their
 * transitive production dependencies — what the bundler is allowed to reach.
 * Development dependencies are not here because none of their code ships.
 *
 * `tests/docs/public.test.ts` re-runs that command and fails when the file and
 * the installed tree disagree, in either direction.
 *
 * After the packages comes a fixed data section (`dataNotices`, R112, D-748):
 * the star catalogue's sources, which ship in the bundle without being
 * packages. `tests/data/starCatalog.test.ts` holds the file to that list.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve('public/third-party-notices.txt');
const ROOT = resolve('.');

/** The rule that separates two entries. `public.test.ts` splits on it. */
export const RULE = '-'.repeat(76);

/** One package, as it is written out. */
export interface Notice {
  name: string;
  version: string;
  license: string;
  source: string;
  text: string;
}

/** A licence file, by the names packages actually use. */
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;
/** The sentence every one of these licences carries, used to find a licence header inside a source file. */
const PERMISSION = /permission is hereby granted|redistribution and use|apache license/i;

/**
 * What `npm ls --omit=dev --all --long --json` reports, reduced to what is
 * needed. A node with no `version` is an optional peer dependency that is not
 * installed (`immer` and `use-sync-external-store` under `zustand`): no code of
 * it exists in the tree, so none of it can reach the bundle, and there is
 * nothing to quote.
 */
interface LsNode {
  version?: string;
  license?: string | { type?: string };
  path?: string;
  /** Installed but required by nothing in the tree: knip's wasm resolver binding pulls these in on a platform that skips the binding. */
  extraneous?: boolean;
  dependencies?: Record<string, LsNode>;
}

/** Every installed production package, by `name@version`, deepest duplicates included. */
export function productionPackages(): Map<string, { name: string; version: string; license: string; path: string }> {
  const json = execFileSync('npm', ['ls', '--omit=dev', '--all', '--long', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const found = new Map<string, { name: string; version: string; license: string; path: string }>();
  const walk = (node: LsNode): void => {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      // Nothing imports an extraneous package, so it cannot reach the bundle.
      if (child.extraneous === true) continue;
      if (child.version !== undefined && child.path !== undefined) {
        const license = typeof child.license === 'string' ? child.license : (child.license?.type ?? 'UNKNOWN');
        found.set(`${name}@${child.version}`, { name, version: child.version, license, path: child.path });
      }
      walk(child);
    }
  };
  walk(JSON.parse(json) as LsNode);
  return found;
}

/**
 * The files a package offers as its own code, in the order worth reading: what
 * `exports` publishes, then `module`, then `main`, then `index.js`.
 *
 * `main` alone is not enough, and that was the review finding on the first P1
 * run. A package that ships ESM only declares `exports` and no `main` — every
 * new one does — so `pkg.main ?? 'index.js'` would look for a file that is not
 * there, `licenseText` would return `null`, and `collect` would stop the build
 * on a package whose notice is sitting in the very file `exports` points at.
 * Today no production dependency takes this path (all eleven but one ship a
 * licence file, and `astronomy-engine` has a `main`); the next one added would.
 *
 * `exports` is a tree of strings, conditions and subpath keys, so it is walked
 * rather than indexed, and anything that is not a relative path to JavaScript
 * is dropped.
 */
function entryFiles(dir: string, pkg: { main?: string; module?: string; exports?: unknown }): string[] {
  const fromExports: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') fromExports.push(node);
    else if (Array.isArray(node)) for (const item of node) walk(item);
    else if (node !== null && typeof node === 'object') for (const value of Object.values(node)) walk(value);
  };
  walk(pkg.exports);
  const files = [...fromExports, pkg.module, pkg.main, 'index.js']
    .filter((name): name is string => typeof name === 'string' && !name.startsWith('/') && /\.[cm]?js$/.test(name))
    .map((name) => join(dir, name))
    .filter((path) => existsSync(path));
  return [...new Set(files)];
}

/**
 * The verbatim licence text of one package: its own licence file when it has
 * one, and otherwise the `@preserve` header of a file it publishes, which is
 * where a single-file library keeps it (`astronomy-engine`).
 */
function licenseText(dir: string): { source: string; text: string } | null {
  const file = readdirSync(dir).find((name) => LICENSE_FILE.test(name));
  if (file !== undefined) return { source: join(relative(ROOT, dir), file), text: readFileSync(join(dir, file), 'utf8').trim() };

  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { main?: string; module?: string; exports?: unknown };
  for (const entry of entryFiles(dir, pkg)) {
    const header = /^\s*\/\*[\s\S]*?\*\//.exec(readFileSync(entry, 'utf8'));
    if (header === null || !PERMISSION.test(header[0])) continue;
    // The comment markers and the indentation the header is written with go; the wording does not.
    const text = header[0]
      .replace(/^\s*\/\*+/, '')
      .replace(/\*+\/\s*$/, '')
      .replace(/^[ \t]*\*? ?/gm, '')
      .replace(/@preserve/g, '')
      .trim();
    return { source: relative(ROOT, entry), text };
  }
  return null;
}

/** Every notice, sorted by name so the file only changes when the tree does. */
export function collect(): Notice[] {
  const notices: Notice[] = [];
  for (const { name, version, license, path } of productionPackages().values()) {
    const found = licenseText(path);
    if (found === null) throw new Error(`no licence text found for ${name}@${version} in ${relative(ROOT, path)}`);
    notices.push({ name, version, license, source: found.source, text: found.text });
  }
  return notices.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/**
 * The rule that opens the data section. It is not `RULE`, so the package
 * entries `public.test.ts` splits on `RULE` stay exactly the installed tree.
 */
export const DATA_RULE = '='.repeat(76);

/** One data source the bundle carries, as it is written out. */
export interface DataNotice {
  name: string;
  license: string;
  source: string;
  /** Where in the repository it is used. */
  use: string;
  text: string;
}

/**
 * R112 (FR-STAR-1, D-748): the data that ships in the bundle without being a
 * package. `npm ls` cannot see it, so it is a fixed list, written after the
 * packages: the star catalogue's three sources (`data-src/stars/README.md`).
 * The figures' licence is quoted from the file vendored beside them.
 */
export function dataNotices(): DataNotice[] {
  return [
    {
      name: 'd3-celestial constellation figures',
      license: 'BSD-3-Clause',
      source: 'https://github.com/ofrohn/d3-celestial, data/constellations.lines.json (data-src/stars/d3-celestial-LICENSE.txt)',
      use: 'src/data/stars/catalog.json, the figures',
      text: readFileSync(resolve('data-src/stars/d3-celestial-LICENSE.txt'), 'utf8').trim(),
    },
    {
      name: 'Yale Bright Star Catalogue, 5th revised edition',
      license: 'Public domain',
      source: 'Hoffleit & Warren (1991), CDS catalogue V/50, https://cdsarc.cds.unistra.fr/ftp/V/50/',
      use: 'src/data/stars/catalog.json, the stars and their positions, magnitudes and designations',
      text: 'The catalogue is in the public domain. Hoffleit, D. and Warren, Jr., W.H., The Bright Star Catalogue, 5th Revised Ed. (Preliminary Version), 1991, distributed by the Centre de Données astronomiques de Strasbourg (CDS).',
    },
    {
      name: 'IAU Catalog of Star Names (IAU-CSN)',
      license: 'CC-BY-4.0',
      source: 'IAU Division C Working Group on Star Names (WGSN), https://www.iau.org/public/themes/naming_stars/, as listed at https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt',
      use: 'src/data/stars/catalog.json, the proper names',
      text: 'The star names are the IAU Working Group on Star Names\' (WGSN), released by the International Astronomical Union under the Creative Commons Attribution 4.0 International licence: free to use as long as the source is mentioned. https://creativecommons.org/licenses/by/4.0/',
    },
  ];
}

/** The file, header and all. */
export function render(notices: Notice[], data: DataNotice[] = dataNotices()): string {
  const head = [
    'THIRD-PARTY NOTICES',
    '',
    'This file lists every package whose code can reach the production bundle of',
    '"What is in your sky right now", with the licence it is used under and the',
    'verbatim text of that licence. It is generated from the installed dependency',
    'tree by scripts/third-party-notices.ts; do not edit it by hand.',
    '',
    'The app itself is MIT licensed. See LICENSE at the root of the repository.',
    '',
    `${String(notices.length)} packages, then ${String(data.length)} data sources.`,
    '',
  ].join('\n');
  const bodies = notices.map(
    (notice) =>
      `${RULE}\n${notice.name}@${notice.version}\nLicence: ${notice.license}\nSource: ${notice.source}\n\n${notice.text}\n`,
  );
  const dataHead = `${DATA_RULE}\nDATA\n\nThe data the bundle carries that is not a package: the star catalogue's sources.\n`;
  const dataBodies = data.map((entry) => `${DATA_RULE}\n${entry.name}\nLicence: ${entry.license}\nSource: ${entry.source}\nUsed in: ${entry.use}\n\n${entry.text}\n`);
  return `${head}\n${bodies.join('\n')}\n${dataHead}\n${dataBodies.join('\n')}`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const notices = collect();
  writeFileSync(OUT, render(notices), 'utf8');
  console.log(`${OUT}: ${String(notices.length)} packages`);
}
