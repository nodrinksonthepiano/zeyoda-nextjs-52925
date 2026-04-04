-- Add prd_item_id to feedback for reverse sync (PRD → feedback)
-- Run in Supabase SQL Editor before first reverse sync

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS prd_item_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_prd_item_id ON feedback(prd_item_id) WHERE prd_item_id IS NOT NULL;
