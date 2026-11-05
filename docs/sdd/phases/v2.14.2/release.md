## 28. v2.14.2 (spec §Phase 2w.2)

Everything in `docs/RELEASE.md` and §27 still applies.
v2.14.2 is one change asked by the owner on 2026-11-05 (V214-39..V214-44): a phone page asks before it follows the phone.

### 28.1 What changed

- On a phone the live page, the stars page and the pass detail ask `Use your phone to look at the sky?` / `¿Usar el teléfono para mirar el cielo?` once per visit; `[ allow ]` asks the browser and follows, `[ not now ]` and `Esc` leave the page as it opened (FR-PHONE-17).
- Android asks too: it follows at load only once an allow is saved (FR-PHONE-1 as amended); iOS asks in the dialog's tap, not the first touch on the sky (FR-PHONE-2 as amended).
- The live page's opening card waits until the question is answered (V214-43).
- Wide is unchanged.

### 28.2 The checks

- `npm run check` and `npm test` on the branch; `follow-ask.spec.ts` 18 of 18, `follow.spec.ts` and `live-dialog.spec.ts` 65 of 65, `live-full.spec.ts` and `whole-sky.spec.ts` 34 of 34 with the question answered for the visit.
- The capture set was not re-shot; no capture spec opens a phone page with the sensor, so none should move.

### 28.3 The release itself — `v2.14.2`

- [x] `package.json` is `2.14.2`.
- [x] Tag the squash merge of this release's pull request (`c1c89c2a`): `git tag -a v2.14.2 <sha> -m "v2.14.2: ask before following" && git push origin v2.14.2`.
- [x] Deploy it: `git push origin <sha>:release` (D-739; `docs/DEPLOY.md`), live 2026-11-05.
- [ ] On an iPhone and an Android phone open `#live`, `#stars` and a pass: the question once per visit, both answers.

### 28.4 v2.14.3

The follow question ran off the right edge on phones under about 430 px (#300): `AskDialog`'s column took the sentence's width.
It is now one column at the viewport's width with the sentence wrapping, checked centred at eight phone sizes in both languages (`follow-ask.spec.ts`).

- [x] `package.json` is `2.14.3`.
- [x] Tag the squash merge `v2.14.3` (`cd6ccb82`) and fast-forward `release` to it.
- [x] Deployed 2026-11-05 with `npx wrangler deploy` from `cd6ccb82`: the `release` build sat queued through Cloudflare's "Workers Builds Issues" incident (`docs/DEPLOY.md`'s command, run by hand).
