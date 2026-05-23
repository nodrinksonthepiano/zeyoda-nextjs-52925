/**
 * Minimal Artistock ABI for owner check and owner mint on deployed tokens.
 */
export const ArtistockABI = [
  "function owner() view returns (address)",
  "function mint(address to, uint256 amount)",
];
