# Complete Plan: Feedback → PRD Sync System

> Surgical, evidence-based plan for consideration. No code changes until approved.

---

## Part 1: Proof of Current State

### 1.1 What Exists in Zeyoda (Verified)

| Item | Path | Evidence |
|------|------|----------|
| feedback table schema | `sql/feedback.sql` | Columns: `id`, `message`, `submitted_by`, `source`, `status`, `artist_id`, `created_at`, `updated_at`. `source` IN ('user','admin'). `status` IN ('open','in_progress','done'). |
| POST /api/feedback | `app/api/feedback/route.ts` | Lines 36-41: sets `source = whitelistData?.role === 'admin' ? 'admin' : 'user'`. Line 50: inserts with `status: 'open'`. |
| PRD.json | — | **Does not exist.** Glob search returns 0 files. |
| AGENT_NOTES.md | — | **Does not exist.** Glob search returns 0 files. |
| ROADMAP.md | — | **Does not exist.** Glob search returns 0 files. |
| project-context rule | `.cursor/rules/project-context.mdc` | Line 12: "If PRD.json exists, consult it." — Rule expects PRD but it is absent. |
| T-001 through T-007 | `SESSION_REPORT_AND_BACKLOG.md` | Lines 59-81. Exact IDs, titles, descriptions, locations. |
| package.json scripts | `package.json` | Current: `dev`, `dev-safe`, `build`, `start`, `lint`, `type-check`. No `sync-feedback`. |
| Env vars for Supabase | `.env.example` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` present. |
| Existing script pattern | `scripts/updateSupabaseWithNewSwap.js` | Line 2: `require('dotenv').config({ path: '.env.local' });` — precedent for loading env in scripts. |

### 1.2 What We Cannot Verify (User Must Confirm)

| Item | Assumption |
|------|------------|
| ArtisTalks has AGENT_NOTES.md, ROADMAP.md, PRD.json | Claude stated these exist. Zeyoda workspace cannot access ArtisTalks. User must confirm path and contents. |
| feedback table deployed | `sql/feedback.sql` exists. User confirmed feedback appears in Wallet — table is deployed. |

---

## Part 2: PRD Schema (Proposed)

PRD.json must support sections and items. Proposed structure:

```json
{
  "version": 1,
  "project": "Zeyoda",
  "updatedAt": "2025-02-23T00:00:00.000Z",
  "sections": [
    {
      "id": "critical",
      "name": "Critical / Security",
      "priority": 1,
      "items": []
    },
    {
      "id": "high",
      "name": "High / Core Features",
      "priority": 2,
      "items": []
    },
    {
      "id": "medium",
      "name": "Medium / Performance",
      "priority": 3,
      "items": []
    },
    {
      "id": "low",
      "name": "Low / Nice to Have",
      "priority": 4,
      "items": []
    }
  ]
}
```

Each item:

```json
{
  "id": "T-001",
  "title": "Add ownership verification to uploadAsset",
  "description": "uploadAsset route does not verify caller owns the artist before allowing upload",
  "location": "app/api/uploadAsset/route.ts:64",
  "status": "todo",
  "feedbackId": null,
  "createdAt": "2025-02-23T00:00:00.000Z"
}
```

- `feedbackId`: UUID from `feedback.id` when item came from admin feedback. `null` for manual/backlog items.
- `status`: `todo` | `in_progress` | `done`

---

## Part 3: Step-by-Step Implementation Plan

### Step 1: Create Base Files (AGENT_NOTES, ROADMAP, PRD)

**1a. ArtisTalks source (conditional)**

- **If** ArtisTalks has these files: copy from ArtisTalks project root into Zeyoda root.
- **Path assumption:** User provides ArtisTalks path, e.g. `../ArtisTalks112025/` or absolute path.
- **Update:** Replace "ArtisTalks" with "Zeyoda", adjust project-specific content.

**1b. If ArtisTalks files don't exist or path unknown**

- Create from scratch:
  - `AGENT_NOTES.md`: Agent context, conventions, gotchas (can derive from ZEYODA_KNOWLEDGE_BASE + SESSION_REPORT).
  - `ROADMAP.md`: High-level milestones (placeholder or minimal).
  - `PRD.json`: Use schema above, initially empty sections.

**1c. Add T-001 through T-007 to PRD.json**

Map from SESSION_REPORT_AND_BACKLOG.md:

| PRD Section | Ticket IDs |
|-------------|------------|
| critical | T-001 |
| high | T-002, T-003 |
| medium | T-004, T-005 |
| low | T-006, T-007 |

Each item: `id`, `title`, `description`, `location`, `status: "todo"`, `feedbackId: null`, `createdAt`.

---

### Step 2: Create `scripts/sync-feedback-to-prd.js`

**2a. Script logic (pseudocode)**

```
1. require('dotenv').config({ path: '.env.local' })
2. Validate NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
3. Create Supabase client with service role
4. Query: SELECT * FROM feedback WHERE source = 'admin' AND status = 'open' ORDER BY created_at ASC
5. Read PRD.json from project root
6. For each feedback row:
   a. Create item: { id: `FB-${feedback.id.slice(0,8)}`, title: feedback.message, description: feedback.message, location: null, status: 'todo', feedbackId: feedback.id, createdAt: feedback.created_at }
   b. Append to PRD section "low" (or "improvements" if added)
   c. UPDATE feedback SET status = 'in_progress', updated_at = NOW() WHERE id = feedback.id
