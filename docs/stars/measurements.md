# Stars spike: measurements

Written by `npm run spike:stars:measure` (R111, PLAN D-741). `FINDINGS.md` quotes it; the phone's numbers are there, not here.

## The catalogue (item 1)

```
catalogue at V ≤ 4.5: 1035 stars (904 bright, 131 fainter figure endpoints) of 9096 records
figures: 89, 743 segments, 893 endpoints, worst snap 0.0025°
objects: 98.0 KB raw, 25.5 KB gzipped
columns: 53.5 KB raw, 21.1 KB gzipped
```

For comparison, V24-3's 5.5:

```
catalogue at V ≤ 5.5: 2892 stars (2887 bright, 5 fainter figure endpoints) of 9096 records
figures: 89, 743 segments, 893 endpoints, worst snap 0.0025°
objects: 248.1 KB raw, 55.6 KB gzipped
columns: 129.2 KB raw, 44.7 KB gzipped
```

## The precession path (item 3)

```
neuquen 2026-11-01T02:00:00Z: stars worst 0.0064° (Menkar), planets worst 0.0051° (Venus); tolerance 0.25°
paris 2026-11-01T21:00:00Z: stars worst 0.0062° (Hamal), planets worst 0.0048° (Venus); tolerance 0.25°
singapore 2026-11-01T14:00:00Z: stars worst 0.0056° (Aldebaran), planets worst 0.0051° (Venus); tolerance 0.25°
```

## The rate, by D-62's method (item 2)

1895 nodes (stars, planets, labels, figure segments); Pixel 5 profile, 5 s sweep, every layer on.

| render | mark | CPU | draws/s | longest gap ms |
|---|---|---|---|---|
| react | glyph | 1× | 86.2 | 36 |
| react | glyph | 4× | 18.8 | 118 |
| react | glyph | 6× | 11.8 | 159 |
| react | disc | 1× | 95.2 | 26 |
| react | disc | 4× | 22.2 | 97 |
| react | disc | 6× | 13.8 | 140 |
| ref | glyph | 1× | 100.2 | 12 |
| ref | glyph | 4× | 100.0 | 17 |
| ref | glyph | 6× | 98.2 | 20 |
| ref | disc | 1× | 100.0 | 12 |
| ref | disc | 4× | 100.0 | 14 |
| ref | disc | 6× | 100.0 | 15 |

Ink centre against the em box centre (px; + is right / below), `--font-mono` in Chromium:

| glyph | px | x | y |
|---|---|---|---|
| `*` | 12 | 0.02 | -0.57 |
| `*` | 15 | 0.02 | -0.73 |
| `+` | 12 | 0.12 | -0.69 |
| `+` | 15 | 0.15 | -0.87 |
| `.` | 12 | -0.30 | 1.94 |
| `.` | 15 | -0.38 | 2.41 |
| `·` | 12 | -0.01 | -1.04 |
| `·` | 15 | -0.01 | -1.32 |
| `@` | 12 | -0.08 | 0.01 |
| `@` | 15 | -0.10 | -0.01 |

## The captures (item 4)

- [`crux-neuquen-13-10-390.png`](captures/crux-neuquen-13-10-390.png)
- [`crux-neuquen-14-11-390.png`](captures/crux-neuquen-14-11-390.png)
- [`crux-neuquen-15-12-390.png`](captures/crux-neuquen-15-12-390.png)
- [`crux-neuquen-16-13-390.png`](captures/crux-neuquen-16-13-390.png)
- [`crux-neuquen-18-15-390.png`](captures/crux-neuquen-18-15-390.png)
- [`crux-neuquen-15-12-collide-0.25-390.png`](captures/crux-neuquen-15-12-collide-0.25-390.png)
- [`crux-neuquen-15-12-collide-1-390.png`](captures/crux-neuquen-15-12-collide-1-390.png)
- [`crux-neuquen-15-12-inkfix-390.png`](captures/crux-neuquen-15-12-inkfix-390.png)
- [`crux-neuquen-15-12-middle-inkfix-390.png`](captures/crux-neuquen-15-12-middle-inkfix-390.png)
- [`crux-neuquen-disc-390.png`](captures/crux-neuquen-disc-390.png)
- [`orion-paris-13-10-390.png`](captures/orion-paris-13-10-390.png)
- [`orion-paris-14-11-390.png`](captures/orion-paris-14-11-390.png)
- [`orion-paris-15-12-390.png`](captures/orion-paris-15-12-390.png)
- [`orion-paris-16-13-390.png`](captures/orion-paris-16-13-390.png)
- [`orion-paris-18-15-390.png`](captures/orion-paris-18-15-390.png)
- [`orion-paris-15-12-collide-0.25-390.png`](captures/orion-paris-15-12-collide-0.25-390.png)
- [`orion-paris-15-12-collide-1-390.png`](captures/orion-paris-15-12-collide-1-390.png)
- [`orion-paris-15-12-inkfix-390.png`](captures/orion-paris-15-12-inkfix-390.png)
- [`orion-paris-15-12-middle-inkfix-390.png`](captures/orion-paris-15-12-middle-inkfix-390.png)
- [`orion-paris-disc-390.png`](captures/orion-paris-disc-390.png)
- [`crux-neuquen-13-10-1280.png`](captures/crux-neuquen-13-10-1280.png)
- [`crux-neuquen-14-11-1280.png`](captures/crux-neuquen-14-11-1280.png)
- [`crux-neuquen-15-12-1280.png`](captures/crux-neuquen-15-12-1280.png)
- [`crux-neuquen-16-13-1280.png`](captures/crux-neuquen-16-13-1280.png)
- [`crux-neuquen-18-15-1280.png`](captures/crux-neuquen-18-15-1280.png)
- [`crux-neuquen-15-12-collide-0.25-1280.png`](captures/crux-neuquen-15-12-collide-0.25-1280.png)
- [`crux-neuquen-15-12-collide-1-1280.png`](captures/crux-neuquen-15-12-collide-1-1280.png)
- [`crux-neuquen-15-12-inkfix-1280.png`](captures/crux-neuquen-15-12-inkfix-1280.png)
- [`crux-neuquen-15-12-middle-inkfix-1280.png`](captures/crux-neuquen-15-12-middle-inkfix-1280.png)
- [`crux-neuquen-disc-1280.png`](captures/crux-neuquen-disc-1280.png)
- [`orion-paris-13-10-1280.png`](captures/orion-paris-13-10-1280.png)
- [`orion-paris-14-11-1280.png`](captures/orion-paris-14-11-1280.png)
- [`orion-paris-15-12-1280.png`](captures/orion-paris-15-12-1280.png)
- [`orion-paris-16-13-1280.png`](captures/orion-paris-16-13-1280.png)
- [`orion-paris-18-15-1280.png`](captures/orion-paris-18-15-1280.png)
- [`orion-paris-15-12-collide-0.25-1280.png`](captures/orion-paris-15-12-collide-0.25-1280.png)
- [`orion-paris-15-12-collide-1-1280.png`](captures/orion-paris-15-12-collide-1-1280.png)
- [`orion-paris-15-12-inkfix-1280.png`](captures/orion-paris-15-12-inkfix-1280.png)
- [`orion-paris-15-12-middle-inkfix-1280.png`](captures/orion-paris-15-12-middle-inkfix-1280.png)
- [`orion-paris-disc-1280.png`](captures/orion-paris-disc-1280.png)
