# Dev Fix: Local vs Deployed (No Local Attachment Required)

The dev-fix flow is **fully driven by environment variables**. You can run everything locally today and switch to a deployed setup later by changing env only—no code changes.

---

## 1. Switching anytime

| Mode | What you do |
|------|-------------|
| **Local** | PHWB and voiceaiagentv5 run on your machine. Use `PUBLIC_VOICE_AGENT_URL=http://localhost:8000` (PHWB) and default Temporal URL (voiceaiagentv5). |
| **Deployed** | PHWB and/or voiceaiagentv5 run on servers. Set PHWB’s `PUBLIC_VOICE_AGENT_URL` to the deployed API URL, and in voiceaiagentv5 set `TEMPORAL_URL` and `CORS_ORIGINS` (see below). |

There is **no “attached locally” requirement**. The same codebase works in both modes.

---

## 2. PHWB (phwb-testrepo) — env for dev-fix

| Variable | Local | Production |
|----------|------|------------|
| `PUBLIC_VOICE_AGENT_URL` | `http://localhost:8000` | `https://your-voice-agent-api.example.com` (no trailing slash) |

- The bug detail and dev-fix simulation pages call this URL for `POST /api/dev/fix`.
- Build-time / server: set in `.env` or your host’s env (e.g. Vercel, Netlify, or your app server). SvelteKit exposes it via `$env/static/public` or `$env/dynamic/public`.

---

## 3. voiceaiagentv5 — env for dev-fix and deployment

| Variable | Local | Production |
|----------|--------|------------|
| `TEMPORAL_URL` | `localhost:7233` (default) or unset | Your Temporal server (e.g. `namespace.tmprl.cloud:7233` for Temporal Cloud, or your self-hosted host:port) |
| `CORS_ORIGINS` | Unset (defaults to localhost origins) | Comma-separated list of allowed origins, e.g. `https://phwb.example.com,https://admin.singforhope.org` |
| `DEV_AGENT_NODE_MODULES_PATH` | Optional: path to PHWB `node_modules` to speed up verify | **Leave unset.** The worker runs `bun install` / `npm install` in the clone and then `bun run check` / `npm run check`. |
| `DEV_AGENT_GITHUB_REPO_URL` | Your repo (e.g. `https://github.com/org/phwb.git`) | Same; use the repo that will receive the fix branches and PRs. |
| `DEV_AGENT_GITHUB_ACCESS_TOKEN` | GitHub token with repo access | Same; use a token valid in the deployment environment. |
| `DEV_AGENT_SUPABASE_URL` / `DEV_AGENT_SUPABASE_SERVICE_KEY` | Supabase project that has `phwb_bugs`, `phwb_bug_comments`, `phwb_dev_logs` | Same project (or production Supabase) so the worker can update bugs and add comments. |

**Notes:**

- **Temporal:** Locally you can run `temporal server start-dev` (Temporal CLI). In production you need Temporal available (Temporal Cloud or self-hosted) and the worker started with the same `TEMPORAL_URL`.
- **CORS:** If PHWB is served from a different origin than the voiceaiagentv5 API, set `CORS_ORIGINS` to that origin (or list of origins). Otherwise the browser will block the `POST /api/dev/fix` request.

---

## 4. Deployment checklist (when you deploy)

**PHWB (frontend + optional server):**

- [ ] Set `PUBLIC_VOICE_AGENT_URL` to the deployed voiceaiagentv5 API base URL.
- [ ] Ensure Supabase (and any other) env vars are set for the deployment environment.

**voiceaiagentv5 (API + worker):**

- [ ] Set `TEMPORAL_URL` to your production Temporal address.
- [ ] Set `CORS_ORIGINS` to your PHWB frontend origin(s), e.g. `https://your-phwb-domain.com`.
- [ ] Leave `DEV_AGENT_NODE_MODULES_PATH` unset (worker will install deps in the clone).
- [ ] Ensure `DEV_AGENT_GITHUB_*` and `DEV_AGENT_SUPABASE_*` (and `ANTHROPIC_API_KEY`) are set for the deployment environment.
- [ ] Run the Temporal worker in the same environment (same process, or separate worker process) so it can connect to `TEMPORAL_URL` and execute the dev-fix workflow.

---

## 5. Summary

- **No local attachment:** Everything is configurable via env; the same repo works locally and deployed.
- **Switch anytime:** Change env (e.g. `PUBLIC_VOICE_AGENT_URL`, `TEMPORAL_URL`, `CORS_ORIGINS`) to move from local to deployed or back.
- **Production:** Set CORS to your real frontend origin(s), point PHWB to your deployed API URL, and run the worker against your production Temporal.
