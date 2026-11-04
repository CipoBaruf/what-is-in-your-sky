# What Is In Your Sky Right Now — Product Specification

| Field | Value |
|---|---|
| Status | **Draft v2.14 — for review.** Phase v2.14 "one sky on a desk" (the three wide pages as one layout, the globe with the passes, the dome by choice, the facts, the names, the desk controls): §4.57, FR-WIDE-1..12, FR-FACT-1..3, FR-NAME-1..3, FR-KEEP-1..4, US-52..US-57, G62–G65, Decision Log V214-1..V214-17 and roadmap §9 Phase 2w, in `docs/sdd/phases/v2.14/spec.md`; the owner's answers of 2026-11-04 are V214-1..V214-14. Every earlier status line, word for word, is in the [revision history](#revision-history) at the end of this document. |
| Date | 2026-11-04 (v2.14). Earlier dates are in the [revision history](#revision-history). |
| Owner | Ezequiel Baruf |
| Scope of this document | Product + technical specification only. No implementation plan or task breakdown (requested as a separate step). |

---

## 1. Summary

A web app that tells a person standing outside, with no equipment, **which satellites they can see with the naked eye, when, and where to look** — and whether clouds are likely to spoil the view.

The user supplies a location (city or place name, coordinates, or browser geolocation).
The app predicts visible passes for the coming hours, ranks them by how good they will be, and for each pass gives plain-language viewing instructions (rise/peak/set direction, maximum elevation, times, duration, expected brightness) plus a cloud-cover warning drawn from a weather forecast.

*As built (2026-09-25, V22-7):* beyond that list, the app also has a live page that draws the whole sky at the shown instant, a sky screen a phone is held up to the sky with, works offline once it has loaded, and speaks English and Spanish — §4.7 (language), §4.10 (the live page), §4.11 (offline) and §4.23 (the sky screen) are where those were specified.

---

## 2. Goals & Non-Goals

### 2.1 Goals (MVP)

- **G1. Zero-friction start.**
  A first-time visitor gets a useful answer in under 30 seconds with no sign-up and no API keys to configure.
- **G2. Correct visibility filtering.**
  Only show passes that are genuinely naked-eye visible: satellite sunlit, observer in darkness, pass high enough above the horizon, predicted brightness above a threshold.
- **G3. Actionable guidance.**
  Every pass answers "where do I look, when, and for how long?" in words a non-astronomer understands.
- **G4. Honest about weather.**
  Warn when clouds are likely to block the pass; never silently present a doomed pass as a good one.
- **G5. Cheap to run.**
  Free or generous-free-tier data sources; near-zero hosting cost; computation pushed to the client where practical.
- **G6. Works on a phone, outdoors, at night.**
  Mobile-first, dark UI, large tap targets, readable at arm's length.

### 2.2 Non-Goals (set for the MVP; amended by later phases where a row says so)

- Tracking every object in orbit (full catalog, debris, Starlink shells).
  MVP covers a hand-maintained catalog of ~30 well-known bright objects; the full CelesTrak `visual` group is v1.
- Street-address-precision geocoding.
  MVP geocodes to city/place level (Open-Meteo geocoding).
  A pass looks the same from anywhere within a few kilometres, so this costs nothing in accuracy; street addresses and reverse geocoding arrive with the v1 proxy.
- Any first-party backend.
  MVP is a static site; the browser talks to CelesTrak and Open-Meteo directly.
  *(amended v1)* The caching proxy moves to Phase 3 (V1-1): v1 stays browser-direct.
- Telescope / binocular targets (faint satellites, geostationary satellites, flares from specific antenna geometry).
- Astrology as prediction. v1 shows Moon lore (zodiac sign, folk names, one-liners) labelled as tradition (FR-MOON-5); the app never claims it affects what is visible.
  *(amended v1.1, V11-2)* The lore line ships behind a build flag that is off by default (FR-FLAG-1); the observing facts (phase, illumination, glare) are not affected by the flag.
- Iridium-style flare prediction (the original Iridium constellation is deorbited; flare prediction for other constellations is research-grade).
- Radio tracking, Doppler, amateur radio pass planning.
- Live 3D globe / orbit visualisation (Earth-centred, orbital view).
  The observer-centred sky dome in §4.4 is in scope; a view of the Earth from outside is not.
  *(v2.12, V212-1)* The stars page's celestial globe (§4.55) is the sky seen from outside, with no Earth drawn on it; this non-goal stands.
- User accounts, cloud sync, social features.
- Native mobile apps.
  *(amended v1)* The app installs as a PWA in v1 (FR-OFF-6); a store app is still out of scope.
- Historical passes ("what did I just see?") — see Roadmap, later phase.
- Guaranteed accuracy for launches < 48 h old or objects during manoeuvres (orbital elements lag reality).
- Commercial use of the free data tiers.
  If the project ever monetises, several dependencies (Open-Meteo; Nominatim once added in v1) require moving to paid/self-hosted tiers.

---

### Current phase — v2.14 ("one sky on a desk", as decided 2026-11-04, V214-1)

After v2.13 is on `main`.
On a desk the satellites, the live sky and the stars become one layout with the globe as their whole sky, the dome by choice and one time control; the satellites, stars and planets the reader picks say what they are, the Spanish star names are reviewed, and the desk gains hover, clouds on the stripe, keys and a full-screen sky.
On the phone and the desk every choice is kept for the next open and the privacy note is read once; otherwise the phone changes only by the star names.
Goals G62–G65, §4.57, FR-WIDE-1..12, FR-FACT-1..3, FR-NAME-1..3, FR-KEEP-1..4, US-52..US-57 and roadmap §9 Phase 2w are in [the phase spec](docs/sdd/phases/v2.14/spec.md); the decisions are V214-1..V214-17.

### Phase 3 — Later
- Threshold tuning UI (US-9): min elevation, magnitude limit, twilight rule, and a user-selectable window up to 5 nights.
- Add-to-calendar (.ics); in-page pre-pass alarm (audio + vibration) while the tab is open; push notifications (US-11, backend scheduler per subscribed location/pass).
- **Caching proxy** (edge worker) in front of CelesTrak; catalog expands to the full `visual` group with "brightness unknown" handling; street-address and reverse geocoding via Nominatim behind the proxy (FR-LOC-4); Space-Track as redundant elements source.
- Starlink trains (server-side precompute for the `starlink` group; supplemental ephemerides).
- "What did I just see?" reverse lookup.
- *(v2.12, OQ-59)* On a desk: the 360° horizon panorama as a second view, several horizons on one globe, a full-sky map for print.
- AR camera overlay.
- Sky transparency (7Timer) and elevation mask; a Southern-hemisphere folk-name list for the Moon (OQ-13).
- Observation feedback loop for accuracy metrics.

---


## Map

The rest of this document is cut by phase (FR-SDD-3, `scripts/sdd/split.ts`).
Every id resolves through [`docs/sdd/ids.md`](docs/sdd/ids.md): `npm run sdd:id <id>` prints it with its file and heading, and an old section number (`SPEC §4.47`, `PLAN §16.4`) has a line there too.

| Phase | Spec | Plan | Tasks |
|---|---|---|---|
| mvp | [spec](docs/sdd/phases/mvp/spec.md) | [plan](docs/sdd/phases/mvp/plan.md) | [tasks](docs/sdd/phases/mvp/tasks.md) |
| v1 | [spec](docs/sdd/phases/v1/spec.md) | [plan](docs/sdd/phases/v1/plan.md) | [tasks](docs/sdd/phases/v1/tasks.md) |
| v1.1 | [spec](docs/sdd/phases/v1.1/spec.md) | [plan](docs/sdd/phases/v1.1/plan.md) | [tasks](docs/sdd/phases/v1.1/tasks.md) |
| v1.2 | [spec](docs/sdd/phases/v1.2/spec.md) | [plan](docs/sdd/phases/v1.2/plan.md) | [tasks](docs/sdd/phases/v1.2/tasks.md) |
| v1.3 | [spec](docs/sdd/phases/v1.3/spec.md) | [plan](docs/sdd/phases/v1.3/plan.md) | [tasks](docs/sdd/phases/v1.3/tasks.md) |
| v1.3.2 | [spec](docs/sdd/phases/v1.3.2/spec.md) | [plan](docs/sdd/phases/v1.3.2/plan.md) | [tasks](docs/sdd/phases/v1.3.2/tasks.md) |
| v1.4 | [spec](docs/sdd/phases/v1.4/spec.md) | [plan](docs/sdd/phases/v1.4/plan.md) | [tasks](docs/sdd/phases/v1.4/tasks.md) |
| v2.0 | [spec](docs/sdd/phases/v2.0/spec.md) | [plan](docs/sdd/phases/v2.0/plan.md) | [tasks](docs/sdd/phases/v2.0/tasks.md) |
| v2.1 | [spec](docs/sdd/phases/v2.1/spec.md) | [plan](docs/sdd/phases/v2.1/plan.md) | [tasks](docs/sdd/phases/v2.1/tasks.md) |
| v2.2 | [spec](docs/sdd/phases/v2.2/spec.md) | [plan](docs/sdd/phases/v2.2/plan.md) | [tasks](docs/sdd/phases/v2.2/tasks.md) |
| v2.2.1 | [spec](docs/sdd/phases/v2.2.1/spec.md) | [plan](docs/sdd/phases/v2.2.1/plan.md) | [tasks](docs/sdd/phases/v2.2.1/tasks.md) |
| v2.3 | [spec](docs/sdd/phases/v2.3/spec.md) | [plan](docs/sdd/phases/v2.3/plan.md) | [tasks](docs/sdd/phases/v2.3/tasks.md) |
| v2.4 | [spec](docs/sdd/phases/v2.4/spec.md) | [plan](docs/sdd/phases/v2.4/plan.md) | [tasks](docs/sdd/phases/v2.4/tasks.md) |
| v2.5 | [spec](docs/sdd/phases/v2.5/spec.md) | [plan](docs/sdd/phases/v2.5/plan.md) | [tasks](docs/sdd/phases/v2.5/tasks.md) |
| v2.6 | [spec](docs/sdd/phases/v2.6/spec.md) | [plan](docs/sdd/phases/v2.6/plan.md) | [tasks](docs/sdd/phases/v2.6/tasks.md) |
| v2.6.1 | [spec](docs/sdd/phases/v2.6.1/spec.md) | [plan](docs/sdd/phases/v2.6.1/plan.md) | [tasks](docs/sdd/phases/v2.6.1/tasks.md) |
| v2.7 | [spec](docs/sdd/phases/v2.7/spec.md) | [plan](docs/sdd/phases/v2.7/plan.md) | [tasks](docs/sdd/phases/v2.7/tasks.md) |
| v2.8 | [spec](docs/sdd/phases/v2.8/spec.md) | [plan](docs/sdd/phases/v2.8/plan.md) | [tasks](docs/sdd/phases/v2.8/tasks.md) |
| v2.9 | [spec](docs/sdd/phases/v2.9/spec.md) | [plan](docs/sdd/phases/v2.9/plan.md) | [tasks](docs/sdd/phases/v2.9/tasks.md) |
| v2.10 | [spec](docs/sdd/phases/v2.10/spec.md) | [plan](docs/sdd/phases/v2.10/plan.md) | [tasks](docs/sdd/phases/v2.10/tasks.md) |
| v2.11 | [spec](docs/sdd/phases/v2.11/spec.md) | [plan](docs/sdd/phases/v2.11/plan.md) | [tasks](docs/sdd/phases/v2.11/tasks.md) |
| v2.12 | [spec](docs/sdd/phases/v2.12/spec.md) | [plan](docs/sdd/phases/v2.12/plan.md) | [tasks](docs/sdd/phases/v2.12/tasks.md) |
| v2.13 | [spec](docs/sdd/phases/v2.13/spec.md) | [plan](docs/sdd/phases/v2.13/plan.md) | [TASKS.md](TASKS.md) |
| v2.14 | [spec](docs/sdd/phases/v2.14/spec.md) | plan to come | — |

The Decision Log (SPEC §12): [decisions.md](docs/sdd/decisions.md).
Reference: [glossary](docs/sdd/reference/glossary.md),
[revision-history](docs/sdd/reference/revision-history.md),
[project-structure](docs/sdd/reference/project-structure.md),
[data-model](docs/sdd/reference/data-model.md),
[worker-contract](docs/sdd/reference/worker-contract.md),
[data-layer](docs/sdd/reference/data-layer.md),
[testing](docs/sdd/reference/testing.md),
[build-and-deploy](docs/sdd/reference/build-and-deploy.md),
[traceability](docs/sdd/reference/traceability.md),
[delivery](docs/sdd/reference/delivery.md),
[breakdown-inputs](docs/sdd/reference/breakdown-inputs.md).
