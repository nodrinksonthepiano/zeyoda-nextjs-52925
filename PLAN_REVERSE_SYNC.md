# Plan: Reverse Sync (PRD → Feedback) — APPROVED

> **Status:** Approved. Build it.

---

## Goal

Wallet inbox should show ALL work items — both feedback submitted via the app AND PRD items (T-001 through T-007) that Cursor added directly. One unified inbox.

---

## Approach

1. Add one column to feedback table: `prd_item_id`
2. Update `scripts/sync-feedback-to-prd.js` to sync both directions
3. No UI changes — wallet already renders all feedback from API

---

## Schema Change

**Migration SQL (run in Supabase SQL Editor):**

```sql
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS prd_item_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_prd_item_id ON feedback(prd_item_id) WHERE prd_item_id IS NOT NULL;
```

- `prd_item_id` = NULL for app-submitted feedback
- `prd_item_id` = PRD item id (e.g. T-001, FB-93c329f5) for PRD-originated items

---

## Reverse Sync Logic (add to sync script)

**For each PRD item where `feedbackId === null`:**

1. Check: does feedback row exist with `prd_item_id = item.id`?
2. If yes → skip (idempotent)
3. If no → INSERT into feedback:
   - `message` = item.title (or description)
   - `submitted_by` = 'system@prd-sync'
   - `source` = 'admin'
   - `status` = map: todo→open, in_progress→in_progress, done→done
   - `artist_id` = parse from item.location if `?artist=xxx`, else null
   - `prd_item_id` = item.id

**Order in script:** Run forward sync (feedback→PRD) first, then reverse sync (PRD→feedback).

---

## After Build

1. Run the migration SQL in Supabase SQL Editor
2. Run `npm run sync-feedback` from terminal
3. Open wallet as Gosheesh — should see all 8 items (T-001 through T-007 + test feedback)
4. **Verify idempotency:** Run `npm run sync-feedback` again — should report zero new items, no duplicates

---

## Edge Cases (handled)

- Items with `feedbackId` set → skip reverse sync (already in feedback)
- Re-run script → no duplicates (check prd_item_id before insert)
- submitted_by for PRD items = 'system@prd-sync'
