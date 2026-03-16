# Dev Fix Flow: End-to-End Summary Report

**From trigger → process → QA → PR link in Comments**

This report summarizes the full path from the user clicking **Initiate dev fix** in PHWB to seeing the PR link (or an error) in the bug’s **Comments** tab.

---

## 1. Overview

| Stage | System | What happens |
|-------|--------|--------------|
| **Trigger** | PHWB (phwb-testrepo) | User opens a bug → clicks **Initiate dev fix** in the Dev Agent card. |
| **Process** | voiceaiagentv5 (Temporal) | Workflow runs: setup repo → analyze & code → verify → create PR → update bug. |
| **QA** | voiceaiagentv5 (verify step) | Project check (`bun run check` / `npm run check`); optional bypass for pre-existing errors. |
| **Outcome** | PHWB + Supabase | PR link (or error) is written to `phwb_bug_comments`; user sees it in the **Comments** tab. |

---

## 2. Trigger (PHWB)

**Where:** Bug detail page `/bugs/[id]` (or simulation page `/bugs/dev-fix-simulation`).

**UI:**
- **Dev Agent** card in the right sidebar (bug detail) or in the simulation form.
- Button: **Initiate dev fix** (with optional loading state and workflow ID).

**Action:**
- Client sends `POST` to `PUBLIC_VOICE_AGENT_URL/api/dev/fix` (e.g. `http://localhost:8000/api/dev/fix`).
- **Body:** `{ id, title, description, category, status }` (and optionally `test_mode: true` for repo-only test).

**Response:**
- `200 OK` with `{ "status": "started", "workflow_id": "dev-fix-workflow-{bugId}-{timestamp}" }`.

**Live feedback:**
- **Agent activity** section polls `GET /api/bugs/[id]/dev-logs` every 2 seconds.
- Logs come from `phwb_dev_logs` (bug_id, step, message, level, workflow_id).
- User can **Clear logs** to delete dev logs for that bug.

---

## 3. Process (voiceaiagentv5)

**Entry:** FastAPI `POST /api/dev/fix` receives the payload and starts a Temporal workflow.

**Workflow:** `DevFixWorkflow` (Temporal) with five steps.

### Step 1 – Setup repository

- **Activity:** `setup_repository`
- **Actions:** Clone repo (with `DEV_AGENT_GITHUB_ACCESS_TOKEN`) into a temp directory; create branch `dev-agent/bug-fix/{bugId}-{timestamp}`.
- **Output:** `(repo_path, branch_name)`. Branch exists only in the clone until Step 4 pushes.
- **Logs:** “Setting up workspace”, “Cloning repository”, “Step 1/5 done. Branch …”.

### Step 2 – Analyze & code (or test-mode trivial change)

**Normal mode:**
- **Activity:** `analyze_and_code`
- **Actions:**
  - Build instruction from **repo-as-source-of-truth**: load `.dev-agent/instruction-prefix.md`, or `AGENTS.md`, or `CLAUDE.md` (up to 6000 chars) as “Repository context”.
  - Add harness guidance: “Use the repository as source of truth… Then implement the bug fix below.”
  - Add structured task: Bug (ID, title, description, category), “What to do” (locate code, make at least one change, pass project check), and on retry “Previous attempt failed verification” with last error.
  - Run dev agent (Planner → Coder → Reviewer, LangGraph + Claude, MCP filesystem scoped to clone).
- **Retries:** Up to 3 attempts; each attempt gets the previous verify failure as context.
- **Logs:** “Step 2/5: Dev Agent analyzing…”, “Agent finished writing code changes.”

**Test mode (`test_mode: true`):**
- **Activity:** `apply_trivial_test_change`
- **Actions:** Append a comment to `README.md` (or create a small test file) so there is something to commit.
- **Logs:** “Test mode: Applying trivial change”, “Trivial change applied. Proceeding to verify.”

### Step 3 – Verify (QA)

- **Activity:** `verify_fix`
- **Actions:**
  1. **Dependencies:** If no `node_modules` in clone, run `bun install` or `npm install` (or copy from `DEV_AGENT_NODE_MODULES_PATH` if set).
  2. **Project check:** Run `bun run check` or `npm run check` (svelte-check). Pass → proceed.
  3. **Bypass (optional):** If check fails, get modified files (`git diff --name-only HEAD`) and parse error paths from check output. If **all** errors are in files **not** modified in this run → treat as pass (pre-existing errors). If any error is in a modified file → fail.
  4. **Strict mode:** If `DEV_AGENT_VERIFY_STRICT=1`, no bypass; any check failure fails verify.
- **Output:** `(True, None)` or `(False, error_message)`. On False, workflow retries from Step 2 (normal mode) or proceeds to PR anyway (test mode).
- **Logs:** “Verifying fix”, “Installing dependencies”, “Running project check”, “Step 3/5 done. Project check passed.” or “Bypassing: errors only in pre-existing files” or “Verification failed”.

### Step 4 – Create pull request

