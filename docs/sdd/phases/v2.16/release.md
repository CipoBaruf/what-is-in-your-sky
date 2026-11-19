## 30. v2.16 (spec §Phase 2y)

Everything in `docs/RELEASE.md` and §29 still applies.
v2.16 is "an answer first" (V216-1..V216-18): a first visit opens on tonight's next pass over its time zone's city, labelled as an example, with one action to set a place, and the place question only where there is no example (FR-OPEN-1..14, US-60, US-61).
Every page opens for the example with one line under the header (FR-OPEN-7), and a load with a stored place draws what 2.15.0 drew but for the header's tagline (FR-OPEN-9).
CI answers by time: the typecheck, lint and unit suite run beside the build and the e2e shards are cut by duration (FR-CI-4, FR-CI-5), and the capture set runs on four runners (FR-CI-6).
`main` reads 2.16.0 once R203 merges; the tag and the deploy are the owner's (§30.6).

### 30.1 The captures (FR-OPEN-9, FR-OPEN-11, FR-CAP-5)

The set is **508 files**, against 464 on 2.15.0: R202 added 32 (`first-example`, `first-example-short`, `first-wait`, `first-wait-short`, `first-place`, `first-place-short`, `first-noon`, `location-short` and `location` at 1024; D-1203) and R203 adds 12 (`first-pass`, `first-live` and `first-stars` at 390 and 1280, dark, both languages; D-1207).
The step captures of `r76-captures.spec.ts` and `r84-captures.spec.ts` left with the steps; they were not in the set (D-1203).

The whole set was not shot here. On the Mac, beside `v2.15.0` built and shot in the same run (plain builds, Google Chrome), seven screens were compared by pixels — `home`, `favourites`, `settings`, `guide`, `live-watching`, `stars`, `stars-globe`, 168 files — with `scripts/captures/diff.ts`:

- **The header's tagline (FR-OPEN-8, FR-OPEN-9, D-1181, D-1204), the one named move of a returning visit.** Every `home` file at 1024, 1280 and 1920 changes in the header alone: in English the tagline's new words (0.2–0.5 % of the pixels); in Spanish at 1024 the tagline now shows, a second header line that moves the page under it down (8–10 %), and at 1280 and 1920 the new words (0.2–0.4 %).
  The Spanish home captures at 964–1049 px of `captures.yml` gain the same line.
- **The phone's follow question, a harness change and not the app's.** `live-watching` and `stars` at 360, 390 and 844 differ by 5–6 % because the 2.15.0 spec did not seed `wiys:followAsked:v1` and the question stood over the sky; R204's seed (FR-CI-6, D-1213) answers it before the page opens.
- **Unchanged** (under 0.1 %): `favourites`, `settings`, `guide`, `stars-globe`, `live-watching` at 1280 and up, `stars` at 1280 and up, and the phones' `home`.
- **New:** FR-OPEN-11's files (R202) and the pages the example opens (R203). The owner's review copies, shot on the Mac, are `docs/screenshots/v2.16-r202/` and `docs/screenshots/v2.16-r203/`.

Two runs' agreement (FR-CAP-5) is the Linux reading, not the Mac's (`docs/sdd/gotchas.md`, *captures*).

- [ ] `captures.yml` against `v2.15.0`: every changed file is a `first-*`, `location` or `location-short` file, a header that moves with the tagline, or a phone `live-*` or `stars-*` file the follow seed answers.
- [ ] A second `captures.yml` run on the same SHA agrees with the first (FR-CAP-5).

### 30.2 The budget (FR-OPEN-1, D-178, D-1208)

`npm run bundle:budget` on the branch, gzip level 9, beside `v2.15.0` built in the same run on the same machine, both plain.
D-178 re-sets every row: the measure × 1.1, up to the next 5 KB line, floored at 10 and inside its ceiling; only `zones` moves, from `PHASE_BUDGETS` into the table. The budget column is `scripts/bundle-budget.ts`'s rows; `tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `v2.15.0` | Change |
|---|---|---|---|---|
| main | **195.2** | 185 (**over**, §30.4) | 194.8 | +385 bytes |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | +2 bytes |
| stars-deep (`deep`) | 41.8 | 50 | 41.8 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars (`Stars` + `catalog`) | 31.1 | 35 | 31.0 | +28 bytes |
| astronomy (`astronomy` + `skyBodies`) | 28.0 | 30 | 28.0 | 0 |
| window (`SkyWindow`) | 14.3 | 20 | 14.3 | +1 byte |
| globe (`SkyGlobe` + `GlobeRail` + `scene`) | 14.1 | 15 | 14.0 | +9 bytes |
| live | 11.6 | 15 | 11.6 | 0 |
| zones | 6.6 | **9** (new row) | — | +6,760 bytes |
| service worker | 6.5 | 10 | 6.5 | +13 bytes |
| facts | 4.8 | 6 | 4.8 | −2 bytes |
| settings | 1.2 | 10 | 1.2 | +1 byte |

