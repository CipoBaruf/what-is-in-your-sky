/**
 * R108 (FR-DS-6, FR-DS-9; D-707, D-729): `docs/DESIGN.md`, generated.
 *
 * The guide is written from three inputs and nothing else: the sheet
 * (`src/ui/styles/tokens.css`, read through `readSections` so the guide and the
 * style tests parse it the same way), the primitives' manifest
 * (`src/ui/components/primitives/manifest.ts`, which `manifest.test.ts` holds
 * to the components' own `Props` types) and the block of rules below, which is
 * SPEC §4.45 in plain words. `tests/docs/design.test.ts` regenerates the guide
 * in memory and expects the committed file byte for byte — the `accuracy.test.ts`
 * pattern (D-650) — so a token added to the sheet, a prop added to a primitive
 * or a value changed in either is a failing test until `npm run design:guide`
 * is run and the result committed, and the guide cannot drift from the files.
 *
 * Nothing here reads the clock or the tree's history: the output is a function
 * of the inputs alone, which is what makes "byte for byte" a fair test.
 *
 *   npm run design:guide
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PRIMITIVES, type PrimitiveEntry } from '../src/ui/components/primitives/manifest';
import { CHART_MARK_TOKENS, CHART_RESERVED_TOKENS, CHART_SURFACE_TOKENS, CHART_TEXT_TOKENS, contrastRatio, GROUND_TOKENS, readSections, TEXT_TOKENS, TOKENS_PATH, type Section, type SheetSection } from './contrast';

export const GUIDE_PATH = 'docs/DESIGN.md';
export const MANIFEST_PATH = 'src/ui/components/primitives/manifest.ts';
export const PRIMITIVES_DIR = 'src/ui/components/primitives';
export const DEV_PAGE_URL = 'http://localhost:5173/dev/primitives.html';

/** What each section of the sheet is for, in a sentence, over its table. */
const SECTION_TEXT: Record<Exclude<Section, 'night' | 'colour'>, { title: string; text: string }> = {
  grid: { title: 'Grid', text: 'The source every other length is written from: one character advance (`--cell`), one text row (`--row`), the tap floor and the hairline a rule is drawn with.' },
  space: { title: 'Space', text: 'The vertical scale, each step a share of the row, so what sits between two blocks is a whole number of quarter rows. Horizontal space is in cells (`calc(2 * var(--cell))`) and has no scale. `--space-block` is board 1B’s block gap, kept at its value beside the scale (OQ-37).' },
  type: { title: 'Type', text: 'Every size-and-line-height pair in use, named for the role of the element that sets it and never for the size, so a later collapse of the ladder (OQ-37) is a value change and not a rename. The chart’s sizes are in px on purpose: the drawings do not scale with the base (OQ-38).' },
  edges: { title: 'Edges', text: 'The plain-character borders, the three radii, the one focus ring (`global.css`’s `:focus-visible`, D-704) and the bold weight.' },
  layers: { title: 'Layers', text: 'Every `z-index` in the tree, named for what stands at it. A module names the level and never writes the number.' },
};

/** A Markdown table cell: pipes escaped, nothing else touched. */
const cell = (text: string): string => text.replace(/\|/g, '\\|');
const code = (text: string): string => `\`${text}\``;
const ratio = (fg: string, bg: string): string => `${contrastRatio(fg, bg).toFixed(2)} : 1`;

/**
 * The trailing comment on a token's line in the `:root` block — `--space-1: …; /* 6 px *\/` —
 * the first occurrence per name, which is the dark theme's (the night block restates the colours
 * with their ratios, which the guide computes rather than copies). A block comment above a token
 * is the sheet's prose and stays there.
 */
