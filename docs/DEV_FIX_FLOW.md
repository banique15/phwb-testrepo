# Dev Fix Feature Flow: Issue → PR Link in Comments Tab

**Production flow (final).** End-to-end path from creating an issue in PHWB to seeing the Dev Agent’s PR link in the bug’s **Comments** tab. The UI uses the **Comments** tab for the PR link; links in comments are clickable.

---

## 1. High-level flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHWB (phwb-testrepo)                    │  voiceaiagentv5 (backend)            │
├──────────────────────────────────────────┼───────────────────────────────────────┤
│  1. Create / open issue (bug)            │                                       │
│  2. Bug detail page → "Initiate dev fix" │                                       │
│  3. POST /api/dev/fix (bug payload)  ────┼──► 4. Start DevFixWorkflow (Temporal)  │
│                                          │     5. Setup repo → Analyze & code   │
│                                          │     6. Verify fix (retry up to 3x)     │
│                                          │     7. Create PR (GitHub)             │
│                                          │     8. update_bug_ticket:              │
│                                          │        - INSERT phwb_bug_comments      │
│                                          │          (PR link or error)           │
│                                          │        - UPDATE phwb_bugs.status       │
│  9. User opens Comments tab              │                                       │
│     → Comments loaded from                │                                       │
│       phwb_bug_comments (Supabase)        │                                       │
│  10. PR link appears in comment list      │                                       │
└──────────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Step-by-step

### 2.1 Create / open issue (PHWB)

- **Where:** `/bugs` (list) or **Create** → new bug in `phwb_bugs`.  
  **Quick test:** On `/bugs/dev-fix-simulation`, click **Create test issue** (calls `POST /api/bugs/seed-test`) to insert a ready-made test bug, then use **Open issue #N →** to go to the bug detail page.
- **Data:** `phwb_bugs` row (id, title, description, category, status, etc.).

### 2.2 Open bug detail and trigger Dev Fix (PHWB)

- **Where:** `/bugs/[id]` (bug detail page).
- **UI:** “Dev Agent” section → **Initiate dev fix** button.
- **Action:** Client `POST` to `PUBLIC_VOICE_AGENT_URL/api/dev/fix` with body:
  - `id`, `title`, `description`, `category`, `status`.
- **Response:** `{ "status": "started", "workflow_id": "dev-fix-workflow-<bugId>-<ts>" }`.

*(Simulation page: `/bugs/dev-fix-simulation` — same payload, for testing without opening a specific bug.)*

### 2.3 voiceaiagentv5: start workflow

- **Endpoint:** `POST /api/dev/fix` (FastAPI).
- **Starts:** Temporal `DevFixWorkflow` with the bug payload.
- **Workflow ID:** `dev-fix-workflow-{bug_id}-{timestamp}`.

### 2.4 DevFixWorkflow (Temporal) — voiceaiagentv5

| Step | Activity | What it does |
|------|----------|----------------|
| 1 | `setup_repository` | Clone repo into a **temporary directory** on the worker, create branch `dev-agent/bug-fix/{id}-{ts}` there. The branch does **not** exist in your local repo or on GitHub yet. |
| 2 | `analyze_and_code` | Build instruction (AGENTS.md/CLAUDE.md, harness blurb, bug task). Run dev agent (plan → code → review). |
| 3 | `verify_fix` | Run checks in repo (e.g. `npm run check`). On failure, retry from step 2 (up to 3 attempts). |
| 4 | `create_pull_request` | Commit, **push branch to GitHub**, create PR via PyGithub. **Only after this step** does the branch appear on the remote (e.g. `github.com/org/repo/branches`). Returns `pr.html_url`. |
| 5 | `update_bug_ticket` | **Writes back to PHWB’s Supabase.** |

**Where to see the branch:** The branch is created only in a temp clone on the worker. It appears on **GitHub** (remote) only when step 4 runs and `git push origin <branch_name>` succeeds. You will **not** see it in your local repo until the workflow has finished and you run `git fetch origin` (or the PR link in Comments will take you to it). If the workflow never reaches step 4 (e.g. still in step 2, or step 3 failed, or “Agent made no code changes”), no branch will exist on GitHub.

