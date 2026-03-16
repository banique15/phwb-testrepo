# Harness Engineering & Symphony — Reference for Future Use

A distilled review of OpenAI’s **Harness Engineering** and **Symphony** so you can apply these ideas in future projects.

---

## Part 1: Harness Engineering

**Source:** [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) (OpenAI, Feb 2026)

### Core idea

- **Humans steer. Agents execute.**  
  The team built a product with **0 lines of manually-written code**; every line (app, tests, CI, docs, observability, tooling) was written by Codex.
- Engineering’s job shifts from “writing code” to **designing environments, specifying intent, and building feedback loops** so agents can do reliable work.

### Practices to apply

| Practice | What it means | How to apply |
|----------|----------------|--------------|
| **Environment over “try harder”** | When the agent fails, fix **missing capability** (tools, abstractions, structure), not prompts alone. Ask: “What is missing, and how do we make it legible and enforceable for the agent?” | Add tools, docs, and structure; avoid endless prompt tweaking. |
| **Depth-first enablement** | Break big goals into small building blocks; have the agent build those blocks; use them to unlock harder tasks. | Design tasks as a chain of small, verifiable steps. |
| **Agent-to-agent review** | Use the agent to review its own (or others’) changes; humans review only when needed. | Automate PR review with agents; use a “Ralph Wiggum Loop” (review → fix → re-review until satisfied). |
| **Application legibility** | Make UI, logs, and metrics **directly readable by the agent** (e.g. Chrome DevTools Protocol, LogQL, PromQL). | Expose DOM, logs, metrics to the agent so it can validate behavior and fix bugs. |
| **Repository as system of record** | All context lives in the repo: code, docs, schemas, plans. External tools (Slack, Google Docs) are invisible to the agent. | Version design, plans, and references in `docs/`; keep a short `AGENTS.md` as a map, not an encyclopedia. |
| **Progressive disclosure** | One short entry point (e.g. ~100-line `AGENTS.md`) that points to deeper docs. Avoid one giant instruction blob. | `AGENTS.md` = table of contents; real knowledge in `docs/` (design-docs, exec-plans, product-specs, references). |
| **Mechanical enforcement** | Use linters and CI to keep docs fresh, cross-linked, and structured. Use “doc-gardening” agents to fix stale docs. | Lint docs; CI checks coverage/freshness/links; recurring agent tasks to fix drift. |
| **Strict boundaries, local freedom** | Enforce architecture (layers, dependency direction, providers) mechanically; allow freedom inside those boundaries. | Custom linters + structural tests for layers and dependencies; taste invariants (logging, naming, file size). |
| **Agent legibility first** | Optimize for what the agent can **see and reason about** in-context. Prefer “boring,” well-documented tech; sometimes reimplement instead of opaque libraries. | Choose stack and deps the agent can fully understand; document boundaries and data shapes. |
| **Throughput changes merge philosophy** | High agent throughput makes “fix fast” better than “block until perfect.” Short-lived PRs, follow-up fixes for flakes, minimal blocking gates. | Optimize for iteration speed; use gates only where they clearly prevent real harm. |
| **Entropy / garbage collection** | Encode “golden principles” in the repo; run recurring cleanup agents to fix drift, update quality grades, open refactor PRs. | Recurring background tasks that scan for violations and open small, reviewable PRs. |
| **Human feedback → system** | Capture review comments, bugs, and taste as doc updates or tooling; when docs aren’t enough, promote the rule into code. | Turn human corrections into lints, tests, or docs so the agent can follow them. |

### Suggested repo layout (from the article)

