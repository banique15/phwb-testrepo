# Dev Fix & E2E Setup Guide

Setup and run the dev-fix flow (Initiate dev fix, Playwright QA): repos, branches, links, and env.

---

## 1. Repositories and branches

| Repo | Purpose | Branch with this work | Clone / PR |
|------|---------|------------------------|------------|
| **phwb-testrepo** (PHWB app) | SvelteKit app: bugs, Initiate dev fix, Playwright E2E | `initiate-dev-fix` | `https://github.com/banique15/phwb-testrepo` |
| **voiceaiagentv5** (Dev Agent backend) | Temporal workflow, verify_fix, optional E2E (only UI) | `adjudication-invite-temporal` | `https://github.com/jessebautista/voiceaiagentv5` |

**Checkout for local dev:**

```bash
# PHWB (app under test)
git clone https://github.com/banique15/phwb-testrepo.git
cd phwb-testrepo
git checkout initiate-dev-fix

# Dev Agent (API + worker)
git clone https://github.com/jessebautista/voiceaiagentv5.git
cd voiceaiagentv5
git checkout adjudication-invite-temporal
```

*(Replace with your own fork URLs/branch names if you’ve diverged.)*

---

## 2. Key links

| What | Link / path |
|------|-------------|
| **Database (Supabase)** | Dashboard: https://supabase.com/dashboard/project/aytecziiyzwsjzzssfxc — use **Settings → API** for project URL, anon key, and service role key. Same project for PHWB and voiceaiagentv5 (tables: `phwb_bugs`, `phwb_bug_comments`, `phwb_dev_logs`). |
| **Dev fix simulation** (test without opening a bug) | In PHWB: `/bugs/dev-fix-simulation` → e.g. `http://localhost:5173/bugs/dev-fix-simulation` |
| **Initiate dev fix** (from a bug) | Bug detail page → “Dev Agent” section → **Initiate dev fix** |
| **Plan: Playwright only for UI changes** | phwb-testrepo: `docs/PLAYWRIGHT_UI_ONLY_QA_PLAN.md` |
| **Dev fix flow (steps, comments, status)** | phwb-testrepo: `docs/DEV_FIX_FLOW.md` |
| **Running the backend (Temporal + API + worker)** | voiceaiagentv5: `docs/DEV_FIX_RUN.md` |
| **Deployment / env (local vs prod)** | phwb-testrepo: `docs/DEPLOYMENT_DEV_FIX.md` |

---

## 3. Environment variables — .env we use (structure)

Below are the **exact .env structures** used in each project. Values marked with `<...>` are **secrets** — share them only via a secure channel (e.g. 1Password, secure chat). Do not commit real keys into the repo.

---

### 3.1 PHWB (phwb-testrepo) — `.env`

```bash
# ----------- DEVELOPMENT (TEST PROJECT) -----------
# Dev fix: URL of voiceaiagentv5 API. Local: backend on this machine. Production: set to deployed API URL (no trailing slash).
PUBLIC_VOICE_AGENT_URL=http://localhost:8000
# PUBLIC_VOICE_AGENT_URL=https://your-voice-agent-api.example.com

PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# ----------- PRODUCTION (DO NOT USE FOR TESTING) -----------
# PUBLIC_SUPABASE_URL=https://other-project.supabase.co
# PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
# SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_VOICE_AGENT_URL` | Yes (for dev fix) | Base URL of voiceaiagentv5 API. Local: `http://localhost:8000`. |
| `PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (replace `YOUR_PROJECT_REF` with your project ref). |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | For server-side/scripts (e.g. seed-test, clean-test-bugs). |

---

### 3.2 voiceaiagentv5 — `.env`

```bash
# Required for the agent (LLM) — used by other features; dev-fix uses ANTHROPIC below
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o-mini

# DEV AGENT — phwb bug fixing (same Supabase project as PHWB)
DEV_AGENT_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
DEV_AGENT_SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>

# Server
HOST=0.0.0.0
PORT=8000

