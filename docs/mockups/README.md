# Desktop mockup (FR-DESK-5)

The visual reference for the wide layout. `docs/mockups/desktop-1280.html` is
the mockup; `desktop-1280-dark.png` and `desktop-1280-night.png` are its
captures, regenerated with:

```
npm run mockup:desktop
```

The page links the app's own `src/ui/styles/tokens.css` and `global.css`, so
every colour, the font stack and `--cell` are the real ones and the reference
cannot drift from the palette. Only the wide-layout rules in the page's own
`<style>` block are new, and those are what R23 implements.

## Status

**Approved by the owner, 2026-09-04** (PR #32). This satisfies R23's
precondition in TASKS.md: R23 implements the wide layout against these
captures and ships its own 1280 px captures beside them for comparison.

A change to the wide layout that this mockup does not show is a change to the
reference: update the page, regenerate the captures and get them approved,
rather than letting the implementation and the reference drift apart.

## What the mockup fixes

Two states, both at 1280 px (about 133 cells at the 16 px base):

**State 1 — nothing selected.** The header spans both columns and carries the
title, the tagline and, at the right, the language, night-theme and live-page
controls (FR-DESK-2). The left column is 40 cells and holds location, the
elements banners, the Now panel and the Moon line's slot, in that order. The
right column takes the rest: the pass count, the hero card, the sort control
and the list.

**State 2 — a pass selected.** The right column splits (FR-DESK-3). The list
keeps at least 44 cells, stays scrollable and highlights the selected card;
the guide takes the rest. `Esc` or `[ × ]` closes it and the selection stays
in the hash.

## What is illustrative, not fixed

- The Moon line is drawn in its slot with a dashed border. Its wording and the
  lore line are FR-MOON-3 and belong to R30; only the slot's position is fixed
  here.
- The guide's chart is the R16 spike's own capture of candidate C (D-92,
  `docs/dome-composition/layered-golden-390.png`) dropped into the panel. The
  guide panel is about 44 cells, so the spike's 390 px grid is close to the
  right density; the spike page's own debug caption is part of that capture
  and is not part of the app. R21 draws the real thing.
- The pass data is the R1 golden fixture's, so the times and magnitudes are
  real but the count and the mix of objects are not a promise.
- The `[ Live sky → ]` control's position in the header is fixed by FR-DESK-2;
  its wording is R32's.
