## 29. v2.15 (spec §Phase 2x)

Everything in `docs/RELEASE.md` and §28 still applies.
v2.15 is "where they stop" (V215-1..V215-7): the site counts where a first visit stops, and the privacy note is gone.
It is the first release with a Worker script, so §29.4's preview checks come before the tag.

### 29.1 What changed

- The app sends anonymous counts to `/e` on its own origin: an event name, first or return visit, layout, language and a random id made per page load (FR-MEAS-1..3). Never a location, a place name or typed text; nothing is stored on the device (FR-MEAS-5).
- `edge/index.ts` receives `POST /e` and writes a kept event to the Analytics Engine dataset `inyoursky_events`; every other path is served by the assets as before (FR-MEAS-4).
- `npm run funnel` prints the last `FUNNEL_DAYS` days: the opens, the first run step by step, the refusals and failures (FR-MEAS-6).
- The privacy sentence is removed from the home, the footer and the settings page in both languages; the README and `docs/DEPLOY.md` say what is counted (FR-MEAS-7, FR-X-3 as amended).
- Events are sent only from the public address, so previews and local builds count nothing.

### 29.2 The checks

- On the merged branch: typecheck, `npx knip`, `npm run check:dead` and `npm run check:sdd` clean; the unit suite green.
- `measure.spec.ts` 7 of 7 (the first-run walk at 390 × 844 and the wide open to a pass, both languages; the leak and storage check at both widths; offline). With `keep.spec.ts`, `home.spec.ts` and `deploy-headers.spec.ts`, 27 of 27.
- The full e2e suite was not run to the end in the build sandbox: about 60 sky-page specs time out there on unchanged code. CI's run on the pull request is the one that counts.
- The measurement module is 896 B gzipped (limit 1 KB, D-1151). The main chunk is 194.8 KB gzipped, 0.4 KB over the branch before the screen counts; it was already over the 185 KB budget line, and the budgets are not re-set in this record.
- The capture set was not re-shot. Every page's footer loses the privacy sentence and the phone's where step loses the line under the coordinates, so those captures move (FR-MEAS-7).

### 29.3 What the owner decides

- [ ] `sky_screen_open` has no call: the sky screen was retired in v2.9 (FR-GYRO-6). Remove the row from FR-MEAS-2's table and from `EVENTS`, or point it at another moment.
- [ ] `[ Use my location ]` still reads "nothing is sent anywhere"; a `place_set` count with `device` is now sent, never the location. Reword or leave.
- [ ] `FOOTER_ONE_LINE_MIN_PX` stays 1176 / 1195 although the row now fits from about 1010 px (D-1159). Lower or leave.
- [ ] The captures that move, reviewed (`captures.yml` against 2.14.3).

### 29.4 The first preview deploy, before the tag

`docs/DEPLOY.md`, *First preview deploy*, has the commands. None of these could be checked while building.

- [x] The deploy accepts `run_worker_first: ["/e"]`, the `EVENTS` binding and the TypeScript `main`.
- [x] An unknown path still answers the 404 page.
- [x] `POST /e` answers `204` and `GET /e` answers `405`.

### 29.5 The release itself — `v2.15.0`

- [x] `package.json` is `2.15.0`.
- [ ] §29.3 decided and §29.4 checked.
- [ ] Tag the squash merge of this release's pull request: `git tag -a v2.15.0 <sha> -m "v2.15.0: where they stop" && git push origin v2.15.0`.
- [ ] Deploy it: `git push origin <sha>:release` (D-739; `docs/DEPLOY.md`).
- [ ] Make the API token (`docs/DEPLOY.md`, *Reading the funnel*) and run `npm run funnel` after the first day: it prints rows. The query and the answer's shape were not checked against the real API; `parseRows` in `scripts/funnel.ts` is where to fix a difference.
