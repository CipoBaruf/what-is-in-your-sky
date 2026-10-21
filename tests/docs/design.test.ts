/**
 * R108 (FR-DS-6, FR-DS-9; US-37 AC1; D-707, D-729): the guide is a function of
 * the sheet and the manifest, so the test is to run the function and compare.
 *
 * `scripts/design-guide.ts` writes `docs/DESIGN.md` from `tokens.css` (through
 * `readSections`, the parser the style tests use), from the primitives'
 * manifest and from one static block of rules; this test regenerates the guide
 * in memory and expects the committed file byte for byte, the way
 * `accuracy.test.ts` holds the README (D-650). A token added, a value changed,
 * a prop added or a sentence edited in either input is a failing test until
 * `npm run design:guide` is run and the result committed — which is what "the
 * guide cannot drift from the files" means as a test.
 *
 * The second half is the sanity check on the generator itself: a renderer that
 * printed nothing would also compare equal to a committed nothing, so the
 * guide is held to naming every token of every section, every primitive and
 * every prop, and to linking the four design captures the set names.
 *
 * Off line, like every test in `tests/docs`: the sheet, the manifest and the
 * committed file.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSections, TOKENS_PATH } from '../../scripts/contrast';
import { GUIDE_PATH, readNotes, renderGuide } from '../../scripts/design-guide';
import { PRIMITIVES } from '../../src/ui/components/primitives/manifest';
import { designCaptureSet } from '../e2e/captureSet';

const css = readFileSync(TOKENS_PATH, 'utf8');
const committed = readFileSync(GUIDE_PATH, 'utf8');
const generated = renderGuide(css);

describe('docs/DESIGN.md is what scripts/design-guide.ts writes (FR-DS-6, D-707)', () => {
  it('is byte for byte the regenerated guide: run `npm run design:guide` and commit when this fails', () => {
    expect(committed).toBe(generated);
  });

  it('is the same twice: nothing in the generator reads the clock or the tree', () => {
    expect(renderGuide(css)).toBe(generated);
  });
});

describe('the guide names everything the inputs hold (US-37 AC1)', () => {
  it('every token of every section, with its dark value and, for a colour, its night value', () => {
    for (const section of readSections(css)) {
      if (section.name === 'night') continue;
      for (const [name, value] of section.tokens) {
        expect(generated, `--${name}`).toContain(`| \`--${name}\` | \`${value.replace(/\|/g, '\\|')}\` |`);
      }
    }
    const night = readSections(css).find((section) => section.name === 'night');
    for (const [name, value] of night?.tokens ?? []) expect(generated, `--${name} night`).toContain(`| \`${value}\` |`);
  });

  it('every primitive with its file and every prop with its type', () => {
    for (const primitive of PRIMITIVES) {
      expect(generated).toContain(`### \`${primitive.name}\``);
      expect(generated).toContain(`\`src/ui/components/primitives/${primitive.file}\``);
      for (const prop of primitive.props) expect(generated, `${primitive.name}.${prop.name}`).toContain(`| \`${prop.name}\` | \`${prop.type.replace(/\|/g, '\\|')}\` |`);
    }
  });

  it('the contrast the tokens test computes, beside the colour it is for', () => {
    // The sheet's header documents the same figures; the guide computes them from the values, so the two agree by construction.
    expect(generated).toMatch(/\| `--fg` \| `#[0-9a-f]{6}` \| `#[0-9a-f]{6}` \| 13\.79 : 1 on `--bg`, 12\.30 : 1 on `--bg-raised` \(text, ≥ 4\.5 : 1\) \| 9\.27 : 1 on `--bg`/);
    expect(generated).toContain('(a chart mark, ≥ 3 : 1)');
    expect(generated).toContain('(reserved for the stars, FR-DS-8)');
  });

  it('the trailing notes of the sheet, read once per token and never the night ratio', () => {
    const notes = readNotes(css);
    expect(notes.get('space-1')).toBe('6 px');
    expect(notes.get('chart-pass')).toBe('11.75 : 1 — the highlighted pass');
    expect(generated).toContain('| `--chart-pass` |');
    expect(generated).toMatch(/\| `--chart-pass` \|.*\| the highlighted pass \|/);
  });

  it('the rules of SPEC §4.45 and the browser floor, in plain words', () => {
    for (const heading of ['## The sheet', '## The primitives', '## The rules', '### No literal in a module (FR-DS-2)', '### Breakpoints: one source, one syntax (FR-DS-3)', '### A prop, never an override (FR-DS-4)', '### How a redesign lands (FR-DS-9)', '## The dev page']) {
      expect(generated).toContain(heading);
    }
    expect(generated).toContain('Safari 16.4, Chrome 104, Firefox 63');
    expect(generated).toContain('A screen\'s module is never the first file a redesign touches.');
  });

  it('links the four design captures the set names, and no other image', () => {
    const images = [...generated.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1] ?? '');
    expect(images).toEqual(designCaptureSet().map((capture) => `screenshots/design/${capture.file}`));
  });
});
