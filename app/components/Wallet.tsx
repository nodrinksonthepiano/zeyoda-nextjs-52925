import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ARTIST_REGISTRY, getArtistContracts } from '../utils/addressRegistry';
import { useDownloadAccess } from '../hooks/useDownloadAccess';
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

  // Get download access for all artists
  const downloadAccessResults = allArtistsConfig ? Object.keys(allArtistsConfig).map(artistId => {
    const { downloadAccess, isLoading: accessLoading, error: accessError } = useDownloadAccess(
      userAddress || null,
      artistId
    );
    return {
      artistId,
      downloadAccess,
      isLoading: accessLoading,
      error: accessError
    };
  }) : [];

  // Fetch asset metadata for owned downloads
  useEffect(() => {
    const fetchAssetMetadata = async () => {
      if (!downloadAccessResults.length) return;
      
      const metadata: { [key: string]: AssetMetadata } = {};
      
      for (const result of downloadAccessResults) {
        if (result.downloadAccess.length > 0) {
          for (const access of result.downloadAccess) {
            const key = `${access.artistId}_${access.assetNumber}`;
            
            try {
              const { data, error } = await supabase
                .from('artist_assets')
                .select('*')
                .eq('artist_id', access.artistId)
                .eq('asset_number', access.assetNumber)
                .single();
              
              if (data && !error) {
                metadata[key] = data;
              }
            } catch (error) {
              console.warn(`Failed to fetch metadata for ${key}:`, error);
            }
          }
        }
      }
      
      setAssetMetadata(metadata);
    };
    
    fetchAssetMetadata();
  }, [downloadAccessResults]);

  // Handle download
  const handleDownload = async (artistId: string, assetNumber: number) => {
    const key = `${artistId}_${assetNumber}`;
    if (downloadingAssets.has(key)) return;
    
    setDownloadingAssets(prev => new Set([...prev, key]));
    
    try {
      console.log(`📥 Starting download for ${artistId} asset ${assetNumber}`);
      
      const response = await fetch('/api/createSignedUrl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artistId: artistId,
          assetNumber: assetNumber,
          userAddress: userAddress
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get download URL');
      }
      
      // Create download link
      const link = document.createElement('a');
      link.href = data.url;
      link.download = `${artistId}_asset_${assetNumber}.${data.file_type?.split('/')[1] || 'mp4'}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Download initiated for ${artistId} asset ${assetNumber}`);
      
    } catch (error: any) {
      console.error('Download failed:', error);
      alert(`❌ Download failed: ${error.message}`);
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

  // Manual refresh function for user control
  const handleManualRefresh = async () => {
    setFetchError(null);
    await fetchRealBalances();
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

  // Combine real-time balances with stored balances
  const combinedBalances = { ...userTokenBalances, ...realTimeBalances };

  if (!showAssetsPanel) {
    return null;
  }

  // Get artists with assets (tokens or downloads)
  const artistsWithAssets = allArtistsConfig ? Object.entries(allArtistsConfig).filter(([id, config]) => {
    const hasTokens = combinedBalances[config.tokenName] > 0;
    const hasDownloads = downloadAccessResults.some(result => 
      result.artistId === id && result.downloadAccess.length > 0
    );
    return hasTokens || hasDownloads;
  }) : [];

  return (
    <>
      {/* Bubble Popup - NO BACKDROP */}
      <div className="fixed top-16 left-4 w-80 max-h-96 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl border border-purple-500 z-[9999] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <h2 className="text-lg font-bold">💰 Your Assets</h2>
          <div className="flex items-center space-x-2">
            {!fetchError && (
              <button
                onClick={handleManualRefresh}
                disabled={isLoading}
                title="Refresh balances"
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-sm disabled:opacity-50"
              >
                {isLoading ? '⟳' : '🔄'}
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

        {/* Error Message and Refresh Controls */}
        {fetchError && (
          <div className="p-3 bg-yellow-900 bg-opacity-50 border-l-4 border-yellow-500 text-yellow-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm">{fetchError}</p>
                {lastFetchTime && (
                  <p className="text-xs text-yellow-300 mt-1">
                    Last updated: {lastFetchTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={isLoading}
                className="ml-3 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
              >
                {isLoading ? '⟳' : '🔄'} Refresh
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-gray-300 py-8">
              <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm">Loading balances...</p>
              <p className="text-xs text-gray-400 mt-1">
                Fetching token balances from blockchain
              </p>
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
              const downloadResult = downloadAccessResults.find(result => result.artistId === artistId);
              const downloads = downloadResult?.downloadAccess || [];
              
              return (
                <div key={artistId} className="mb-3 bg-black bg-opacity-30 rounded-lg p-3 border border-purple-400 border-opacity-50">
                  <h3 className="text-md font-bold text-white mb-2" style={{ color: config.theme.accentColor }}>
                    {config.displayName}
                  </h3>
                  
                  {/* Token Balance */}
                  {tokenBalance > 0 && (
                    <div className="flex items-center justify-between mb-2 bg-purple-900 bg-opacity-50 rounded p-2">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">⚡</span>
                        <div>
                          <div className="text-white font-medium text-sm">
                            {tokenBalance.toLocaleString()} {config.tokenName}
                          </div>
                          <div className="text-purple-300 text-xs">Artistocks</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ERC-1155 Downloads */}
                  {downloads.map((download) => {
                    const assetKey = `${download.artistId}_${download.assetNumber}`;
                    const metadata = assetMetadata[assetKey];
                    const isDownloading = downloadingAssets.has(assetKey);
                    
                    return (
                      <div key={assetKey} className="flex items-center justify-between bg-purple-900 bg-opacity-50 rounded p-2 mt-2">
                        <div className="flex items-center">
                          <span className="text-xl mr-2">🎵</span>
                          <div>
                            <div className="text-white font-medium text-sm">
                              {metadata?.metadata?.title || config.artworkTitle} #{download.assetNumber}
                            </div>
                            <div className="text-purple-300 text-xs">
                              Download • Balance: {download.balance}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(download.artistId, download.assetNumber)}
                          disabled={isDownloading}
                          className="text-purple-300 hover:text-purple-200 text-xs font-medium px-2 py-1 bg-purple-800 bg-opacity-50 rounded disabled:opacity-50"
                        >
                          {isDownloading ? '⏳' : '📥'} Download
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        
        {/* Bubble pointer/arrow */}
        <div className="absolute -top-2 left-8 w-4 h-4 bg-gradient-to-br from-purple-600 to-blue-600 transform rotate-45 border-l border-t border-purple-500"></div>
      </div>
    </>
  );
};

export default Wallet; 