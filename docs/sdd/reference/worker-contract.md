## 6. Web Worker: Computation and Message Contract

### 6.1 What runs where

| Concern | Main thread | Worker |
|---|---|---|
| Fetch + cache elements, catalog filtering | ✔ | |
| `omm → satrec` conversion, holding satrecs | | ✔ |
| Pass search over the window (SGP4, frames, sun, shadow, magnitude) | | ✔ |
| "Now" state every 10 s | | ✔ (on request) |
| Weather fetch, cloud verdict per pass | ✔ | |
| Guide text, compass names, formatting, sky projection | ✔ | |

The worker is a single module worker (`new Worker(new URL('./passes.worker.ts', import.meta.url), { type: 'module' })`), instantiated once by `workerClient.ts`.
It holds `Map<NoradId, { satrec, catalog }>` in memory.
Reloading elements replaces the map.

### 6.2 Protocol (`src/worker/protocol.ts`)

```ts
export type WorkerRequest =
  | { type: 'loadElements'; requestId: string; records: SatelliteRecord[] }
  | { type: 'computePasses'; jobId: string; observer: Observer; window: TimeWindow; thresholds: VisibilityThresholds }
  | { type: 'computeNow'; requestId: string; observer: Observer; t: EpochMs; thresholds: VisibilityThresholds; includeHidden?: boolean }  // includeHidden added in v1 (D-76, FR-LIVE-6)
  | { type: 'cancel'; jobId: string };

export type WorkerResponse =
  | { type: 'elementsLoaded'; requestId: string; loaded: NoradId[]; rejected: { noradId: NoradId; reason: string }[] }
  | { type: 'passes'; jobId: string; noradId: NoradId; nightIndex: number; passes: Pass[] }   // streamed, one per (night, object) in v1 (D-77)
  | { type: 'progress'; jobId: string; done: number; total: number }
  | { type: 'jobDone'; jobId: string; cancelled: boolean; elapsedMs: number; hasDarkness: boolean } // hasDarkness added in R5 (§2.6)
  | { type: 'nowState'; requestId: string; state: NowState }
  | { type: 'error'; ref: { jobId?: string; requestId?: string }; code: WorkerErrorCode; message: string };

export type WorkerErrorCode = 'NO_ELEMENTS' | 'BAD_OMM' | 'PROPAGATION_FAILED' | 'INTERNAL';
```

Rules:

- **Correlation.**
  Every request carries a `jobId` (long-running) or `requestId` (one-shot).
  Responses echo it.
  The client ignores responses for IDs it no longer tracks (stale jobs after cancel).
- **Streaming.**
  `computePasses` emits one `passes` message per object as soon as that object is finished, then `jobDone`.
  The UI renders progressively; the ISS is processed first (catalog `featured` objects go first in the loop).
  *(v1, D-77)* With the 72 h window the loop is night-outer, object-inner: all of night 1 is emitted (featured first) before night 2 begins, so tonight's list is complete in the MVP's time and `progress` counts object × night pairs.
  `nightIndex` is 0, 1 or 2 and is what FR-OFF-2's grouping uses.
- **Hidden objects (v1, FR-LIVE-6).**
  `computeNow { includeHidden: true }` adds `NowState.hidden`: every object above the horizon at `t` that is not worth looking for — not visible, or visible but fainter than `magLimit` — each with its `NowItem.visible` flag and the reason fields already in the model.
  `items` is untouched and the key is absent without the flag, so the response is unchanged from MVP (D-96).
  There is no `computeAt` request: `computeNow` has always taken an arbitrary `t` (D-76).
  **The set is not the complement of the drawn passes**: it reads the magnitude at `t` while a pass is kept on its peak, so an object is in both for the few seconds it takes to dim past the limit on the way down (D-102).
  The live page draws its passes first and dims `hidden` minus what it has already drawn.
- **Cancellation (D-6).**
  The handler loop `await`s a zero-delay yield (`MessageChannel` ping) between objects so queued `cancel` messages are processed.
  A cancelled job still emits `jobDone { cancelled: true }`.
  The client auto-cancels the previous `computePasses` job when issuing a new one.
- **Errors.**
  `BAD_OMM` is per-object and reported inside `elementsLoaded.rejected`, never fatal.
  `PROPAGATION_FAILED` for one object skips that object and continues.
  `INTERNAL` aborts the job.
- **Serialisation.**
  All payloads are plain JSON-compatible objects (structured clone, no class instances, no `Date`).
  `satrec` never crosses the boundary.
- **Testability.**
  `handlers.ts` exports `createHandler(state) => (req, emit) => Promise<void>` with no reference to `self`/`postMessage`.
  `passes.worker.ts` is four lines binding it.
  Node tests drive the handler directly.

### 6.3 Pass search algorithm (as implemented in `physics/passes.ts`)

Inputs: one `satrec`, `Observer`, `TimeWindow`, `VisibilityThresholds`, `stdMag`.
Output: `Pass[]`.

1. **Coarse scan** at 30 s from `window.startMs` to `window.endMs`: propagate, convert to look angles, record `elDeg`.
   Group consecutive samples with `elDeg > 0` into candidate segments.
   Extend each segment by one coarse step on each side.
   (Any LEO pass reaching 10° spends well over 60 s above 0°, so a 30 s grid cannot skip one.)
2. **Refine horizon crossings**: within each candidate segment, bisect `elDeg − minElevationDeg = 0` on the entering and leaving flanks to ≤ 0.5 s.
   If the segment never reaches `minElevationDeg`, drop it.
3. **Dense sampling** at 1 s from rise(10°) to set(10°): for each sample compute `elDeg`, `azDeg`, `rangeKm`, `sunAltDeg` (observer), `lit` (shadow test), `phaseAngle`, `magnitude`.
   The visibility predicate is `el ≥ min && sunAlt ≤ sunAltMax && lit`.
4. **Visible interval** = longest contiguous run where the predicate holds.
   Drop the pass if none.
   `startReason`/`endReason` = whichever of the three conditions changed at the boundary (`horizon` if the run touches the 10° crossing).
   Boundary times are the 1 s sample edges (meets FR-VIS-2).
5. **Peak** = sample with max `elDeg` inside the visible interval, refined by a parabola through its neighbours (D-7).
6. **Magnitude** = value at peak (D-1).
   Drop the pass if `> magLimit`.
7. `twilight = sunAltAtPeak > twilightLabelSunAltDeg`.
   `track` = every 10th dense sample plus the exact start/peak/end points.
8. *(v1)* `moonAtPeak = moonAt(peak.t, observer)`, up or down (D-109); `moonGlare` from FR-MOON-2's three conditions with the constants from `physics/constants.ts` (D-80), which is the one place the altitude is tested.
   One Moon evaluation per pass, not per sample — the Moon moves ~0.5° in the length of a pass, far below the 30° separation threshold.

Shadow test (`physics/shadow.ts`): with `r` the satellite ECI position and `ŝ` the sun unit vector, `d = r·ŝ`; in umbra iff `d < 0` and `|r − d·ŝ| < 6371.0`.

Frame note: satellite.js propagates in TEME; `astronomy-engine`'s equator-of-date vector is used directly as the sun direction (D-2).
The ~arcsecond difference is irrelevant at this precision.

---
