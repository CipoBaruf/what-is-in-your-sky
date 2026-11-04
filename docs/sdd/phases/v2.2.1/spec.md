# v2.2.1 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### Phase 2j — v2.2.1 ("the Bariloche night", as decided 2026-09-28, V22-16)

After the `v2.2.0` tag.
No product change: the app, its chunks, its tests of behaviour and its deploy are the `v2.2.0` build.
The subject is the material a reader is shown — the recordings for the owner's posts and the release captures the reading order points at — which move from a night with no weather to one with it (FR-SHOW-9).
Two `P` tasks, in the order the posts need them (V22-18):

- The recording run on the showcase night: the seeds, the stored run over the picked place, the forecast and geocoder stubs fulfilled from the new fixtures, `PROMO_FLOWS` walked there (FR-SHOW-6 as amended, FR-SHOW-9).
  `P7`, **first**, with a precondition that the two fixtures are on `main`.
  It re-shoots no capture.
- The release set re-shot on the same night, the hero and the social preview regenerated (FR-SHOW-10).
  `P8`, after `P7`, because it imports the seeds `P7` moves and must not carry a second copy of the night.
- *(V22-20)* The dome flows over London (FR-SHOW-6 and FR-SHOW-9 as amended).
  `P9`, beside `P8` (recordings only, no file of `P8`'s but `observers.ts`, where it adds and removes nothing of `P8`'s), in the owner's session.

Definition of done:
- US-36 AC5 and AC8 accepted; FR-SHOW-6 as amended, FR-SHOW-9 and FR-SHOW-10 met, with `tests/docs/promo.test.ts`, `tests/docs/captures.test.ts` and the seeds' test green.
- The app unchanged, measured as FR-SHOW-5 measures it: `npm run bundle:budget`'s table on `v2.2.0` and on the phase's last commit, no row larger; `passes.golden.test.ts` and every golden fixture untouched; `npm run e2e` green; `git diff --stat v2.2.0 -- src public` empty.
- The owner has run `npm run promo:record` after `P7` and opened every file it names: the place reads Bariloche, the clocks read local time, the cloud badges read the forecast and no file shows the staleness warning (FR-SHOW-9 (a)–(c)).
- The re-shot set at `P8`'s gate: the owner has looked at the home, live and sky-screen captures in both languages and both themes, and FR-CAP-5's two runs agree.
- Every session on the most capable model with a second model reviewing and no fallback, as V22-13 has it for the showcase (V22-19).
- No version bump and no tag (V22-19): `package.json` stays 2.2.0 and the deployed site is the `v2.2.0` build, as Phase 2e shipped no product and took none.
