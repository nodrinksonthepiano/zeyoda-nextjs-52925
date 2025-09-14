import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ArtistConfig, UserTokenBalances } from '../../types/artist-types';
import { SwapService, SwapQuote } from '../utils/swapUtils';
import { TreasurySwapLiteService, TreasurySwapQuote } from '../utils/treasurySwapUtils';
import { UsdcSwapRouter } from '../utils/usdcSwapRouter';
import { useWallet } from './MagicProvider';
import { useDownloadAccess } from '../hooks/useDownloadAccess';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { getArtistContracts } from '../utils/addressRegistryFallback';

// ERC-1155 ABI for minting download tokens
const DOWNLOAD_CONTRACT_ABI = [
  "function mintDownload(address user, uint256 assetId, uint256 amount) external",
  "function owner() view returns (address)"
];

interface PurchaseFlowProps {
  user: string | null | undefined;
  artistConfig: ArtistConfig | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  featuredAsset?: any; // Add featured asset for dynamic pricing
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
  featuredAsset,
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
    const { setUsdBalance } = useUsdBalance();
    const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
    const [isSwapping, setIsSwapping] = useState(false);
    const [downloadingAssets, setDownloadingAssets] = useState<Set<number>>(new Set());
    
    // Check download access for current artist
    const { hasAccessToAsset, hasAnyAccess, downloadAccess, isLoading: checkingAccess, refreshDownloadAccess } = useDownloadAccess(
        user || null, 
        artistConfig?.name?.toLowerCase() || null
    );

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
            
            // Calculate total USD amount including download fee
            const baseUsdAmount = parseFloat(swapFromAmount);
            const downloadFee = includeDownload ? 1.0 : 0.0;
            const totalUsdAmount = baseUsdAmount + downloadFee;
            
            console.log('💰 Purchase breakdown:', {
                baseSwapAmount: baseUsdAmount,
                downloadFee: downloadFee,
                totalAmount: totalUsdAmount,
                includeDownload: includeDownload
            });
            
            // DEBUG: Log the artist configuration for swap debugging
            console.log('🔍 Swap Debug Info for', artistConfig.name, {
                swap: artistConfig.swap,
                paused: artistConfig.paused,
                hasLiquidityPool: artistConfig.hasLiquidityPool,
                contract: artistConfig.contract,
                swapFromAsset: swapFromAsset
            });
            
            // Show user that transaction is starting
            const loadingToast = window.alert || console.log;
            
            // FIXED ROUTING LOGIC: Prioritize AMM when liquidity pools exist
            const hasLiquidityPool = artistConfig.hasLiquidityPool;
            const hasTreasurySwap = artistConfig.swap && !artistConfig.paused;
            
            // Routing logic: Check for USD cash-out path
            
            let transactionHash = '';
            let swapType = '';
            let downloadTxHash = '';
            
