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
      if (!userAddress || !magic || !allArtistsConfig) return;
      
      setIsLoading(true);
      const balances: UserTokenBalances = {};
      
      try {
        const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
        
        for (const [artistId, config] of Object.entries(allArtistsConfig)) {
          if (config.contract) {
            try {
              // Simple ERC20 ABI for balanceOf
              const erc20Abi = [
                "function balanceOf(address owner) view returns (uint256)",
                "function decimals() view returns (uint8)"
              ];
              
              const contract = new ethers.Contract(config.contract, erc20Abi, provider);
              const balance = await contract.balanceOf(userAddress);
              const decimals = await contract.decimals();
              
              // Convert from wei to tokens
              const tokenBalance = Number(ethers.formatUnits(balance, decimals));
              if (tokenBalance > 0) {
                balances[config.tokenName] = tokenBalance;
              }
            } catch (err) {
              console.log(`Error fetching balance for ${config.tokenName}:`, err);
            }
          }
        }
        
        setRealTimeBalances(balances);
      } catch (error) {
        console.error('Error fetching token balances:', error);
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
    console.log("🚫 Wallet not showing because showAssetsPanel is:", showAssetsPanel);
    return null;
  }

  console.log("✅ Wallet should be visible! showAssetsPanel:", showAssetsPanel);

  // Get artists with assets
  const artistsWithAssets = allArtistsConfig ? Object.entries(allArtistsConfig).filter(([id, config]) => {
    const hasTokens = combinedBalances[config.tokenName] > 0;
    const hasDownloads = allPurchasedDownloads.some(d => d.artistId === id);
    return hasTokens || hasDownloads;
  }) : [];

  return (
    <div className="fixed top-0 left-0 w-80 h-full bg-gray-900 shadow-xl z-40 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <h2 className="text-lg font-bold">Your Assets</h2>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-xl"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Loading balances...</p>
          </div>
        ) : artistsWithAssets.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            <div className="text-3xl mb-2">🎨</div>
            <p className="text-sm">No assets yet.</p>
            <p className="text-xs text-gray-500">Start collecting artistocks!</p>
          </div>
        ) : (
          artistsWithAssets.map(([artistId, config]) => {
            const tokenBalance = combinedBalances[config.tokenName] || 0;
            const downloads = allPurchasedDownloads.filter(d => d.artistId === artistId);
            
            return (
              <div key={artistId} className="mb-4 bg-gray-800 rounded-lg p-3 border border-gray-700">
                <h3 className="text-md font-bold text-white mb-2" style={{ color: config.theme.accentColor }}>
                  {config.displayName}
                </h3>
                
                {/* Token Balance */}
                {tokenBalance > 0 && (
                  <div className="flex items-center justify-between mb-2 bg-gray-700 rounded p-2">
                    <div className="flex items-center">
                      <span className="text-xl mr-2">⚡</span>
                      <div>
                        <div className="text-white font-medium text-sm">
                          {tokenBalance.toLocaleString()} {config.tokenName}
                        </div>
                        <div className="text-gray-400 text-xs">Artistocks</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Downloads */}
                {downloads.map((download, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-700 rounded p-2 mt-2">
                    <div className="flex items-center">
                      <span className="text-xl mr-2">🎵</span>
                      <div>
                        <div className="text-white font-medium text-sm">{download.artworkTitle} #{index + 1}</div>
                        <div className="text-gray-400 text-xs">Download</div>
                      </div>
                    </div>
                    {download.ipfsHash && (
                      <a 
                        href={`https://ipfs.io/ipfs/${download.ipfsHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium px-2 py-1 bg-blue-900 bg-opacity-50 rounded"
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
    </div>
  );
};

export default Wallet; 