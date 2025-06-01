import React from 'react';

interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  // Add other relevant fields from ArtistConfig if needed by the wallet
}

interface UserTokenBalances {
  [tokenSymbol: string]: number;
}

interface WalletProps {
  artistConfig: ArtistConfig | null;
  userTokenBalances: UserTokenBalances;
  hasPurchasedDownload: boolean;
  showAssetsPanel: boolean;
  onClose: () => void;
  artistIdFromUrl: string; // To correctly check download status for the current artist
  // TODO: Add IPFS hash for download link if available from purchase confirmation
  downloadIpfsHash?: string | null; 
}

const Wallet: React.FC<WalletProps> = ({
  artistConfig,
  userTokenBalances,
  hasPurchasedDownload,
  showAssetsPanel,
  onClose,
  artistIdFromUrl,
  downloadIpfsHash
}) => {
  if (!showAssetsPanel) {
    return null;
  }

  // Determine current artist's download status based on hasPurchasedDownload prop
  // (which is already specific to the current artist in page.tsx)
  const ownsCurrentArtistDownload = hasPurchasedDownload;

  return (
    <div className={`your-assets-panel ${showAssetsPanel ? 'open' : ''} bg-gray-800 shadow-2xl rounded-lg border border-gray-700 transform transition-all duration-300 ease-out`}>
      <div className="flex justify-between items-center mb-4 wallet-header" style={{ backgroundColor: 'var(--primary-color)', padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)'}}>
        <h2 className="text-xl font-bold text-white">Your Assets</h2>
        <button 
          onClick={onClose} 
          className="p-1 text-gray-400 hover:text-white"
          aria-label="Close wallet"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="divide-y divide-gray-700 wallet-content">
        {artistConfig ? (
          <div className="wallet-artist-section">
            <h4 className="text-lg font-semibold text-accentColor">{artistConfig.displayName}</h4>
            {Object.keys(userTokenBalances).length > 0 ? (
              Object.entries(userTokenBalances).map(([tokenSymbol, balance]) => {
                // Only display token if it matches current artist's token or is a general token
                if (balance > 0 && tokenSymbol === artistConfig.tokenName) { 
                  return (
                    <div key={tokenSymbol} className="py-3 wallet-asset-item">
                      <span className="asset-icon">⚡</span>
                      <span className="asset-amount">{balance}</span>
                      <span className="asset-name">{tokenSymbol}</span>
                    </div>
                  );
                }
                return null;
              })
            ) : (
              <p className="text-gray-400 py-3 wallet-empty-state">You do not own any {artistConfig.tokenName} yet.</p>
            )}
          </div>
        ) : (
           <p className="text-gray-400 py-3 wallet-empty-state">Loading artist information...</p>
        )}

        {/* Purchased Downloads Section */}
        <div className="mt-6 pt-4 border-t border-gray-700 wallet-artist-section">
          <h4 className="text-lg font-semibold text-white mb-2">Featured Content</h4>
          {artistConfig ? (
            ownsCurrentArtistDownload ? (
              <div className="py-3 wallet-asset-item">
                <span className="asset-icon">🎵</span>
                <span className="asset-title flex-1">{artistConfig.artworkTitle}</span>
                {/* TODO: Make this a real IPFS link later */}
                {downloadIpfsHash ? (
                   <a 
                      href={`https://ipfs.io/ipfs/${downloadIpfsHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="asset-download-link"
                    >
                      Download
                    </a>
                ) : (
                  <span className="asset-download-link opacity-50">(Link pending)</span>
                )}
              </div>
            ) : (
              <p className="text-gray-400 py-3 wallet-empty-state">No featured download purchased for {artistConfig.displayName} yet.</p>
            )
          ) : (
            <p className="text-gray-400 py-3 wallet-empty-state">Download status unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wallet; 