export function readNotes(css: string): Map<string, string> {
  const notes = new Map<string, string>();
  for (const [, name, note] of css.matchAll(/^\s*--([a-z0-9-]+):\s*[^;]+;[ \t]*\/\*\s*([\s\S]*?)\s*\*\//gm)) {
    if (name && note && !notes.has(name)) notes.set(name, note.replace(/\s+/g, ' '));
  }
  return notes;
}

/** A colour token's note without the ratio the sheet writes before it: `11.75 : 1 — the highlighted pass` → `the highlighted pass`. */
const colourNote = (note: string | undefined): string => (note ?? '').replace(/^\d+(\.\d+)? : 1\s*(—\s*)?/, '');

/** The contrast column for one colour token in one theme: what the tokens test measures it against, and the bar it meets. */
function contrastCell(name: string, tokens: Map<string, string>): string {
  const value = tokens.get(name);
  const get = (token: string): string => {
    const found = tokens.get(token);
    if (!found) throw new Error(`no --${token} in the sheet`);
    return found;
  };
  if (!value) throw new Error(`no --${name} in the sheet`);
  if (name === 'bg') return 'the page ground';
  if (name === 'bg-raised') return `${ratio(value, get('bg'))} on \`--bg\` (a surface)`;
  if ((TEXT_TOKENS as readonly string[]).includes(name)) {
    const parts = GROUND_TOKENS.map((ground) => `${ratio(value, get(ground))} on \`--${ground}\``);
    if (name === 'accent') parts.push(`\`--bg\` on it ${ratio(get('bg'), value)}`);
    return `${parts.join(', ')} (text, ≥ 4.5 : 1)`;
  }
  if (name === 'edge') return `${GROUND_TOKENS.map((ground) => `${ratio(value, get(ground))} on \`--${ground}\``).join(', ')} (a control’s edge, ≥ 3 : 1)`;
  if (name === 'rule') return `${ratio(value, get('bg'))} on \`--bg\` (decorative only)`;
  if ((CHART_RESERVED_TOKENS as readonly string[]).includes(name)) return `${ratio(value, get('bg'))} on \`--bg\` (reserved for the stars, FR-DS-8)`;
  if ((CHART_MARK_TOKENS as readonly string[]).includes(name)) return `${ratio(value, get('bg'))} on \`--bg\` (a chart mark, ≥ 3 : 1)`;
  if ((CHART_TEXT_TOKENS as readonly string[]).includes(name)) return `${ratio(value, get('bg'))} on \`--bg\` (chart text, ≥ 4.5 : 1)`;
  if ((CHART_SURFACE_TOKENS as readonly string[]).includes(name)) return `${ratio(value, get('bg'))} on \`--bg\` (a chart surface, meant to sit near 1)`;
  return `${ratio(value, get('bg'))} on \`--bg\``;
}

function lengthTable(section: SheetSection, notes: Map<string, string>): string[] {
  const lines = ['| Token | Value | Note |', '|---|---|---|'];
  for (const [name, value] of section.tokens) lines.push(`| ${code(`--${name}`)} | ${code(cell(value))} | ${cell(notes.get(name) ?? '')} |`);
  return lines;
}

function colourTable(colour: SheetSection, night: SheetSection, notes: Map<string, string>): string[] {
  const lines = ['| Token | Dark | Night | Contrast, dark | Contrast, night | Note |', '|---|---|---|---|---|---|'];
  for (const [name, dark] of colour.tokens) {
    const nightValue = night.tokens.get(name);
    if (!nightValue) throw new Error(`--${name} has no night value (FR-THEME-1)`);
    lines.push(`| ${code(`--${name}`)} | ${code(dark)} | ${code(nightValue)} | ${cell(contrastCell(name, colour.tokens))} | ${cell(contrastCell(name, night.tokens))} | ${cell(colourNote(notes.get(name)))} |`);
  }
  return lines;
}

function primitiveBlock(primitive: PrimitiveEntry): string[] {
  const lines = [`### \`${primitive.name}\``, '', `${code(`${PRIMITIVES_DIR}/${primitive.file}`)} — ${primitive.when}`, '', '| Prop | Type | What it does |', '|---|---|---|'];
  for (const prop of primitive.props) lines.push(`| ${code(prop.name)} | ${code(cell(prop.type))} | ${cell(prop.text)} |`);
  return lines;
}

