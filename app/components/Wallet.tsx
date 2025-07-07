import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { ARTIST_REGISTRY, getArtistContracts } from '../utils/addressRegistry';
import { useAllArtistsDownloadAccess } from '../hooks/useDownloadAccess';
import { supabase } from '../utils/supabaseClient';

interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  contract?: string;
  theme: {
    primaryColor: string;
    accentColor: string;
  };
  // Add other relevant fields from ArtistConfig if needed by the wallet
}

interface UserTokenBalances {
  [tokenSymbol: string]: number;
}

interface AssetMetadata {
  id: string;
  artist_id: string;
  asset_number: number;
  file_url: string;
  file_type: string;
  metadata: any;
}

interface WalletProps {
  artistConfig: ArtistConfig | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  userTokenBalances: UserTokenBalances;
  showAssetsPanel: boolean;
  onClose: () => void;
  userAddress?: string;
  magic?: any;
}

const Wallet: React.FC<WalletProps> = ({
  artistConfig,
  allArtistsConfig,
  userTokenBalances,
  showAssetsPanel,
  onClose,
  userAddress,
  magic
}) => {
  const [realTimeBalances, setRealTimeBalances] = useState<UserTokenBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [downloadingAssets, setDownloadingAssets] = useState<Set<string>>(new Set());
  const [assetMetadata, setAssetMetadata] = useState<{ [key: string]: AssetMetadata }>({});

  // Use the new hook to get all download access data at once
  const { allDownloads, isLoading: downloadsLoading, error: downloadsError } = useAllArtistsDownloadAccess(
    userAddress || null,
    allArtistsConfig
  );

  // Memoize the artist IDs to prevent re-renders
  const artistIds = useMemo(() => {
    return allArtistsConfig ? Object.keys(allArtistsConfig) : [];
  }, [allArtistsConfig]);

  // Fetch asset metadata for all owned downloads
  useEffect(() => {
    const fetchAssetMetadata = async () => {
      if (Object.keys(allDownloads).length === 0) return;
      
      const metadata: { [key: string]: AssetMetadata } = {};
      const allAccessEntries = Object.values(allDownloads).flat();

      await Promise.all(allAccessEntries.map(async (access) => {
        const key = `${access.artistId}_${access.assetNumber}`;
        try {
          const { data, error } = await supabase
            .from('artist_assets')
            .select('*')
            .eq('artist_id', access.artistId)
            .eq('asset_number', access.assetNumber)
            .single();
          
          if (data && !error) {
            metadata[key] = {
              ...data,
              metadata: {
                ...data.metadata,
                title: data.metadata?.title || `Asset #${access.assetNumber}`
              }
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch metadata for ${key}:`, error);
        }
      }));
      
      setAssetMetadata(metadata);
    };
    
    fetchAssetMetadata();
  }, [allDownloads]);

  // Handle download logic, now back in the main wallet component
  const handleDownload = async (artistId: string, assetNumber: number) => {
    const key = `${artistId}_${assetNumber}`;
    if (downloadingAssets.has(key)) return;
    
    setDownloadingAssets(prev => new Set([...prev, key]));
    
    try {
      const response = await fetch('/api/createSignedUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, assetNumber, userAddress })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get download URL');
      
      const link = document.createElement('a');
      link.href = data.url;
      const fileType = assetMetadata[key]?.file_type?.split('/')[1] || 'mp4';
      link.download = `${artistId}_asset_${assetNumber}.${fileType}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error: any) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error.message}`);
    } finally {
      setDownloadingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Fetch real-time token balances from the blockchain
  const fetchRealBalances = async () => {
    if (!userAddress || !magic || !allArtistsConfig) {
      console.log("⚠️ Missing requirements for balance fetch:", {
        userAddress: !!userAddress,
        magic: !!magic,
        allArtistsConfig: !!allArtistsConfig
      });
      return;
    }
    
    setIsLoading(true);
    setFetchError(null);
    const balances: UserTokenBalances = {};
    
    try {
      console.log("🔍 Fetching real token balances for:", userAddress);
      
      // Use Magic Link provider (most reliable)
      const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
      
      // Use the contract addresses from the registry
      const contractAddresses = {
        'GOSH33SH': ARTIST_REGISTRY.gosheesh.token,
        'JAIT33': ARTIST_REGISTRY.jaitea.token,
      };
      
      // Simple ERC20 ABI for balanceOf
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];
      
      // Fetch balance for each token with simplified logic
      for (const [artistId, config] of Object.entries(allArtistsConfig)) {
        const contractAddress = contractAddresses[config.tokenName as keyof typeof contractAddresses];
        
        if (!contractAddress) {
          console.warn(`⚠️ No contract address for ${config.tokenName}`);
          balances[config.tokenName] = 0; // Set to 0 instead of skipping
          continue;
        }
        
        try {
          console.log(`🪙 Fetching ${config.tokenName} balance...`);
          
          const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
          const rawBalance = await contract.balanceOf(userAddress);
          const balance = Number(rawBalance) / Math.pow(10, 18); // Assuming 18 decimals
          
          console.log(`✅ ${config.tokenName} balance:`, balance);
          balances[config.tokenName] = balance;
          
        } catch (error: any) {
          console.warn(`⚠️ Error fetching ${config.tokenName} balance:`, error.message);
          balances[config.tokenName] = 0; // Set to 0 on error
        }
      }
      
      // Always update state with whatever we fetched (even if some failed)
      setRealTimeBalances(balances);
      setLastFetchTime(new Date());
      
      // Cache successful balances
      try {
        localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify({
          balances,
          timestamp: Date.now(),
          userAddress
        }));
        console.log(`💾 Cached token balances:`, balances);
      } catch (cacheError) {
        console.warn('Could not cache balances:', cacheError);
      }
      
      // Trigger a custom event to notify other components
      const balanceUpdateEvent = new CustomEvent('walletBalancesUpdated', {
        detail: balances
      });
      window.dispatchEvent(balanceUpdateEvent);
      
    } catch (error: any) {
      console.error('❌ Balance fetch failed:', error);
      setFetchError(`Failed to fetch balances: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch balances when wallet panel opens
  useEffect(() => {
    if (showAssetsPanel) {
      fetchRealBalances();
    }
  }, [userAddress, magic, allArtistsConfig, showAssetsPanel]);

  // Listen for transaction success events to refresh balances
  useEffect(() => {
    const handleTransactionSuccess = (event: CustomEvent) => {
      console.log('🎉 Transaction success detected, forcing balance refresh...', event.detail);
      setFetchError(null);
      
      // Force aggressive refresh for post-transaction updates
      if (event.detail?.forceRefresh) {
        console.log('🚀 Forcing aggressive balance refresh with retries...');
        
        // Clear all cached data
        localStorage.removeItem('zeyodaUserTokenBalances');
        
        // Try multiple times with delays to catch blockchain propagation
        let retryCount = 0;
        const maxRetries = 3;
        
        const retryFetch = async () => {
          retryCount++;
          console.log(`🔄 Balance fetch attempt ${retryCount}/${maxRetries}...`);
          
          await fetchRealBalances();
          
          // If we still don't see updated balances and have retries left, try again
          if (retryCount < maxRetries) {
            setTimeout(retryFetch, 5000); // Wait 5 seconds between retries
          }
        };
        
        retryFetch();
      } else {
        // Normal refresh
        fetchRealBalances();
      }
    };

    window.addEventListener('refreshWalletBalances', handleTransactionSuccess as EventListener);
    
    return () => {
      window.removeEventListener('refreshWalletBalances', handleTransactionSuccess as EventListener);
    };
  }, [userAddress, magic, allArtistsConfig]);

  const handleManualRefresh = async () => {
    setFetchError(null);
    await fetchRealBalances();
    // Note: The download hook refreshes automatically based on its dependencies
  };

  const combinedBalances = { ...userTokenBalances, ...realTimeBalances };

  if (!showAssetsPanel) {
    return null;
  }

  // Filter artists to only show those with assets (tokens or downloads)
  const artistsWithAssets = allArtistsConfig ? Object.entries(allArtistsConfig).filter(([id, config]) => {
    const hasTokens = (combinedBalances[config.tokenName] || 0) > 0;
    const hasDownloads = allDownloads[id] && allDownloads[id].length > 0;
    return hasTokens || hasDownloads;
  }) : [];

  const isAnythingLoading = isLoading || downloadsLoading;

  return (
    <div className="fixed top-16 left-4 w-80 max-h-96 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl border border-purple-500 z-[9999] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white flex-shrink-0">
        <h2 className="text-lg font-bold">💰 Your Assets</h2>
        <div className="flex items-center space-x-2">
          {!fetchError && (
            <button
              onClick={handleManualRefresh}
              disabled={isAnythingLoading}
              title="Refresh balances"
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-sm disabled:opacity-50"
            >
              {isAnythingLoading ? '⟳' : '🔄'}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-xl"
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 overflow-y-auto">
        {isAnythingLoading ? (
          <div className="text-center text-gray-300 py-8">
            <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Loading assets...</p>
          </div>
        ) : artistsWithAssets.length === 0 ? (
          <div className="text-center text-gray-300 py-6">
            <div className="text-3xl mb-2">🎨</div>
            <p className="text-sm">No assets yet.</p>
            <p className="text-xs text-gray-400">Start collecting artistocks!</p>
          </div>
        ) : (
          artistsWithAssets.map(([artistId, config]) => {
            const tokenBalance = combinedBalances[config.tokenName] || 0;
            const downloads = allDownloads[artistId] || [];
            
            return (
              <div key={artistId} className="mb-3 bg-black bg-opacity-30 rounded-lg p-3 border border-purple-400 border-opacity-50">
                <h3 className="text-md font-bold text-white mb-2" style={{ color: config.theme.accentColor }}>
                  {config.displayName}
                </h3>
                
                {tokenBalance > 0 && (
                  <div className="flex items-center justify-between mb-2 bg-purple-900 bg-opacity-50 rounded p-2">
                    <div className="text-white font-medium text-sm">
                      {tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {config.tokenName}
                    </div>
                  </div>
                )}
                
                {downloads.map((download) => {
                  const assetKey = `${download.artistId}_${download.assetNumber}`;
                  const metadata = assetMetadata[assetKey];
                  const isDownloading = downloadingAssets.has(assetKey);
                  
                  return (
                    <div key={assetKey} className="flex items-center justify-between bg-purple-900 bg-opacity-50 rounded p-2 mt-2">
                      <div>
                        <div className="text-white font-medium text-sm">
                          {metadata?.metadata?.title || `${config.artworkTitle} #${download.assetNumber}`}
                        </div>
                        <div className="text-purple-300 text-xs">
                          Balance: {download.balance}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(download.artistId, download.assetNumber)}
                        disabled={isDownloading}
                        className="text-purple-300 hover:text-purple-200 text-xs font-medium px-2 py-1 bg-purple-800 bg-opacity-50 rounded disabled:opacity-50"
                      >
                        {isDownloading ? '...' : 'Download'}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      
      {/* Bubble pointer */}
      <div className="absolute -top-2 left-8 w-4 h-4 bg-gradient-to-br from-purple-600 to-blue-600 transform rotate-45 border-l border-t border-purple-500"></div>
    </div>
  );
};

export default Wallet; 