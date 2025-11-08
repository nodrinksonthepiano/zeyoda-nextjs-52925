/**
 * ArtistDownloadsUUPS Contract ABI
 * Minimal ABI for ERC-1155 UUPS download purchases
 */
export const ArtistDownloadsUUPSABI = [
  "function buyFor(address recipient, uint256 tokenId, uint256 quantity) external payable",
  "function mintDownload(address user, uint256 tokenId, uint256 amount) external",
  "function owner() view returns (address)",
  "function sponsor() view returns (address)",
  "function pause() external",
  "function unpause() external",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "event DownloadPurchased(address indexed buyer, uint256 indexed tokenId, uint256 quantity, uint256 amount)"
] as const;






