// This file is now a fallback. The primary source of truth is the 'artist_registry' table in Supabase.
// The useArtistRegistry hook will load data from the DB and fall back to this static object on error.

export const ARTIST_REGISTRY = {
  gosheesh: {
    token: '0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac',
    swap: '0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf',
    downloads: '0x51A70725D8842E856971C71bAE389f0EA5EEC676',
    treasury_wallet: '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8'
  },
  jaitea: {
    token: '0x9D06564a8D98e146CAb1dE74BF815bf05d24D685',
    swap: '0xd01cFF08a9962e67914a3A3e446D90513915db6f', // FIXED: Updated to correct JAITEA swap address
    downloads: '0xec7BaDb433504aEbeFF747ADc8586E5663C0ea21',
    treasury_wallet: '0x0B893D9D0dA09096C75e43c310316dC61b2773be'
  },
  cancakes: {
    token: '0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65',
    swap: '0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE',
    downloads: '0x1942756cA3dc2484b55E3417551159b56F66d467',
    treasury_wallet: '0xe42C291143e03f3Bd7D5a095815DAD3e82835C05'
  }
};

export const getArtistContracts = (artistId: string) => {
  const registry = ARTIST_REGISTRY as any;
  return registry[artistId] || null;
}; 