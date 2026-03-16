# Plan: Playwright in the Dev-Fix Harness

This document plans how to use **Playwright** E2E tests as part of the dev-fix verification harness, so the agent’s changes are gated not only by `bun run check` but also by critical E2E tests.

---

## 1. Goal

- **Harness today:** Verify step runs **project check** (`bun run check` / `npm run check`) in the clone; pass → proceed to PR, fail → retry or fail.
- **Harness with Playwright:** Optionally or additionally run a **smoke / critical E2E** suite in the clone so that:
  - The app builds and key user journeys still work after the agent’s changes.
  - Failures can be fed back to the agent (e.g. “E2E failed: …”) for retry, same as svelte-check failures.

---

## 2. Where Playwright Fits in the Harness

| Layer | What runs | Where |
|-------|-----------|--------|
| **1. Type/syntax** | `bun run check` / `npm run check` (svelte-check) | voiceaiagentv5 `verify_fix` activity |
| **2. E2E (new)** | `npm run test:e2e` (or a dedicated smoke script) | Same `verify_fix` activity, after check passes (or in parallel; see below) |

**Recommended order:** Run **check first**, then **E2E**. If check fails, no need to run E2E. If check passes, run a small Playwright suite (smoke/critical only) so verify stays within a reasonable timeout.

---

## 3. PHWB (phwb-testrepo) – What to Add

### 3.1 Scripts and config

- **package.json**
  - `"test:e2e": "playwright test"`
  - `"test:e2e:ui": "playwright test --ui"`
  - **Optional:** `"test:e2e:smoke": "playwright test --project=smoke"` for a smoke-only suite used by the harness.

- **playwright.config.ts** (repo root)
  - `baseURL`: e.g. `http://localhost:5173` (dev server).
  - **Projects:**
    - `default`: full E2E (all specs).
    - `smoke`: only specs tagged or placed under `tests/e2e/smoke/` (or tagged `@smoke`) for fast, critical-path checks.