/**
 * SPEC §4.45 in plain words — the block the script carries (D-707). It is the
 * one part of the guide that is not read from a file, so it is held here, next
 * to what reads the files, and changes with the spec and not with the sheet.
 */
const RULES = `## The rules

### No literal in a module (FR-DS-2)

\`tests/styles/literals.test.ts\` reads every stylesheet under \`src/\` except the sheet and fails on:

- a colour literal — a hex, \`rgb()\`, \`hsl()\`, a \`color-mix()\` with a literal inside, or a named colour other than \`transparent\`, \`currentColor\` and \`inherit\`;
- a \`px\`, \`rem\` or \`em\` length other than \`0\`, outside an \`@media\` or \`@container\` condition;
- a \`z-index\` written as a number;
- an \`outline\` rule other than \`outline-offset: var(--focus-offset-tight)\` — the ring is \`global.css\`'s alone;
- a \`font-family\` that is not \`var(--font-mono)\`;
- a \`::before\`/\`::after\` whose \`content\` is \`"[ "\` or \`" ]"\` outside \`src/ui/components/primitives/\` — the brackets are the control primitives';
- in a \`.tsx\` file, an inline \`style\` whose value is a colour or a length literal (a custom property and a number measured at runtime are allowed).

The exceptions are in \`tests/styles/literals.allow.json\`, one entry per file with its count and its reason. A count may only go down, and an entry whose count reaches zero is removed. A length a module needs is a token above or a cell count; a colour is a token; a stacking level is a layer.

### Breakpoints: one source, one syntax (FR-DS-3)

Every length in an \`@media\` or \`@container\` condition is one of \`src/lib/layout.ts\`'s exported thresholds — the widths, the three heights (\`SIDEWAYS_MAX_HEIGHT_PX\`, \`SHORT_MAX_HEIGHT_PX\`, \`WIDE_SHORT_MAX_HEIGHT_PX\`) and \`FRAME_LEGEND_MIN_CELLS\` — and \`tests/styles/breakpoint.test.ts\` holds each condition in the tree to one of them and to \`tests/styles/breakpoints.json\`'s listing. Every condition is written in range syntax: \`(width >= 964px)\`, \`(height <= 700px)\`, never \`min-width\` or \`max-width\`. That syntax sets the browser floor: **Safari 16.4, Chrome 104, Firefox 63**. Nothing in the tree targets anything older.

### A prop, never an override (FR-DS-4)

The primitives above are the only place a control is styled. A feature module may place a primitive — a grid area, a margin from the space scale — and may not set its colour, its font, its border, its padding or its brackets. A feature component that wants a different control asks for a prop, and the prop is added to the primitive for every module that needs it, never as a local override. A feature component composes primitives and keeps its own file and name (\`FailureLine\` renders a \`Line\`, \`PassCard\` a \`Card\`, \`SortToggle\` a \`ToggleGroup\`, \`CoordsInput\` a \`Field\`), which is what keeps its tests and its captures unchanged. The primitives are leaves: they import React, their own module and each other, and nothing of the app — no store, no copy, no behaviour (D-703).

### How a redesign lands (FR-DS-9)

A design handoff names the sheet's tokens and the primitives by the names this guide prints. A handoff that invents names (\`--color-accent-*\`) is translated into the sheet before a task is cut, and the translation is part of the spec prompt. The order of work is always:

1. the sheet — a token's value changes here and nowhere else;
2. the primitives — a prop is added, a module changed, in \`src/ui/components/primitives/\`;
3. the dev page's captures — \`npm run design:captures\` re-shoots the four files below, so the change is a visible diff in review in both themes;
4. the screens.

A screen's module is never the first file a redesign touches. The \`sdd-spec\` skill reads this guide before a screen is specified.
`;

