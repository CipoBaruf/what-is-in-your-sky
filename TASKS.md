# What Is In Your Sky Right Now — Task Breakdown

## Status

This file holds the open phase, v2.15; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).
Each phase's header rows (status, inputs, scope) are in [`docs/sdd/reference/breakdown-inputs.md`](docs/sdd/reference/breakdown-inputs.md).

| Phase | First … last task | Merged | File |
|---|---|---|---|
| mvp | R1 … H | 16 of 16 | [tasks.md](docs/sdd/phases/mvp/tasks.md) |
| v1 | R16 … R36 | 21 of 21 | [tasks.md](docs/sdd/phases/v1/tasks.md) |
| v1.1 | R37 … R55 | 19 of 19 | [tasks.md](docs/sdd/phases/v1.1/tasks.md) |
| v1.2 | R56 … R60 | 6 of 6 | [tasks.md](docs/sdd/phases/v1.2/tasks.md) |
| v1.3 | R62 … R65 | 5 of 5 | [tasks.md](docs/sdd/phases/v1.3/tasks.md) |
| v1.3.2 | P1 … P2 | 2 of 2 | [tasks.md](docs/sdd/phases/v1.3.2/tasks.md) |
| v1.4 | R67 … R72 | 7 of 7 | [tasks.md](docs/sdd/phases/v1.4/tasks.md) |
| v2.0 | R74 … R80 | 9 of 9 | [tasks.md](docs/sdd/phases/v2.0/tasks.md) |
| v2.1 | R83 … R100 | 19 of 19 | [tasks.md](docs/sdd/phases/v2.1/tasks.md) |
| v2.2 | P6 … P5 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.2/tasks.md) |
| v2.2.1 | P7 … P9 | 3 of 3 | [tasks.md](docs/sdd/phases/v2.2.1/tasks.md) |
| v2.3 | R103 … R110 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.3/tasks.md) |
| v2.4 | R111 … R118 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.4/tasks.md) |
| v2.5 | R119 … R128 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.5/tasks.md) |
| v2.6 | R129 … R135 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.6/tasks.md) |
| v2.6.1 | R137 … R140 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.6.1/tasks.md) |
| v2.7 | R141 … R145 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.7/tasks.md) |
| v2.8 | R146 … R149 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.8/tasks.md) |
| v2.9 | R150 … R153 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.9/tasks.md) |
| v2.10 | R154 … R161 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.10/tasks.md) |
| v2.11 | R162 … R165 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.11/tasks.md) |
| v2.12 | R167 … R171 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.12/tasks.md) |
| v2.13 | R172 … R181 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.13/tasks.md) |
| v2.14 | R182 … R191 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.14/tasks.md) |
| v2.14.2 | R192 | 1 of 1 | [tasks.md](docs/sdd/phases/v2.14.2/tasks.md) |
| v2.15 | R193 … R197 | 4 of 5 | this file |

## v2.15 tasks

Cut 2026-11-18 from the phase folder `docs/sdd/phases/v2.15/` (`spec.md` §2.22, §4.58, Phase 2x; `plan.md` §2.53, §9.17, §11.9, §16.36).
Spec Phase 2x, "where they stop": the site counts where first visits stop on a route of its own, a command prints the funnel, and the privacy note goes (V215-1..V215-7).
Delivery is PLAN §16.36: five tasks in three waves, each built by a sub-agent in its own worktree and merged into the phase branch on green checks.
Decision blocks (§16.2): R193 D-1152..D-1156, R194 D-1157..D-1159, R195 D-1160..D-1164, R196 D-1165..D-1169, R197 D-1170..D-1172.

- [x] **R193 — A visit's facts are counted and sent**
  - **Lane:** data
  - **Model:** opus
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-MEAS-1, FR-MEAS-2, FR-MEAS-3, FR-MEAS-5; D-1145, D-1146, D-1147, D-1151; FR-FIRST-4, FR-ADDR-2
  - **Goal:** with `__WIYS_MEASURE__` set, loading the app and setting a place posts `open`-ready context and `place_set` to `/e` as FR-MEAS-1's six fields; an empty night and a stored failure post theirs; off the public address nothing is sent.
  - **Satisfies:** FR-MEAS-1; FR-MEAS-3; the state rows of FR-MEAS-2 (`place_set`, `no_passes`, `failure`); FR-MEAS-5's "no free text" half
  - **Scope:** `src/model/measure.ts` (D-1145); `src/data/measure.ts` (D-1146); `src/state/measure.ts`, `src/state/measureEffects.ts` and their start in `startApp` (D-1146, D-1147), the `favourite` and `link` details passed by their actions; `tests/build/measure-size.test.ts` (D-1151); the unit tests of §9.17's "Pure" and "State" lines.
  - **Touches outside the lane:** `src/model/measure.ts`
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** any `src/ui` call (R196); the route (R195).
  - **Done when:** `npm run check` green; `measure.test.ts` in `model/`, `data/` and `measureEffects.test.ts` cover FR-MEAS-1's and FR-MEAS-3's verification lines; the size test holds 1 KB.