- **tests/e2e/** (or **tests/e2e/smoke/**)
  - At least one smoke spec that:
    - Starts or assumes the app is running.
    - Logs in (e.g. via test-login or test user).
    - Covers one critical path (e.g. open Bugs list, open a bug, or open dev-fix-simulation and assert the page loads and “Initiate dev fix” is present).
  - Keep smoke tests **fast** (< 2–3 minutes total) and **stable** (no flaky waits).

### 3.2 Test-login / auth

- E2E needs a way to authenticate. Options:
  - Use existing **dev-only** route (e.g. `/auth/test-login?email=...`) if present.
  - Or use a dedicated test user and sign-in once in `beforeEach`/global setup.
- Document in this plan or in `docs/testing/` so the harness (and CI) can run with the same auth.

### 3.3 Running against the clone in the worker

- The **harness runs in a clone** on the voiceaiagentv5 worker. To run Playwright there:
  - **Option A – Build + preview:** In the clone, run `bun run build && bun run preview` (or `npm run build && npm run preview`) so the app is served (e.g. on port 4173), then run `npm run test:e2e:smoke` with `baseURL: http://localhost:4173`.
  - **Option B – Dev server:** Run `bun run dev` in the background and wait for ready, then run Playwright with `baseURL: http://localhost:5173`. Simpler but slightly more fragile (port, startup time).
- **Recommendation:** Option A (build + preview) so the agent is verified against the **production build**; Playwright then uses the same build artifact.

---

## 4. voiceaiagentv5 – Changes to `verify_fix`

### 4.1 When to run Playwright

- **Option 1 – After check passes (recommended):**
  1. Run `bun run check` / `npm run check` (current behavior).
  2. If it fails, apply current bypass logic (pre-existing errors in unmodified files); if still failing, return failure.
  3. If check passes, run build + preview (or dev), then `npm run test:e2e:smoke` (or `playwright test --project=smoke`).
  4. If E2E fails, return `(False, "E2E failed: ...")` so the workflow can retry the agent with that message (same as check failure).

- **Option 2 – Optional E2E via env:**
  - Only run Playwright when e.g. `DEV_AGENT_RUN_E2E=1` is set. Default remains check-only until smoke suite is stable.

### 4.2 Implementation outline

- In `verify_fix` (after check passes):
  1. If `DEV_AGENT_RUN_E2E` is not set (or 0), return `True` (current behavior).
  2. Otherwise:
     - Run `bun run build` / `npm run build` in the clone (with timeout).
     - Start preview (e.g. `bun run preview` or `npm run preview`) in the background, wait for URL to be reachable.
     - Run `npx playwright test --project=smoke` with env `BASE_URL=http://localhost:4173` (or whatever port preview uses), capture exit code and output.
     - Stop preview.
     - If exit code != 0, parse Playwright’s JSON or text output and return `(False, "E2E failed: ...")`; optionally log to `phwb_dev_logs`.
  3. If E2E passes, return `True`.

- **Timeouts:** Build (e.g. 3–5 min) + preview startup (e.g. 30 s) + smoke tests (e.g. 2–3 min). Total verify step timeout may need to increase (e.g. 10–15 min) when E2E is enabled.

### 4.3 Bypass and strict mode

- **Pre-existing E2E failures:** Same idea as for check: if we have a way to know which tests/specs touch “modified” code (e.g. by test file or by convention), we could bypass E2E failure when only unmodified paths are affected. For a first version, **no bypass**: if smoke fails, verify fails.
- **DEV_AGENT_VERIFY_STRICT:** Already forces check failures to fail; can apply to E2E the same way (strict = no bypass, and E2E must pass when enabled).

---

## 5. Instruction to the Agent (optional)

- In `_build_dev_fix_instruction` (or in CLAUDE.md), add a short line so the agent knows E2E exists and should not break it:
  - e.g. “Do not break the project: the change must pass the project’s check and, if present, the smoke E2E suite (`npm run test:e2e:smoke`).”
- This keeps “repo as source of truth” and makes the E2E gate part of the documented contract.

---

## 6. Phased Rollout

| Phase | What | Goal |
|-------|------|------|
| **1** | Add Playwright config, `test:e2e` (and optionally `test:e2e:smoke`), one smoke spec in phwb-testrepo. Run locally and in CI. | Establish stable smoke suite and scripts. |
| **2** | In voiceaiagentv5, add optional E2E step behind `DEV_AGENT_RUN_E2E=1`: after check, run build + preview + smoke; on failure return error to workflow. | Playwright in harness, opt-in. |
| **3** | Document in DEV_FIX_FLOW.md and CLAUDE.md; enable E2E by default for dev-fix (or keep opt-in and document when to use it). | Clear contract and operations. |
| **4** | (Optional) Bypass or filter E2E failures by modified files if we have a mapping (e.g. smoke tests for routes X,Y → only fail if X,Y were modified). | Reduce false failures from pre-existing flakiness. |

---

## 7. Files to Touch (summary)

**phwb-testrepo**

- `package.json` – Add `test:e2e`, `test:e2e:ui`, optionally `test:e2e:smoke`.
- `playwright.config.ts` – New; baseURL, projects (default, smoke).
- `tests/e2e/smoke/` – At least one smoke spec (e.g. login + Bugs or dev-fix-simulation page).
- `docs/PLAYWRIGHT_HARNESS_PLAN.md` – This plan.

**voiceaiagentv5**

- `app/activities/dev_activities.py` – In `verify_fix`, after check passes: if `DEV_AGENT_RUN_E2E`, run build → preview → Playwright smoke → parse result and return pass/fail.
- `docs/DEV_FIX_RUN.md` (or equivalent) – Document `DEV_AGENT_RUN_E2E` and timeouts.

**phwb-testrepo (repo-as-source-of-truth)**

- `CLAUDE.md` (or `.dev-agent/instruction-prefix.md`) – One line about passing check and smoke E2E when present.

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| E2E flaky in worker | Use smoke-only suite; retry once; or keep E2E opt-in until stable. |
| Long verify time | Run E2E only after check passes; use short timeout for smoke; consider running E2E in parallel with check later. |
| Port conflict | Use a fixed port for preview in the clone (e.g. 4173) and pass it to Playwright. |
| No browser in worker | Use Playwright’s bundled browsers (`npx playwright install`) in the clone or in the worker image; headless by default. |

---

## 9. Success Criteria

- Smoke E2E runs locally with `npm run test:e2e:smoke` (or `test:e2e --project=smoke`).
- With `DEV_AGENT_RUN_E2E=1`, verify step runs check → build → preview → smoke and fails the workflow when smoke fails, with a clear message for the agent.
- DEV_FIX_FLOW (or equivalent) and CLAUDE.md document that the harness may run Playwright and that the agent must not break the smoke suite.

This plan keeps the harness “repo as source of truth” (tests live in the repo, agent is instructed via CLAUDE.md) and adds Playwright as a second, optional then first-class gate alongside svelte-check.
