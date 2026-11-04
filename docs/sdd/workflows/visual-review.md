# Visual review: capture, diff by pixels, look at what changed

Reads: the pixel-diff report, the side-by-side images past `CAPTURE_DIFF_SHARE`.
Never reads: unchanged captures, the phase files.

A task that changes the UI ends with captures a reviewer can compare with the spec and the approved designs.
A task's own captures (`r<n>-*.png`) are evidence in the PR; the release set (`v1-*.png`, named in `tests/e2e/captureSet.ts`) is also a test: `tests/docs/captures.test.ts` fails on a missing file or one the set does not name.

## Widths

| Name | Viewport | Why |
|---|---|---|
| phone | 390 × 844 | The reference phone (FR-COMP-6). |
| phone-landscape | 844 × 390 | The live page only (FR-LIVE-7). |
| desktop | 1280 × 800 | The wide layout (FR-DESK-1). |

Both themes (dark and night) when the task touches colour; both languages (en and es) when it touches text.

## Procedure

Until `scripts/captures/diff.ts` exists (R178): shoot with the capture spec, in steps 2 to 3, and compare each pair by eye, side by side, then file them as step 8 says.

1. Find the captures the diff reaches: `scripts/captures/manifest.json` maps each capture name to the source globs it draws, and `scripts/ci-affected.ts`'s matcher picks the entries the branch's changed files match (D-1068). A new screen gets its manifest entry in the same task.
2. Build and serve the production bundle so the strict CSP applies: `npm run build`, then `npx vite preview --port <port>` in the background, with `E2E_PORT` as the port when it is set (another task may be serving 4173).
3. Shoot only those captures: a Playwright spec under `tests/e2e/` reaches each state and writes `test-results/<task>-<screen>-<width>.png`; run it with `npx playwright test <spec> --project=chromium`. The full set is shot only at release preparation.
4. Shoot the same captures from the base (`origin/main`'s build; the recipe is in `docs/sdd/gotchas.md`, *captures*).
5. Compare each pair with `scripts/captures/diff.ts`: YIQ delta, per-pixel threshold 0.1. A capture counts as changed only past `CAPTURE_DIFF_SHARE` of its pixels; under it is anti-aliasing noise.
6. Look only at the changed ones, through the side-by-side image the diff script composes (base and branch at half size). Check them against the acceptance criteria and the design: aligned to the cell grid, no clipped label, no horizontal scroll, contrast, no English in the Spanish captures.
7. Re-encode the kept captures losslessly with `scripts/captures/compress.ts` (deflate level 9).
8. File them: the capture set lives on the orphan `captures` branch, which mirrors `docs/screenshots/`'s layout; `captures.yml` commits to it. Until that branch exists, copy them to `docs/screenshots/`. README, design and promo images stay on `main`.
9. List in the PR the changed captures with one line each on what to look at, and the count of unchanged ones; the PR's job summary shows the same side-by-side images.

## Names

`<task>-<screen>-<width>[-<variant>].png`, for example `r34-live-844-landscape-dark-es.png`.