**`main` is +385 bytes** (199,454 → 199,839), inside 1 KB of 2.15.0: R200's example and R202's band and `usePlaceOpen` against the steps, the step catalog keys and `lib/moonNote.ts` that R202 removed (199,664 at R202's merge), and R203's page line and `usePageObserver` (+175).
D-1204 named 199,845 bytes for 2.15.0; a plain build of the tag reads 199,454 here, and against D-1204's figure the change is −6. The row stays over its 185 line as it was on 2.15.0 (V214-20). **`zones`** is the time zone table (FR-OPEN-1), loaded only on a first visit; the rule's 10 is capped at `ZONE_TABLE_MAX_KB` (9).
**`stars`** and **`globe`** take the example's line on the stars page.

### 30.3 What the phase removed

`npm run check:dead` reports nothing. R202 removed the first-run steps, the files named without their path as they are gone:
StepLine.tsx, WhenStep.tsx, WhatStep.tsx and Steps.module.css under the home's screens, with WhenStep.clouds.test.tsx and tonight.test.ts; lib/moonNote.ts with its test; the e2e spec first-run-controls.spec.ts; the steps' catalog keys and the doors' `onWhat` (D-1204). R201 removed the `when_shown` and `what_shown` events (D-1197).

The phase was built by sub-agents outside the driver, so `sdd-run/usage.jsonl` has no row for it; no tier ceiling is set.

### 30.4 What the owner decides

- [ ] `main` is 195.2 KB against its 185 budget and ceiling, as on 2.15.0 (194.8): raise the ceiling to the measure, or leave the row warning.
- [ ] The captures of §30.1, compared: the R202 and R203 review folders and `captures.yml`'s diff.
- [ ] The wide stars page's place group lists the example's city as `[x] Buenos Aires` (the globe's own and saved places read the active observer). FR-OPEN-2 keeps the example out of the fields and the saved places; keep it in the globe's group as the place shown, or leave it out.
- [ ] The required checks on `main`: `static`, `unit (shard 1)` and `unit (shard 2)` (D-1223), with `gh api` branch protection.

### 30.5 The run on a device

- [ ] On the phone, in a private window: the first screen is the tagline, the example band and `[ Not there? Set your place ]` with no scroll; the action opens the question with `[ back ]`; a place set lands on the stacked home.
- [ ] From the example, the Satellites, Stars and Live sky doors: each page carries `Example: <city>, from your time zone · [ set your place ]` under its head, and the control brings the home back with the question open.
- [ ] The wait on the phone: `exampleWait.spec.ts`'s reading was 3.25 s on the Mac with Google Chrome (D-1193); a first visit on the owner's phone over mobile data, timed from the tap to the band's card, is written here. Over 10 s (`EXAMPLE_WAIT_MS`) the page falls back to the question.
- [ ] At the desk: a first visit shows the three panes for the example, and `#live` and `#stars` carry the line under the header.
- [ ] A browser with a saved place opens exactly as on 2.15.0, the tagline aside.

### 30.6 The release itself — `v2.16.0`

- [ ] `package.json` is `2.16.0` on `main` and every task of the phase is checked off.
- [ ] §30.4 decided and §30.1's `captures.yml` runs recorded.
- [ ] `npm run check:dead` clean on the release commit, and the bundle table is §30.2's.
- [ ] §30.5's run written down.
- [ ] The phase's full CI run on its pull request answers within 8 minutes with a shard spread under 60 s (FR-CI-4, FR-CI-5, D-1223): its wall time and spread written here and in D-1223.
- [ ] The release commit is the squash merge of the phase's pull request, its SHA written here.
- [ ] Tag it: `git tag -a v2.16.0 <sha> -m "v2.16.0: an answer first" && git push origin v2.16.0`.
- [ ] Deploy the same SHA: `git push origin <sha>:release` (D-739, `docs/DEPLOY.md`), and run `docs/RELEASE.md` §2 and §5 against the live site.