- [x] **R194 — The privacy note is gone from every page**
  - **Lane:** ui
  - **Model:** sonnet
  - **Gate:** owner
  - **Depends on:** —
  - **Reads:** FR-MEAS-7, FR-KEEP-4; D-1150
  - **Goal:** the home, the footer and the settings page show no privacy sentence and no `[ × ]` for one, in both languages.
  - **Satisfies:** FR-MEAS-7's app half; US-59 AC4's app half
  - **Scope:** `Footer`, `LocationInput`, the settings page; the four catalog keys in `i18n/{en,es}`; `usePrivacyNote`, the prefs slice's setter, `privacyNoteClosed` in `localPrefs` and `model/prefs` (D-1150).
  - **Touches outside the lane:** `src/state/store.ts`, `src/state/slices/prefs.ts`, `src/data/localPrefs.ts`, `src/model/prefs.ts` (deletions only)
  - **Deletes:** the privacy-note cases of `Footer.test.tsx`, `LocationInput.test.tsx`, `localPrefs.test.ts` and `keep.spec.ts`; rewritten to assert absence.
  - **Captures:** none added; every page's footer and the where step move (a named move, re-shot on `main`).
  - **Out of scope:** the README and `docs/DEPLOY.md` (R197); `wrangler.jsonc`'s comment (R195).
  - **Done when:** `npm run check` green; the three component tests and `keep.spec.ts` assert no privacy text in either language; `messages.test.ts`'s snapshot has lost the four keys; `controlRows.test.ts` green.

- [x] **R195 — The site receives a count at `/e`**
  - **Lane:** docs
  - **Model:** opus
  - **Gate:** auto
  - **Depends on:** R193
  - **Reads:** FR-MEAS-4, FR-X-3; D-1148, D-1145; PLAN §11.9
  - **Goal:** `POST /e` with a valid event writes one data point and answers `204`; anything else writes nothing; every other path is served as before.
  - **Satisfies:** FR-MEAS-4; FR-X-3 as amended
  - **Scope:** `edge/collect.ts`, `edge/index.ts`, their `tsconfig` entry and lint coverage (D-1148); `wrangler.jsonc` (`main`, the two bindings, `run_worker_first`, the corrected comment); `tests/deploy/endpoint.test.ts`; `tests/deploy/wrangler.test.ts`.
  - **Touches outside the lane:** `tsconfig*.json`, `eslint.config.js` (the `edge/` entry only)
  - **Deletes:** `wrangler.test.ts`'s assertion that there is no Worker script, rewritten for the script and the bindings.
  - **Captures:** none
  - **Out of scope:** the funnel and the documents (R197); a deploy (the owner's).
  - **Done when:** `npm run check` green; `endpoint.test.ts` covers FR-MEAS-4's verification line; `headers.test.ts` unchanged and green.

- [ ] **R196 — Every screen counts its moment**
  - **Lane:** ui
  - **Model:** opus
  - **Gate:** auto
  - **Depends on:** R193, R194
  - **Reads:** FR-MEAS-2, FR-MEAS-3, FR-MEAS-5; D-1146, D-1147; FR-FIRST-4, FR-PHONE-17, FR-FAIL-1
  - **Goal:** walking the first run from an empty store sends `open`, `where_shown`, `place_set`, `when_shown`, `what_shown` and `door` once each, in order, with one id; nothing typed leaves the browser.
  - **Satisfies:** FR-MEAS-2's screen rows; FR-MEAS-5; US-58 AC3; US-59 AC1..AC3
  - **Scope:** the `count` calls of D-1147's `src/ui` list (`main.tsx`, `Home`, `HomeDoors`, `App.tsx`, the sky screen, `useFollow`, `UseMyLocation`, `PlacePicker`); their component tests; `tests/e2e/measure.spec.ts` (§9.17).
  - **Touches outside the lane:** none
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** new names or details (the table is FR-MEAS-2's); the route.
  - **Done when:** `npm run check` and `npm test` green; `measure.spec.ts` passes at 390 × 844 and 1280 × 800 in both languages with the leak, storage and offline checks; `npm run bundle:budget` main row within 1 KB of 2.14.3's.

- [x] **R197 — The funnel prints, the documents say what is counted, 2.15.0**
  - **Lane:** docs
  - **Model:** sonnet
  - **Gate:** auto
  - **Depends on:** R195
  - **Reads:** FR-MEAS-6, FR-MEAS-7, FR-X-3; D-1149, D-1148; PLAN §11.9
  - **Goal:** `npm run funnel` prints the last 14 days' funnel from the store; the README and `docs/DEPLOY.md` state what is counted and how the token is made.
  - **Satisfies:** FR-MEAS-6; FR-MEAS-7's document half; US-58 AC1, AC2; US-59 AC4's README half
  - **Scope:** `scripts/funnel.ts` and `scripts/funnel.test.ts` (D-1149); `package.json` (`funnel`, version 2.15.0); README's and `docs/DEPLOY.md`'s FR-X-3 lines and the token step; `docs/sdd/map.md` regenerated; the traceability rows.
  - **Touches outside the lane:** `package.json`
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** the tag and the deploy (the owner's); the release record.
  - **Done when:** `npm run check` and `npm test` green; `funnel.test.ts` covers FR-MEAS-6's verification line; no document says "no analytics".

Waves: **wave 1** R193, R194; **wave 2** R195, R196; **wave 3** R197.