### 2.5 update_bug_ticket — writing the “comment” (voiceaiagentv5)

- **Table:** `phwb_bug_comments` (same DB PHWB uses).
- **On success (PR created):**
  - **Insert** one row:
    - `bug_id`, `content`:  
      `"✅ **Dev Agent** completed a fix and raised a Pull Request.\n\nPlease review it here: {pr_url}"`
    - `user_id`: `null`, `is_internal`: `false`.
  - **Update** `phwb_bugs`: `status = 'review'`.
- **On failure:**
  - **Insert** one row:
    - `content`: `"❌ **Dev Agent** encountered an error:\n\n```\n{error_msg}\n```"`
    - `is_internal`: `true`.

So the “PR link in the comment tab” is this inserted row: same table and UI as normal comments.

### 2.6 Comments tab in PHWB (bug detail page)

- **Where:** `/bugs/[id]` → **Comments** tab (in `BugDetailTabs.svelte`).
- **Data source:** Server load in `+page.server.ts`:
  - `supabase.from('phwb_bug_comments').select('*').eq('bug_id', bugId).order('created_at', { ascending: true })`
- **Rendering:** `BugCommentList` receives `comments` and shows each `content` (supports markdown; PR link is in that text).
- **Seeing the new comment:** Reload the bug page or re-open the Comments tab (or use realtime/invalidate if you add it). The new row from `update_bug_ticket` is just another comment, so it appears in the list with the PR link.

---

## 3. Data flow summary

| Stage | System | Table / API |
|-------|--------|-------------|
| Issue exists | PHWB | `phwb_bugs` |
| User clicks “Initiate dev fix” | PHWB → voiceaiagentv5 | `POST /api/dev/fix` |
| Workflow runs | voiceaiagentv5 (Temporal) | Clone → code → verify → GitHub PR |
| PR link (or error) saved | voiceaiagentv5 → Supabase | `phwb_bug_comments` insert, `phwb_bugs` status update |
| User sees PR link | PHWB | Comments tab reads `phwb_bug_comments` for that `bug_id` |

---

## 4. Optional: live logs during the run

- **Table:** `phwb_dev_logs` (bug_id, step, message, level, workflow_id).
- **Written by:** `log_dev_event()` in voiceaiagentv5 activities (setup, analyze_and_code, create_pull_request, update_bug_ticket).
- **PHWB:** “Agent activity” on the bug detail page (and simulation page) can subscribe or poll this table to show live progress; currently a placeholder.

---

## 5. References (in repo)

| What | Where |
|------|--------|
| Bug detail + Initiate dev fix button | `src/routes/bugs/[id]/+page.svelte` |
| Dev fix simulation page | `src/routes/bugs/dev-fix-simulation/+page.svelte` |
| Comments tab + comment list | `src/routes/bugs/[id]/components/BugDetailTabs.svelte`, `BugCommentList.svelte` |
| Server load (bug + comments) | `src/routes/bugs/[id]/+page.server.ts` |
| Create test issue API | `src/routes/api/bugs/seed-test/+server.ts` (POST) |
| Clean test bugs script | `scripts/clean-test-bugs.ts` — `npm run clean:test-bugs` |
| Dev workflow + activities | voiceaiagentv5: `app/workflows/dev_fix.py`, `app/activities/dev_activities.py` |
| update_bug_ticket (comment insert) | voiceaiagentv5: `app/activities/dev_activities.py` → `update_bug_ticket` |

---

## 6. Flow improvements (smoother issue processing)

To make the agent more reliable at processing issues and applying code fixes:

| Area | Change |
|------|--------|
| **Verify step** | `verify_fix` is cross-platform: no hardcoded Windows path. Uses optional env `DEV_AGENT_NODE_MODULES_PATH` to copy host `node_modules`; otherwise runs `bun install` or `npm install` in the clone (with timeout), then `bun run check` or `npm run check`. Verification failures are returned as `(False, error_message)` so the workflow retry passes the error into the next agent run. |
| **Instruction** | Bug task is structured (Bug to fix, What to do, optional Previous attempt failed). Includes “make at least one concrete code change” and “must pass project check”. Repo context can include CLAUDE.md (up to 6000 chars). Empty description is handled. |
| **Dev agent** | Coder prompt stresses using `write_file` and making at least one real file change. Reviewer→Coder loop is capped at 2 cycles so the pipeline doesn’t run indefinitely; after that the workflow proceeds. |

