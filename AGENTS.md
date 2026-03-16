# Agent map (repository as source of truth)

This repo is the **single source of truth** for the PHWB Admin codebase. When fixing bugs or implementing features (e.g. via the Dev Agent / Initiate dev fix flow), use this map to find context.

## Entry points

- **CLAUDE.md** — Project overview, architecture, stack, directory structure, conventions. Start here for full context.
- **docs/** — Deeper references:
  - **docs/README.md** — Docs index
  - **docs/guides/** — How-to guides (artists, events, payroll, etc.)
  - **docs/pages/** — Page specs
  - **docs/planning/** — Architecture and optimization notes
  - **docs/HARNESS_ENGINEERING_AND_SYMPHONY.md** — Harness engineering reference
  - **docs/VOICEAIAGENTV5_REVIEW.md** — Dev fix backend integration
  - **docs/HARNESS_DEV_FIX_INTEGRATION.md** — How harness applies to Initiate dev fix

## Conventions

- **Stacks:** SvelteKit, Svelte 5 runes, TypeScript, Tailwind, DaisyUI, Supabase. See CLAUDE.md.
- **Data:** All tables use `phwb_` prefix; use stores in `src/lib/stores/` for CRUD.
- **Bugs:** Tracked in `phwb_bugs`; dev fix workflow updates `phwb_bug_comments` and `phwb_dev_logs`.

## For Dev Agent (Initiate dev fix)

1. Read **CLAUDE.md** for architecture and layout.
2. Use **docs/** for domain context (e.g. payroll, events) if the bug touches that area.
3. Implement the fix following existing patterns; run `bun run check` before considering the fix done.
