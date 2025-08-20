import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { useAllArtistsDownloadAccess } from '../hooks/useDownloadAccess';
import { useWalletBalances } from '../hooks/useWalletBalances';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { toBigIntStrict } from '../utils/bigint';

import { ArtistConfig } from '../../types/artist-types';

interface UserTokenBalances {
  [tokenSymbol: string]: bigint;
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
  userTokenBalances: initialBalances,
  showAssetsPanel,
  onClose,
  userAddress,
  magic
}) => {
  const [downloadingAssets, setDownloadingAssets] = useState<Set<string>>(new Set());
  const [assetMetadata, setAssetMetadata] = useState<{ [key: string]: AssetMetadata }>({});
  const { showToast } = useToast();
  const { usdBalance, isLoading: usdLoading } = useUsdBalance();

  // Use the new wallet balances hook
  const { 
    balances: realTimeBalances, 
    isLoading: balancesLoading, 
    error: balancesError, 
    lastFetchTime, 
    refreshBalances 
  } = useWalletBalances({
    magic,
    userAddress: userAddress || null,
    allArtistsConfig,
    autoRefreshOnMount: showAssetsPanel,
    suspendAutoRefresh: (window as any).onboardingMode || false
  });

  // Using strict BigInt conversion utility to prevent precision loss

  // Convert initial balances to BigInt
  const userTokenBalances = useMemo(() => {
    const converted: UserTokenBalances = {};
    if (initialBalances) {
      Object.entries(initialBalances).forEach(([token, balance]) => {
        if (balance !== undefined && balance !== null) {
          try {
            converted[token] = toBigIntStrict(balance);
          } catch (error) {
            console.warn(`[BAL-WARN] Could not convert balance for ${token}:`, balance, error);
            converted[token] = BigInt(0);
          }
        }
      });
    }
    return converted;
  }, [initialBalances]);

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

  // Handle download logic
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
      showToast(`Download failed: ${error.message}`, 'error');
    } finally {
      setDownloadingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Balance logic is now handled by useWalletBalances hook

  // Manual refresh using the hook
  const handleManualRefresh = async () => {
    localStorage.removeItem('zeyodaUserTokenBalances');
    await refreshBalances();
  };

  // Combine balances
  const combinedBalances = useMemo(() => {
    const combined: { [tokenSymbol: string]: bigint } = {};
    
    Object.entries(userTokenBalances).forEach(([token, balance]) => {
      if (balance !== undefined && balance !== null) {
        try {
          combined[token] = toBigIntStrict(balance);
        } catch (error) {
          console.warn(`[BAL-WARN] Could not convert user balance for ${token}:`, balance, error);
          combined[token] = BigInt(0);
        }
      }
    });
    
    Object.entries(realTimeBalances).forEach(([token, balance]) => {
      if (balance !== undefined && balance !== null) {
        combined[token] = balance;
      }
    });
    
    return combined;
  }, [userTokenBalances, realTimeBalances]);

  if (!showAssetsPanel) {
    return null;
  }

  // Filter artists to only show those with assets
  const artistsWithAssets = allArtistsConfig ? Object.entries(allArtistsConfig).filter(([id, config]) => {
    const tokenBalance = combinedBalances[id === 'gosheesh' ? 'GOSH33SH' : id === 'jaitea' ? 'JAIT33' : config.tokenName];
    const hasTokens = tokenBalance && tokenBalance > BigInt(0);
    const hasDownloads = allDownloads[id] && allDownloads[id].length > 0;
    return hasTokens || hasDownloads;
  }) : [];

  const isAnythingLoading = balancesLoading || downloadsLoading || usdLoading;

  return (
    <div className="fixed top-16 left-4 w-80 max-h-96 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl border border-purple-500 z-[9999] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white flex-shrink-0">
        <h2 className="text-lg font-bold">💰 Your Assets</h2>
        <div className="flex items-center space-x-2">
          {!balancesError && (
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
            const tokenName = artistId === 'gosheesh' ? 'GOSH33SH' : artistId === 'jaitea' ? 'JAIT33' : config.tokenName;
            const tokenBalance = combinedBalances[tokenName];
            const downloads = allDownloads[artistId] || [];
            
            return (
              <div key={artistId} className="mb-3 bg-black bg-opacity-30 rounded-lg p-3 border border-purple-400 border-opacity-50">
                <div className="flex flex-col">
                  {/* Artist Name */}
                  <h3 className="text-lg font-bold text-white mb-2" style={{ color: config.theme.accentColor }}>
                    {artistId === 'gosheesh' ? 'GOSHEESH' : artistId === 'jaitea' ? 'JAI TEA' : config.displayName}
                  </h3>
                  
                  {/* Token Balance */}
                  {tokenBalance && tokenBalance > BigInt(0) && (
                    <div className="flex flex-col mb-2 bg-purple-900 bg-opacity-50 rounded p-2">
                      <div className="text-purple-300 text-xs mb-1">
                        {tokenName}
                      </div>
                      <div className="text-white font-medium text-sm">
                        {Number(ethers.formatUnits(tokenBalance, 18)).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Downloads Section */}
                  {downloads.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {downloads.map(download => {
                        const assetKey = `${download.artistId}_${download.assetNumber}`;
                        const metadata = assetMetadata[assetKey];
                        const isDownloading = downloadingAssets.has(assetKey);
                        
                        return (
                          <div key={assetKey} className="flex items-center justify-between bg-purple-900 bg-opacity-50 rounded p-2">
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
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* USD Balance Display */}
        {(usdBalance > 0 || usdLoading) && (
          <div className="mt-4 bg-green-900 bg-opacity-50 rounded-lg p-3 border border-green-400 border-opacity-50">
            <div className="flex flex-col">
              <div className="text-green-300 text-xs mb-1">USD Balance</div>
              <div className="text-white font-bold text-lg">
                {usdLoading ? (
                  <span className="text-gray-300">Loading...</span>
                ) : usdBalance < 0.01 && usdBalance > 0 ? (
                  '< $0.01'
                ) : (
                  `$${usdBalance.toFixed(2)}`
                )}
              </div>
              {!usdLoading && usdBalance > 0 && (
                <div className="text-green-200 text-xs mt-1">
                  💰 Available for withdrawal
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Bubble pointer */}
      <div className="absolute -top-2 left-8 w-4 h-4 bg-gradient-to-br from-purple-600 to-blue-600 transform rotate-45 border-l border-t border-purple-500"></div>
    </div>
  );
};

export default Wallet;