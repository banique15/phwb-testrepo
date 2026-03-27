# voiceaiagentv5 — Review (with Dev Fix & PHWB integration)

Review of the **voiceaiagentv5** project in the same workspace, with focus on the **Initiate dev fix** flow and how it ties to PHWB.

---

## 1. Project overview

- **Stack:** FastAPI (Python), LangChain/LangGraph, Anthropic Claude, ElevenLabs (voice), Temporal (workflows), optional Supabase/Redis/Pinecone.
- **Role:** AI agent service with:
  - **Chat** (`/chat`) and **Voice** (`/voice` — Live Connect).
  - **Workspace** (`/workspace`) to edit prompts, tools, welcome message.
  - **Dev fix workflow:** Temporal workflow that clones repo → runs dev agent → verifies → opens PR → updates bug in Supabase.

---

## 2. Dev fix feature (Initiate dev fix)

### 2.1 API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| **`/api/dev/fix`** | POST | Start the dev-fix workflow for a bug. |

**Request body** (`BugFixRequest` in `app/main.py`):

```json
{
  "id": 123,
  "title": "Bug title",
  "description": "Bug description",
  "category": "UI/UX",
  "status": "new"
}
```

**Response (success):** `{"status": "started", "workflow_id": "dev-fix-workflow-123-<timestamp>"}`

**CORS:** `main.py` allows `http://localhost:5173` and `http://localhost:4173` (PHWB Vite dev/preview), so the PHWB frontend can call this API.

### 2.2 Workflow: `DevFixWorkflow` (`app/workflows/dev_fix.py`)

1. **Setup repository** (`setup_repository`)  
   - Clones repo from `DEV_AGENT_GITHUB_REPO_URL` (default `https://github.com/singforhope/phwb.git`) using `DEV_AGENT_GITHUB_ACCESS_TOKEN`.  
   - Creates branch `dev-agent/bug-fix/{bug_id}-{timestamp}`.  
   - Writes progress to **`phwb_dev_logs`** in Supabase (for live UI).

2. **Analyze & code** (up to 3 attempts)  
   - **`analyze_and_code`** calls **`run_dev_agent(repo_path, prompt)`** (`app/agents/dev_agent.py`).  
   - Prompt: `Fix Bug #{id}: {title}\nDescription: {description}\nCategory: {category}` (+ previous error if retry).  
   - **`verify_fix`** runs checks in the clone (e.g. `npm run check`; currently can skip or use a local `node_modules` copy on Windows).

3. **Create pull request** (`create_pull_request`)  
   - Commits, pushes branch, creates GitHub PR via PyGithub.  
   - Returns PR URL.

4. **Update bug ticket** (`update_bug_ticket`)  
   - **On success:** Inserts a comment into **`phwb_bug_comments`** with the PR link; updates **`phwb_bugs`** `status` to `"review"`.  
   - **On failure:** Inserts an error comment (e.g. `is_internal: true`).

Supabase access uses **`DEV_AGENT`** prefix: `DEV_AGENT_SUPABASE_URL`, `DEV_AGENT_SUPABASE_SERVICE_KEY` (see `app/supabase_client.py`). These should point to the **same** Supabase project as PHWB so `phwb_bugs`, `phwb_bug_comments`, and `phwb_dev_logs` are the same DB.

### 2.3 Dev agent (`app/agents/dev_agent.py`)

- **Pipeline:** LangGraph: **Planner → Coder → Reviewer** (loop until Reviewer says "APPROVED").
- **Model:** Claude (`claude-sonnet-4-5-20250929`), with **MCP filesystem** (`@modelcontextprotocol/server-filesystem`) over the cloned repo path.
- **Tools:** MCP read/write files + custom `get_git_diff` (git diff in repo).
- **Planner:** Explores repo, produces a detailed markdown plan (file paths + logic).  
- **Coder:** Applies plan using `write_file`; can be sent back with reviewer feedback.  
- **Reviewer:** Uses `get_git_diff`, responds APPROVED or REJECTED + feedback.

