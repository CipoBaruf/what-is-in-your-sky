# What Is In Your Sky Right Now — Task Breakdown

## Status

This file holds the open phase, v2.14.2; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).
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
| v2.14.2 | R192 | 0 of 1 | this file |

## v2.14.2 tasks

Cut 2026-11-05 from the phase folder `docs/sdd/phases/v2.14.2/` (`spec.md` Phase 2w.2; `plan.md` §2.52, §16.35).
Spec Phase 2w.2, "ask before following": on a phone the live page, the stars page and the pass detail ask `Use your phone to look at the sky?` before they follow (V214-39..V214-44).
Delivery is PLAN §16.35: one task, built interactively on `v2-14-2-follow-ask` with the docs, merged by hand on CI green and a clean review.
Decision block (§16.2): D-1142..D-1144 are the plan's; R192 spends none of its own.

- [ ] **R192 — A phone page asks before it follows the phone**
  - **Lane:** ui
  - **Model:** interactive
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-PHONE-17, FR-PHONE-1, FR-PHONE-2, FR-WIN-4, FR-GYRO-3, FR-FULL-10, FR-WIDE-13; D-1142..D-1144, D-986, D-175
  - **Goal:** on a phone, opening `#live`, `#stars` or a pass detail asks once per visit whether to follow the phone; `[ allow ]` asks the browser and follows, `[ not now ]` leaves the page as it opened.
  - **Satisfies:** FR-PHONE-17; FR-PHONE-1, FR-PHONE-2, FR-WIN-4 as amended
  - **Scope:** `components/sky/AskDialog.tsx` (+ css) from `FirstPassDialog` (D-1142); `components/sky/useFollow.ts` (D-1143); the three screens' calls and the card's wait in `Live.tsx` (D-1144); `i18n/{en,es}/sheet.ts`; `package.json` 2.14.2.
  - **Touches outside the lane:** none
  - **Deletes:** the `useFollow` and page tests that assert compact following at mount with no request, or the first-touch arming on compact; rewritten for the question.
  - **Captures:** none
  - **Out of scope:** wide's follow rules; the toggle's and the overlay's controls.
  - **Done when:** `npm run check` and `npm test` green; `useFollow.test.tsx` and `follow-ask.spec.ts` cover FR-PHONE-17's verification line; `npm run bundle:budget` within 1 KB of v2.14.1's rows.

Waves: **wave 1** R192.