- **Activity:** `create_pull_request`
- **Actions:**
  1. `git add .` → if no changes, raise `ValueError` (no commit).
  2. `git commit -m "Fixes #{bugId}: {title}"`.
  3. `git push origin {branch_name}` (branch now appears on GitHub).
  4. Use PyGithub to create PR: title “Fix: {title} (Bug #{bugId})”, base `main`, head `branch_name`.
- **Output:** `pr_url` (e.g. `https://github.com/org/repo/pull/123`).
- **Logs:** “Committing and pushing branch”, “Creating pull request on GitHub”, “Step 4/5 done. PR: …”.

### Step 5 – Update bug ticket (PR link or error)

- **Activity:** `update_bug_ticket`
- **Actions:**
  - **On success:** Insert into `phwb_bug_comments`: content “✅ **Dev Agent** completed a fix and raised a Pull Request. Please review it here: {pr_url}”; update `phwb_bugs.status` to `review`.
  - **On failure:** Insert into `phwb_bug_comments`: content “❌ **Dev Agent** encountered an error: …” (internal).
- **Logs:** “Posting PR link to Comments”, “Step 5/5 done. PR link posted; status → Review. All done!” or “Error posted to Comments”.

---

## 4. QA Summary

| Gate | What runs | Pass condition | Bypass / notes |
|------|-----------|----------------|----------------|
| **Project check** | `bun run check` / `npm run check` (svelte-check) | Exit code 0 | Yes: if all reported errors are in unmodified files. |
| **Strict mode** | Same | No bypass when `DEV_AGENT_VERIFY_STRICT=1` | N/A |
| **Future: Playwright** | Optional `test:e2e:smoke` after check (see PLAYWRIGHT_HARNESS_PLAN.md) | All smoke tests pass | Planned; opt-in via `DEV_AGENT_RUN_E2E=1`. |

---

## 5. Outcome in PHWB (Comments tab)

**Data flow:**
- voiceaiagentv5 writes one row into **`phwb_bug_comments`** (same table used by normal comments).
- Bug detail page load already fetches `phwb_bug_comments` for that bug and passes them to **Comments** tab.

**User experience:**
- User opens the bug → clicks **Comments** tab.
- Sees the new comment: either the PR link (clickable) or the error message.
- PR link opens in a new tab (target="_blank", rel="noopener noreferrer").

**Technical:**
- Server: `src/routes/bugs/[id]/+page.server.ts` loads comments; `BugCommentList` renders them; URLs in comment content are linkified in `BugCommentList.svelte`.

---

## 6. End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHWB (phwb-testrepo)                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. User opens bug #N → Clicks "Initiate dev fix"                                │
│  2. POST /api/dev/fix { id, title, description, category, status }               │
│  3. Agent activity polls GET /api/bugs/N/dev-logs (every 2s)                     │
└───────────────────────────────────────────┬─────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  voiceaiagentv5 (Temporal + FastAPI)                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Step 1  setup_repository     → Clone repo, create branch                        │
│  Step 2  analyze_and_code     → Repo context (CLAUDE.md) + agent → code changes  │
│          (or apply_trivial_test_change if test_mode)                             │
│  Step 3  verify_fix           → Install deps, run project check (QA gate)         │
│          ↑_____________________________ retry up to 3x if fail _________________│
│  Step 4  create_pull_request  → Commit, push, open PR on GitHub                  │
│  Step 5  update_bug_ticket    → Insert comment (PR link or error) + set status   │
└───────────────────────────────────────────┬─────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Supabase (PHWB DB)                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  phwb_dev_logs     ← Live logs (step, message, level) for Agent activity        │
│  phwb_bug_comments ← One new row: PR link or error message                      │
│  phwb_bugs         ← status = 'review' on success                                │
└───────────────────────────────────────────┬─────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHWB – User sees result                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Comments tab → New comment with clickable PR link (or error).                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Key Files and References

| Purpose | Location |
|--------|----------|
| Trigger (button + API call) | phwb-testrepo: `src/routes/bugs/[id]/+page.svelte`, `dev-fix-simulation/+page.svelte` |
| Dev logs API (get/delete) | phwb-testrepo: `src/routes/api/bugs/[id]/dev-logs/+server.ts` |
| Comments tab + linkify | phwb-testrepo: `src/routes/bugs/[id]/components/BugDetailTabs.svelte`, `BugCommentList.svelte` |
| Workflow orchestration | voiceaiagentv5: `app/workflows/dev_fix.py` |
| Activities (setup, code, verify, PR, update) | voiceaiagentv5: `app/activities/dev_activities.py` |
| Instruction (harness / repo context) | voiceaiagentv5: `_build_dev_fix_instruction()` in dev_activities.py |
| Dev agent (Planner/Coder/Reviewer) | voiceaiagentv5: `app/agents/dev_agent.py` |
| Playwright in harness (plan) | phwb-testrepo: `docs/PLAYWRIGHT_HARNESS_PLAN.md` |

---

## 8. Optional and Test Flows

- **Test mode:** Send `test_mode: true` (e.g. `npm run test-repo` from phwb-testrepo). Skips LLM; applies trivial change → verify → PR. Use for pipeline validation only.
- **Clear logs:** Button in Agent activity calls `DELETE /api/bugs/[id]/dev-logs` and clears the list.
- **Clean test bugs:** `npm run clean:test-bugs` (phwb-testrepo) deletes bugs with titles `[Script Test]…` or `[Dev Fix Test]…` and their comments.

---

*This report summarizes the full flow from trigger to PR link for the Dev Fix feature. For deployment and env, see DEPLOYMENT_DEV_FIX.md; for Playwright in the harness, see PLAYWRIGHT_HARNESS_PLAN.md.*
