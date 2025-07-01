import React, { useState } from 'react';
import { ArtistConfig, UserTokenBalances } from '../../types/artist-types';
import { SwapService, SwapQuote } from '../utils/swapUtils';
import { TreasurySwapLiteService, TreasurySwapQuote } from '../utils/treasurySwapUtils';
import { useWallet } from './MagicProvider';

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
  swapToAsset: string;
  setSwapToAsset: (asset: string) => void;
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
  swapToAmount: string;
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
  swapToAsset,
  setSwapToAsset,
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
  setShakeActive,
  swapToAmount
}) => {
    const { magic } = useWallet();
    const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
    const [isSwapping, setIsSwapping] = useState(false);

    if (!artistConfig) return null;

    // Calculate slider value for proper positioning
    const sliderValue = swapFromAsset === "USD" ? parseFloat(swapFromAmount || "0") : 0;
    const maxSliderValue = 1000; // Maximum slider range
    const minSliderValue = 1;    // Minimum slider range

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const usdString = e.target.value;
        handleSwapFromAmountChange({ target: { value: usdString } } as React.ChangeEvent<HTMLInputElement>);
    };

    const handleRealSwap = async () => {
        if (!magic || !artistConfig?.contract) {
            console.error('Magic or artist contract not available');
            return;
        }

        setIsSwapping(true);
        try {
            const provider = magic.rpcProvider;
            const { ethers } = await import('ethers');
            const browserProvider = new ethers.BrowserProvider(provider as any);
            const signer = await browserProvider.getSigner();
            
            // DEBUG: Log the artist configuration for swap debugging
            console.log('🔍 Swap Debug Info for', artistConfig.name, {
                swapAddress: artistConfig.swapAddress,
                paused: artistConfig.paused,
                hasLiquidityPool: artistConfig.hasLiquidityPool,
                contract: artistConfig.contract,
                swapFromAsset: swapFromAsset
            });
            
            // Show user that transaction is starting
            const loadingToast = window.alert || console.log;
            
            // FIXED ROUTING LOGIC: Prioritize AMM when liquidity pools exist
            const hasLiquidityPool = artistConfig.hasLiquidityPool;
            const hasTreasurySwap = artistConfig.swapAddress && !artistConfig.paused;
            
            let transactionHash = '';
            let swapType = '';
            
            if (hasLiquidityPool && swapFromAsset === "USD") {
                // ✅ PRIORITY: Use AMM for USD purchases when liquidity pools exist (live pricing)
                console.log('🏊 Using AMM system for LP-based swap (live pricing)');
                
                const swapService = new SwapService(signer);
                
                // Convert USD to ETH for AMM with proper precision
                const ethAmount = (parseFloat(swapFromAmount) / 2500).toFixed(18); // Max 18 decimals for ETH
                swapType = `$${swapFromAmount} USD → ${artistConfig.tokenName} (AMM Live Price)`;
                
                // Get actual AMM quote with proper slippage tolerance
                const quote = await swapService.getTokenQuote(artistConfig.contract, ethAmount);
                console.log('📊 AMM Quote:', {
                    ethAmount,
                    expectedTokens: quote.outputAmount,
                    minimumOutput: quote.minimumOutput,
                    frontendEstimate: artistocksInput
                });
                
                const tx = await swapService.swapEthForTokens(
                    artistConfig.contract,
                    ethAmount,
                    quote.minimumOutput  // ✅ Use AMM quote with slippage, not frontend estimate
                );
                
                await tx.wait();
                transactionHash = tx.hash;
                console.log('✅ AMM swap successful:', tx.hash);
                
            } else if (hasLiquidityPool && swapFromAsset !== "USD") {
                // ✅ Use AMM for token-to-token swaps
                console.log('🏊 Using AMM system for token-to-token swap');
                console.log('📋 Swap details:', {
                    from: swapFromAsset,
                    to: swapToAsset || artistConfig.tokenName,
                    amount: swapFromAmount
                });
                
                const swapService = new SwapService(signer);
                
                // Find FROM token config
                const fromTokenConfig = Object.values(allArtistsConfig || {}).find(
                    config => config.tokenName === swapFromAsset
                );
                
                // Find TO token config (use swapToAsset if set, otherwise fallback to artistConfig)
                const toTokenName = swapToAsset || artistConfig.tokenName;
                const toTokenConfig = Object.values(allArtistsConfig || {}).find(
                    config => config.tokenName === toTokenName
                );
                
                if (fromTokenConfig?.contract && toTokenConfig?.contract) {
                    swapType = `${swapFromAmount} ${swapFromAsset} → ${toTokenName}`;
                    
                    console.log('🎯 Token contracts:', {
                        fromToken: fromTokenConfig.contract,
                        toToken: toTokenConfig.contract,
                        fromSymbol: swapFromAsset,
                        toSymbol: toTokenName
                    });
                    
                    // IMPORTANT: Approve tokens before swap
                    const { ethers: ethersLib } = await import('ethers');
                    const fromTokenContract = new ethersLib.Contract(
                        fromTokenConfig.contract,
                        ["function approve(address spender, uint256 amount) external returns (bool)"],
                        signer
                    );
                    
                    const swapAmountWei = ethersLib.parseUnits(swapFromAmount, 18);
                    console.log('🔑 Approving tokens for swap...');
                    const approveTx = await fromTokenContract.approve(
                        '0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE', // Main swap contract
                        swapAmountWei
                    );
                    await approveTx.wait();
                    console.log('✅ Tokens approved for swap');
                    
                    // Calculate minimum output with EXTREME slippage tolerance for testing (50%)
                    const ethQuote = await swapService.getEthQuote(fromTokenConfig.contract, swapFromAmount);
                    const tokenQuote = await swapService.getTokenQuote(toTokenConfig.contract, ethQuote.outputAmount);
                    const minimumOutput = (parseFloat(tokenQuote.outputAmount) * 0.50).toString(); // 50% slippage tolerance for testing
                    
                    console.log('📊 Cross-token swap quotes:', {
                        fromAmount: swapFromAmount,
                        fromToken: swapFromAsset,
                        toToken: toTokenName,
                        ethIntermediate: ethQuote.outputAmount,
                        expectedTokens: tokenQuote.outputAmount,
                        minimumOutput,
                        slippageTolerance: '50%'
                    });
                    
                    const tx = await swapService.swapTokens(
                        fromTokenConfig.contract,
                        toTokenConfig.contract, // Use the correct TO token contract
                        swapFromAmount,
                        minimumOutput // Use calculated minimum with very lenient slippage
                    );
                    
                    await tx.wait();
                    transactionHash = tx.hash;
                    console.log('✅ AMM token swap successful:', tx.hash);
                } else {
                    throw new Error(`Missing contract addresses: FROM=${fromTokenConfig?.contract}, TO=${toTokenConfig?.contract}`);
                }
                
            } else if (hasTreasurySwap && swapFromAsset === "USD") {
                // ⚠️ FALLBACK: Use TreasurySwapLite only when no liquidity pools (fixed rate)
                console.log('🎯 Using TreasurySwapLite for Day-0 MVP swap (fixed rate fallback)');
                swapType = `$${swapFromAmount} USD → ${artistConfig.tokenName} (Fixed Rate)`;
                
                const treasurySwap = new TreasurySwapLiteService(artistConfig.swapAddress!, signer);
                const usdAmount = parseFloat(swapFromAmount);
                
                const tx = await treasurySwap.buyTokensWithUSD(usdAmount);
                await tx.wait();
                transactionHash = tx.hash;
                console.log('✅ TreasurySwapLite swap successful:', tx.hash);
                
            } else {
                throw new Error('No swap system available for this configuration');
            }
            
            // 🎉 SUCCESS - Show user-facing feedback
            if (transactionHash) {
                const successMessage = `🎉 SWAP SUCCESSFUL!\n\n${swapType}\n\nTransaction: ${transactionHash.substring(0, 10)}...`;
                alert(successMessage);
                
                // Force wallet balance refresh with delay to allow blockchain to update
                setTimeout(() => {
                    console.log('🔄 Triggering wallet balance refresh after successful transaction...');
                    
                    // Clear any cached balances to force fresh fetch
                    localStorage.removeItem('zeyodaUserTokenBalances');
                    
                    // Trigger a custom event for wallet refresh
                    const refreshEvent = new CustomEvent('refreshWalletBalances', {
                        detail: { transactionHash, swapType, forceRefresh: true }
                    });
                    window.dispatchEvent(refreshEvent);
                    
                }, 8000); // Increased from 3 to 8 seconds for better blockchain propagation
            }
            
        } catch (error: any) {
            console.error('❌ Swap failed:', error);
            
            // Better error handling
            let errorMessage = 'Swap failed: ';
            if (error?.message?.includes('user rejected')) {
                errorMessage += 'Transaction was cancelled by user';
            } else if (error?.message?.includes('insufficient funds')) {
                errorMessage += 'Insufficient funds for gas or tokens';
            } else if (error?.message?.includes('paused')) {
                errorMessage += 'Swap contract is temporarily paused';
            } else {
                errorMessage += error?.message || 'Unknown error occurred';
            }
            
            alert(errorMessage);
        } finally {
            setIsSwapping(false);
        }
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
                
                {/* Universal Amount Slider - Always visible for all swaps */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {swapFromAsset === "USD" ? "Amount Slider ($)" : `Amount Slider (${swapFromAsset})`}
                    </label>
                    <input
                        type="range"
                        min={swapFromAsset === "USD" ? minSliderValue : 1}
                        max={swapFromAsset === "USD" ? maxSliderValue : (userTokenBalances[swapFromAsset] || 1000)}
                        value={parseFloat(swapFromAmount || "0")}
                        onChange={handleSliderChange}
                        className="custom-token-slider w-full"
                        step={swapFromAsset === "USD" ? "0.01" : "1"}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{swapFromAsset === "USD" ? `$${minSliderValue}` : "1"}</span>
                        <span>{swapFromAsset === "USD" ? `$${maxSliderValue}` : `${userTokenBalances[swapFromAsset] || 1000}`}</span>
                    </div>
                </div>
                
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
                        {/* Show ALL tokens the user owns with a balance > 0 */}
                        {allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                            const userBalance = userTokenBalances[artist.tokenName] || 0;
                            const hasTokens = userBalance > 0;
                            
                            // Show token if user has it OR if it's the current artist's token (for swapping TO it)
                            if (hasTokens || artist.tokenName === artistConfig?.tokenName) {
                                return (
                                    <option key={artist.tokenName} value={artist.tokenName}>
                                        {artist.tokenName} {hasTokens ? `(${Math.floor(userBalance).toLocaleString()})` : ''}
                                    </option>
                                );
                            }
                            return null;
                        })}
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
                            value={swapFromAsset === "USD" ? artistConfig.tokenName : 
                                   (swapToAsset || (artistConfig.tokenName === "GOSH33SH" ? "JAIT33" : "GOSH33SH"))}
                            onChange={(e) => {
                                const newToAsset = e.target.value;
                                setSwapToAsset(newToAsset);
                                
                                // For token swaps, if user changes TO asset, we might want to suggest opposite FROM
                                if (swapFromAsset !== "USD" && swapFromAsset === newToAsset) {
                                    // If FROM and TO are same, switch FROM to something else
                                    const oppositeAsset = newToAsset === "GOSH33SH" ? "JAIT33" : "GOSH33SH";
                                    setSwapFromAsset(oppositeAsset);
                                }
                            }}
                            disabled={swapFromAsset === "USD"} // Only disable for USD swaps
                            className="w-2/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor disabled:opacity-50"
                            >
                            {swapFromAsset === "USD" ? (
                                // For USD swaps, only show current artist's token
                                <option value={artistConfig.tokenName}>{artistConfig.tokenName}</option>
                            ) : (
                                // For token swaps, show all available tokens except the FROM token
                                allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                                    const userBalance = userTokenBalances[artist.tokenName] || 0;
                                    // Show if different from FROM asset and either has balance or is main tokens
                                    if (artist.tokenName !== swapFromAsset && 
                                        (userBalance > 0 || ['GOSH33SH', 'JAIT33'].includes(artist.tokenName))) {
                                        return (
                                            <option key={artist.tokenName} value={artist.tokenName}>
                                                {artist.tokenName}
                                            </option>
                                        );
                                    }
                                    return null;
                                })
                            )}
                        </select>
                        <input
                            type="text"
                            id="toAmount"
                            value={Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()}
                            onChange={handleArtistocksInputChange}
                            className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor custom-token-input"
                            readOnly={true}
                        />
                    </div>
                </div>

                {/* Token Price Info and Swap System Status */}
                <div className="text-center text-sm text-gray-400 mb-4">
                    {/* Price Information */}
                    {(artistConfig.realTimePrice || artistConfig.tokenPrice) && (
                        <p>
                            1 {artistConfig.tokenName} = ${(artistConfig.realTimePrice || artistConfig.tokenPrice).toFixed(6)} USD
                            {artistConfig.hasLiquidityPool ? (
                                <span className="ml-2 text-green-400">● Live Price</span>
                            ) : (
                                <span className="ml-2 text-yellow-400">● Fallback Price</span>
                            )}
                        </p>
                    )}
                    
                    {/* Swap System Status */}
                    <div className="mt-2 p-2 bg-gray-700 rounded-lg">
                        {artistConfig.hasLiquidityPool ? (
                            <div>
                                <p className="text-green-400">🏊 AMM Pools Active</p>
                                <p className="text-xs">Live pricing via liquidity pools</p>
                                <p className="text-xs">Cross-token trading enabled</p>
                            </div>
                        ) : artistConfig.swapAddress && !artistConfig.paused ? (
                            <div>
                                <p className="text-blue-400">🎯 Day-0 MVP Active</p>
                                <p className="text-xs">Fixed Rate: 1 ETH = 1,000,000 tokens</p>
                                <p className="text-xs">TreasurySwapLite fallback</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-red-400">⚠️ No swap system available</p>
                                <p className="text-xs">Contact support for assistance</p>
                            </div>
                        )}
                    </div>
                    
                    <p className="text-xs mt-2">Minimum purchase: $1.00</p>
                </div>

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

                {/* Main Swap Button */}
                <div className="text-center">
                    <button
                        onClick={handleRealSwap}
                        disabled={isSwapping || !swapFromAmount || parseFloat(swapFromAmount) <= 0}
                        className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200 ${
                            isSwapping 
                                ? 'bg-gray-600 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 shadow-lg'
                        } text-white`}
                    >
                        {isSwapping ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing Transaction...
                            </span>
                        ) : swapFromAsset === "USD" ? (
                            `🔄 Swap $${swapFromAmount || '0'} for ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ${artistConfig.tokenName}`
                        ) : (
                            `🔄 Swap ${swapFromAmount || '0'} ${swapFromAsset} for ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ${swapToAsset || artistConfig.tokenName}`
                        )}
                    </button>
                    
                    {/* Helpful hints */}
                    <div className="mt-3 text-xs text-gray-400">
                        {!swapFromAmount || parseFloat(swapFromAmount) <= 0 ? (
                            <p>💡 Set an amount above to enable swapping</p>
                        ) : (
                            <p>💡 Transaction will be confirmed in your wallet</p>
                        )}
                    </div>
                </div>
                </div>
            )}
        </>
    );
};

export default PurchaseFlow;