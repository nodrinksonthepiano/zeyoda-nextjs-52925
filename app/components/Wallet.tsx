import React from 'react';

interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
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
  artistConfig: ArtistConfig | null; // Current artist, for theme/context
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  userTokenBalances: UserTokenBalances;
  allPurchasedDownloads: PurchasedDownloadInfo[];
  showAssetsPanel: boolean;
  onClose: () => void;
}

const Wallet: React.FC<WalletProps> = ({
  artistConfig, // Current artist for context
  allArtistsConfig,
  userTokenBalances,
  allPurchasedDownloads,
  showAssetsPanel,
  onClose,
}) => {
  if (!showAssetsPanel) {
    return null;
  }

  // Create a list of artist IDs for whom the user has assets (tokens or downloads)
  const relevantArtistIds = new Set<string>();
  Object.keys(userTokenBalances).forEach(tokenSymbol => {
    if (allArtistsConfig) {
      for (const id in allArtistsConfig) {
        if (allArtistsConfig[id].tokenName === tokenSymbol && userTokenBalances[tokenSymbol] > 0) {
          relevantArtistIds.add(id);
          break;
        }
      }
    }
  });
  allPurchasedDownloads.forEach(download => relevantArtistIds.add(download.artistId));

  const sortedArtistIds = Array.from(relevantArtistIds).sort();

  const hasAnyAssetsToShow = sortedArtistIds.length > 0;

  return (
    <div className={`your-assets-panel open bg-gray-800 shadow-2xl rounded-lg border border-gray-700 transform transition-all duration-300 ease-out`}>
      <div className="flex justify-between items-center mb-4 wallet-header" 
           style={{ backgroundColor: artistConfig?.theme.primaryColor || 'var(--primary-color)', padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)'}}>
        <h2 className="text-xl font-bold text-white">Your Assets</h2>
        <button 
          onClick={onClose} 
          className="p-1 text-gray-400 hover:text-white"
          aria-label="Close wallet"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="wallet-content">
        {!allArtistsConfig ? (
          <div className="p-4 text-gray-400 text-center">Loading artist details...</div>
        ) : !hasAnyAssetsToShow ? (
          <div className="p-4 text-gray-400 text-center">No assets yet. Explore and collect!</div>
        ) : (
          sortedArtistIds.map(id => {
            const currentArtist = allArtistsConfig ? allArtistsConfig[id] : null;
            if (!currentArtist) return null; // Should not happen if logic is correct

            const tokensForThisArtist = userTokenBalances[currentArtist.tokenName] || 0;
            const downloadForThisArtist = allPurchasedDownloads.find(d => d.artistId === id);

            if (tokensForThisArtist === 0 && !downloadForThisArtist) {
              return null; // No assets for this specific artist in the loop
            }

            return (
              <div key={id} className="wallet-artist-section px-4 py-3 border-b border-gray-700 last:border-b-0">
                <h4 className="text-lg font-semibold text-accentColor mb-2">{currentArtist.displayName}</h4>
                
                {tokensForThisArtist > 0 && (
                  <div className="py-1 wallet-asset-item flex justify-between items-center mb-1">
                    <div>
                      <span className="asset-icon mr-2">⚡</span>
                      <span className="asset-name text-sm text-gray-300">{currentArtist.tokenName}</span> 
                    </div>
                    <span className="asset-amount font-medium text-gray-100">{tokensForThisArtist}</span>
                  </div>
                )}

                {downloadForThisArtist && (
                  <div className={`py-1 wallet-asset-item flex justify-between items-center ${tokensForThisArtist > 0 ? 'mt-1' : ''}`}>
                    <div>
                      <span className="asset-icon mr-2">🎵</span>
                      <span className="asset-title flex-1 text-sm text-gray-300">{downloadForThisArtist.artworkTitle}</span>
                    </div>
                    {downloadForThisArtist.ipfsHash ? (
                       <a 
                          href={`https://ipfs.io/ipfs/${downloadForThisArtist.ipfsHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="asset-download-link text-accentColor hover:underline text-sm font-medium"
                        >
                          Download
                        </a>
                    ) : (
                      <span className="text-gray-500 text-sm">(Link pending)</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Wallet; 