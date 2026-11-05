## 27. v2.14.1 (spec §Phase 2w.1)

Everything in `docs/RELEASE.md` and §26 still applies.
v2.14.1 is the owner's desk review of 2.14.0 (V214-25..V214-38), built on one branch and read by the owner locally before it was pushed.
2.14.0 was never tagged (V214-32): this is the release of v2.14 and v2.14.1 together.

### 27.1 What changed

- The pass page: `[ ← ]` back to where the reader came from, `[ satellites ]` in the header, tonight's passes as one-line rows under the head opening in place, a rail inside the page's width, the whole path drawn, faced and paused at the rise (FR-WIDE-1, FR-CLEAN-14, FR-WIDE-3 as amended).
- The stars page: no overview bar and no satellite marks; the clock, the steps and the live page's playback row (FR-WIDE-4 as amended).
- The globe by day and in twilight draws the stars to magnitude 3.5 and their figures, faint (FR-STAR-13 as amended).
- The live page asks to go to the first pass and play when nothing is up (FR-WIDE-13).
- A focused field draws one line, its border (FR-WIDE-14).

### 27.2 The checks

- `npm test` on the branch: every unit test but `SkyWindow.test.tsx`'s "swept through and back", which times out under the full suite's load on `main` too and passes alone; the full e2e suite 719 passed, `r77-captures.spec.ts` failing once on `clock.pauseAt` under load and passing 4 of 4 alone.
- `npm run bundle:budget`: `main` 193.3 KB against 2.14.0's 192.0, within the phase's 2 KB; the 185 KB ceiling stays the owner's call (§26.4).
- The capture set was not re-shot for this release; the pass, stars and live pages' wide captures move by the changes above.

### 27.3 The release itself — `v2.14.1`

- [x] `package.json` is `2.14.1` on `main`.
- [ ] Tag the squash merge of this release's pull request: `git tag -a v2.14.1 <sha> -m "v2.14.1: one sky on a desk, reviewed" && git push origin v2.14.1`.
- [ ] Deploy it: `git push origin <sha>:release` (D-739; `docs/DEPLOY.md`), and run `docs/RELEASE.md` §2 and §5 against `https://inyoursky.app`.
