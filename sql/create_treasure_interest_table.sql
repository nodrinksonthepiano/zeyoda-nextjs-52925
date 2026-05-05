-- treasure_interest: burial/wizard path — no draft linkage (service role only via API)

CREATE TABLE IF NOT EXISTS public.treasure_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_value TEXT NOT NULL,
  artist_slug_attempted TEXT,
  source_url TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasure_interest_created_at
  ON public.treasure_interest (created_at DESC);

ALTER TABLE public.treasure_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to treasure_interest"
  ON public.treasure_interest
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
