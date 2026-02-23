-- Feedback table for user and admin submissions
-- Used by POST /api/feedback and GET /api/feedback (admin only)

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  submitted_by TEXT NOT NULL,           -- email or wallet address
  source TEXT NOT NULL CHECK (source IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  artist_id TEXT,                       -- ?artist= context when submitted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for admin list view (most recent first)
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- RLS: Only service role can read/write (API routes use service role)
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to feedback"
  ON feedback
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
