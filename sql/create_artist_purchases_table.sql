-- Artist Purchases Table
-- Tracks all ERC-1155 purchases with idempotency support
-- Used for duplicate prevention and purchase history

CREATE TABLE IF NOT EXISTS public.artist_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_hash text UNIQUE NOT NULL,    -- Idempotency hash (keccak256)
  artist_id text NOT NULL,
  user_address text NOT NULL,
  asset_number integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_usd numeric,
  price_wei text NOT NULL,              -- Store as string to avoid precision loss
  tx_hash text NOT NULL UNIQUE,
  block_number bigint,
  gas_cost_wei text,                    -- Protocol-sponsored gas cost
  created_at timestamptz DEFAULT now(),
  
  -- Foreign key to artists table
  CONSTRAINT fk_artist FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.artist_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read artist purchases"
  ON public.artist_purchases FOR SELECT USING (true);

CREATE POLICY "Service role manage artist purchases"
  ON public.artist_purchases FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes for performance (matching master prompt spec)
CREATE INDEX idx_request_hash ON public.artist_purchases(request_hash);
CREATE INDEX idx_user_date ON public.artist_purchases(user_address, created_at);
CREATE INDEX idx_artist_date ON public.artist_purchases(artist_id, created_at);
CREATE INDEX idx_tx_hash ON public.artist_purchases(tx_hash);

-- Comments for documentation
COMMENT ON TABLE public.artist_purchases IS 'Tracks all ERC-1155 download purchases with idempotency support';
COMMENT ON COLUMN public.artist_purchases.request_hash IS 'Keccak256 hash of (artistId + assetNumber + userAddress + priceWei + day) for idempotency';
COMMENT ON COLUMN public.artist_purchases.price_wei IS 'Payment amount in wei (stored as string to avoid precision loss)';

