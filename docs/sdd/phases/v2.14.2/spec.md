# v2.14.2 — SPEC.md sections

Phase file of SPEC.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### Phase 2w.2 — v2.14.2 ("ask before following", as decided 2026-11-05, V214-39)

After v2.14.1 is on `main` (`d72865ff`, tagged v2.14.1).
On a phone the sky follows the phone with no word on Android, and on iOS only after the reader finds the follow toggle; the owner wants a page that can follow to ask first.
The fixes are the owner's answers of 2026-11-05 (V214-39..V214-44); they amend FR-PHONE-1, FR-PHONE-2 and FR-WIN-4 on compact and add FR-PHONE-17.
One branch, one pull request, merged when CI and the review are green.

#### The question

- **FR-PHONE-17** *(V214-39, V214-40, V214-41, V214-42)* **Ask before following.**
  On compact, when the live page, the stars page or the pass detail opens where FR-WIN-4's presence test passes, a dialog asks `Use your phone to look at the sky?` with `[ allow ]` and `[ not now ]` (`¿Usar el teléfono para mirar el cielo?`, `[ permitir ]`, `[ ahora no ]`).
  It shows on every phone with the sensor, Android included (V214-40): where a motion request exists (iOS) at mount, and where none exists at the sensor's first reading with a north in it (D-986's test), so a touch laptop whose readings carry no north is never asked.
  `[ allow ]` runs `requestOrientationAccess()` inside its click (D-175); granted, the page follows from the next reading (FR-GYRO-2's view rule) and `followGranted` is saved on every platform; refused or throwing, the dialog closes, following stays off, `followGranted` is cleared and FR-GYRO-3's line stands under the toggle.
  `[ not now ]`, `Esc` and the dialog's close leave the page as it first rendered: following off, the view and the hand camera untouched, nothing asked.
  It is asked once per visit (V214-41): an answer of either kind is kept for the tab in session storage (`FOLLOW_ASKED_KEY`), so the other two pages and a reload in the same tab do not ask again, and a new tab or a later visit asks again.
  With `followGranted` saved and no request to make (Android after an allow), the page follows from the first reading as FR-PHONE-1 says and the dialog is not shown; with it saved where a request exists (iOS), the dialog is shown once per visit, since iOS grants only inside a tap and `[ allow ]` is that tap.
  It is a modal dialog (`role="dialog"`, `aria-modal`, `aria-labelledby` its question, focus on `[ allow ]`, focus returned on close), on `--screen-overlay` with a hairline edge and its buttons at least `--tap` tall, the same parts as FR-WIDE-13's dialog.
  It is not shown on wide, without the sensor, or while following is already on; FR-FULL-10's card waits until it is answered (V214-43).
  *Verification:* `useFollow.test.tsx` — with a request: shown at mount, `allow` asks exactly once inside the click and follows on a grant, a refusal clears the pref and sets `refused`, `not now` asks nothing and leaves `on` false.
  With no request: it is hidden until a reading with a north, then shown, and `allow` follows; with `followGranted` saved it is not shown and the page follows.
  The session key set by either answer hides it on the next mount.
  `follow-ask.spec.ts` at 390 × 844 in both languages with `stubOrientation`, with and without `requestPermission`: the dialog on `#live`, `#stars` and a pass detail, both answers, `Esc`, not shown on the next page or after a reload in the tab, not shown at 1280 × 800; axe on the open dialog.

#### Amended on compact

- **FR-PHONE-1** *(amended v2.14.2, V214-40; before: following on from the first reading wherever no request exists)*
  On compact the page follows by default only where `followGranted` is saved; otherwise the first reading with a north opens FR-PHONE-17's question and following waits for its `[ allow ]`.
  Wide is unchanged.
- **FR-PHONE-2** *(amended v2.14.2, V214-42; before: with a saved grant the first tap on the sky asks)*
  On compact FR-PHONE-17's `[ allow ]` is the visit's one request; the first tap on the sky asks nothing and the page is never armed.
  Wide keeps the first-tap rule.
- **FR-WIN-4** *(amended v2.14.2, V214-39; before: never on load)*
  On compact the permission is requested in FR-PHONE-17's `[ allow ]`, which a page shows at load; the prompt is still the reader's tap, never the page's.

#### Definition of done

- FR-PHONE-17 and FR-PHONE-1, FR-PHONE-2 and FR-WIN-4 as amended met, each by its verification line.
- `npm test` green; `npm run bundle:budget` no row over v2.14.1's by more than 1 KB without a named reason in the release record.
- `package.json` reads 2.14.2; the release record lists the captures that move.
- The tag and the deploy are the owner's.
