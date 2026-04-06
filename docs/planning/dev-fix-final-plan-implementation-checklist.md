# Dev Fix Final Plan - Implementation Checklist

**Scope**: Implement the approved final plan for Dev Agent behavior, verification, DB migration confirmation/apply, staging-first validation, and QA alignment.  
**Repos involved**: `voiceaiagentv5` (workflow/backend/agent), `phwb-testrepo` (UI + docs).  
**Status**: In Progress

---

## Phase A - Behavior and Definition of Done

### A1. Outcome-first behavior rules
- [x] Update `voiceaiagentv5/app/prompts/dev_fix_strict_rules.txt`:
  - [x] Add "fully functional outcome" rule as default.
  - [x] Add "non-dev ticket inference" rule (infer missing technical steps).
  - [x] Add "cross-layer allowed when required" rule.
  - [x] Add explicit "Definition of Done" checklist in prompt.

### A2. Implementation contract (pre-coding)
- [x] Add contract generation step in `analyze_and_code` instruction builder:
  - [x] ticket type (bug/enhancement/feature)
  - [x] impacted layers (UI/API/Store/DB)
  - [x] migration required yes/no
  - [x] acceptance checks
- [x] Persist contract summary to `phwb_dev_logs`.

### A3. Workflow status model
- [x] Define and use intermediate status labels:
  - [x] `code_complete_db_pending`
  - [x] `staging_ready`
  - [x] `staging_ready_db_pending`
  - [x] `staging_validated`
  - [x] `ready_for_pr`
  - [x] `fully_complete`
- [x] Ensure status transitions are logged and visible in bug comments.

---

## Phase B - Verify and Completeness Gates

### B1. Keep edited-file-focused verify as default
- [x] Support `DEV_AGENT_VERIFY_MODE=edited_only|hybrid|strict`.
- [x] Document mode semantics in `voiceaiagentv5/docs/DEV_FIX_RUN.md`.
- [x] Add runtime log line showing active verify mode per run.

### B2. Functional completeness checks
- [x] Add non-blocking checks first (then promote to blocking once stable):
  - [x] detect code references to missing DB schema objects
  - [x] detect UI field/API mismatch for newly introduced data paths
  - [x] require migration file if schema dependency is introduced
- [x] Promote critical completeness checks to blocking in `verify_fix`.

### B3. Preflight hardening
- [x] Improve `preflight_repository_check`:
  - [x] install/ensure dependencies before check (or explicit skip reason)
  - [x] classify tooling failure as `preflight_skipped` instead of noisy warning
  - [x] include reason in log/comment payload

---

## Phase C - DB Migration Detection + Confirmation + Apply

### C1. Detect migration changes
- [x] Detect changed files under `migrations/*.sql` after coding.
- [x] Persist metadata:
  - [x] `db_changes_detected`
  - [x] `migration_files`
  - [x] `requires_db_confirmation`

### C2. Migration preview endpoint (backend)
- [x] Add endpoint in `voiceaiagentv5` to preview pending migration changes:
  - [x] returns file list
  - [x] SQL summary (tables/columns/constraints touched)
  - [x] risk tags (DDL/destructive/index-only)

### C3. Migration apply endpoint (backend)
- [x] Add protected apply endpoint:
  - [x] apply pending migrations in order
  - [x] return structured success/failure
  - [x] audit log all apply attempts
- [x] Add env guards:
  - [x] `DEV_AGENT_DB_AUTO_APPLY_ENABLED`
  - [x] `DEV_AGENT_DB_APPLY_REQUIRES_CONFIRMATION`
  - [x] `DEV_AGENT_DB_APPLY_TARGET`

### C4. DB-aware completion gate
- [x] If DB changes exist and not applied:
  - [x] mark `code_complete_db_pending` / `staging_ready_db_pending`
  - [x] block `fully_complete`
- [x] After apply success:
  - [x] run targeted post-apply verification
  - [x] allow `fully_complete`

---

## Phase D - Staging-first Outcome (Primary Deliverable)

### D1. Staging deployment integration
- [x] Add deploy step after verify success:
  - [x] deploy branch to staging/preview
  - [x] capture preview URL
  - [x] persist URL in bug comment/log

### D2. Primary output change
- [x] Make staging link the primary handoff output.
- [x] Keep PR creation as:
  - [x] after staging approval (preferred), or
  - [x] draft PR in parallel (configurable).

### D3. Staging readiness states
- [ ] Use:
  - [x] `staging_ready`
  - [x] `staging_ready_db_pending`
  - [x] `staging_validated`
- [x] Show these states in UI and logs.

---

## Phase E - PHWB UI Enhancements (Dev Agent section)

### E1. DB confirmation UX
- [x] Add alert when DB changes are detected:
  - [x] migration filenames
  - [x] short SQL impact summary
  - [x] "Apply DB changes" confirm modal
- [x] Show apply progress and result.

### E2. Staging-first UX
- [x] Add "Open Staging Preview" action.
- [x] Add acceptance checklist for dev/non-dev validation.
- [x] Add approve/reject controls that feed back to workflow.

### E3. Evidence visibility
- [x] Display:
  - [x] impacted layers (UI/API/DB)
  - [x] verify mode used
  - [x] migration status
  - [x] staging URL + validation result

---

## Phase F - QA Process Alignment

### F1. QA policy updates
- [x] Update QA docs/checklist:
  - [x] edited-file verify remains fast gate
  - [x] final QA is outcome-based (affected flow)
  - [x] DB tickets require migration status confirmation

### F2. QA readiness rules
- [x] `code_complete_db_pending` is not QA-passable.
- [x] `fully_complete` requires:
  - [x] staging validation done
  - [x] DB applied (if required)
  - [x] acceptance criteria checked

### F3. Test strategy updates
- [x] Keep smoke checks.
- [x] Add targeted flow checks for cross-layer tickets.
- [x] Add persistence/refresh checks for DB-changing tickets.

---

## Phase G - Observability, Reporting, and Failure Recovery

### G1. Structured run summaries
- [x] Include in final comment/log:
  - [x] layers changed
  - [x] migration files and apply status
  - [x] verify summary
  - [x] staging link
  - [x] user validation result

### G2. Failure comments
- [x] Keep error + suggested fix behavior.
- [x] Add explicit blocking layer classification:
  - [x] UI
  - [x] API
  - [x] DB
  - [x] deploy/staging

### G3. Safety and rollback
- [x] Ensure destructive SQL is never auto-applied without explicit confirmation.
- [x] Add rollback guidance when migration apply fails.

---

## Suggested Rollout Order

- [ ] **Sprint 1**: Phase A + B (behavior + verify/completeness foundations)
- [ ] **Sprint 2**: Phase C (DB detect/confirm/apply backend)
- [ ] **Sprint 3**: Phase D + E (staging-first + UI)
- [ ] **Sprint 4**: Phase F + G (QA alignment + observability hardening)

---

## Immediate Next Actions (Kickoff)

- [ ] Approve this checklist as baseline.
- [x] Start Phase A task A1 (prompt rules update).
- [ ] Start Phase B task B3 (preflight hardening) to reduce noisy warnings.
- [ ] Keep `DEV_AGENT_VERIFY_MODE=edited_only` until Phase B is complete.