            if (hasLiquidityPool && swapFromAsset === "USD") {
                // ✅ PRIORITY: Use AMM for USD purchases when liquidity pools exist (live pricing)
                console.log('🏊 Using AMM system for LP-based swap (live pricing)');
                
                const swapService = new SwapService(signer);
                
                // Convert total USD amount (including download fee) to ETH for AMM with proper precision
                const ethAmount = (totalUsdAmount / 2500).toFixed(18); // Max 18 decimals for ETH
                swapType = `$${totalUsdAmount} USD → ${artistConfig.tokenName}${includeDownload ? ' + Download' : ''} (AMM Live Price)`;
                
                // Get actual AMM quote with proper slippage tolerance
                const quote = await swapService.getTokenQuote(artistConfig.contract, ethAmount);
                console.log('📊 AMM Quote:', {
                    ethAmount,
                    expectedTokens: quote.outputAmount,
                    minimumOutput: quote.minimumOutput,
                    frontendEstimate: artistocksInput,
                    includesDownloadFee: includeDownload
                });
                
                const tx = await swapService.swapEthForTokens(
                    artistConfig.contract,
                    ethAmount,
                    quote.minimumOutput  // ✅ Use AMM quote with slippage, not frontend estimate
                );
                
                await tx.wait();
                transactionHash = tx.hash;
                console.log('✅ AMM swap successful:', tx.hash);
                
                // Trigger balance refresh
                window.dispatchEvent(new CustomEvent('transactionSuccess', {
                    detail: { type: 'swap', hash: tx.hash }
                }));
                
            } else if (hasLiquidityPool && swapFromAsset !== "USD" && swapToAsset !== "USD") {
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

                    // Trigger balance refresh
                    window.dispatchEvent(new CustomEvent('transactionSuccess', {
                        detail: { type: 'swap', hash: tx.hash }
                    }));
                } else {
                    throw new Error(`Missing contract addresses: FROM=${fromTokenConfig?.contract}, TO=${toTokenConfig?.contract}`);
                }
                
            } else if (hasTreasurySwap && swapFromAsset === "USD") {
                // ⚠️ FALLBACK: Use TreasurySwapLite only when no liquidity pools (fixed rate)
                console.log('🎯 Using TreasurySwapLite for Day-0 MVP swap (fixed rate fallback)');
                swapType = `$${totalUsdAmount} USD → ${artistConfig.tokenName}${includeDownload ? ' + Download' : ''} (Fixed Rate)`;
                
                const treasurySwap = new TreasurySwapLiteService(artistConfig.swap!, signer);
                
                const tx = await treasurySwap.buyTokensWithUSD(totalUsdAmount);
                await tx.wait();
                transactionHash = tx.hash;
                console.log('✅ TreasurySwapLite swap successful:', tx.hash);
                
                // Trigger balance refresh
                window.dispatchEvent(new CustomEvent('transactionSuccess', {
                    detail: { type: 'swap', hash: tx.hash }
                }));
                
            } else if (swapFromAsset !== "USD" && swapToAsset === "USD") {
                // 💰 CASH-OUT: Convert tokens to USDC → USD balance via new router
                console.log('💰 Processing USDC cash-out transaction');
                
                const tokenAmount = parseFloat(swapFromAmount);
                swapType = `${tokenAmount} ${swapFromAsset} → $${swapToAmount} USD (USDC Cash-Out)`;
                
                console.log('🏦 USDC cash-out details:', {
                    fromToken: swapFromAsset,
                    tokenAmount: tokenAmount,
                    expectedUSD: swapToAmount,
                    userAddress: user
                });
                
                // Find the token config for the FROM token
                const fromTokenConfig = Object.values(allArtistsConfig || {}).find(
                    config => config.tokenName === swapFromAsset
                );
                
                if (!fromTokenConfig?.contract) {
                    throw new Error(`Cannot find contract for token: ${swapFromAsset}`);
                }
                
                // ✅ Use USDC Swap Router (0x → Uniswap V3 fallback)
                console.log('🔄 Using USDC Swap Router for cash-out');
                
                const usdcRouter = new UsdcSwapRouter(signer);
                
                const result = await usdcRouter.executeCashOut(
                    fromTokenConfig.contract,
                    swapFromAmount,
                    user!
                );
                
                if (result.success && result.usdcReceived) {
                    transactionHash = result.txHash || '';
                    console.log('✅ USDC cash-out successful:', {
                        usdReceived: result.usdcReceived,
                        txHash: transactionHash
                    });
                    
                    // Update USD balance via context
                    await setUsdBalance(result.usdcReceived);
                    console.log('💰 USD balance updated:', result.usdcReceived);
                    
                    // Trigger balance refresh
                    window.dispatchEvent(new CustomEvent('transactionSuccess', {
                        detail: { type: 'cashout', hash: transactionHash }
                    }));
                    
                } else {
                    throw new Error(result.error || 'USDC cash-out failed');
                }
                
            } else {
                throw new Error('No swap system available for this configuration');
            }
            
            // 🎯 DOWNLOAD TOKEN MINTING (after successful swap)
            // Call backend relayer service to mint download token
            if (includeDownload && transactionHash && user) {
                console.log('🪙 Starting download token mint via backend relayer...');
                
                try {
                    const mintRequestBody = {
                        artistId: artistConfig.name?.toLowerCase() || '',
                        userAddress: user,
                        assetId: 1, // Featured asset is always #1
                        txHash: transactionHash,
                        amount: 1
                    };
                    
                    console.log('🔍 DEBUG: Sending mint request:', mintRequestBody);
                    
                    const mintResponse = await fetch('/api/mintDownload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(mintRequestBody)
                    });
                    
                    const mintData = await mintResponse.json();
                    
                    console.log('🔍 DEBUG: Mint response:', {
                        status: mintResponse.status,
                        ok: mintResponse.ok,
                        data: mintData
                    });
                    
                    if (mintResponse.ok && mintData.success) {
                        downloadTxHash = mintData.mintTxHash;
                        console.log('✅ Download token minted successfully:', downloadTxHash);
                        
                        if (mintData.alreadyOwned) {
                            console.log('ℹ️ User already owned this download');
                        }
                        
                        // Refresh download access to show the newly minted token
                        refreshDownloadAccess();
                    } else {
                        // Show the exact error from the API with helpful context
                        const errorDetails = {
                            status: mintResponse.status,
                            error: mintData.error || 'Unknown error',
                            details: mintData.details || {},
                            fullResponse: mintData
                        };
                        
                        console.error('❌ Mint API error details:', errorDetails);
                        
                        // Create user-friendly error message
                        let userErrorMessage = `⚠️ Download Token Update\n\n`;
                        
                        if (mintData.error === 'Transaction not found on blockchain' || 
                            mintData.error === 'Transaction still pending confirmation') {
                            userErrorMessage += `Your payment was successful! 🎉\n\n`;
                            userErrorMessage += `However, we need to wait for the network to confirm it.\n`;
                            userErrorMessage += `This usually takes 1-2 minutes.\n\n`;
                            userErrorMessage += mintData.details?.suggestion || 'Please wait a moment and try again.';
                            
                            // Schedule automatic retry
                            setTimeout(() => {
                                console.log('🔄 Auto-retrying download token mint...');
                                handleRealSwap();
                            }, 60000); // Try again in 1 minute
                            
                        } else {
                            userErrorMessage += `There was an issue processing your download:\n`;
                            userErrorMessage += mintData.error;
                            
                            if (mintData.details?.suggestion) {
                                userErrorMessage += `\n\n${mintData.details.suggestion}`;
                            }
                            
                            userErrorMessage += `\n\nSwap Transaction: ${transactionHash.substring(0, 10)}...`;
                            
                            if (mintData.details?.timeWaited) {
                                userErrorMessage += `\nTime waited: ${mintData.details.timeWaited}`;
                            }
                        }
                        
                        alert(userErrorMessage);
                    }
                    
                } catch (mintError: any) {
                    console.error('❌ Download token mint failed:', mintError);
                    
                    // Show detailed error to user for debugging
                    const errorMessage = mintError.message.includes('❌ Download Token Mint Failed') 
                        ? mintError.message 
                        : `⚠️ Your payment was successful, but we couldn't process the download yet.\n\n` +
                          `This usually means the network is busy.\n` +
                          `Please wait a minute and try refreshing the page.\n\n` +
                          `Error: ${mintError.message || 'Connection issue'}\n` +
                          `Swap TX: ${transactionHash.substring(0, 10)}...`;
                    
                    alert(errorMessage);
                }
            }
            
            // 🎉 SUCCESS - Show user-facing feedback
            if (transactionHash) {
                let successMessage = `🎉 PURCHASE SUCCESSFUL!\n\n${swapType}\n\nSwap Transaction: ${transactionHash.substring(0, 10)}...`;
                
                if (includeDownload && downloadTxHash) {
                    successMessage += `\n\n🎵 Download Token Minted! ✅\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
                } else if (includeDownload) {
                    successMessage += `\n\n💡 Download processing: Your payment included $1 for download access. Download tokens are being credited to your wallet.`;
                }
                
                alert(successMessage);
                
                // Force wallet balance refresh with delay to allow blockchain to update
                setTimeout(() => {
                    console.log('🔄 Triggering wallet balance refresh after successful transaction...');
                    
                    // Clear any cached balances to force fresh fetch
                    localStorage.removeItem('zeyodaUserTokenBalances');
                    
                    // Trigger a custom event for wallet refresh (includes download access refresh)
                    const refreshEvent = new CustomEvent('refreshWalletBalances', {
                        detail: { 
                            transactionHash, 
                            downloadTxHash,
                            swapType, 
                            forceRefresh: true,
                            includeDownload: includeDownload 
                        }
                    });
                    window.dispatchEvent(refreshEvent);
                    
                    // Force re-render of download access by changing a dependency
                    window.location.reload(); // Simple but effective way to refresh download status
                    
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

    const handleDownload = async (assetNumber: number) => {
        if (!user || !artistConfig) {
            alert('Please connect your wallet first');
            return;
        }

        setDownloadingAssets(prev => new Set([...prev, assetNumber]));
        try {
            console.log(`📥 Requesting download for ${artistConfig.name} asset ${assetNumber}`);
            
            const response = await fetch('/api/createSignedUrl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    artist_id: artistConfig.name?.toLowerCase(),
                    asset_number: assetNumber,
                    user_address: user
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get download URL');
            }

            console.log(`✅ Got signed URL for ${artistConfig.name} asset ${assetNumber}`);
            
            // Create a temporary link to trigger download
            const link = document.createElement('a');
            link.href = data.url;
            link.download = `${artistConfig.name}_asset_${assetNumber}.${data.file_type?.split('/')[1] || 'mp4'}`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert(`✅ Download started! Your ${artistConfig.name} asset will begin downloading shortly.`);
            
        } catch (error: any) {
            console.error('Download failed:', error);
            alert(`❌ Download failed: ${error.message}`);
        } finally {
            setDownloadingAssets(prev => {
                const newSet = new Set(prev);
                newSet.delete(assetNumber);
                return newSet;
            });
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
                        max={swapFromAsset === "USD" ? maxSliderValue : Number(userTokenBalances[swapFromAsset] || 1000)}
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

                        {/* Show all artist tokens - user can trade any direction */}
                        {allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                          if (!artist || !artist.tokenName) return null;

                          const userBalance = userTokenBalances[artist.tokenName] || 0;
                          const hasTokens = userBalance > 0;

                          // Show all main artist tokens (GOSH33SH, JAIT33) for cross-trading
                          if (artist.tokenName && ['GOSH33SH', 'JAIT33'].includes(artist.tokenName)) {
                            return (
                              <option key={`from-${id}-${artist.tokenName}`} value={artist.tokenName!}>
                                {artist.tokenName} {hasTokens ? `(${Number(ethers.formatUnits(userBalance, 18)).toLocaleString(undefined, {maximumFractionDigits: 0})})` : '(0)'}
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
                            value={swapToAsset || "USD"}
                            onChange={(e) => {
                                const newToAsset = e.target.value;
                                console.log('🔧 TO Dropdown changed:', { 
                                    from: swapToAsset, 
                                    to: newToAsset,
                                    swapFromAsset,
                                    dropdownValue: e.target.value 
                                });
                                setSwapToAsset(newToAsset);
                                
                                // For token swaps, if user changes TO asset, we might want to suggest opposite FROM
                                if (swapFromAsset !== "USD" && swapFromAsset === newToAsset) {
                                    // If FROM and TO are same, switch FROM to something else
                                    const oppositeAsset = newToAsset === "GOSH33SH" ? "JAIT33" : "GOSH33SH";
                                    setSwapFromAsset(oppositeAsset);
                                }
                            }}
                            className="w-2/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                            >
                            {swapFromAsset === "USD" ? (
                                // For USD swaps, show all available artist tokens
                                allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                                    if (!artist || !artist.tokenName) return null;
                                    
                                    // Show all main artist tokens for USD purchases
                                    if (['GOSH33SH', 'JAIT33'].includes(artist.tokenName)) {
                                        return (
                                            <option key={`to-usd-${id}-${artist.tokenName}`} value={artist.tokenName}>
                                                {artist.tokenName}
                                            </option>
                                        );
                                    }
                                    return null;
                                })
                            ) : (
                                // For token swaps, show USD + all other tokens except the FROM token
                                <>
                                    <option value="USD">USD (Cash)</option>
                                    {allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                                        if (!artist || !artist.tokenName) return null;
                                        
                                        // Show if different from FROM asset and is main tokens
                                        if (artist.tokenName !== swapFromAsset && 
                                            ['GOSH33SH', 'JAIT33'].includes(artist.tokenName)) {
                                            return (
                                                <option key={`to-${id}-${artist.tokenName}`} value={artist.tokenName}>
                                                    {artist.tokenName}
                                                </option>
                                            );
                                        }
                                        return null;
                                    })}
                                </>
                            )}
                        </select>
                        <input
                            type="text"
                            id="toAmount"
                            value={
                                swapToAsset === "USD" 
                                    ? `$${parseFloat(swapToAmount || '0').toFixed(2)}`
                                    : Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()
                            }
                            onChange={handleArtistocksInputChange}
                            className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor custom-token-input"
                            readOnly={true}
                        />
                    </div>
                </div>

                {/* Token Price Info and Swap System Status */}
                <div className="text-center text-sm text-gray-400 mb-4">
                    {/* Price Information - Show price for the token being swapped FROM */}
                    {(() => {
                        // For USD swaps, show current artist price
                        if (swapFromAsset === "USD" && artistConfig) {
                            return (
                                <p>
                                    1 {artistConfig.tokenName} = ${(artistConfig.realTimePrice || artistConfig.tokenPrice).toFixed(6)} USD
                                    {artistConfig.hasLiquidityPool ? (
                                        <span className="ml-2 text-green-400">● Live Price</span>
                                    ) : (
                                        <span className="ml-2 text-yellow-400">● Fallback Price</span>
                                    )}
                                </p>
                            );
                        }
                        
                        // For token swaps, show price of the FROM token
                        if (swapFromAsset !== "USD" && allArtistsConfig) {
                            const fromTokenConfig = Object.values(allArtistsConfig).find(
                                config => config.tokenName === swapFromAsset
                            );
                            if (fromTokenConfig) {
                                return (
                                    <p>
                                        1 {fromTokenConfig.tokenName} = ${(fromTokenConfig.realTimePrice || fromTokenConfig.tokenPrice).toFixed(6)} USD
                                        {fromTokenConfig.hasLiquidityPool ? (
                                            <span className="ml-2 text-green-400">● Live Price</span>
                                        ) : (
                                            <span className="ml-2 text-yellow-400">● Fallback Price</span>
                                        )}
                                    </p>
                                );
                            }
                        }
                        
                        return null;
                    })()}
                    
                    {/* Swap System Status */}
                    <div className="mt-2 p-2 bg-gray-700 rounded-lg">
                        {artistConfig.hasLiquidityPool ? (
                            <div>
                                <p className="text-green-400">🏊 AMM Pools Active</p>
                                <p className="text-xs">Live pricing via liquidity pools</p>
                                <p className="text-xs">Cross-token trading enabled</p>
                            </div>
                        ) : artistConfig.swap && !artistConfig.paused ? (
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
                        Include Featured Download (${featuredAsset?.price_usd || 1}.00)
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
                            includeDownload 
                                ? `🔄 GET DOWNLOAD + ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ARTISTOCKS ($${(parseFloat(swapFromAmount || '0') + 1).toFixed(2)})`
                                : `🔄 GET ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ARTISTOCKS ($${swapFromAmount || '0'})`
                        ) : (
                            // Check if swapping TO USD (cash-out)
                            swapToAsset === "USD" ? 
                                `🔄 Cash Out ${swapFromAmount || '0'} ${swapFromAsset} for $${parseFloat(swapToAmount || '0').toFixed(2)} USD` :
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