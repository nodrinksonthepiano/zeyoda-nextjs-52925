-- Faucet V2: extend wallet_funding + create faucet_alerts
-- Run in Supabase before enabling FAUCET_ENABLED=true

-- 1. Add new columns
ALTER TABLE wallet_funding
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS chain_id INTEGER,
  ADD COLUMN IF NOT EXISTS faucet_version TEXT;

-- 2. Backfill existing rows (pre-v2 historical funds)
UPDATE wallet_funding
SET
  status = 'success',
  chain_id = 84532,
  faucet_version = 'legacy',
  error = NULL
WHERE status IS NULL;

-- 3. Enforce NOT NULL on required columns
ALTER TABLE wallet_funding
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN chain_id SET NOT NULL,
  ALTER COLUMN faucet_version SET NOT NULL,
  ALTER COLUMN faucet_version SET DEFAULT 'v2';

-- 4. Relax tx hash for failed / pending attempts
ALTER TABLE wallet_funding
  ALTER COLUMN transaction_hash DROP NOT NULL;

-- 5. Drop old blanket UNIQUE on wallet_address (allows retry after failure)
ALTER TABLE wallet_funding
  DROP CONSTRAINT IF EXISTS wallet_funding_wallet_address_key;

-- 6. Partial unique: one active fund per wallet (success or pending)
DROP INDEX IF EXISTS wallet_funding_success_unique;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_funding_active_unique
  ON wallet_funding (wallet_address)
  WHERE status IN ('success', 'pending');

-- 7. Daily cap aggregation index
CREATE INDEX IF NOT EXISTS idx_wallet_funding_daily_cap
  ON wallet_funding (funded_at, status, faucet_version);

-- 8. Status check constraint
ALTER TABLE wallet_funding
  DROP CONSTRAINT IF EXISTS wallet_funding_status_check;

ALTER TABLE wallet_funding
  ADD CONSTRAINT wallet_funding_status_check
  CHECK (status IN (
    'success',
    'pending',
    'failed_confirmation',
    'failed_validation',
    'failed_signing',
    'failed_chain_guard',
    'failed_balance',
    'failed_cap',
    'failed_duplicate'
  ));

-- 9. faucet_alerts for abnormal events
CREATE TABLE IF NOT EXISTS faucet_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,
  wallet_address TEXT,
  email TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faucet_alerts_type_created
  ON faucet_alerts (alert_type, created_at DESC);

COMMENT ON TABLE faucet_alerts IS 'Abnormal faucet v2 events (cap hit, low balance, client body rejected, etc.)';

-- 10. RLS: block browser/anon clients; service role (faucet API) bypasses RLS by design
ALTER TABLE wallet_funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE faucet_alerts ENABLE ROW LEVEL SECURITY;
