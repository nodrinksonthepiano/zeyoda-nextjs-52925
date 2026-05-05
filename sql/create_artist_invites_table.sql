-- artist_invites: hidden treasure draft + NFC coin lifecycle (service role only via API)

CREATE TABLE IF NOT EXISTS public.artist_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_slug TEXT NOT NULL,
  coin_public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'claimed', 'launched', 'revoked')),
  draft_payload JSONB NOT NULL DEFAULT '{"schema_version": 1}'::jsonb,
  reserved_email_normalized TEXT NOT NULL,
  created_by_email TEXT,
  claimed_by_email TEXT,
  claimed_by_wallet TEXT,
  claimed_at TIMESTAMPTZ,
  launched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_invites_coin_public_id
  ON public.artist_invites (coin_public_id);

-- At most one active onboarding invite per slug (draft or claimed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_invites_one_active_per_slug
  ON public.artist_invites (artist_slug)
  WHERE status IN ('draft', 'claimed');

CREATE INDEX IF NOT EXISTS idx_artist_invites_status ON public.artist_invites (status);

ALTER TABLE public.artist_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to artist_invites"
  ON public.artist_invites
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
