# What Happens When You Click "Initiate dev fix"

Step-by-step flow from the button click to the PR link (or error) in the bug’s **Comments** tab.

---

## 1. In PHWB (browser)

**Where:** Bug detail page (`/bugs/[id]`) or the simulation page (`/bugs/dev-fix-simulation`).

**On click:**

1. The **Initiate dev fix** button calls `initiateDevFix()`.
2. The UI shows loading (e.g. “Starting workflow…”), and the button is disabled.
3. The app builds the request:
   - **URL:** `POST {PUBLIC_VOICE_AGENT_URL}/api/dev/fix` (e.g. `http://localhost:8000/api/dev/fix`).
   - **Body (JSON):**  
     `id`, `title`, `description`, `category`, `status` of the current bug.
4. The browser sends this **POST** (cross-origin to voiceaiagentv5; CORS is allowed).
5. When the response comes back:
   - **Success (HTTP 200):**  
     Response is `{ "status": "started", "workflow_id": "dev-fix-workflow-6-1234567890" }`.  
     The UI stores `workflow_id` and clears loading. The **workflow has only been started**; it keeps running on the server.
   - **Error (4xx/5xx or network failure):**  
     The UI shows an error message (e.g. “Cannot reach the dev fix backend…” or the API error detail).

So at this point you have only **started** a workflow. The rest runs asynchronously on the voiceaiagentv5 side.

---

## 2. In voiceaiagentv5 (FastAPI)

**Endpoint:** `POST /api/dev/fix` (in `app/main.py`).

**What happens:**

1. The request body is validated as `BugFixRequest` (id, title, description, category, status).
2. The server gets the **Temporal client** (connected to your Temporal server, e.g. `localhost:7233`).
3. If Temporal is not connected → **503** and the message you see in PHWB.
4. It generates a unique **workflow ID:**  
   `dev-fix-workflow-{bug_id}-{unix_timestamp}`  
   (e.g. `dev-fix-workflow-6-1773631986`).
5. It **starts a workflow** on Temporal:
   - Workflow type: `DevFixWorkflow.run`
   - Argument: the bug payload (as a dict)
   - Task queue: `voiceai-email-queue-v3`
   - ID: the one above
6. It returns **200** with `{ "status": "started", "workflow_id": "<that-id>" }`.

The HTTP request from PHWB ends here. The workflow runs in the **Temporal worker** process (same or another process), not inside this request.

---

## 3. In the Temporal worker (DevFixWorkflow)

The **worker** (running `python app/temporal_worker.py`) picks up the workflow from the task queue and runs `DevFixWorkflow.run(bug_data)`.

Rough order of steps:

| Step | Activity | What it does |
|------|----------|----------------|
| **1** | `setup_repository` | Clones the repo (e.g. from `DEV_AGENT_GITHUB_REPO_URL`), creates branch `dev-agent/bug-fix/{bug_id}-{timestamp}`. Can write to `phwb_dev_logs` for live logs. Returns `(repo_path, branch_name)`. |
| **2** | `analyze_and_code` | Builds an instruction from repo context (e.g. AGENTS.md/CLAUDE.md), harness-style guidance, and the bug (title, description, category). Runs the **dev agent** (Claude + MCP filesystem) to plan and write code. Can run up to **30 minutes**; sends heartbeats so Temporal doesn’t time out. Optionally logs to `phwb_dev_logs`. |
| **3** | `verify_fix` | In the cloned repo, runs verification (e.g. tests/lint). Returns `(success: bool, error_output)`. |
| **4** | **Loop** | If verification fails, the workflow can retry from step 2 (up to **3 attempts**) with `last_error` so the agent can fix the issue. |
| **5** | `create_pull_request` | If verification passed: `git add` / `git commit` / `git push`, then uses PyGithub to open a PR (title/body from bug). Returns the PR URL (`pr.html_url`). |
| **6** | `update_bug_ticket` | Writes back to **PHWB’s Supabase** (see below). |
| **On any failure** | `update_bug_ticket` | Called with `error_msg` instead of `pr_url`, so the bug still gets a comment with the error. |

So: clone → code (LLM) → verify (retry up to 3x) → push + open PR → update bug.

---

## 4. Writing back to PHWB (Supabase)

**Activity:** `update_bug_ticket` in `app/activities/dev_activities.py`.

It uses the **same Supabase project as PHWB** (via `DEV_AGENT_*` env vars).

**If a PR was created (`pr_url` present):**

1. **Insert** one row into `phwb_bug_comments`:
   - `bug_id` = this bug
   - `content` =  
     `"✅ **Dev Agent** completed a fix and raised a Pull Request.\n\nPlease review it here: {pr_url}"`
   - `user_id` = null, `is_internal` = false
2. **Update** `phwb_bugs` for this bug: set `status = 'review'`.

**If the workflow failed (`error_msg` present):**

1. **Insert** one row into `phwb_bug_comments`:
   - `content` =  
     `"❌ **Dev Agent** encountered an error:\n\n```\n{error_msg}\n```"`
   - `is_internal` = true

So the “result” of Initiate dev fix is always a **new comment** on the same bug (success or failure).

---

## 5. How you see the result in PHWB

- The bug detail page loads comments from `phwb_bug_comments` in `+page.server.ts`.
- The **Comments** tab renders that list (e.g. via `BugCommentList`).
- After the workflow finishes, **reload the bug page** (or re-open the Comments tab). The new comment will appear:
  - **Success:** Comment with “Dev Agent completed a fix…” and the **PR link**.
  - **Failure:** Comment with “Dev Agent encountered an error…” and the error text.

There is no live push from the workflow to the browser yet; refreshing (or a future realtime/polling on `phwb_bug_comments`) is how you see the new comment.

---

## 6. End-to-end summary

1. **Click** → PHWB sends `POST /api/dev/fix` with bug id, title, description, category, status.
2. **voiceaiagentv5** starts a Temporal workflow and returns `workflow_id`; the UI stops loading.
3. **Temporal worker** runs: clone repo → dev agent (Claude) writes code → verify (retry up to 3x) → create PR → **update_bug_ticket**.
4. **update_bug_ticket** inserts a comment in `phwb_bug_comments` (PR link or error) and, on success, sets bug status to `review`.
5. **You** open the bug’s **Comments** tab (and refresh if needed) to see the PR link or the error message.

---

## 7. Where each part lives in code

| What | Where |
|------|--------|
| Button + `initiateDevFix()` | `src/routes/bugs/[id]/+page.svelte` (and simulation page) |
| `POST /api/dev/fix` | voiceaiagentv5 `app/main.py` |
| Workflow definition | voiceaiagentv5 `app/workflows/dev_fix.py` |
| Activities (clone, code, verify, PR, update bug) | voiceaiagentv5 `app/activities/dev_activities.py` |
| Dev agent (Claude + MCP) | voiceaiagentv5 `app/agents/dev_agent.py` |
| Comments tab (display) | PHWB `src/routes/bugs/[id]/components/BugDetailTabs.svelte` → `BugCommentList` |
| Loading comments from DB | PHWB `src/routes/bugs/[id]/+page.server.ts` |