# ----------- Deployment (dev-fix): switch for local vs production -----------
# TEMPORAL_URL=localhost:7233
# CORS_ORIGINS=https://phwb.example.com,https://admin.singforhope.org
# DEV_AGENT_NODE_MODULES_PATH=/path/to/phwb-testrepo/node_modules

# Resend Email (if using email features)
RESEND_API_KEY=<your-resend-api-key>

# GitHub — dev agent clones this repo and opens PRs
DEV_AGENT_GITHUB_ACCESS_TOKEN=<your-github-token>
DEV_AGENT_GITHUB_REPO_URL=https://github.com/banique15/phwb-testrepo.git

# LLM for the dev agent (required for real fixes; optional for test_mode)
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

**Optional (uncomment to use):**

- `DEV_AGENT_RUN_E2E=1` — run Playwright smoke when changes are only UI.
- `DEV_AGENT_E2E_ALWAYS=1` — run E2E even when not only UI.
- `DEV_AGENT_NODE_MODULES_PATH` — local path to phwb-testrepo `node_modules` to speed up verify.
- `DEV_AGENT_VERIFY_STRICT=1` — fail verify on any check failure (no bypass).

| Variable | Required | Description |
|----------|----------|-------------|
| `DEV_AGENT_GITHUB_REPO_URL` | Yes | Repo to clone and open PRs (e.g. phwb-testrepo or your fork). |
| `DEV_AGENT_GITHUB_ACCESS_TOKEN` | Yes | GitHub token with repo access. |
| `DEV_AGENT_SUPABASE_URL` | Yes | Same Supabase project as PHWB. |
| `DEV_AGENT_SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (same project). |
| `ANTHROPIC_API_KEY` | Yes (for real fixes) | For dev agent LLM; not needed if only using `test_mode`. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | For other features | Used by non–dev-fix parts of the app. |
| `RESEND_API_KEY` | Optional | For email (Resend). |
| `TEMPORAL_URL` | Optional | Default `localhost:7233` for local Temporal. |
| `CORS_ORIGINS` | When PHWB on other domain | Comma-separated frontend origins. |

**Sharing with colleagues:** Send the values for `<your-supabase-anon-key>`, `<your-supabase-service-role-key>`, `<your-github-token>`, and `<your-anthropic-api-key>` through a secure channel (e.g. 1Password vault, encrypted chat). Use the same Supabase project ref in both PHWB and voiceaiagentv5 so bugs, comments, and dev logs line up.

---

## 4. Quick start (local)

1. **PHWB**
   - Clone phwb-testrepo, checkout `initiate-dev-fix`, copy `.env` from section 3.1 and fill in.
   - `bun install` (or `npm install`), then `bun dev` (or `npm run dev`).

2. **voiceaiagentv5**
   - Clone voiceaiagentv5, checkout `adjudication-invite-temporal`, copy `.env` from section 3.2 and fill in.
   - Install Temporal CLI (e.g. `brew install temporal`), then start: `temporal server start-dev`.
   - In voiceaiagentv5: `python -m venv .venv`, `.venv/bin/pip install -r requirements.txt`.
   - Run API + worker: `./scripts/run_dev_fix.sh` (or run uvicorn + worker in two terminals; see `docs/DEV_FIX_RUN.md`).

3. **Test**
   - Open `http://localhost:5173/bugs/dev-fix-simulation` → create a test issue → Load bug → **Initiate dev fix**.
   - Check the bug’s **Comments** tab for the PR link (or error).

---

## 5. E2E (Playwright) summary

- **phwb-testrepo** has a `smoke` project: `npx playwright test --project=smoke` (or `bun run test:e2e:smoke`).
- **voiceaiagentv5** runs this only when `DEV_AGENT_RUN_E2E` is set and the agent’s changes are **only UI** (or when `DEV_AGENT_E2E_ALWAYS=1`).
- Full plan: `docs/PLAYWRIGHT_UI_ONLY_QA_PLAN.md`.

---

*Update the repo URLs and branch names above if your team uses different forks or branches.*
