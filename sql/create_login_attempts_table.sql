-- Create login attempts table for security logging
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  whitelisted BOOLEAN NOT NULL,
  clue TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_timestamp ON login_attempts(timestamp);
