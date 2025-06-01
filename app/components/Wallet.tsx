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

  if (!artistConfig) {
    return (
      <div className={`your-assets-panel open bg-gray-800 shadow-2xl rounded-lg border border-gray-700 transform transition-all duration-300 ease-out`}>
        <div className="flex justify-between items-center mb-4 wallet-header" style={{ backgroundColor: 'var(--primary-color)', padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h2 className="text-xl font-bold text-white">Your Assets</h2>
          <button 
            onClick={onClose} 
            className="p-1 text-gray-400 hover:text-white"
            aria-label="Close wallet"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="wallet-content p-4 text-gray-400 text-center">Loading asset information...</div>
      </div>
    );
  }

  const ownsCurrentArtistDownload = hasPurchasedDownload; 
  
  const currentArtistTokens = Object.entries(userTokenBalances)
    .filter(([tokenSymbol, balance]) => tokenSymbol === artistConfig.tokenName && balance > 0);
  
  const hasVisibleArtistTokens = currentArtistTokens.length > 0;
  const hasVisibleDownload = ownsCurrentArtistDownload;

  const hasAnyAssetsForArtist = hasVisibleArtistTokens || hasVisibleDownload;

  return (
    <div className={`your-assets-panel open bg-gray-800 shadow-2xl rounded-lg border border-gray-700 transform transition-all duration-300 ease-out`}>
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
      
      <div className="wallet-content">
        
        {artistConfig && hasAnyAssetsForArtist && (
          <div className="wallet-artist-section px-4 py-3">
            <h4 className="text-lg font-semibold text-accentColor mb-2">{artistConfig.displayName}</h4>
            
            {hasVisibleArtistTokens && currentArtistTokens.map(([tokenSymbol, balance]) => (
              <div key={tokenSymbol} className="py-1 wallet-asset-item flex justify-between items-center">
                <div>
                  <span className="asset-icon mr-2">⚡</span>
                  <span className="asset-name text-sm text-gray-300">{tokenSymbol} TOKENS</span> 
                </div>
                <span className="asset-amount font-medium text-gray-100">{balance}</span>
              </div>
            ))}

            {hasVisibleDownload && (
              <div className={`py-1 wallet-asset-item flex justify-between items-center ${hasVisibleArtistTokens ? 'mt-2' : ''}`}> 
                <div>
                  <span className="asset-icon mr-2">🎵</span>
                  <span className="asset-title flex-1 text-sm text-gray-300">{artistConfig.artworkTitle}</span>
                </div>
                {downloadIpfsHash ? (
                   <a 
                      href={`https://ipfs.io/ipfs/${downloadIpfsHash}`} 
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
        )}
        
      </div>
    </div>
  );
};

export default Wallet; 