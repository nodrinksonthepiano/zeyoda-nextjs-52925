import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getArtistContracts } from '../utils/addressRegistry';

// ERC-1155 ABI for checking balances
const ERC1155_ABI = [
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function hasDownloadAccess(address user, uint256 assetId) view returns (bool)"
];

// RPC provider for contract calls
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC);

export interface DownloadAccess {
  artistId: string;
  assetNumber: number;
  hasAccess: boolean;
  balance: number;
}

export function useDownloadAccess(userAddress: string | null, artistId: string | null) {
  const [downloadAccess, setDownloadAccess] = useState<DownloadAccess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress || !artistId) {
      setDownloadAccess([]);
      return;
    }

    async function checkDownloadAccess() {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`🔍 Checking download access for ${userAddress} on ${artistId}`);
        
        // Get artist contracts (artistId is guaranteed to be non-null here)
        const artistContracts = getArtistContracts(artistId!) as any;
        if (!artistContracts?.download) {
          console.log(`⚠️ No download contract found for ${artistId}`);
          setDownloadAccess([]);
          return;
        }

        // Create contract instance
        const downloadContract = new ethers.Contract(
          artistContracts.download,
          ERC1155_ABI,
          provider
        );

        // Check access for assets 1-10 (common range)
        const assetNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const accessChecks: DownloadAccess[] = [];

        for (const assetNumber of assetNumbers) {
          try {
            const balance = await downloadContract.balanceOf(userAddress, assetNumber);
            const hasAccess = balance > 0;
            
            if (hasAccess) {
              console.log(`✅ ${artistId} asset ${assetNumber}: balance ${balance.toString()}`);
                             accessChecks.push({
                artistId: artistId!,
                assetNumber,
                hasAccess: true,
                balance: Number(balance)
              });
            }
          } catch (error: any) {
            console.warn(`⚠️ Error checking ${artistId} asset ${assetNumber}:`, error.message);
            // Continue checking other assets
          }
        }

        setDownloadAccess(accessChecks);
        console.log(`📊 Found ${accessChecks.length} accessible downloads for ${artistId}`);
        
      } catch (error: any) {
        console.error('Error checking download access:', error);
        setError(error.message || 'Failed to check download access');
        setDownloadAccess([]);
      } finally {
        setIsLoading(false);
      }
    }

    checkDownloadAccess();
  }, [userAddress, artistId]);

  // Helper function to check specific asset
  const hasAccessToAsset = (assetNumber: number): boolean => {
    return downloadAccess.some(access => 
      access.assetNumber === assetNumber && access.hasAccess
    );
  };

  // Helper function to get balance for specific asset
  const getAssetBalance = (assetNumber: number): number => {
    const access = downloadAccess.find(access => access.assetNumber === assetNumber);
    return access?.balance || 0;
  };

  return {
    downloadAccess,
    isLoading,
    error,
    hasAccessToAsset,
    getAssetBalance,
    hasAnyAccess: downloadAccess.length > 0
  };
} 