- **`AGENTS.md`** — Short map (~100 lines), pointers to truth elsewhere.
- **`docs/`** — System of record:
  - `design-docs/` (index, core-beliefs, …)
  - `exec-plans/` (active/, completed/, tech-debt-tracker.md)
  - `generated/` (e.g. db-schema.md)
  - `product-specs/` (index, feature specs)
  - `references/` (LLM-oriented reference docs)
  - Top-level: `DESIGN.md`, `ARCHITECTURE.md`, `PLANS.md`, `PRODUCT_SENSE.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, `SECURITY.md`

### Pitfalls to avoid

- **One big AGENTS.md** — Hard to verify, rots quickly, overwhelms context, becomes “non-guidance.”
- **Knowledge only in Slack/Docs/heads** — Invisible to the agent; treat as non-existent for the system.
- **Fixing by “try harder”** — Fix the environment (tools, structure, docs) instead.

---

## Part 2: Symphony

**Sources:**  
- [Symphony README](https://github.com/openai/symphony)  
- [Symphony SPEC](https://github.com/openai/symphony/blob/main/SPEC.md)

### Core idea

- **Symphony** turns **project work** (e.g. from an issue tracker) into **isolated, autonomous implementation runs**.
- Teams **manage work** (backlog, priorities, acceptance) instead of **supervising coding agents** (no need to babysit each run).
- **Prerequisite:** Works best in codebases that already use **harness engineering** (repo as source of truth, agent-legible docs, clear boundaries).

### What Symphony is

- A **long-running service** that:
  1. **Polls** an issue tracker (e.g. Linear) on a cadence.
  2. **Selects** issues in “active” states (e.g. Todo, In Progress).
  3. **Creates** one **isolated workspace per issue** (directory per issue).
  4. **Runs** a **coding agent** (e.g. Codex app-server) inside that workspace.
  5. **Tracks** runs, retries, and handoff (e.g. to “Human Review” or “Done”).

- **Policy lives in-repo:** `WORKFLOW.md` defines the workflow (YAML config + prompt template). No out-of-band config required for the workflow itself.

### Main components (from SPEC)

| Component | Role |
|-----------|------|
| **Workflow Loader** | Reads `WORKFLOW.md`, parses YAML front matter + prompt body. |
| **Config Layer** | Typed config, env indirection, validation before dispatch. |
| **Issue Tracker Client** | Fetches candidates, states, terminal issues; normalizes to stable issue model. |
| **Orchestrator** | Poll tick, in-memory state, dispatch/retry/stop/release, session metrics. |
| **Workspace Manager** | Issue → workspace path, create/reuse/clean, lifecycle hooks. |
| **Agent Runner** | Build prompt from issue + template, launch coding agent (e.g. Codex), stream events. |
| **Status / Logging** | Operator-visible status and structured logs. |

### Repository contract: `WORKFLOW.md`

- **Location:** Repo-owned, version-controlled; default path `WORKFLOW.md` in process cwd.
- **Format:** Optional YAML front matter (`---` … `---`) + Markdown prompt body.
- **Front matter** (main sections):
  - **`tracker`** — `kind` (e.g. `linear`), `endpoint`, `api_key` (or `$VAR`), `project_slug`, `active_states`, `terminal_states`.
  - **`polling`** — `interval_ms` (default 30s).
  - **`workspace`** — `root` (path or `$VAR`).
  - **`hooks`** — `after_create`, `before_run`, `after_run`, `before_remove`, `timeout_ms`.
  - **`agent`** — `max_concurrent_agents`, `max_retry_backoff_ms`, `max_concurrent_agents_by_state`, etc.
  - **`codex`** — `command`, `approval_policy`, `thread_sandbox`, `turn_sandbox_policy`, timeouts, etc.
- **Prompt template:** Liquid-compatible; variables e.g. `issue`, `attempt`. Unknown variables/filters must fail (no silent fallback).
- **Dynamic reload:** Service should watch `WORKFLOW.md` and re-apply config and prompt without restart; invalid reload → keep last good config + log error.

### Orchestration model

- **Issue states (orchestrator):** Unclaimed → Claimed (Running or RetryQueued) → Released.  
  (Distinct from tracker states like Todo / In Progress / Done.)
- **Run attempt phases:** PreparingWorkspace → BuildingPrompt → LaunchingAgentProcess → … → Succeeded / Failed / TimedOut / Stalled / CanceledByReconciliation.
- **Concurrency:** Global `max_concurrent_agents`; optional per-state limits; optional per-host limits when using SSH workers.
- **Retries:** Exponential backoff (capped by `max_retry_backoff_ms`); continuation retry (~1s) after normal worker exit to re-check if issue still active.
- **Reconciliation:** Every tick — refresh tracker state for running issues; stop workers for terminal/non-active issues; stall detection by `codex.stall_timeout_ms`.
- **Recovery:** No persistent DB required; restart recovery uses tracker + filesystem (e.g. terminal workspace cleanup at startup).

### Workspace rules

- **One workspace per issue:** path = `workspace.root / workspace_key` (workspace_key = sanitized issue identifier: `[A-Za-z0-9._-]`, else `_`).
- **Invariants:** Agent runs only in that path; workspace path must be under workspace root; keys sanitized.
- **Hooks:** `after_create` (fatal if fail), `before_run` (fatal), `after_run` / `before_remove` (log and ignore).

### Dispatch rules (summary)

- Issue must have `id`, `identifier`, `title`, `state`; state in `active_states`, not in `terminal_states`.
- Not already running or claimed; slots available (global and per-state).
- If state is `Todo`, do not dispatch when any blocker is non-terminal.
- Sort: priority (asc), then `created_at` (oldest first), then `identifier`.

### What Symphony is *not*

- A rich web UI or multi-tenant control plane.
- A general-purpose workflow engine or job scheduler.
- Defining *how* to edit tickets/PRs/comments (that’s in the workflow prompt and agent tools).
- Mandating a single approval/sandbox policy (implementation-defined).

### How to use Symphony later

1. **Option A — Build your own:** Implement the [SPEC](https://github.com/openai/symphony/blob/main/SPEC.md) in any language; tell your coding agent to implement it from the spec.
2. **Option B — Reference implementation:** Use the Elixir implementation; see [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md).

---

## Applying this in the future

### If you want “harness engineering” without Symphony

- Treat the **repo as the single source of truth** for the agent.
- Keep **`AGENTS.md`** short and use **`docs/`** (design, plans, product, references) with **mechanical checks** (lint, CI, doc-gardening).
- Make **app and ops legible** to the agent (DOM, logs, metrics).
- Enforce **architecture and taste** with linters and structural tests; allow freedom inside boundaries.
- Prefer **agent-to-agent review** and **high throughput** with light merge gates and continuous cleanup.

### If you want to add Symphony (or a similar orchestrator)

1. **First:** Adopt harness engineering so the codebase and workflow are agent-legible and in-repo.
2. **Add** a repo-owned `WORKFLOW.md` (tracker config + prompt template).
3. **Run** an orchestrator that polls the tracker, creates per-issue workspaces, and runs the coding agent per the spec.
4. **Manage work** in the issue tracker; let the orchestrator and agent handle dispatch, runs, retries, and handoff.

### One-line takeaway

- **Harness engineering:** Design the environment and repo so agents can do reliable, high-throughput work with minimal human supervision.  
- **Symphony:** Automate “pick work from backlog → run agent in isolation → track and retry” so teams manage work, not individual agent runs.

---

## Links

- [Harness engineering (OpenAI)](https://openai.com/index/harness-engineering/)
- [Symphony repo](https://github.com/openai/symphony)
- [Symphony SPEC](https://github.com/openai/symphony/blob/main/SPEC.md)
- [Symphony README](https://github.com/openai/symphony?tab=readme-ov-file)