7. Write PRD.json back to disk
8. Log: "Synced N feedback items to PRD"
```

**2b. Idempotency**

- Only process `status = 'open'`.
- After processing, set `status = 'in_progress'` — prevents reprocessing.
- If item with same `feedbackId` already in PRD, skip (avoid duplicates).

**2c. File location**

- `scripts/sync-feedback-to-prd.js`
- PRD path: `path.join(process.cwd(), 'PRD.json')`

**2d. Env loading**

- Use `require('dotenv').config({ path: '.env.local' })` (matches `scripts/updateSupabaseWithNewSwap.js`).
- Fallback: try `.env` if `.env.local` not found.

**2e. Error handling**

- Exit with code 1 if env vars missing.
- Exit with code 1 if Supabase query fails.
- Log errors; do not silently swallow.

---

### Step 3: Add npm Script

**3a. Edit `package.json`**

Add to `scripts`:

```json
"sync-feedback": "node scripts/sync-feedback-to-prd.js"
```

**3b. Verification**

- Run `npm run sync-feedback` from project root.
- Expect: script runs, reads feedback, updates PRD, updates feedback table (or exits cleanly if no open admin feedback).

---

### Step 4: Create `.cursor/rules/feedback-prd-sync.mdc`

**4a. Rule content (proposed)**

```markdown
---
description: At session start, sync admin feedback to PRD and read project docs
alwaysApply: true
---

# Feedback-PRD Sync

At the start of every session, before assisting with any task:

1. Run `npm run sync-feedback` to pull new admin feedback from Supabase into PRD.json
2. Read `AGENT_NOTES.md` and `PRD.json`
3. Use PRD.json as the source of truth for backlog items and priorities

This ensures feedback submitted via the app (as Gosheesh) becomes visible work items.
```

**4b. Placement**

- Path: `.cursor/rules/feedback-prd-sync.mdc`
- `alwaysApply: true` so the agent considers it every time.

---

### Step 5: Constraints (Do Not Violate)

| Constraint | Source |
|------------|--------|
| Do not modify .env | constraints.mdc, SESSION_REPORT |
| Do not run git commands | constraints.mdc |
| Script reads env; does not write | Plan |

---

## Part 4: Verification Checklist

After implementation:

| # | Action | Expected Result |
|---|--------|------------------|
| 1 | Submit feedback as Gosheesh via 🎤→📢 | Row in `feedback` with `source='admin'`, `status='open'` |
| 2 | Run `npm run sync-feedback` | Script exits 0; PRD.json has new item; feedback row has `status='in_progress'` |
| 3 | Open PRD.json | New item present with `feedbackId` matching feedback row |
| 4 | Start new Cursor chat | Agent runs sync, reads AGENT_NOTES and PRD (observe behavior) |

---

## Part 5: File Manifest (What Gets Created/Modified)

| File | Action |
|------|--------|
| `AGENT_NOTES.md` | Create (or copy from ArtisTalks + adapt) |
| `ROADMAP.md` | Create (or copy from ArtisTalks + adapt) |
| `PRD.json` | Create with schema + T-001 through T-007 |
| `scripts/sync-feedback-to-prd.js` | Create |
| `package.json` | Modify — add `sync-feedback` script |
| `.cursor/rules/feedback-prd-sync.mdc` | Create |

---

## Part 6: Dependencies and Order

```
Step 1 (base files) → Step 2 (script) → Step 3 (npm) → Step 4 (rule)
```

- Step 2 requires PRD.json to exist (Step 1).
- Step 3 requires script to exist (Step 2).
- Step 4 requires AGENT_NOTES and PRD to exist (Step 1).

---

## Part 7: Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| ArtisTalks path wrong or files missing | Fallback: create AGENT_NOTES, ROADMAP, PRD from scratch |
| PRD.json corrupted by script | Validate structure before write; consider backup before overwrite |
| Duplicate items from same feedback | Check `feedbackId` in PRD before adding; skip if exists |
| Env vars not loaded in script | Use dotenv with `.env.local`; validate and exit with clear error |
| Agent ignores rule | Rule is alwaysApply; user can explicitly prompt "run sync first" |

---

## Part 8: Summary

**Inputs:** Feedback table (exists), POST /api/feedback (exists), SESSION_REPORT (T-001 to T-007), ArtisTalks docs (optional).

**Outputs:** AGENT_NOTES.md, ROADMAP.md, PRD.json, sync script, npm script, Cursor rule.

**Flow:** Gosheesh submits feedback → `status='open'` → `npm run sync-feedback` → items added to PRD, `status='in_progress'` → Cursor reads PRD at session start.

**Proof:** Run verification checklist after implementation.
