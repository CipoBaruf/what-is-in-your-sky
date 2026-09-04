---
name: visual-review
description: Capture a task's screens at phone and desktop widths with Playwright and file them under docs/screenshots for review. Use when a task changes the UI, when the user asks for screenshots, or when sdd-implement reaches its "when done" list.
---

# Visual review captures

Every UI task ends with captures that a reviewer can compare against the spec and the approved mockups. The captures are evidence in the PR, not tests.

## Widths

| Name | Viewport | Why |
|---|---|---|
| phone | 390 × 844 | The MVP reference (Pixel 5 profile). |
| phone-landscape | 844 × 390 | Only for the live page (FR-LIVE-7). |
| desktop | 1280 × 800 | Wide layout (FR-DESK-1, ≥ 100 cells). |

Both themes when the task touches colour (FR-THEME-*): capture dark and night. Both languages when the task touches text (FR-I18N-*): capture en and es.

## Procedure

1. Build and serve the production bundle so the strict CSP applies: `npm run build && npx vite preview --port ${E2E_PORT:-4173}` (background). A driver session has `E2E_PORT` set (PLAN §16.4, D-132) because another task may be serving 4173 from its own worktree at the same time; use the same port in every URL below.
2. Write or extend a Playwright script under `tests/e2e/` that reaches the state (typed coordinates, fixture elements through MSW or the recorded fixtures, a chosen pass) and calls `page.screenshot({ path: 'test-results/<task>-<screen>-<width>.png', fullPage })`. Reuse `tests/e2e/identity.spec.ts`'s helpers where they fit.
3. Run it: `npx playwright test <spec> --project=chromium`.
4. Look at every capture (Read the PNG). Check against the acceptance criteria and the mockup: alignment to the cell grid, no clipped labels, no horizontal scroll, contrast, both languages complete (no English leaking into Spanish).
5. Copy the captures the PR should carry to `docs/screenshots/` with the task prefix (`r16-home-1280.png`). Keep the set small: one per screen, width, and variant that matters.
6. List the files in the PR body with one line each saying what to look at.

## Names

`<task>-<screen>-<width>[-<variant>].png`, for example `r17-live-844-landscape.png`, `r16-detail-1280-es.png`.
