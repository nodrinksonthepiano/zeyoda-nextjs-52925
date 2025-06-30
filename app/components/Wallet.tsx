import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

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

interface PurchasedDownloadInfo {
  artistId: string;
  artworkTitle: string;
  artistDisplayName: string;
  ipfsHash: string | null;
}

interface WalletProps {
  artistConfig: ArtistConfig | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  userTokenBalances: UserTokenBalances;
  allPurchasedDownloads: PurchasedDownloadInfo[];
  showAssetsPanel: boolean;
  onClose: () => void;
  userAddress?: string;
  magic?: any;
}

const Wallet: React.FC<WalletProps> = ({
  artistConfig,
  allArtistsConfig,
  userTokenBalances,
  allPurchasedDownloads,
  showAssetsPanel,
  onClose,
  userAddress,
  magic
}) => {
  const [realTimeBalances, setRealTimeBalances] = useState<UserTokenBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

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
    let successfulFetches = 0;
    let totalAttempts = 0;
    
    try {
      console.log("🔍 Fetching real token balances for:", userAddress);
      
      // Try multiple RPC providers for better success rate
      const providers = [];
      
      // Primary: Magic Link provider
      try {
        const magicProvider = new ethers.BrowserProvider(magic.rpcProvider as any);
        providers.push({ name: 'Magic', provider: magicProvider });
      } catch (e) {
        console.warn('Magic provider failed to initialize');
      }
      
      // Fallback: Direct Base Sepolia RPC
      try {
        const directProvider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        providers.push({ name: 'Direct', provider: directProvider });
      } catch (e) {
        console.warn('Direct provider failed to initialize');
      }
      
      // Fallback: Alchemy Base Sepolia
      try {
        const alchemyProvider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/demo');
        providers.push({ name: 'Alchemy', provider: alchemyProvider });
      } catch (e) {
        console.warn('Alchemy provider failed to initialize');
      }
      
      if (providers.length === 0) {
        throw new Error('No RPC providers available');
      }
      
              console.log(`🔗 Using ${providers.length} provider(s) for balance fetching`);
        
        // Get latest block to ensure fresh data
        let latestBlock = 0;
        for (const { name, provider } of providers) {
          try {
            latestBlock = await provider.getBlockNumber();
            console.log(`📊 Latest block from ${name}: ${latestBlock}`);
            break; // Use first successful block number
          } catch (e) {
            console.warn(`Could not get block number from ${name}`);
          }
        }
        
        // Use the contract addresses from environment variables
      const contractAddresses = {
        'GOSH33SH': process.env.NEXT_PUBLIC_GOSH33SH_TOKEN,
        'JAIT33': process.env.NEXT_PUBLIC_JAIT33_TOKEN,
      };
      
      // Simple ERC20 ABI for balanceOf
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];
      
      // Try to fetch balance for each artist config
      for (const [artistId, config] of Object.entries(allArtistsConfig)) {
        const contractAddress = contractAddresses[config.tokenName as keyof typeof contractAddresses];
        
        if (!contractAddress) {
          console.warn(`⚠️ No contract address for ${config.tokenName}`);
          continue;
        }
        
        totalAttempts++;
        let balanceFetched = false;
        
        // Try each provider until one succeeds
        for (const { name, provider } of providers) {
          if (balanceFetched) break;
          
          try {
            console.log(`🪙 Fetching ${config.tokenName} balance using ${name} provider...`);
            
            const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
            
            // Set a 5-second timeout for each call
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`${name} provider timeout`)), 5000)
            );
            
                         // Force latest block data to avoid cached balances
             const balancePromise = latestBlock > 0 
               ? contract.balanceOf(userAddress, { blockTag: latestBlock })
               : contract.balanceOf(userAddress);
             const rawBalance = await Promise.race([balancePromise, timeoutPromise]) as bigint;
            
            const balance = Number(rawBalance) / Math.pow(10, 18); // Assuming 18 decimals
            
                         console.log(`✅ ${config.tokenName} balance from ${name}:`, balance);
             balances[config.tokenName] = balance;
            
            successfulFetches++;
            balanceFetched = true;
            
          } catch (error: any) {
            console.warn(`⚠️ ${name} provider failed for ${config.tokenName}:`, error.message);
            // Try next provider
          }
        }
        
        if (!balanceFetched) {
          console.error(`❌ Could not fetch ${config.tokenName} balance from any provider`);
        }
      }
      
      // Update state with fetched balances
      if (successfulFetches > 0) {
        setRealTimeBalances(balances);
        setLastFetchTime(new Date());
        
        // Cache successful balances
        try {
          localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify({
            balances,
            timestamp: Date.now(),
            userAddress
          }));
          console.log(`💾 Cached ${successfulFetches} token balances`);
        } catch (cacheError) {
          console.warn('Could not cache balances:', cacheError);
        }
      }
      
      // Provide user feedback
      if (successfulFetches === 0 && totalAttempts > 0) {
        console.warn('⚠️ No balances could be fetched from any provider');
        setFetchError('Unable to fetch current balances. Network connectivity issues detected. Showing cached data if available.');
        
        // Try to load from cache as fallback
        try {
          const cached = localStorage.getItem('zeyodaUserTokenBalances');
          if (cached) {
            const { balances: cachedBalances, timestamp, userAddress: cachedAddress } = JSON.parse(cached);
            if (cachedAddress === userAddress && cachedBalances) {
              setRealTimeBalances(cachedBalances);
              const cacheAge = Math.round((Date.now() - timestamp) / 1000 / 60);
              setFetchError(`Showing cached balances (${cacheAge} minutes old). Click refresh to try again.`);
              console.log(`📦 Using cached balances (${cacheAge} minutes old)`);
            }
          }
        } catch (e) {
          console.warn('Could not load cached balances');
        }
        
      } else if (successfulFetches < totalAttempts) {
        console.warn(`⚠️ Partial balance fetch: ${successfulFetches}/${totalAttempts} successful`);
        setFetchError(`Some balances couldn't be loaded (${successfulFetches}/${totalAttempts} successful). Data may be incomplete.`);
      } else {
        setLastFetchTime(new Date());
        console.log(`✅ Successfully fetched all ${successfulFetches} token balances`);
      }
      
    } catch (error: any) {
      console.error('❌ Critical error in balance fetching:', error);
      setFetchError(`Critical error: ${error.message}. Please try refreshing the page.`);
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

  // Get artists with assets
  const artistsWithAssets = allArtistsConfig ? Object.entries(allArtistsConfig).filter(([id, config]) => {
    const hasTokens = combinedBalances[config.tokenName] > 0;
    const hasDownloads = allPurchasedDownloads.some(d => d.artistId === id);
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
              const downloads = allPurchasedDownloads.filter(d => d.artistId === artistId);
              
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
                  
                  {/* Downloads */}
                  {downloads.map((download, index) => (
                    <div key={index} className="flex items-center justify-between bg-purple-900 bg-opacity-50 rounded p-2 mt-2">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">🎵</span>
                        <div>
                          <div className="text-white font-medium text-sm">{download.artworkTitle} #{index + 1}</div>
                          <div className="text-purple-300 text-xs">Download</div>
                        </div>
                      </div>
                      {download.ipfsHash && (
                        <a 
                          href={`https://ipfs.io/ipfs/${download.ipfsHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-300 hover:text-purple-200 text-xs font-medium px-2 py-1 bg-purple-800 bg-opacity-50 rounded"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  ))}
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