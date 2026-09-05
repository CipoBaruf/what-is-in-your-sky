# Mockups

The visual references the owner approves before the screens are built. Both
pages link the app's own `src/ui/styles/tokens.css` and `global.css`, so every
colour, the font stack and `--cell` are the real ones and a reference cannot
drift from the palette. Only the layout rules in each page's own `<style>`
block are new, and those are what the tasks implement.

| Page | Captures | Regenerate |
| --- | --- | --- |
| `desktop-1280.html` (FR-DESK-5) | `desktop-1280-{dark,night}.png` | `npm run mockup:desktop` |
| `compact-390.html` (FR-COMP-6) | `compact-390-{home,settings,detail}-{dark,night}.png` | `npm run mockup:compact` |

Both go through `scripts/mockup-capture.ts`, which takes the mockup's name
(and with no name at all shoots both). The desktop page is one full-page shot
per theme, because its two frames are two states of the same layout and are
read side by side. The compact page is three screens, and a phone screen is
read on its own, so each frame is shot as an element at a 390 px viewport —
the app's own 960 px breakpoint has to *not* match while these are taken.

A change to a layout that its mockup does not show is a change to the
reference: update the page, regenerate the captures and get them approved,
rather than letting the implementation and the reference drift apart.

---

# The desktop mockup (FR-DESK-5)

## Status

