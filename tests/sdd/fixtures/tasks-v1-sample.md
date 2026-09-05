# Sample task breakdown — fixture for `scripts/sdd-run.ts`

A stand-in for TASKS.md in the shape `sdd-breakdown` emits for v1 (PLAN
§16.3): the MVP task shape plus `Lane:`, `Model:` and `Gate:`. It exists so
the wave logic can be proved end to end without spending a session:

    npm run sdd -- --dry-run --tasks-file tests/sdd/fixtures/tasks-v1-sample.md

---

## Tasks

- [x] **R16 — Language preference and the Spanish catalog**
  - **Lane:** ui
  - **Model:** opus
  - **Gate:** owner
  - **Depends on:** —

- [ ] **R17 — The layered dome**
  - **Lane:** chart
  - **Model:** fable
  - **Gate:** owner
  - **Depends on:** R16

- [ ] **R18 [P] — Desktop layout at 1280 px**
  - **Lane:** ui
  - **Model:** opus
  - **Gate:** owner
  - **Depends on:** R16

- [ ] **R19 — The polar view's v1 markers**
  - **Lane:** chart
  - **Model:** fable
  - **Gate:** auto
  - **Depends on:** R16

- [ ] **R20 — Offline store and the service worker**
  - **Lane:** data
  - **Model:** opus
  - **Gate:** auto
  - **Depends on:** —

- [ ] **R21 — The live page**
  - **Lane:** chart
  - **Model:** fable
  - **Gate:** owner
  - **Depends on:** R19, R20

- [ ] **R22 — The Moon line**
  - **Lane:** physics
  - **Model:** opus
  - **Depends on:** —

- [ ] **R23 — The window spike the owner drives**
  - **Lane:** window
  - **Model:** interactive
  - **Gate:** owner
  - **Depends on:** —

- [ ] **R24 — A task behind a precondition**
  - **Lane:** docs
  - **Model:** sonnet
  - **Gate:** auto
  - **Depends on:** —
  - **Precondition:** docs/window/FINDINGS.md
  - **Findings:** F-3, F-35
