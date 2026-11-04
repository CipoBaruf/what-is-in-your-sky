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

The post-split mean is 25 % higher, not lower.
The sample does not say the split failed to cut reading: the five later tasks are larger (R177 rewrote the driver's session layer, R179 wired `check:sdd` into CI) and ran on opus and sonnet where the baseline's R173 was a small docs task; tokens per turn rose from 0.08 M to 0.10 M because a longer session re-reads a longer context each turn.
With three and five tasks of unequal size there is no like-for-like pair.
The honest reading is: no measured saving yet.
A fair comparison needs the same kind of task run before and after, which is the next phase's measurement.

## Ceilings (FR-SDD-2, V213-7)

`TIER_BUDGET_FACTOR` = 2 × the nearest-rank 90th percentile (`percentile90`) of every ledger session of the tier, implementation and review alike, mapped by model (sonnet = light, opus = standard, fable = hard).

| Tier | Sessions | p90 | Ceiling set |
|---|---|---|---|
| light | 2 | 5 131 301 | unset (2 sessions) |
| standard | 12 | 16 358 291 | **32 716 582** |
| hard | 1 | 2 388 811 | **not set** |

`hard` has one session, and it ended on a usage limit at turn 53, so 2 × its value (4.78 M) would stop a normal fable task partway; the driver itself needs `MIN_BUDGET_SAMPLES` = 5 before it calls an overrun.
It stays unset, which records overruns and stops nothing.
`light` has two sessions, below the same bar, so it stays unset like `hard` (review of #283); the next phase's release sets both once each has five.
Re-set both from the next phase's ledger.

## Findings, flakes and CI reruns

Filled in by the owner's session from `gh` (a task session cannot run it).

| Task | PR | Review findings | CI runs | Failed runs | Reruns | What failed first |
|---|---|---|---|---|---|---|
| R172 | #270 | 10 | 3 | 1 | 0 | knip: an unused export |
| R173 | #271 | 10 | 5 | 3 | 0 | knip (`rg` binary); `rg` missing on the runner |
| R174 | #272 | 10 | 3 | 1 | 0 | its own CI tests after the review fixes; stale `map.md` |
| R175 | #273 | 9 | 2 | 0 | 0 | — |
| R176 | #275 | 10 | 2 | 0 | 0 | — |
| R177 | #277 | 10 | 2 | 0 | 0 | — |
| R178 | #276 | 10 | 3 | 0 | 0 | — |
| R179 | #280 | 0 | 2 | 0 | 0 | — |
| R180 | #279 | 0 | 2 | 1 | 0 | knip: an unused export |

- **Findings:** 69 over nine reviewed tasks; every task before R179 had 9–10. Fixed by subagents, one rejected with a reason (R174's 4).
- **Flakes:** none quarantined; no F-id opened.
- **CI reruns:** none. 6 of 24 runs failed, on four PRs; three of the six were `knip` alone, which `implement.md` now runs before a push (R176).
- **Not in the ledger:** the reviews run by hand (R172, R173, R180) and the subagents that fixed findings. The ledger counts the driver's own sessions only.

## The app does not change (FR-SDD-28)

- `git diff --stat fda34853..HEAD -- src public` (the last app commit before the phase to this branch's start) prints nothing: no path under `src/` or `public/`.
- `package.json` is unchanged from 2.12.0 by this task; no tag and no deploy (V213-1).
- `dist/`: the base `fda34853` and this branch, built with the same `node_modules` (`package-lock.json` unchanged), give the same 52 file names, hashed assets included (run by the owner's session).

## The owner's memory trim

The memory index at `~/.claude/projects/-Volumes-Data-Projects-what-is-in-your-sky-right-now/memory/MEMORY.md` has about 60 lines of one-line entries for finished phases.
Trim it to the entries a future session still needs (the gotchas that moved to `docs/sdd/gotchas.md` first): no-commit-trailers, npm cache, parallel checkouts, the driver recipe, the Cloudflare release branch, and the open owner items.
That is the owner's to do; this task does not touch it.
