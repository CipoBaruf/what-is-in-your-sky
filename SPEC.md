# What Is In Your Sky Right Now — Product Specification

| Field | Value |
|---|---|
| Status | **Draft v3.0 — for review.** Phase v3.0 "the sky first" (the live sky is the first page at both widths, no home, the stars folded into live, a next-pass strip, a dark sky at every hour, one look per control, new versions said on every page): FR-LAND-1..7, FR-STRIP-1..6, FR-DARK-1..4, FR-CTRL-1..17, FR-DS-10..14, FR-NOW-1..3, FR-UPD-1..2, amendments listed in the phase, Decision Log V30-1..V30-32, in `docs/sdd/phases/v3.0/spec.md`. Every earlier status line, word for word, is in the [revision history](#revision-history). |
| Date | 2026-11-21 (v3.0). Earlier dates are in the [revision history](#revision-history). |
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

### Current phase — v3.0 ("the sky first", as decided 2026-11-21, V30-1)

After v2.16, which shipped as 2.16.0; the owner's review of that release is the phase.
The live sky is the first and main page at both widths: the home goes, the stars fold into live, the place is one line in the header, the next pass is a strip rather than a question, the sky is dark at every hour, every control has one look per role, and a new version is said on every page.
Goals G72–G75, §4.61–§4.67, FR-LAND-1..7, FR-STRIP-1..6, FR-DARK-1..4, FR-CTRL-1..17, FR-DS-10..14, FR-NOW-1..3, FR-UPD-1..2, the amendments, US-62..US-66 and roadmap §9 Phase 2z are in [the phase spec](docs/sdd/phases/v3.0/spec.md); the decisions are V30-1..V30-32.

### Previous phase — v2.16 ("an answer first", as decided 2026-11-18, V216-1)

Right after v2.15, which shipped as 2.15.0 (V216-16); the first waves also make CI faster and the capture set green again (V216-17).
A first visit opens on an answer, not a question: tonight's next pass for the city of the browser's time zone, labelled as an example, with `[ Not there? Set your place ]` and the place question as the fallback.
Goals G69–G71, §4.59, §4.60, FR-OPEN-1..14, FR-CI-4..6, FR-CI-1, FR-CI-2, FR-MEAS-2, FR-MEAS-6, FR-FIRST-1, FR-FIRST-4 and FR-FIRST-7 amended, US-60..US-61 and roadmap §9 Phase 2y are in [the phase spec](docs/sdd/phases/v2.16/spec.md); the decisions are V216-1..V216-18.

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
| v2.14 | [spec](docs/sdd/phases/v2.14/spec.md) | [plan](docs/sdd/phases/v2.14/plan.md) | [tasks](docs/sdd/phases/v2.14/tasks.md) |
| v2.14.1 | [spec](docs/sdd/phases/v2.14.1/spec.md) | [plan](docs/sdd/phases/v2.14.1/plan.md) | — |
| v2.14.2 | [spec](docs/sdd/phases/v2.14.2/spec.md) | [plan](docs/sdd/phases/v2.14.2/plan.md) | [tasks](docs/sdd/phases/v2.14.2/tasks.md) |
| v2.15 | [spec](docs/sdd/phases/v2.15/spec.md) | [plan](docs/sdd/phases/v2.15/plan.md) | [TASKS.md](TASKS.md) |
| v2.16 | [spec](docs/sdd/phases/v2.16/spec.md) | [plan](docs/sdd/phases/v2.16/plan.md) | — |
| v3.0 | [spec](docs/sdd/phases/v3.0/spec.md) | [plan](docs/sdd/phases/v3.0/plan.md) | — |

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
