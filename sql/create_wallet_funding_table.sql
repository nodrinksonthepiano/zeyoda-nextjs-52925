-- Create wallet funding table to track auto-funding
CREATE TABLE wallet_funding (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  funded_amount TEXT NOT NULL, -- Store as string to avoid precision issues
  transaction_hash TEXT NOT NULL,
  funded_at TIMESTAMP DEFAULT NOW(),
  deployer_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_wallet_funding_address ON wallet_funding(wallet_address);
CREATE INDEX idx_wallet_funding_email ON wallet_funding(email);
CREATE INDEX idx_wallet_funding_tx ON wallet_funding(transaction_hash);
