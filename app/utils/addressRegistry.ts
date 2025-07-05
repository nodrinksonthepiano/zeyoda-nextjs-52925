export const ARTIST_REGISTRY = {
  gosheesh: {
    token: "0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac",
    swap:  "0xFCdc6C04bC0e1625178883c64567e1218Ee97DFf",
    treasuryWallet: "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8"
  },
  jaitea: {
    token: "0x9D06564a8D98e146CAb1dE74BF815bf05d24D685",
    swap:  "0xd01cFF08a9962e67914a3A3e446D90513915db6f",
    treasuryWallet: "0x0B893D9D0dA09096C75e43c310316dC61b2773be"
  }
} as const;

export type ArtistId = keyof typeof ARTIST_REGISTRY;

// Helper functions for type-safe access
export function getArtistContracts(artistId: string) {
  return ARTIST_REGISTRY[artistId as ArtistId] || null;
}

export function isValidArtist(artistId: string): artistId is ArtistId {
  return artistId in ARTIST_REGISTRY;
}

export function getAllArtistIds(): ArtistId[] {
  return Object.keys(ARTIST_REGISTRY) as ArtistId[];
} 