### 2.4 Temporal

- **Client:** `app/temporal_client.py` — connects at startup to `TEMPORAL_URL` (default `localhost:7233`).
- **Worker:** `app/temporal_worker.py` — task queue **`voiceai-email-queue-v3`**, runs `DevFixWorkflow` and all dev activities.
- **Starting a fix:** `main.py` calls `client.start_workflow(DevFixWorkflow.run, body.dict(), id=workflow_id, task_queue="voiceai-email-queue-v3")`.  
So the **API** starts the workflow; the **worker** must be running separately to execute it.

---

## 3. PHWB ↔ voiceaiagentv5 integration (current state)

| Aspect | Where it lives | Status |
|--------|----------------|--------|
| **Trigger** | PHWB bug single page | ❌ No “Initiate dev fix” button; no call to `/api/dev/fix`. |
| **API** | voiceaiagentv5 `POST /api/dev/fix` | ✅ Implemented; accepts bug id, title, description, category, status. |
| **CORS** | voiceaiagentv5 `main.py` | ✅ Allows `localhost:5173` / `4173` (PHWB). |
| **Supabase** | voiceaiagentv5 `DEV_AGENT_*` | ✅ Writes to `phwb_bugs`, `phwb_bug_comments`, `phwb_dev_logs` (same project as PHWB). |
| **Dev logs UI** | PHWB | ❌ No UI yet for `phwb_dev_logs` (streaming/live log view). |

So: the **backend** for “initiate dev fix” is in voiceaiagentv5; the **frontend** in PHWB (button + optional dev-log view) is missing.

---

## 4. Relevant env (voiceaiagentv5)

- **Temporal:** `TEMPORAL_URL` (default `localhost:7233`). Worker must run with same queue `voiceai-email-queue-v3`.
- **Dev fix / Supabase:**  
  `DEV_AGENT_SUPABASE_URL`, `DEV_AGENT_SUPABASE_SERVICE_KEY` — same Supabase as PHWB.  
  `DEV_AGENT_GITHUB_ACCESS_TOKEN`, optionally `DEV_AGENT_GITHUB_REPO_URL`.
- **Dev agent (Claude/MCP):** `ANTHROPIC_API_KEY`.
- **Verify step:** `dev_activities.verify_fix` uses a hardcoded Windows path for copying `node_modules`; other environments may need to adjust or skip.

---

## 5. Other voiceaiagentv5 pieces

- **Chat/Voice:** `/chat`, `/voice`, `/voice/tts`, `/voice/stt`, `/voice/welcome` — receptionist-style agent + ElevenLabs (`ELEVENLABS_API_KEY`).
- **Workspace:** `/api/workspace/config` (GET/PATCH) — prompt key, overrides, enabled tools, welcome message; stored under `data/workspace_config.json` and `data/prompt_overrides/`.
- **Other workflows:** Invitation and Agreed workflows (email flows) on the same worker and queue.

---

## 6. Summary: what’s in voiceaiagentv5 vs PHWB

- **voiceaiagentv5** implements:
  - **POST /api/dev/fix** with `BugFixRequest`.
  - **DevFixWorkflow** (clone → dev agent → verify → PR → update `phwb_bugs` / `phwb_bug_comments` / `phwb_dev_logs`).
  - Dev agent (Planner/Coder/Reviewer) and Temporal worker on `voiceai-email-queue-v3`.
- **PHWB** currently has:
  - No “Initiate dev fix” button on the bug detail page.
  - No call to the voiceaiagentv5 API.
  - No UI for `phwb_dev_logs`.

To complete the integration from PHWB: add an **“Initiate dev fix”** button on the bug single page that POSTs to the voiceaiagentv5 base URL (e.g. `VITE_VOICE_AGENT_URL` or `PUBLIC_VOICE_AGENT_URL`) + `/api/dev/fix` with the current bug’s `id`, `title`, `description`, `category`, `status`. Optionally add a “Dev agent log” section that reads from `phwb_dev_logs` for that bug.