**Approved by the owner, 2026-09-04** (PR #32). This satisfies R23's
precondition in TASKS.md: R23 implements the wide layout against these
captures and ships its own 1280 px captures beside them for comparison.

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

---

# The compact mockup (FR-COMP-6)

## Status

**Waiting for the owner's approval** on R43's PR. It is the `Precondition:`
of R52 (the settings page, the two headers, the location summary and the rows
that fit) and the reference R51 builds the pass detail's legend block
against, the way R23 was gated on the desktop one.

The live page's compact layout is deliberately **not** here: FR-COMP-6 leaves
it to the spike of FR-WIN-7 (R38).

## The width, and where 36 cells comes from

390 px is an iPhone 15 Pro's viewport. One cell is 0.6 em at the 16 px base,
so 9.6 px, and 390 px is 40.6 cells; `global.css` keeps two cells of side
padding on `header`, `main` and `footer`, which leaves **36 cells** of
content. That is the number FR-COMP-4 holds every control row to, and the
number R52's `tests/styles/controlRows.test.ts` asserts.

Each frame is drawn down to its full height, with a dashed rule at 845 px
marking the fold — what a reader sees before scrolling on an iPhone 15 Pro,
whose viewport is 390 × 844. The rule's label is short (`844 px — the fold`)
because it is opaque: every cell it spans is a cell of the screen the frame
stops showing.

## What the mockup fixes

**Home (FR-COMP-3, FR-COMP-1).** The one-row header, then: the location
summary, the readiness line, the elements banners, the Now panel, the Moon
line, the hero card, the sort row, the list, the footer.

**Settings (FR-COMP-2), at `#settings`.** A `[ ← Back ]` control, then
language, theme, location (the inputs, the device-location button and the
precision note), saved places, and clear. No save action: every change applies
at once, as it does today.

**The pass detail (FR-COMP-5, FR-LEG-1..5).** The chart box is full-bleed — it
spans the 390 px and ignores `main`'s two cells of side padding — and is a
square. The numeric table has moved directly under it and is now the legend:
its heading carries the key `A` and the swatch, the shadow entry has a row of
its own, another drawn pass gets one row (key, swatch, name, rise and end),
and the Sun and the Moon get a line each. The chart itself carries no name, no
clock times and no Sun or Moon captions — only the compass names, the ring
labels, the degree ticks, the markers and the key.

## Every control row, counted (FR-COMP-4)

Character counts, which for a monospace grid are cell counts. The limit is 36.

| Screen | Row | Cells |
| --- | --- | ---: |
| home | `> Your sky [ live ] [ settings ]` | 32 |
| home | `Using −38.93, −67.99 · [ change ]` | 33 |
| home | `from your device, accurate to 3 km` | 34 |
| home | `Ready offline until 2026-09-11 09:49` | 36 |
| home | `Sort: [x] Soonest [ ] Best` | 26 |
| settings | `[ ← Back ]` | 10 |
| settings | `[x] English [ ] Español` | 23 |
| settings | `[x] Dark [ ] Night` | 18 |
| settings | `[ Use my location ]` | 19 |
| settings | `−38.93, −67.99 in use [ × ]` | 27 |
| settings | `Cipolletti [ use ] [ × ]` | 24 |
| settings | `[ Save this place ]` | 19 |
| settings | `[ Clear saved location ]` | 24 |
| detail | `[ ← Back to the list ]` | 22 |
| detail | `View: [ ] Polar [x] Dome` | 24 |
| detail | `A ██ ISS (Zarya)` | 16 |
| detail | `Point Time Azimuth Elevation` (5 + 8 + 8 + 9 columns, single spaces) | 33 |
| detail | `Shadow 03:58:52 SE 132° 21°` | 30 |
| detail | `B ██ SL-16 R/B 03:36 → 03:46` | 28 |
| detail | `Sun WNW 291° · 8° below` | 23 |
| detail | `Moon ☽ SE 132° · 34° up` | 23 |
| detail | `[ Share this pass ]` | 19 |

The two tightest are worth naming. The readiness line is 36 cells exactly —
D-145 already sized it, and it is why the stamp is a date and a clock to the
minute rather than a full timestamp. The header is 32, which is what makes the
short title necessary (below).

## The decisions the mockup makes

- **The compact title is the manifest's `short_name`, "Your sky".** FR-COMP-1
  asks for the title, `[ live ]` and `[ settings ]` in one row of 36 cells;
  the full title alone is 31 cells with `h1`'s `> ` prefix, so the row cannot
  hold the controls. `Your sky` is already the app's own short name
  (`public/manifest.webmanifest`), so the phone header says what a phone
  launcher says.
- **The header is the same on every compact screen, and the current page is
  not a link.** On `#settings` the `[ settings ]` control is dim and inert;
  the way back is FR-COMP-2's own `[ ← Back ]`, at the top of the page.
- **The location summary can take a second line.** The summary itself is one
  line, as FR-COMP-3 says. The accuracy note of US-3 AC3 is a dim line under
  it, shown only for a device fix — one line of 34 cells rather than a longer
  first line that would wrap.

## What is illustrative, not fixed

- **The chart.** It is R22's own 390 px capture of the dome
  (`docs/screenshots/r22-dome-390-{dark,night}-en.png`), cropped to the
  drawing and scaled up to fill the square box, with the labels FR-LEG-1 drops
  blanked out in the page background: the satellite name, the clock times, the
  `max 45°` peak caption and the `Sun` and `Moon` captions. The key `A` is
  drawn over the peak marker. So the drawing is a real one, but it is a
  smaller drawing enlarged: R45 re-rasters at this size instead, and under
  D-65 the cell keeps its size and the grid gains rows and columns, so the
  real square is finer than this one. What the mockup fixes is the box — full
  bleed, square, the drawing covering 95 % of the width, above FR-DOME-1's
  90 % floor.
- **The `B` row in the legend.** FR-LEG-3 gives every other drawn pass a row,
  and the row is drawn here to show its shape. The borrowed capture draws one
  arc only, so there is no `B` arc in the picture; the legend lists exactly
  the passes the chart draws (FR-LEG-2), and how many that is on the detail is
  R45's.
- **The `Shadow` row's label** and the wording of the legend's Sun and Moon
  lines are R51's to name in the catalogs. Only their place is fixed here.
- **The pass data** is the R1 golden fixture's and R22's, so the times,
  magnitudes and directions are real, but the count and the mix of objects are
  not a promise.
- **The Moon line's slot** on home is dashed for the same reason as on the
  desktop mockup: FR-MOON-3's lore line belongs to R30 and its flag.
- **Where the fold falls.** With the staleness warning shown, as it is here,
  the hero card starts 34 px below the fold; with fresh elements and no
  banner it sits above it. The order is FR-COMP-3's and the mockup follows it.
