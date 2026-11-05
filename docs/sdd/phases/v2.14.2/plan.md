# v2.14.2 — PLAN.md sections

Phase file of PLAN.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.52 v2.14.2 decisions (2026-11-05)

- **D-1142 — One ask dialog, two questions.**
  (FR-PHONE-17; V214-39, V214-44.) `FirstPassDialog`'s body moves to `components/sky/AskDialog.tsx` — the portal, the inert document, the capture-phase keys, `Esc` as the second answer, `useOpenerFocus` — taking `question`, `yes`, `no`, `onYes`, `onNo` and a `testId`; `FirstPassDialog` becomes a wrapper over it with its own words and test ids, so its tests and captures do not move.
  The follow question is `AskDialog` with `t.sheet.followAsk` (`question`, `allow`, `notNow`), in both catalogs.
- **D-1143 — `useFollow(compact)` owns the question.**
  (FR-PHONE-17, FR-PHONE-1 and FR-PHONE-2 as amended; V214-40..V214-42.) The hook takes the page's `compact`; `Follow` gains `asking: boolean`, `allow()` and `notNow()`.
  On compact with the sensor and no session answer: where a request exists, `asking` starts true and `armed` false; where none exists and `followGranted` is unset, the first reading with a north sets `asking` instead of `on`; with `followGranted` set and no request, the page follows as before.
  `allow` is `turnOn` plus closing; `notNow` closes and asks nothing; both write `FOLLOW_ASKED_KEY` (`wiys:followAsked:v1`) to `sessionStorage` through a guarded accessor (a throw reads as unasked).
  A grant now saves `followGranted` on every platform, so Android's allow carries to the next visit; wide keeps every rule it had.
- **D-1144 — The pages render the question; the card waits.**
  (FR-PHONE-17; V214-43.) `Live.tsx`, `Stars.tsx` and `PassDetail.tsx` call `useFollow(compact)` and render `{follow.asking && <AskDialog …/>}`; `Live.tsx` renders FR-FULL-10's card only while `!follow.asking`, so the card's decision is unchanged and it appears when the question is answered.
  While asking, `firstTouch` is `undefined` and no page key reaches the page (the dialog's capture).

### 16.35 v2.14.2 delivery

One task, R192, on the branch `v2-14-2-follow-ask` with the docs, built interactively (tier: the session's model), one pull request with the spec, the plan, the task and the code.
CI green and a fresh-context review of the diff are the gate; the PR is merged by hand with `--match-head-commit` (auto-merge is off).
Budget: the main chunk grows by the hook's branch and the dialog's wrapper only, under 1 KB gzipped.
No dependency is added.
