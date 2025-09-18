-- Add unique constraint to prevent duplicate external_id transactions
CREATE UNIQUE INDEX IF NOT EXISTS ux_artist_earnings_external_id 
ON artist_earnings (external_id) 
WHERE external_id IS NOT NULL;

-- Add index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_artist_earnings_buyer_address 
ON artist_earnings (buyer_address);

CREATE INDEX IF NOT EXISTS idx_artist_earnings_created_at 
ON artist_earnings (created_at DESC);

-- Ensure addresses are always lowercase (add constraint)
ALTER TABLE artist_earnings 
ADD CONSTRAINT chk_buyer_address_lowercase 
CHECK (buyer_address = LOWER(buyer_address));

-- Add constraint to ensure positive amounts
ALTER TABLE artist_earnings 
ADD CONSTRAINT chk_positive_amounts 
CHECK (
  gross_amount_usd >= 0 AND 
  protocol_fee_usd >= 0 AND 
  processor_fee_usd >= 0 AND 
  net_earnings_usd >= 0
);

