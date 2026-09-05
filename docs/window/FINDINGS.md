# Sky-window spike: findings (R38, FR-WIN-7)

The picks R47 (the window view) and R48 (the stripe's stepping) build on. The spike is `spike/window/`: one page for the window with every knob on the URL, one for the stripe with the three stepping candidates. `npm run spike:window` serves both over HTTPS on the LAN for the phone; `npm run spike:window:capture` writes the captures and `measurements.md` from Chromium.

**Status: measured on the desktop; the phone run is pending.** The four picks below carry their desktop reasoning and a `phone:` line to fill in. The OQ-17 facts can only come from the device.

## The four picks

### 1. Projection: stereographic *(provisional)*

- Desktop: `window-stereographic-high-peak-390.png` against `window-gnomonic-high-peak-390.png`. At the peak of the 64° pass the gnomonic arc is straighter and the 60° ring is a wider curve; the stereographic keeps the arc's bend and the ring's shape at the same scale. Aimed at the horizon (`*-horizon-390.png`) the two are close at 60°: the horizon bows by a few pixels under stereographic and is straight under gnomonic.
- OQ-16 said start from stereographic at 60°. Nothing on the desktop argues against it; the phone decides whether the bent horizon reads as "what is in front of me".
- phone: _pending_

### 2. Field of view: `WINDOW_FOV = 60` *(provisional)*

- Desktop: at 60° the 30° and 60° altitude lines are both in view when the phone is held at 30–45°, and the arc of the high pass fills the frame; at 90° the arcs shrink to a third of the frame's height and the compass names crowd; at 45° the horizon leaves the frame at a 25° tilt.
- phone: _pending_ (the slider on the page; the pick is the width at which the pass in view matches the sky in view)

### 3. Smoothing: `WINDOW_SMOOTHING = 0.6` *(provisional)*

- Applied to the rotation's axes, not to the angles, so the picture stays continuous past the zenith and across north (`projection.ts` `smoothRotation`). 0 is the raw sensor; 0.9 lags a quarter turn by about half a second.
- phone: _pending_ (the slider; the pick is the lowest value at which the horizon does not shiver when the phone is still)

### 4. Stripe stepping: buttons *(provisional; OQ-18 said buttons if nothing else wins)*

- The three candidates are on `stripe.html?step=buttons|tap|drag`; the readout counts taps and shows the distance to the nearest rise, so US-22 AC6 (within 1 min of a rise in ≤ 3 taps) is read off the page.
- Desktop reasoning: `rise ▶|` is one tap to the exact rise; `tap` is one tap when the segment is wide enough to hit (a 6-minute pass on a 24 h stripe at 390 px is 1.6 px wide, so the hit area is the ±6 px slop, and two passes 15 min apart share it); `drag` needs a steady hand to hold the slow gear and lands within a minute in one motion, but not in a countable number of taps.
- phone: _pending_ (taps to a rise for each candidate, from the readout)

## Screen-angle correction (FR-WIN-3)

- The projection applies `screen.orientation.angle` to the projected plane with the sign that makes a phone turned counter-clockwise into landscape (angle 90) keep east on the viewer's right (`tests/spike/window-projection.test.ts`). `correction=neg` on the page tries the other sign; `off` none.
- phone: _pending_ (turn the phone to landscape with the sensors on: with the right setting the horizon stays level)

## OQ-17: the iOS sensor path

Filled in from the page's `[ copy facts ]` text on the device.

- Event name(s) fired: _pending_
- `webkitCompassHeading` present, with `beta`/`gamma` usable in the same event: _pending_
- `absolute` flag on iOS: _pending_
- The heading source that keeps the horizon put when tilting (`heading=webkit` vs `alpha`): _pending_
- Android Chrome: `deviceorientationabsolute` present, `alpha` absolute: _pending_
- Permission flow: iOS needs the tap (`[ start sensors ]`); Android and desktop do not: _pending_

## Update rate (FR-WIN-3, the D-62 method)

From `measurements.md` (Chromium, Pixel 5 profile, synthetic readings at 60/s, three companion passes drawn):

| Projection | CPU throttle | Events/s | Draws/s | Longest gap |
|---|---|---|---|---|
| stereographic | 1× | 58 | 59 | 21 ms |
| stereographic | 4× | 60 | 61 | 23 ms |
| stereographic | 6× | 59 | 59 | 29 ms |
| gnomonic | 1× | 58 | 59 | 21 ms |
| gnomonic | 4× | 61 | 61 | 26 ms |
| gnomonic | 6× | 60 | 60 | 29 ms |

The SVG window re-projects and commits every reading at the display rate under a 6× throttle, with no frame longer than 30 ms: FR-WIN-3's ≥ 30/s target is met with room, and the projection does not need to be cheaper than it is. The phone's own figure goes here: _pending_ (the `ev/s … draws/s` line under the window).

## Captures

- `window-{stereographic,gnomonic}-{high,golden}-horizon-390.png`: aimed at the pass's peak azimuth, 20° up; the horizon with its compass names and ticks in view.
- `window-{stereographic,gnomonic}-{high,golden}-peak-390.png`: aimed at the peak; the arc's sweep, the key at the peak, the live marker and the dotted part still ahead.
- `stripe-{buttons,tap,drag}-390.png`: the stripe page in each mode at rest.

## How the phone run goes

1. `npm run spike:window`, then on the phone `https://<this machine's LAN address>:5173/spike/window/`; accept the self-signed certificate once.
2. `[ start sensors ]` (iOS asks for permission in that tap). Point the phone at the sky: the horizon and the compass names should sit where the real horizon is; `N` where north is (magnetic, in the spike).
3. Turn the phone to landscape: the horizon should stay level. If it turns, try `correction=neg`; if only `off` is level, the platform already applies the angle.
4. Tilt and roll; try `heading=alpha` against `webkit` on iOS; pick `fov` and `smoothing` with the sliders. `[ copy facts ]` and paste the text into the OQ-17 section.
5. `the stripe page`: in each mode, `[ reset taps ]` and land on a rise; write the tap count and the distance into pick 4.
