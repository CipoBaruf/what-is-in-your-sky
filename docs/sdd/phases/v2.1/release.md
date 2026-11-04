## 13. v2.1 (spec §9 Phase 2h)

> *History (marked 2026-09-25, FR-SHOW-1): the v2.1 release's list as it was run. What is current is §1–§5, §10 and the last section.*

Everything above still applies, §1 to §5 included, and §12's runs stay the reference for
the screens v2.1 did not change. v2.1 is the audit and the flow: no new screen, three
small features (faint passes, `[ see this pass ]`, the capped column), and a long list
of holes closed — a link that no longer overwrites your place, failures that say what
failed and offer `[ retry ]`, a list that knows what night it is, a shell a screen reader
can walk, and a Back button that goes back. Most of it is proved by a test. What is
left here is what a test cannot do: hold a phone, lose the network on purpose, and
listen to the page.

The phone is the one used for §12, so the readings compare. **Start §13.1 from a clean
browser**, for the same reason as §12.1: it cannot be run twice on one profile.

### 13.1 The first run, from a clean browser (FR-FIRST-1..4, FR-FIRST-10, US-26 AC7, F-97)

- [ ] The where step's placeholders read as hints, not values: the coordinate field
      and the place field are visibly empty, and the altitude box holds no real `0`
      (FR-FIRST-2, F-73).
- [ ] **Type** a coordinate pair — do not use the device button. `[ continue ]` is on
      the screen as soon as the pair is valid, and pressing it moves to the next step
      (FR-FIRST-2, F-86). The step does not move under you while you are still typing.
- [ ] The first step is one screen with its footer under it — no long empty run under
      the coordinates, the privacy promise said once (FR-FIRST-1, F-74).
- [ ] On the third step, **open the first card** — tap anywhere on it, the cloud line
      included — and its pass opens; back on the list, the next pass is there to open
      too (FR-FIRST-3, FR-FIRST-10, F-84, F-85).
- [ ] The header of the cold open offers no `[ live ]` that leads to a page with
      nothing on it (F-75).
- [ ] **F-97.** Back on the first step (a second clean profile, or clear the site
      data), scroll it up and down with a finger. If the top of the page above the form
      blanks while scrolling, F-97 is confirmed: write down the phone, the browser and
      the version, and it becomes a finding with a task. If it does not, write that down
      and F-97 is closed as the emulated pane's artefact.

### 13.2 A friend's link over a saved place, and back (FR-VISIT-1..4, US-30)

With the place from §13.1 saved. Have a pass link and a live link for **another**
place ready — sent from a second device, or made there with `[ share ]`.

- [ ] Open the pass link. The page shows the other place's sky with one notice under
      the header: "Showing the sky from …, from a link" with `[ back to my place ]` and
      `[ keep this place ]` (FR-VISIT-2). Your saved place has not been touched.
- [ ] `[ back to my place ]`: your own place and its list come back, the notice goes,
      and the hash is cleared (FR-VISIT-2). Reload to be sure the saved place survived
      — **this is the item the phase exists for** (F-89).
- [ ] Open the live link, and this time `[ keep this place ]`: the visited place is now
      yours, and the notice goes.
- [ ] A live link whose time has passed opens at real time with a note that says so
      (FR-VISIT-3); a link with a broken value opens your own home with "That link
      could not be read." (FR-VISIT-4). Edit the hash by hand for both.

### 13.3 Aeroplane mode on an open tab, then `[ retry ]` (FR-FAIL-1..8, FR-OFF-8, US-31)

- [ ] With the home open and computed, turn on aeroplane mode and reload. The stored
      run is shown with its age, the live page draws from it (FR-OFF-8), and nothing
      says `HTTP`, a status code or an exception's name outside `[ details ]`
      (FR-FAIL-2, F-96).
- [ ] Change the place while offline, so a load has to fail. The place its result
      would have been shows one line — what failed, what the page is using instead —
      then `[ retry ]` and `[ details ]` (FR-FAIL-1).
