## v2.14.2 tasks

Cut 2026-11-05 from the phase folder `docs/sdd/phases/v2.14.2/` (`spec.md` Phase 2w.2; `plan.md` §2.52, §16.35).
Spec Phase 2w.2, "ask before following": on a phone the live page, the stars page and the pass detail ask `Use your phone to look at the sky?` before they follow (V214-39..V214-44).
Delivery is PLAN §16.35: one task, built interactively on `v2-14-2-follow-ask` with the docs, merged by hand on CI green and a clean review.
Decision block (§16.2): D-1142..D-1144 are the plan's; R192 spends none of its own.

- [x] **R192 — A phone page asks before it follows the phone**
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
