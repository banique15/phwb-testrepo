# Harness Engineering Applied: Initiate Dev Fix

How **harness engineering** is applied to the **Initiate dev fix** feature, with PHWB as UI and voiceaiagentv5 as backend.

---

## 1. Split of responsibilities

| Layer | Role | Where |
|-------|------|--------|
| **UI** | Trigger workflow, show live logs, display bug and PR/comment updates | **PHWB** (SvelteKit): bug detail page, “Initiate dev fix” button, Agent activity panel |
| **Backend** | Run workflow, clone repo, run dev agent, verify, open PR, write to Supabase | **voiceaiagentv5** (FastAPI + Temporal): `POST /api/dev/fix`, `DevFixWorkflow`, activities |
| **Source of truth for the agent** | Repo the agent clones and edits (context, conventions, architecture) | **PHWB repo** (the codebase being fixed): `AGENTS.md`, `CLAUDE.md`, `docs/` |

PHWB does not run the agent; it only sends the bug payload and displays results. The agent runs inside voiceaiagentv5 and operates on a **clone of the PHWB repo**.

---

## 2. Harness practices applied

### 2.1 Repository as system of record (target repo = PHWB)

- The **repo that gets cloned** (PHWB) is the agent’s source of truth.
- **AGENTS.md** at repo root is the **map**: short, points to CLAUDE.md and docs/. No single giant instruction file.
- **CLAUDE.md** holds project overview, architecture, and conventions.
- **docs/** holds deeper context (guides, planning, specs). See `docs/README.md` and `docs/HARNESS_ENGINEERING_AND_SYMPHONY.md`.

So when the dev agent clones PHWB, it sees AGENTS.md → CLAUDE.md → docs/ (progressive disclosure).

### 2.2 Progressive disclosure (backend prompt)

- In **voiceaiagentv5** (`app/activities/dev_activities.py`), the instruction sent to the dev agent is built with:
  1. **Optional repo-owned prefix**: if the clone contains `.dev-agent/instruction-prefix.md` or `AGENTS.md`, the first ~4k chars are prepended so the repo can define policy.
  2. **Harness guidance**: “This codebase uses repository-as-source-of-truth. Read AGENTS.md (or CLAUDE.md). Use docs/ as needed. Then implement the following bug fix.”
  3. **Bug task**: Fix Bug #id, title, description, category, and optional “previous attempt failed with …”.

So the agent is told to **read the map and docs first**, then execute the bug fix (environment over “try harder”).

### 2.3 Agent legibility

- The agent’s context is **in the clone**: code, AGENTS.md, CLAUDE.md, docs/. No dependency on Slack or out-of-repo docs.
- PHWB’s **live logs** come from `phwb_dev_logs` (written by voiceaiagentv5). The UI can subscribe later for real-time updates so humans see what the agent is doing without supervising the run.

### 2.4 Agent-to-agent review (already in place)

- The dev agent pipeline in voiceaiagentv5 is **Planner → Coder → Reviewer**; the reviewer approves or sends back feedback. That’s agent-to-agent review; humans only step in at PR review in GitHub.

### 2.5 Throughput / merge philosophy

- The workflow opens a PR and moves the bug to “review”; verification can be lenient (e.g. optional `npm run check`). Optimizing for “fix fast, iterate in PR” rather than “block until perfect” aligns with harness.

### 2.6 Human feedback → system (future)

- When humans comment on the PR or close the bug, that knowledge is today in GitHub/PHWB. To fully apply “human feedback → system,” you could later:
  - Copy salient review comments or post-mortems into `docs/` or into a `.dev-agent/` file so the next run sees them.
  - Encode recurring corrections as lint rules or tests in the repo so the agent obeys them mechanically.

---

## 3. Current integration flow

1. **User (PHWB):** Opens bug detail → clicks “Initiate dev fix.”
2. **PHWB:** `POST` to `{PUBLIC_VOICE_AGENT_URL}/api/dev/fix` with `{ id, title, description, category, status }`.
3. **voiceaiagentv5:** Starts `DevFixWorkflow` (Temporal).
4. **Workflow:** Clone PHWB repo → checkout branch `dev-agent/bug-fix/{id}-{ts}` → run dev agent with **harness-style instruction** (map + task) → verify → commit/push → open PR → update `phwb_bugs` / `phwb_bug_comments` / `phwb_dev_logs`.
5. **PHWB:** User sees success/error and workflow id; can later show live logs from `phwb_dev_logs` and new comment/PR link from `phwb_bug_comments`.

---

## 4. Files that implement this

| Purpose | Location |
|--------|----------|
| Agent map (repo as source of truth) | **phwb:** `AGENTS.md` |
| Project + architecture (agent context) | **phwb:** `CLAUDE.md`, `docs/` |
| Harness-style prompt builder | **voiceaiagentv5:** `app/activities/dev_activities.py` (`_build_dev_fix_instruction`) |
| Repo-owned policy (optional) | **phwb:** `.dev-agent/instruction-prefix.md` (optional) or AGENTS.md content used as prefix |
| Trigger + live logs UI | **phwb:** `src/routes/bugs/[id]/+page.svelte` (Dev Agent section) |
| API + workflow | **voiceaiagentv5:** `app/main.py` (`POST /api/dev/fix`), `app/workflows/dev_fix.py`, activities |

---

## 5. Optional: repo-owned instruction prefix

To push more policy into the repo (harness: “repository as system of record”):

- Add **phwb/.dev-agent/instruction-prefix.md**.
- The backend will prepend its contents (up to ~4k chars) to the instruction when present.
- Use it for things like: “Always run `bun run check` before considering the fix done,” or “For payroll bugs, read `docs/guides/payroll/` first.”

No change to PHWB UI required; only the cloned repo content and the backend prompt builder use it.