- [ ] Turn aeroplane mode off and press `[ retry ]`. It shows its loading state and the
      list comes back **without a reload** (FR-FAIL-1, F-87).
- [ ] Switch the language while a failure line is up: the sentence changes language
      with the rest of the page (FR-FAIL-2).
- [ ] The live page opened cold with no network says it is offline or failed — not
      "loading" for ever (FR-LIVE-1, FR-FAIL-6, F-92).

### 13.4 A screen-reader pass over the four routes (FR-A11Y-1..6, OQ-35)

VoiceOver on an iPhone or TalkBack on Android, whichever the phone has. Name it and its
version in the release PR: that is what FR-A11Y-6 asks for.

- [ ] **Home.** The first swipe reaches a skip link; the rotor or the headings list
      shows one `h1`, the steps or panes as `h2`, and each night and each pass card
      below them (FR-A11Y-1, FR-A11Y-2, F-72). A card is announced as one control.
- [ ] **A pass** (`#pass?…`). Opening it moves the focus into the pass and the
      document's title names it (FR-A11Y-3, FR-A11Y-4). Back goes back to the list,
      once, not twice (FR-ROUTE-1, F-91).
- [ ] **Live** (`#live`). Entering it moves the focus to the page, its landmarks are
      there (F-71), and the watching headline's times are read with `rise`, `peak`
      and `end` (F-81). **F-100** (fixed in the release, D-642): with the screen reader off, tap
      into `#live` and look at the back control. If a ring is drawn, it hugs `[ ← ]`
      and stays off the line below. A ring that covers text reopens F-100.
- [ ] **Settings** (`#settings`). Every row is read once — the install row is not
      "Instalar, Instalar" (F-83) — and the install button, if the browser offers one,
      still works after a cancelled dialog (FR-FAIL-8, F-95).
- [ ] What no test checks, the rest of OQ-35, once each: a Tab walk on a device with a
      keyboard (every control reached, the focus ring visible), and the four routes at
      200 % text in the phone's settings (nothing cut off without a way to reach it).
      Write down what fails; each is a finding, not a fix in this release.

### 13.5 What the owner decides on this release

- [x] **F-69, main over its budget.** Decided at the gate (V21-24, D-641): main's
      budget is 170, the §11 ceiling, against the 166.6 KB it measures. 3.4 KB is left;
      PLAN D-609's remedies (zod out of the shell's path, the guide behind
      `React.lazy`) are for the phase that needs more.
- [ ] **F-66, F-70 and F-99.** Read the two `captures.yml` runs on the release commit
      (§13.6) and diff them. The two local runs differed in 38 of 254 files (PLAN
      D-639): about half are sub-pixel edges (F-66, F-70), and the rest are the live
      page's shown instant a second apart (F-99). F-99 is fixed in the release (D-642):
      two local runs now differ in 7 files, none on a clock. Byte-identical on CI:
      close F-66 and F-70. Different: keep them with the file names. A clock that
      differs reopens F-99.
- [ ] **OQ-33**, the stripe with no dark band, is still open for want of a night to
      look at (SPEC §7). Close it or carry it.

### 13.6 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.1.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R83..R101).
- [ ] The `captures.yml` run on the merge commit is green: **254 files**, no missing
      capture. Dispatch it a **second time on the same commit** and compare the two
      artefacts file by file; that pair is F-66's and F-70's reading of record
      (FR-CAP-5).
- [ ] Tag it: `git tag -a v2.1.0 <sha> -m "v2.1: the audit and the flow" && git push
      origin v2.1.0` — **with the release commit's SHA written in**, not whatever
      `main` has reached by then (a squash merge rewrites the commit).
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Run §13.1 to §13.4 on the phone, and write the results into the register: F-97
      confirmed or closed, OQ-35's remaining half closed or turned into findings.
- [ ] Record in the release PR: the bundle table with main against its new 170, the
      screen reader and its version, the §4 Heavens-Above comparison with the observer
      and both element epochs, and the date.
