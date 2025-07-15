import { ArtistConfig } from '../../types/artist-types';

/**
 * Get the download price for an artist's featured asset
 * @param artistConfig - The artist configuration object
 * @returns The download price in USD (defaults to $1)
 */
export const getDownloadPrice = (artistConfig: ArtistConfig | null): number => {
  return 1; // TODO: Add downloadPrice to ArtistConfig type
};

/**
 * Check if download is available for purchase
 * @param artistConfig - The artist configuration object
 * @param user - The user address
 * @param hasExistingAccess - Whether user already owns the download (ignored - users can purchase multiple times)
 * @returns Whether download can be purchased
 */
export const isDownloadAvailable = (
  artistConfig: ArtistConfig | null,
  user: string | null,
  hasExistingAccess: boolean
): boolean => {
  return !!(artistConfig && user);
};

/**
 * Format download price for display
 * @param artistConfig - The artist configuration object
 * @returns Formatted price string (e.g., "$1")
 */
export const formatDownloadPrice = (artistConfig: ArtistConfig | null): string => {
  return `$${getDownloadPrice(artistConfig)}`;
};

/**
 * Create download mint request payload
 * @param artistConfig - The artist configuration object
 * @param userAddress - The user's wallet address
 * @param swapTxHash - The swap transaction hash
 * @returns Request payload for /api/mintDownload
 */
export const createDownloadMintPayload = (
  artistConfig: ArtistConfig,
  userAddress: string,
  swapTxHash: string
) => {
  return {
    artistId: artistConfig.name?.toLowerCase() || '',
    userAddress,
    assetId: 1, // Featured asset is always #1
    txHash: swapTxHash,
    amount: 1,
    downloadPrice: getDownloadPrice(artistConfig) // Include price for server logs
  };
}; 