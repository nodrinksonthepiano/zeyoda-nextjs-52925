-- Protocol Swap Fees Table
-- Tracks 0.3% protocol fees collected from AMM swaps
-- Used for accurate treasury reporting

CREATE TABLE IF NOT EXISTS public.protocol_swap_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash text NOT NULL UNIQUE,
  artist_id text,                      -- Artist whose token was swapped (nullable for tracking)
  token_address text,                  -- Token involved in swap
  user_address text NOT NULL,          -- User who made the swap
  swap_direction text NOT NULL,        -- 'ETH_TO_TOKEN', 'TOKEN_TO_ETH', 'TOKEN_TO_TOKEN'
  fee_amount_wei text NOT NULL,        -- Protocol fee in wei (0.3% of input)
  fee_token text NOT NULL,             -- 'ETH' or token address (what fee was paid in)
  fee_usd numeric,                     -- USD value at time of swap
  eth_usd_rate numeric,                -- ETH/USD rate used for conversion
  block_number bigint NOT NULL,
  collected_at timestamptz DEFAULT now(),
  
  -- Foreign key to artists table (nullable - some swaps might be for unknown artists)
  CONSTRAINT fk_artist FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.protocol_swap_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read protocol swap fees"
  ON public.protocol_swap_fees FOR SELECT USING (true);

CREATE POLICY "Service role manage protocol swap fees"
  ON public.protocol_swap_fees FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_protocol_fees_tx_hash ON public.protocol_swap_fees(tx_hash);
CREATE INDEX idx_protocol_fees_artist ON public.protocol_swap_fees(artist_id);
CREATE INDEX idx_protocol_fees_user ON public.protocol_swap_fees(user_address);
CREATE INDEX idx_protocol_fees_date ON public.protocol_swap_fees(collected_at);
CREATE INDEX idx_protocol_fees_token ON public.protocol_swap_fees(token_address);
CREATE INDEX idx_protocol_fees_direction ON public.protocol_swap_fees(swap_direction);

-- Comments for documentation
COMMENT ON TABLE public.protocol_swap_fees IS 'Tracks all 0.3% protocol fees collected from AMM swaps';
COMMENT ON COLUMN public.protocol_swap_fees.tx_hash IS 'Blockchain transaction hash (unique)';
COMMENT ON COLUMN public.protocol_swap_fees.artist_id IS 'Artist identifier (nullable, for tracking)';
COMMENT ON COLUMN public.protocol_swap_fees.token_address IS 'Token contract address involved in swap';
COMMENT ON COLUMN public.protocol_swap_fees.user_address IS 'User who initiated the swap';
COMMENT ON COLUMN public.protocol_swap_fees.swap_direction IS 'Direction of swap: ETH_TO_TOKEN, TOKEN_TO_ETH, or TOKEN_TO_TOKEN';
COMMENT ON COLUMN public.protocol_swap_fees.fee_amount_wei IS 'Protocol fee amount in wei (stored as string to avoid precision loss)';
COMMENT ON COLUMN public.protocol_swap_fees.fee_token IS 'Currency fee was collected in (ETH or token address)';
COMMENT ON COLUMN public.protocol_swap_fees.fee_usd IS 'USD value of fee at time of collection';
COMMENT ON COLUMN public.protocol_swap_fees.eth_usd_rate IS 'ETH/USD exchange rate used for conversion';
COMMENT ON COLUMN public.protocol_swap_fees.block_number IS 'Block number where fee was collected';
COMMENT ON COLUMN public.protocol_swap_fees.collected_at IS 'Timestamp when fee was recorded';

-- Verification query
SELECT 
  'protocol_swap_fees table created' as status,
  COUNT(*) as total_fees,
  COUNT(DISTINCT artist_id) as unique_artists,
  COUNT(DISTINCT user_address) as unique_users,
  SUM(fee_usd) as total_usd_collected,
  MIN(collected_at) as first_fee,
  MAX(collected_at) as last_fee
FROM public.protocol_swap_fees;

