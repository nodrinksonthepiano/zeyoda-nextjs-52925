-- Gas Sponsorship Events Table
-- Tracks all server-sponsored transactions (ERC-1155 purchases)
-- Used for analytics, cap enforcement, and gas budget monitoring

CREATE TABLE IF NOT EXISTS public.gas_sponsorship_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id text NOT NULL,
  user_address text NOT NULL,
  asset_number integer NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  gas_used bigint,
  gas_price bigint,
  payment_amount_wei text,
  sponsored_at timestamptz DEFAULT now(),
  
  -- Foreign key to artists table
  CONSTRAINT fk_artist FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.gas_sponsorship_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read gas sponsorship events"
  ON public.gas_sponsorship_events FOR SELECT USING (true);

CREATE POLICY "Service role manage gas sponsorship events"
  ON public.gas_sponsorship_events FOR INSERT, UPDATE, DELETE
  USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_gas_sponsorship_artist ON public.gas_sponsorship_events(artist_id);
CREATE INDEX idx_gas_sponsorship_user ON public.gas_sponsorship_events(user_address);
CREATE INDEX idx_gas_sponsorship_date ON public.gas_sponsorship_events(sponsored_at);
CREATE INDEX idx_gas_sponsorship_tx_hash ON public.gas_sponsorship_events(tx_hash);
CREATE INDEX idx_gas_sponsorship_free_mints ON public.gas_sponsorship_events(payment_amount_wei) WHERE payment_amount_wei = '0';

-- Comments for documentation
COMMENT ON TABLE public.gas_sponsorship_events IS 'Tracks all server-sponsored ERC-1155 purchase transactions';
COMMENT ON COLUMN public.gas_sponsorship_events.artist_id IS 'Artist identifier (foreign key to artists table)';
COMMENT ON COLUMN public.gas_sponsorship_events.user_address IS 'User wallet address (recipient of NFT)';
COMMENT ON COLUMN public.gas_sponsorship_events.asset_number IS 'ERC-1155 token ID (asset number)';
COMMENT ON COLUMN public.gas_sponsorship_events.tx_hash IS 'Blockchain transaction hash (unique)';
COMMENT ON COLUMN public.gas_sponsorship_events.gas_used IS 'Gas units consumed by transaction';
COMMENT ON COLUMN public.gas_sponsorship_events.gas_price IS 'Gas price in wei at time of transaction';
COMMENT ON COLUMN public.gas_sponsorship_events.payment_amount_wei IS 'Payment amount forwarded to artist (in wei string format)';
COMMENT ON COLUMN public.gas_sponsorship_events.sponsored_at IS 'Timestamp when transaction was sponsored';

-- Verification query
SELECT 
  'gas_sponsorship_events table created' as status,
  COUNT(*) as total_events,
  COUNT(DISTINCT artist_id) as unique_artists,
  COUNT(DISTINCT user_address) as unique_users,
  SUM(CASE WHEN payment_amount_wei = '0' THEN 1 ELSE 0 END) as free_mints,
  MIN(sponsored_at) as first_event,
  MAX(sponsored_at) as last_event
FROM public.gas_sponsorship_events;

