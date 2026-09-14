/**
 * R25 (FR-OFF-6, D-127): the install audit, as a unit test. Chromium will
 * only offer to install a page whose manifest parses, is same-origin, names
 * the app, starts somewhere inside its own scope, asks for `standalone`, and
 * carries a PNG icon of at least 192 px and one of 512 px — so those are the
 * assertions, read off the file the site actually serves rather than off a
 * config object. The e2e half (the link resolves, the icons are precached,
 * the audit passes at 390 px) is in `tests/e2e/pwa.spec.ts`.
 *
 * The two icons are checked by reading their PNG headers: R74 (D-460) draws
 * them from the mark's scene as dots, and a wrong `sizes` in the manifest is
 * the one mistake the browser reports as "no suitable icon" and nothing else
 * catches. What the icons *draw* is pinned by `tests/build/mark-icons.test.ts`,
 * byte for byte against the renderer; this file only asks that the site
 * serves them, and the three favicons, at the sizes it declares.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
interface Manifest {
  id: string;
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

const MANIFEST = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as Manifest;
const TOKENS = readFileSync('src/ui/styles/tokens.css', 'utf8');

/** Width and height out of a PNG's IHDR, which is always the first chunk. */
function pngSize(file: string): { width: number; height: number; png: boolean } {
  const bytes = readFileSync(file);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    png: bytes.subarray(0, 8).equals(signature) && bytes.toString('latin1', 12, 16) === 'IHDR',
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

/** The value of a token in `:root`, i.e. the dark theme (D-84). */
function darkToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(TOKENS.slice(TOKENS.indexOf(':root')));
  if (!match?.[1]) throw new Error(`no --${name} in tokens.css`);
  return match[1];
}

describe('public/manifest.webmanifest', () => {
  it('names the app once, in one language (FR-OFF-6)', () => {
    expect(MANIFEST.name).toBe('What is in your sky right now');
    expect(MANIFEST.short_name.length).toBeLessThanOrEqual(12); // what a launcher shows under the icon
    expect(MANIFEST.lang).toBe('en');
    // Not localised: the file is one object, not a map of languages, and carries no Spanish.
    expect(JSON.stringify(MANIFEST)).not.toMatch(/"es"|cielo/i);
  });

  it('installs standalone from the root, in the dark theme colour', () => {
    expect(MANIFEST.display).toBe('standalone');
    expect(MANIFEST.start_url).toBe('/');
    expect(MANIFEST.scope).toBe('/');
    expect(MANIFEST.start_url.startsWith(MANIFEST.scope)).toBe(true);
    expect(MANIFEST.theme_color).toBe(darkToken('bg'));
    expect(MANIFEST.background_color).toBe(darkToken('bg'));
  });

  it('carries the 192 and 512 px PNGs the install audit asks for', () => {
    expect(MANIFEST.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of MANIFEST.icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.purpose).toBe('any');
      expect(icon.src.startsWith('/')).toBe(true);
      const declared = Number(icon.sizes.split('x')[0]);
      const actual = pngSize(`public${icon.src}`);
      expect(actual.png, `${icon.src} is not a PNG`).toBe(true);
      expect([actual.width, actual.height], `${icon.src} is not ${icon.sizes}`).toEqual([declared, declared]);
    }
  });

  /** R74 (FR-MARK-4 e, D-460): the app had no favicon at all until the mark gave it three files. */
  it('ships the 16 and 32 px favicons and the SVG, and links them from index.html with the SVG first', () => {
    for (const [file, px] of [['favicon.png', 16], ['favicon-32.png', 32]] as const) {
      const favicon = pngSize(`public/${file}`);
      expect(favicon.png, `public/${file} is not a PNG`).toBe(true);
      expect([favicon.width, favicon.height], file).toEqual([px, px]);
    }
    const svg = readFileSync('public/favicon.svg', 'utf8');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 16 16"/);
    expect(svg, 'the SVG carries the light-scheme swap in its own stylesheet').toContain('@media (prefers-color-scheme:light)');
    const html = readFileSync('index.html', 'utf8');
    const links = [
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />',
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />',
    ];
    const at = links.map((link) => html.indexOf(link));
    expect(at.every((index) => index >= 0), 'every favicon link is in index.html').toBe(true);
    expect(at[0]).toBeLessThan(at[1] ?? 0);
    expect(at[1]).toBeLessThan(at[2] ?? 0);
  });

  it('is linked from index.html, with the icon Safari installs from', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/icon-192\.png" \/>/);
  });
});
