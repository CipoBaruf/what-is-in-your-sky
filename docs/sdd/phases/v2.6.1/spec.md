# v2.6.1 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### Phase 2o — v2.6.1 ("the review fixes", as decided 2026-10-29, V26-15)

After v2.6 is on `main` (`6b0634f`, 2.6.0).
The review of the merged phase (R129–R136) found two behaviour bugs, two places where the spec's words had drifted from the shipped and designed screens, two test gaps, one doubled gap and the parts v2.6 left unused.
The fixes stay inside the handoff's boards: a change that would depart from them is a proposal for a later phase, not a task here (V26-15).
Every task merges on CI green and a clean review with no owner gate, as v2.6's did; no tag and no deploy in the phase.

- The window's opening facing once the passes arrive (FR-FLOW-14 as amended).
- The Stars door on a night with no dark band (FR-FLOW-1 as amended).
- The empty slot's gap, and the rhythm and target specs over the window (FR-FLOW-10, FR-FLOW-11 as amended).
- The capture specs' waits and the dead parts (FR-FLOW-16, FR-FLOW-17), with FR-FLOW-5's and FR-FLOW-13's dead strings and words; the version `2.6.1`.

Definition of done:
- FR-FLOW-1, FR-FLOW-10, FR-FLOW-11, FR-FLOW-14, FR-FLOW-16 and FR-FLOW-17 met, each by its verification line; FR-FLOW-5 and FR-FLOW-13 as amended need no code beyond FR-FLOW-17's removals.
- `rhythm.spec.ts` and `targets.spec.ts` green in both views and both languages, with no known exception.
- FR-CAP-5's diff against 2.6.0 lists only the files of the changed gap and the Stars door's line; `npm run bundle:budget` no row larger than 2.6.0's; `passes.golden.test.ts` and every golden fixture untouched.
- `package.json` reads 2.6.1.
  The tag and the deploy are the owner's.
