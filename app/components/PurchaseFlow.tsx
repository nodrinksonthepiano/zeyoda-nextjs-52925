import React from 'react';
import { ArtistConfig, UserTokenBalances } from '../../types/artist-types';

interface PurchaseFlowProps {
  user: string | null;
  artistConfig: ArtistConfig | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  isActionLoading: boolean;
  hasPurchasedDownload: boolean;
  globalSafewordVerified: boolean;
  purchaseConfirmationData: string | null;
  swapFromAsset: string;
  setSwapFromAsset: (asset: string) => void;
  unlockedArtistStates: { [key: string]: boolean };
  userTokenBalances: UserTokenBalances;
  swapFromAmount: string;
  handleSwapFromAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  artistocksInput: string;
  handleArtistocksInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  includeDownload: boolean;
  handleIncludeDownloadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  totalPurchasePrice: number;
  handlePreviewSwap: () => void;
  handleDollarPurchase: () => void;
  setShakeActive: (active: boolean) => void;
}

const PurchaseFlow: React.FC<PurchaseFlowProps> = ({
  user,
  artistConfig,
  allArtistsConfig,
  isActionLoading,
  hasPurchasedDownload,
  globalSafewordVerified,
  purchaseConfirmationData,
  swapFromAsset,
  setSwapFromAsset,
  unlockedArtistStates,
  userTokenBalances,
  swapFromAmount,
  handleSwapFromAmountChange,
  artistocksInput,
  handleArtistocksInputChange,
  includeDownload,
  handleIncludeDownloadChange,
  totalPurchasePrice,
  handlePreviewSwap,
  handleDollarPurchase,
  setShakeActive
}) => {
    if (!artistConfig) return null;

    // Calculate slider value for proper positioning
    const sliderValue = swapFromAsset === "USD" ? parseFloat(swapFromAmount || "0") : 0;
    const maxSliderValue = 1000; // Maximum slider range
    const minSliderValue = 1;    // Minimum slider range

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const usdString = e.target.value;
        handleSwapFromAmountChange({ target: { value: usdString } } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
        <>
            {!hasPurchasedDownload && (!user || (user && !globalSafewordVerified)) && (
                <div className="my-4 w-full max-w-md mx-auto">
                <button
                    onClick={() => {
                    if (!user) {
                        setShakeActive(true);
                        setTimeout(() => setShakeActive(false), 500);
                        const commandInput = document.querySelector<HTMLInputElement>('input[placeholder="you@example.com"]');
                        commandInput?.focus();
                    } else {
                        handleDollarPurchase();
                    }
                    }}
                    disabled={isActionLoading && !!user}
                    className={`w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 
                    ${!user ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
                >
                    {isActionLoading && !!user ? 'Processing...' : 
                    !user ? '$1.00 INCLUDES PERMANENT ACCESS (SIGN IN TO SELECT)' : `GET DOWNLOAD ($${(1).toFixed(2)})`}
                </button>
                </div>
            )}

            {user && globalSafewordVerified && !purchaseConfirmationData && (
                <div className="purchase-slider-section mock-ui-section p-4 md:p-6 bg-gray-800 bg-opacity-70 shadow-xl rounded-lg border border-gray-700 backdrop-blur-md mb-8 max-w-2xl mx-auto">
                <h3 className="text-xl font-semibold mb-3 text-center text-white">Purchase Options</h3>
                
                {/* Token Amount Slider - This was missing! */}
                {swapFromAsset === "USD" && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Amount Slider</label>
                        <input
                            type="range"
                            min={minSliderValue}
                            max={maxSliderValue}
                            value={sliderValue}
                            onChange={handleSliderChange}
                            className="custom-token-slider w-full"
                            step="0.01"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>${minSliderValue}</span>
                            <span>${maxSliderValue}</span>
                        </div>
                    </div>
                )}
                
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">FROM</label>
                    <div className="flex items-center space-x-2">
                    <select 
                        id="fromAsset"
                        value={swapFromAsset} 
                        onChange={(e) => {
                        setSwapFromAsset(e.target.value);
                        }}
                        className="w-2/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                    >
                        <option value="USD">USD (Cash)</option>
                        {allArtistsConfig && (
                        unlockedArtistStates[artistConfig.name.toLowerCase()] ? (
                            Object.entries(allArtistsConfig).map(([id, artist]) => {
                            const isOwned = userTokenBalances[artist.tokenName] && userTokenBalances[artist.tokenName] > 0;
                            if (isOwned || id === artistConfig.name.toLowerCase()) {
                                return <option key={artist.tokenName} value={artist.tokenName}>{artist.tokenName}</option>;
                            }
                            return null;
                            })
                        ) : (
                            (userTokenBalances[artistConfig.tokenName] && userTokenBalances[artistConfig.tokenName] > 0 || artistConfig.name.toLowerCase() === artistConfig.name.toLowerCase()) && (
                            <option key={artistConfig.tokenName} value={artistConfig.tokenName}>{artistConfig.tokenName}</option>
                            )
                        )
                        )}
                    </select>
                    <input
                        type="text"
                        id="fromAmount"
                        value={swapFromAmount}
                        onChange={handleSwapFromAmountChange}
                        className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor custom-token-input"
                    />
                    </div>
                </div>
                
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1">TO</label>
                    <div className="flex items-center space-x-2">
                        <select 
                            id="toAsset"
                            value={artistConfig.tokenName}
                            disabled
                            className="w-2/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                            >
                            <option value={artistConfig.tokenName}>{artistConfig.tokenName}</option>
                        </select>
                        <input
                            type="text"
                            id="toAmount"
                            value={artistocksInput}
                            onChange={handleArtistocksInputChange}
                            className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor custom-token-input"
                            readOnly={swapFromAsset === 'USD'}
                        />
                    </div>
                </div>

                {/* Token Price Info */}
                {artistConfig.tokenPrice && (
                    <p className="text-center text-sm text-gray-400 mb-4">
                        1 {artistConfig.tokenName} = ${artistConfig.tokenPrice.toFixed(4)} USD (Minimum purchase: $1.00)
                    </p>
                )}

                <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center">
                    <input
                        id="includeDownload"
                        type="checkbox"
                        checked={includeDownload}
                        onChange={handleIncludeDownloadChange}
                        className="h-4 w-4 rounded border-gray-300 text-accentColor focus:ring-accentColor"
                    />
                    <label htmlFor="includeDownload" className="ml-2 block text-sm text-gray-200">
                        Include Featured Download ($1.00)
                    </label>
                    </div>
                </div>
                <button 
                    onClick={handlePreviewSwap}
                    className="w-full mt-4 px-6 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500 custom-buy-button"
                    disabled={isActionLoading}
                >
                {isActionLoading ? 'Loading...' : `Get Download (${totalPurchasePrice > 0 ? `$${totalPurchasePrice.toFixed(2)}` : ''})`}
                </button>
                </div>
            )}
        </>
    );
};

export default PurchaseFlow; 