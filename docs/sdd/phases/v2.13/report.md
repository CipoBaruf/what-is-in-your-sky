# v2.13 phase report (FR-SDD-1, FR-SDD-2, FR-SDD-28)

Source: `sdd-run/usage.jsonl` in the driver's checkout, 15 lines, read on 2026-11-04 (D-1058). A "token" is `entryTokens` in `scripts/sdd/ledger.ts`: input + cached input + cache writes + output, the count the ceiling is checked against. Cache reads dominate it (about 98 %); output alone is 636 k.

**What the ledger does not hold.** Only the driver's own sessions. R172 predates the ledger (it built it), R181 is the session writing this, and the reviews run by hand and the subagents that fixed findings are not in it. These totals are a floor.

## Total and per task

Phase total: **90 257 433 tokens** over 15 sessions and 147.5 minutes of wall time; output 636 347.

| Task | Sessions | Tokens | Output | Turns | Wall (min) | Tokens per turn |
|---|---|---|---|---|---|---|
| R173 | 1 | 2.79 M | 28.9 k | 60 | 4.9 | 0.05 M |
| R174 | 2 | 7.49 M | 78.3 k | 102 | 17.9 | 0.07 M |
| R175 | 3 | 18.95 M | 177.7 k | 183 | 37.3 | 0.10 M |
| R176 | 2 | 9.46 M | 52.8 k | 122 | 13.9 | 0.08 M |
| R177 | 2 | 13.38 M | 97.5 k | 112 | 17.7 | 0.12 M |
| R178 | 2 | 12.50 M | 66.8 k | 107 | 15.2 | 0.12 M |
| R179 | 2 | 20.56 M | 103.0 k | 166 | 32.1 | 0.12 M |
| R180 | 1 | 5.13 M | 31.3 k | 96 | 8.5 | 0.05 M |

**Most expensive task: R179**, 20.56 M tokens (one implementation session of 18.66 M cached reads over 145 turns, plus its review). R175 is next at 18.95 M; its first session (fable, 2.39 M) ended on a usage limit at turn 53 and the opus rerun spent 16.5 M. The most expensive single session is R179's implementation, 18.97 M.

Reviews: 6 sessions, 2.53 M tokens in all, 1.2 % to 8 % of their task's cost.

## Baseline against the post-split tasks

The baseline is the tasks before the split merged (R173, R174, R175; the split is R175, `c32145af`); R172 is not in the ledger. The post-split tasks are R176–R180.

| | Tasks | Tokens | Mean per task | Tokens per turn |
|---|---|---|---|---|
| Before the split | 3 | 29.23 M | 9.74 M | 0.08 M |
| After the split | 5 | 61.03 M | 12.21 M | 0.10 M |

The post-split mean is 25 % higher, not lower. The sample does not say the split failed to cut reading: the five later tasks are larger (R177 rewrote the driver's session layer, R179 wired `check:sdd` into CI) and ran on opus and sonnet where the baseline's R173 was a small docs task; tokens per turn rose from 0.08 M to 0.10 M because a longer session re-reads a longer context each turn. With three and five tasks of unequal size there is no like-for-like pair. The honest reading is: no measured saving yet. A fair comparison needs the same kind of task run before and after, which is the next phase's measurement.

## Ceilings (FR-SDD-2, V213-7)

`TIER_BUDGET_FACTOR` = 2 × the nearest-rank 90th percentile (`percentile90`) of every ledger session of the tier, implementation and review alike, mapped by model (sonnet = light, opus = standard, fable = hard).

| Tier | Sessions | p90 | Ceiling set |
|---|---|---|---|
| light | 2 | 5 131 301 | **10 262 602** |
| standard | 12 | 16 358 291 | **32 716 582** |
| hard | 1 | 2 388 811 | **not set** |

`hard` has one session, and it ended on a usage limit at turn 53, so 2 × its value (4.78 M) would stop a normal fable task partway; the driver itself needs `MIN_BUDGET_SAMPLES` = 5 before it calls an overrun. It stays unset, which records overruns and stops nothing. `light` has two sessions, below the same bar; its ceiling is set because the rule says so and 10.3 M is twice its largest session, but it is the thinnest number here. Re-set both from the next phase's ledger.

## Findings, flakes and CI reruns

Not derivable from inside a headless session: the findings are in the review handoffs and the PR bodies, the flakes are F-ids marked quarantined, and the reruns are `gh run list` attempts per PR, and `gh` is denied here (D-1058). The ledger gives only the sessions: 6 review sessions, all `ok`, on R174, R175, R176, R177, R178 and R179 (R173 and R180 have no review line in it). The owner fills the three numbers from `gh pr view` and `gh run list` for #270–#282 before the release notes are cut.

## The app does not change (FR-SDD-28)

- `git diff --stat fda34853..HEAD -- src public` (the last app commit before the phase to this branch's start) prints nothing: no path under `src/` or `public/`.
- `package.json` is unchanged from 2.12.0 by this task; no tag and no deploy (V213-1).
- The `dist/` asset-name comparison against the base was not run in this session: it needs a second install and build of the base, and the session cannot add a worktree. With no change under `src/`, `public/` or `package.json`'s dependencies, only a tooling change in `vite.config.ts` could move a name; run `npm run build` on `fda34853` and on the release commit and diff `ls dist/assets`.

## The owner's memory trim

The memory index at `~/.claude/projects/-Volumes-Data-Projects-what-is-in-your-sky-right-now/memory/MEMORY.md` has about 60 lines of one-line entries for finished phases. Trim it to the entries a future session still needs (the gotchas that moved to `docs/sdd/gotchas.md` first): no-commit-trailers, npm cache, parallel checkouts, the driver recipe, the Cloudflare release branch, and the open owner items. That is the owner's to do; this task does not touch it.
