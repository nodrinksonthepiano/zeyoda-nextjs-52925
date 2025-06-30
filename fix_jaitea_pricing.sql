-- Fix JAITEA pricing in Supabase
UPDATE artists 
SET tokenPrice = 0.000001
WHERE id = 'jaitea';

-- Verify the update
SELECT id, name, tokenPrice, contract, swap_address FROM artists WHERE id = 'jaitea';
