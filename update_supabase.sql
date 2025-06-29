-- Update artist contracts with new token addresses
UPDATE artists 
SET contract = '0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac',
    swapAddress = '0x63349f5190860b4E954639eeFd60b92bE9A01148'
WHERE id = 'gosheesh';

UPDATE artists 
SET contract = '0x9D06564a8D98e146CAb1dE74BF815bf05d24D685',
    swapAddress = '0xd01cFF08a9962e67914a3A3e446D90513915db6f'
WHERE id = 'jaitea';

-- Verify updates
SELECT id, name, contract, swapAddress FROM artists WHERE id IN ('gosheesh', 'jaitea');
