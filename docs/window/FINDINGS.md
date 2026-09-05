# Sky-window spike: findings (R38, FR-WIN-7)

The picks R47 (the window view) and R48 (the stripe's stepping) build on. The spike is `spike/window/`: one page for the window with every knob on the URL, one for the stripe with the three stepping candidates. `npm run spike:window` serves both over HTTPS on the LAN for the phone; `npm run spike:window:capture` writes the captures and `measurements.md` from Chromium. The owner ran the pages on an iPhone (iOS 18.7, Safari 26.6.1 and Chrome 152) on 2026-09-05, in a session with Fable (§16.6).

## The four picks (constants for R47 and R48)

| Pick | Value | Behind it |
|---|---|---|
| Projection | **stereographic** | OQ-16's starting point, kept. On the phone the bent horizon read as the sky in front, and the arc of the 64° pass kept its shape near the zenith where the gnomonic stretches (`window-*-high-peak-390.png`, the two side by side). |
| `WINDOW_FOV` | **60°** across the shorter side | The default the owner used throughout; at 60° the 30° and 60° altitude lines are both in view at a 30–45° tilt, and the window matched the sky behind the phone. |
| `WINDOW_SMOOTHING` | **0.6** | The default the owner used; the horizon did not shiver at rest and a quarter turn settled within a few frames. Applied to the rotation's axes, not the angles (`projection.ts` `smoothRotation`), so the picture is continuous across north and past the zenith. |
| Stripe stepping | **buttons** — `|◀ rise` `−10m` `−1m` `+1m` `+10m` `rise ▶|` | On the phone: `rise ▶|` landed the shown instant on a rise in **1 tap**, the page's readout reading "within 1 min of a rise · 1 tap · AC6 met" (US-22 AC6 asks for ≤ 3). Tap-to-jump depends on hitting a 1.6 px segment (a 6-minute pass on a 24 h stripe at 390 px) and two passes 15 min apart share the ±6 px slop; slow drag lands within a minute in one motion but is not a countable tap. OQ-18 is closed as it expected. |

## The sensor path (OQ-17, FR-WIN-3, FR-WIN-4), measured

From the page's `[ copy facts ]` text on the iPhone, three runs.

- **Event name:** `deviceorientation` only. No `deviceorientationabsolute`.
- **`absolute`:** `undefined`, not `false`. `compassHeading.ts`'s reading must treat a missing flag as "not absolute".
- **`webkitCompassHeading` arrives with usable `beta` and `gamma` in the same event.** Sample: `alpha 80.9 beta 99.9 gamma 4.7 webkitCompassHeading 4.7` — an upright phone facing north; `beta 121.5 … webkitCompassHeading 35.4` tilted back 30°, facing north-east. Yes to OQ-17's first question.
- **`alpha` is relative and drifts against the compass:** `alpha 80.9` with heading `4.7`, then `alpha 80.6` with heading `1.4`; in another run `alpha 3.7` with heading `331.6`. The heading must not be `360 − alpha` on iOS. D-175's assumption stands.
- **The compass field fails at the zenith.** With `heading=webkit` the picture reset when the phone pointed straight up: the field is the direction of the phone's *top* along the ground, which has no answer overhead. **The pick is `fused`:** the event's own `alpha`, which the platform keeps continuous through the zenith, offset by the compass; the offset is learned as a circular running mean while the phone is upright (`beta` 45–135°) and the compass accuracy is sane, `(360 − heading) − alpha`. On the phone the estimate settled at 31.2° from 1145 upright samples and the sweep over the head stayed continuous. `projection.ts` `alphaFor`, `calibrationSample`, `OffsetEstimate`.
- **The first event is not a reading:** `webkitCompassHeading 0.0 accuracy -1.0` before the compass settles. Accuracy `< 0` (and `> 30°`) is excluded from the calibration; a product strip should not print a heading from it. Settled accuracy was 12–17°.
- **Screen rotation:** in landscape (`screen.orientation` 90°, `landscape-primary`) the horizon stayed level with the correction **on** — the projected plane turned by `+angle` (`projection.ts` `projectDevice`, pinned by `tests/spike/window-projection.test.ts`). Neither `off` nor the opposite sign was needed.
- **Permission:** iOS grants it from the tap (`[ start sensors ]` → `granted`); the page must never ask on load (FR-WIN-4 stands).
- **Android Chrome:** not measured in this run; `compassHeading.ts`'s `deviceorientationabsolute` path is unchanged and the spike listens on both names, so a later run fills this line in.

## Update rate (FR-WIN-3, the D-62 method)

| Where | Events/s | Draws/s | Longest gap |
|---|---|---|---|
| iPhone, Safari 26.6.1 | 60 | 60 | 30–36 ms |
| iPhone, Chrome 152 (CriOS) | 10 | 8 → 60 after the change below | 1915 ms → — |
| Chromium, Pixel 5 profile, 1× | 58 | 59 | 21 ms |
| Chromium, Pixel 5 profile, 6× CPU throttle | 59–60 | 59–60 | 29 ms |

Safari delivers the sensor at 60/s and the SVG window redraws every reading: FR-WIN-3's ≥ 30/s is met with room, and the projection does not need to be cheaper than it is. **Chrome on iOS throttles the sensor to about 10 readings a second**, so the window now keeps drawing at the display rate, easing toward the latest reading until it has arrived (`main.tsx` `draw`); with that the picture is smooth at either sensor rate, and R47's hook should do the same rather than draw once per event. The desktop rows are `measurements.md`.

## Captures

- `window-{stereographic,gnomonic}-{high,golden}-horizon-390.png`: aimed at the pass's peak azimuth, 20° up; the horizon with its compass names and ticks in view.
- `window-{stereographic,gnomonic}-{high,golden}-peak-390.png`: aimed at the peak; the arc's sweep, the key at the peak, the live marker and the dotted part still ahead.
- `stripe-{buttons,tap,drag}-390.png`: the stripe page in each mode at rest.

## What R47 and R48 take from here

- R47: stereographic, `WINDOW_FOV = 60`, `WINDOW_SMOOTHING = 0.6` on the rotation's axes; the heading fused from `alpha` and a compass calibration taken while upright with accuracy in `[0, 30]`; `absolute` read as `event.absolute === true`; the screen angle applied as `+angle` to the projected plane; draw at the display rate, not per event; the first reading with accuracy `−1` ignored. The strip's declination line (R44) applies to the fused heading.
- R48: the six buttons above; `rise ▶|` / `|◀ rise` jump to the next and previous rise, `±1m` and `±10m` step; a tap on the band still names an instant (FR-LIVE-4).

## How the phone run went

`npm run spike:window` → `https://<LAN address>:5173/spike/window/`, the self-signed certificate accepted once, `[ start sensors ]`, the horizon and compass names checked against the sky, landscape checked, the sweep over the head checked before and after the fused heading, `[ copy facts ]` pasted; then the stripe page, `[ reset taps ]`, `rise ▶|`.
