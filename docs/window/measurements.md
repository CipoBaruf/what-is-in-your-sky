# Sky-window spike: measurements (R38)

Captured by `npm run spike:window:capture` on 2026-09-05 in Playwright's Chromium with the Pixel 5 profile at 390 px.

## Update rate (the D-62 method)

Synthetic `deviceorientation` readings fed at 60 per second for 5 s, a slow sweep with a small tilt, three companion passes drawn beside the fixture pass. "Draws" are frames in which the window was re-projected and committed; the FR-WIN-3 target is ≥ 30 per second on the phone.

| Projection | CPU throttle | Events/s | Draws/s | Longest gap |
|---|---|---|---|---|
| stereographic | 1× | 57 | 57 | 22 ms |
| stereographic | 4× | 60 | 61 | 24 ms |
| stereographic | 6× | 59 | 60 | 31 ms |
| gnomonic | 1× | 57 | 57 | 22 ms |
| gnomonic | 4× | 61 | 61 | 22 ms |
| gnomonic | 6× | 59 | 60 | 29 ms |

## Captures

- `window-stereographic-high-horizon-390.png`
- `window-stereographic-high-peak-390.png`
- `window-stereographic-golden-horizon-390.png`
- `window-stereographic-golden-peak-390.png`
- `window-gnomonic-high-horizon-390.png`
- `window-gnomonic-high-peak-390.png`
- `window-gnomonic-golden-horizon-390.png`
- `window-gnomonic-golden-peak-390.png`
- `stripe-buttons-390.png`
- `stripe-tap-390.png`
- `stripe-drag-390.png`

The `horizon` window shots point the manual angles at each fixture pass's peak azimuth, 20° above the horizon; the `peak` shots point at the peak itself; the stripe shots are the three stepping candidates at rest.
