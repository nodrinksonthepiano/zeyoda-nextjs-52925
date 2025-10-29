/**
 * ArtistFactory ABI
 * One-click deployment of complete UUPS artist infrastructure
 */
export const ArtistFactoryABI = [
  "function createArtist(string name, string symbol, string artistId, address artistWallet) returns (address tokenProxy, address downloadsProxy)",
  "event ArtistCreated(string indexed artistId, address indexed tokenProxy, address downloadsProxy, address ammProxy, uint256 lpTokenSeed, uint256 lpEthSeed)",
  "function getBalance() view returns (uint256)",
  "function artistCount() view returns (uint256)"
];

