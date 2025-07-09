import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useArtistRegistryContext } from '../contexts/ArtistRegistryContext';
import { getArtistContracts as getFallbackArtistContracts } from '../utils/addressRegistryFallback';
import { supabase } from '../utils/supabaseClient';

// ERC-1155 ABI for checking balances
const ERC1155_ABI = [
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function hasDownloadAccess(address user, uint256 assetId) view returns (bool)"
];

// RPC provider for contract calls
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

export interface DownloadAccess {
  artistId: string;
  assetNumber: number;
  hasAccess: boolean;
  balance: number;
}

export function useDownloadAccess(userAddress: string | null, artistId: string | null) {
  const { registry, isLoading: isRegistryLoading } = useArtistRegistryContext();
  const [downloadAccess, setDownloadAccess] = useState<DownloadAccess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const checkDownloadAccess = async () => {
      if (!userAddress || !artistId || isRegistryLoading) {
        setDownloadAccess([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`🔍 Checking download access for ${userAddress} on ${artistId}`);
        
        const artistContracts = registry ? registry[artistId] : getFallbackArtistContracts(artistId);

        if (!artistContracts?.downloads) {
          console.log(`⚠️ No download contract found for ${artistId}`);
          setDownloadAccess([]);
          setIsLoading(false);
          return;
        }

        // Create contract instance
        const downloadContract = new ethers.Contract(
          artistContracts.downloads,
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
    };

    checkDownloadAccess();
  }, [userAddress, artistId, refreshTrigger, registry, isRegistryLoading]);

  // Manual refresh function
  const refreshDownloadAccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
    hasAnyAccess: downloadAccess.length > 0,
    refreshDownloadAccess
  };
}

export function useAllArtistsDownloadAccess(userAddress: string | null, allArtistsConfig: { [key: string]: any } | null) {
  const [allDownloads, setAllDownloads] = useState<{ [artistId: string]: DownloadAccess[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAllAccess = async () => {
      if (!userAddress || !allArtistsConfig) {
        setAllDownloads({});
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        // 1. Fetch all possible assets from our database first
        const { data: allPossibleAssets, error: dbError } = await supabase
          .from('artist_assets')
          .select('artist_id, asset_number');

        if (dbError) {
          throw new Error(`Failed to fetch asset list from DB: ${dbError.message}`);
        }

        const results: { [artistId: string]: DownloadAccess[] } = {};
        const artistIds = Object.keys(allArtistsConfig);

        // 2. For each artist, check balances for the assets that actually exist
        await Promise.all(artistIds.map(async (artistId) => {
          const artistContracts = allArtistsConfig[artistId];
          if (!artistContracts?.downloads) return;

          const downloadContract = new ethers.Contract(
            artistContracts.downloads,
            ERC1155_ABI,
            provider
          );

          // Filter for assets belonging to the current artist
          const assetsForArtist = allPossibleAssets.filter(asset => asset.artist_id === artistId);
          if (assetsForArtist.length === 0) return;

          const accessChecks: DownloadAccess[] = [];
          
          // Create a list of balance check promises
          const balanceChecks = assetsForArtist.map(asset => 
            downloadContract.balanceOf(userAddress, asset.asset_number)
              .then(balance => ({ assetNumber: asset.asset_number, balance }))
              .catch(err => {
                console.warn(`Balance check failed for ${artistId} asset ${asset.asset_number}:`, err);
                return { assetNumber: asset.asset_number, balance: 0n }; // On error, assume 0 balance (using BigInt literal for ethers v6)
              })
          );
          
          const balances = await Promise.all(balanceChecks);

          for (const { assetNumber, balance } of balances) {
            if (balance > 0n) { // Compare with BigInt zero
              accessChecks.push({
                artistId,
                assetNumber,
                hasAccess: true,
                balance: Number(balance) // Convert BigInt to Number for state and UI
              });
            }
          }

          if (accessChecks.length > 0) {
            results[artistId] = accessChecks;
          }
        }));
        
        setAllDownloads(results);
      } catch (e: any) {
        console.error('Error checking all download access:', e);
        setError(e.message || 'An unexpected error occurred.');
        setAllDownloads({});
      } finally {
        setIsLoading(false);
      }
    };

    checkAllAccess();
  }, [userAddress, allArtistsConfig]);

  return { allDownloads, isLoading, error };
} 