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

  // Fetch real-time token balances from the blockchain
  useEffect(() => {
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
      const balances: UserTokenBalances = {};
      
      try {
        console.log("🔍 Fetching real token balances for:", userAddress);
        const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
        
        // Add the new contract addresses from environment variables
        const contractAddresses = {
          'GOSH33SH': process.env.NEXT_PUBLIC_GOSH33SH_TOKEN,
          'JAIT33': process.env.NEXT_PUBLIC_JAIT33_TOKEN,
        };
        
        console.log("🏗️ Using contract addresses:", contractAddresses);
        
        for (const [artistId, config] of Object.entries(allArtistsConfig)) {
          // Use new contract addresses first, fallback to config
          const contractAddress = contractAddresses[config.tokenName as keyof typeof contractAddresses] || config.contract;
          
          if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
            try {
              console.log(`🪙 Fetching ${config.tokenName} balance from:`, contractAddress);
              
              // Simple ERC20 ABI for balanceOf
              const erc20Abi = [
                "function balanceOf(address owner) view returns (uint256)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)"
              ];
              
              const contract = new ethers.Contract(contractAddress, erc20Abi, provider);
              const balance = await contract.balanceOf(userAddress);
              const decimals = await contract.decimals();
              const symbol = await contract.symbol();
              
              // Convert from wei to tokens
              const tokenBalance = Number(ethers.formatUnits(balance, decimals));
              console.log(`💰 ${symbol} balance:`, tokenBalance);
              
              if (tokenBalance > 0) {
                balances[config.tokenName] = tokenBalance;
                console.log(`✅ Added ${tokenBalance} ${config.tokenName} to balances`);
              }
            } catch (err) {
              console.error(`❌ Error fetching balance for ${config.tokenName}:`, err);
            }
          } else {
            console.log(`⚠️ No contract address for ${config.tokenName}`);
          }
        }
        
        console.log("📊 Final balances:", balances);
        setRealTimeBalances(balances);
        
        // Also update localStorage for persistence
        localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify(balances));
        
      } catch (error) {
        console.error('❌ Error fetching token balances:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (showAssetsPanel) {
      fetchRealBalances();
    }
  }, [userAddress, magic, allArtistsConfig, showAssetsPanel]);

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
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-gray-300 py-8">
              <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm">Loading balances...</p>
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