/** The whole guide, from the sheet's text and the manifest; what `npm run design:guide` writes and the test regenerates. */
export function renderGuide(css: string, primitives: readonly PrimitiveEntry[] = PRIMITIVES): string {
  const sections = readSections(css);
  const notes = readNotes(css);
  const section = (name: Section): SheetSection => {
    const found = sections.find((s) => s.name === name);
    if (!found) throw new Error(`no == ${name} == section in ${TOKENS_PATH}`);
    return found;
  };

  const lines: string[] = [
    '# The design system',
    '',
    `<!-- Generated by \`scripts/design-guide.ts\` from \`${TOKENS_PATH}\` and \`${MANIFEST_PATH}\`. Do not edit: \`npm run design:guide\` rewrites it, and \`tests/docs/design.test.ts\` fails when this file differs from what the script writes. -->`,
    '',
    `The visual identity, written down as one token sheet and the primitives built on it (SPEC §4.45, FR-X-6). A screen is built from these and from nothing else: every length, colour, type size and stacking level a module uses is a token below, every control is a primitive below, and a module that writes a value instead of its name fails \`tests/styles/literals.test.ts\`. The page that shows every primitive in every state, in both themes, is \`dev/primitives.html\` — \`npm run dev\` serves it at ${DEV_PAGE_URL} — and its captures are at the end of this page.`,
    '',
    '## The sheet',
    '',
    `\`${TOKENS_PATH}\`, in the order its sections are written. Lengths are written from the grid — \`--row\` (1.5 rem, 24 px at the base) and \`--cell\` (1ch) — and have one value; colours have a dark value and a night value, and the night block restates every colour and nothing else (FR-THEME-1). The contrast beside each colour is what \`tests/styles/tokens.test.ts\` computes (\`scripts/contrast.ts\`, WCAG 2.1): text clears 4.5 : 1 on both grounds, a control's edge and a chart mark clear 3 : 1.`,
    '',
  ];

  for (const name of ['grid', 'space', 'type', 'edges', 'layers'] as const) {
    const { title, text } = SECTION_TEXT[name];
    lines.push(`### ${title}`, '', text, '', ...lengthTable(section(name), notes), '');
  }
  lines.push('### Colour', '', 'Every colour in both themes. The night values are reds (FR-THEME-3: `r ≥ g ≥ b`, within 30° of red), so in night mode the status inks differ by lightness and not by hue, and colour is never the only channel (FR-X-5).', '', ...colourTable(section('colour'), section('night'), notes), '');

  lines.push('## The primitives', '', `\`${PRIMITIVES_DIR}/\`: one component, one module and one manifest row each (\`${MANIFEST_PATH}\`, D-703). Every control is \`--tap\` tall. Each one's \`className\` is placement only — a grid area or a margin from the space scale — and nothing else may be set from outside.`, '');
  for (const primitive of primitives) lines.push(...primitiveBlock(primitive), '');

  lines.push(RULES);

  lines.push('## The dev page', '', `\`dev/primitives.html\` renders every primitive in every state and tone, both themes side by side, and is served by \`npm run dev\` only — \`vite build\` never sees it. \`npm run design:captures\` shoots it under \`playwright.design.config.ts\` at 390 and 1280 px, one file per theme, into \`docs/screenshots/design/\`; \`.github/workflows/captures.yml\` re-shoots them after the release set, so they join the set's diff.`, '');
  for (const width of [390, 1280]) {
    for (const theme of ['dark', 'night']) {
      const file = `design-primitives-${String(width)}-${theme}.png`;
      lines.push(`![The primitives at ${String(width)} px in the ${theme} theme](screenshots/design/${file})`, '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

if (process.argv[1]?.endsWith('design-guide.ts')) {
  const guide = renderGuide(readFileSync(TOKENS_PATH, 'utf8'));
  writeFileSync(GUIDE_PATH, guide);
  console.log(`${GUIDE_PATH}: ${String(guide.split('\n').length)} lines from ${TOKENS_PATH} and ${MANIFEST_PATH}`);
}