**Optional env (voiceaiagentv5):** `DEV_AGENT_NODE_MODULES_PATH` — path to a pre-built `node_modules` directory to copy into the clone (faster than installing in the clone; leave unset to use install + check).

---

## 7. Deployment (no local attachment required)

The flow is fully env-driven so you can run locally or deploy and switch anytime. See **[DEPLOYMENT_DEV_FIX.md](./DEPLOYMENT_DEV_FIX.md)** for:

- Local vs production env (PHWB: `PUBLIC_VOICE_AGENT_URL`; voiceaiagentv5: `TEMPORAL_URL`, `CORS_ORIGINS`, etc.)
- Deployment checklist and CORS setup

---

## 8. Testing the flow (optional)

| Method | Use case |
|--------|----------|
| **Simulation page** | `/bugs/dev-fix-simulation` — enter a bug ID or click **Create test issue** (uses `POST /api/bugs/seed-test`), then **Initiate dev fix**. No script required. |
| **Repo-only test** (~1–2 min) | From phwb-testrepo root: `npm run test-repo`. Creates a test bug, sends `test_mode: true` so the backend skips the LLM and applies a trivial change → verify → PR. Check the bug’s **Comments** tab for the PR link. |
| **Full flow script** | `npm run test:dev-fix-flow` — creates a test bug and triggers the full agent (10–30+ min). |
| **E2E** | `npm run test:e2e -- tests/e2e/dev-fix-simulation.spec.ts` — Playwright test for the simulation page. |

Production use: open any real bug → **Initiate dev fix**. Do **not** send `test_mode` for real issues.

---

## 9. Cleaning up test bugs

Test issues created by the script or seed-test API use titles like `[Script Test] ...` or `[Dev Fix Test] ...`. To remove them from the database:

From **phwb-testrepo** root (with `.env` containing `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run clean:test-bugs
```

This deletes bugs whose title starts with `[Script Test]` or `[Dev Fix Test]`, and their comments. See `scripts/clean-test-bugs.ts`.

---

## 10. Future improvements (ideas)

- **Instruction:** Pull “steps to reproduce” / “acceptance criteria” from the bug into a dedicated section for the agent.
- **Verification:** Log the exact `bun run check` output to `phwb_dev_logs` on failure so the UI shows why verify failed.
- **Branch re-runs:** If the same bug is re-run, handle “branch already exists” (e.g. new timestamp or delete remote branch first).

---

## 11. QA policy (staging-first)

This flow now uses a two-layer QA policy:

1. **Fast gate (edited-file focused verify):**
   - Keep `verify_fix` fast and stable by default with `DEV_AGENT_VERIFY_MODE=edited_only` (or `hybrid`/`strict` when needed).
   - This gate is for fast signal on changes made by the current run.

2. **Outcome gate (final QA on affected flow):**
   - QA validates behavior on the staging preview URL for the affected user flow.
   - Validation is outcome-based (what the ticket asked for), not only file-based.
   - Use the bug detail Dev Agent section checklist and approve/reject controls to record staging validation.

For DB-affecting tickets:

- `code_complete_db_pending` / `staging_ready_db_pending` are **not QA-passable** states.
- Migration preview/apply status must be confirmed before considering the fix fully complete.

---

## 12. Test strategy updates (F3)

Keep existing smoke coverage and add focused regression checks for staging-first behavior:

- **Smoke checks stay in place** for fast confidence on core dev-fix routes and trigger actions.
- **Cross-layer ticket checks** validate that bug detail surfaces evidence from logs (impacted layers, verify mode, migration status, staging link/validation).
- **DB-changing refresh checks** validate that DB-pending state and migration preview details remain visible after refresh/reload.

Suggested command:

```bash
npm run test:e2e -- tests/e2e/dev-fix-simulation.spec.ts
```
