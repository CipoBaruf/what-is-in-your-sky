/**
 * R4 (FR-X-3, PLAN D-12, §11): `public/_headers` is exactly the block PLAN §11
 * prescribes, the CSP allows no host the code does not need, and the `_headers`
 * parser behind `vite preview` applies rules the way Cloudflare Pages does.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePagesHeaders } from '../../vite.config';

const HEADERS_FILE = readFileSync('public/_headers', 'utf8');
const PLAN = readFileSync('PLAN.md', 'utf8');

function planHeadersBlock(): string {
  const match = /`public\/_headers`:\s*\n\s*```\n([\s\S]*?)```/.exec(PLAN);
  if (!match?.[1]) throw new Error('PLAN.md §11 has no `public/_headers` block');
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^ {2}/, ''))
    .join('\n')
    .trim();
}

function csp(): Map<string, string[]> {
  const rule = parsePagesHeaders(HEADERS_FILE).find((r) => r.pattern.test('/'));
  const value = rule?.headers.find(([name]) => name === 'Content-Security-Policy')?.[1];
  if (!value) throw new Error('no Content-Security-Policy for /');
  return new Map(
    value.split(';').map((directive) => {
      const [name = '', ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

function externalHostsIn(dir: string): Set<string> {
  const hosts = new Set<string>();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    // Code only: catalog.json carries provenance links (McCants, CelesTrak pages) the app never fetches.
    if (!entry.isFile() || /\.test\.tsx?$/.test(entry.name) || !/\.tsx?$/.test(entry.name)) continue;
    // The footer's attribution links (FR-X-2, R12) are navigation targets the user follows, not connections the page makes; CSP does not govern them.
    if (entry.name === 'Footer.tsx') continue;
    const text = readFileSync(join(entry.parentPath, entry.name), 'utf8');
    for (const [url] of text.matchAll(/https?:\/\/[a-z0-9.-]+/g)) hosts.add(url);
  }
  return hosts;
}

describe('public/_headers', () => {
  it('is the PLAN §11 block verbatim', () => {
    expect(HEADERS_FILE.trim()).toBe(planHeadersBlock());
  });

  it('serves the three security headers on every path', () => {
    const rules = parsePagesHeaders(HEADERS_FILE);
    const root = rules.find((r) => r.pattern.test('/'));
    expect(root?.headers.map(([name]) => name)).toEqual(['Content-Security-Policy', 'Referrer-Policy', 'Permissions-Policy']);
    expect(root?.headers).toContainEqual(['Referrer-Policy', 'strict-origin-when-cross-origin']);
    expect(root?.headers).toContainEqual(['Permissions-Policy', 'geolocation=(self)']);
  });

  it('allows exactly the site, CelesTrak and Open-Meteo as connection targets, and no inline code', () => {
    const directives = csp();
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('connect-src')).toEqual([
      "'self'",
      'https://celestrak.org',
      'https://api.open-meteo.com',
      'https://geocoding-api.open-meteo.com',
    ]);
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('style-src')).toEqual(["'self'"]);
    expect(directives.get('worker-src')).toEqual(["'self'"]);
    // R25 (FR-OFF-6, D-75): the manifest is ours, named explicitly rather than left to `default-src`.
    expect(directives.get('manifest-src')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    // D-75: `style-src-attr` is the one relaxation, and it is the only place `unsafe-` may appear.
    for (const [name, sources] of directives) {
      if (name === 'style-src-attr') continue;
      expect(sources.join(' '), `${name} must not be relaxed`).not.toMatch(/unsafe|nonce|sha\d/);
    }
  });

  /**
   * V1-4 / D-75, and the assertion FR-GUIDE-5 asks for by name: glyphcss
   * colours a glyph with an inline `style` attribute, so `style-src-attr`
   * gains `'unsafe-inline'` — and nothing else does. `style-src-elem` and
   * `script-src` stay `'self'`, which is what stops a later "just add
   * unsafe-inline" from riding in on an unrelated PR. Both are checked as
   * CSP3 resolves them, so falling back to `style-src` counts and a future
   * explicit directive is held to the same value.
   */
  describe('the FR-DOME-2 relaxation (D-75)', () => {
    /** A fetch directive as the browser resolves it: its own value, or the one it falls back to. */
    const effective = (name: string, fallback: string): string[] => {
      const directives = csp();
      return directives.get(name) ?? directives.get(fallback) ?? directives.get('default-src') ?? [];
    };

    it('lets a style attribute through, so the dome can be coloured', () => {
      expect(effective('style-src-attr', 'style-src')).toEqual(["'unsafe-inline'"]);
    });

    it('keeps stylesheets and scripts on the origin', () => {
      expect(effective('style-src-elem', 'style-src')).toEqual(["'self'"]);
      expect(effective('script-src-elem', 'script-src')).toEqual(["'self'"]);
      expect(csp().get('script-src')).toEqual(["'self'"]);
    });

    it('relaxes exactly one directive and no other', () => {
      const relaxed = [...csp()].filter(([, sources]) => sources.some((source) => source.startsWith("'unsafe-"))).map(([name]) => name);
      expect(relaxed).toEqual(['style-src-attr']);
    });
  });

  it('covers every external host the app code references (FR-X-3)', () => {
    const allowed = new Set(csp().get('connect-src'));
    const referenced = externalHostsIn('src');
    expect(referenced.size).toBeGreaterThan(0);
    for (const host of referenced) expect(allowed, `${host} is not in connect-src`).toContain(host);
  });

  it('marks hashed assets immutable for a year and nothing else', () => {
    const rules = parsePagesHeaders(HEADERS_FILE);
    const cacheRules = rules.filter((r) => r.headers.some(([name]) => name === 'Cache-Control'));
    expect(cacheRules).toHaveLength(1);
    const [assets] = cacheRules;
    expect(assets?.pattern.test('/assets/index-abc123.js')).toBe(true);
    expect(assets?.pattern.test('/')).toBe(false);
    expect(assets?.pattern.test('/index.html')).toBe(false);
    expect(assets?.headers).toEqual([['Cache-Control', 'public, max-age=31536000, immutable']]);
  });
});

describe('parsePagesHeaders', () => {
  it('stacks every matching rule and ignores blanks and comments', () => {
    const rules = parsePagesHeaders(['# comment', '/*', '  X-A: 1', '', '/assets/*', '  X-B: two: parts', ''].join('\n'));
    expect(rules).toHaveLength(2);
    const applied = (path: string): [string, string][] =>
      rules.filter((r) => r.pattern.test(path)).flatMap((r) => r.headers);
    expect(applied('/')).toEqual([['X-A', '1']]);
    expect(applied('/assets/deep/file.js')).toEqual([
      ['X-A', '1'],
      ['X-B', 'two: parts'],
    ]);
    expect(applied('/assets')).toEqual([['X-A', '1']]);
  });

  it('rejects a header line before any path', () => {
    expect(() => parsePagesHeaders('  X-A: 1')).toThrow(/unexpected line/);
  });
});
