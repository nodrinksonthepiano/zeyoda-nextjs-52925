import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ArtistConfig, UserTokenBalances } from '../../types/artist-types';
// SwapService removed - using direct AMM helper functions instead
// TreasurySwapLite removed - using AMM only
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

    // 🎯 HELPER: Mint download token (extracted for reuse)
    const mintDownloadToken = async (userAddress: string): Promise<string> => {
        console.log('🪙 Starting download token purchase via new API...');
        
        // Get artistId from URL - handle both /artist=joz3n and /artist=joz3n/
        const urlPath = window.location.pathname;
        let artistId = '';
        
        // Try splitting by /artist=
        if (urlPath.includes('/artist=')) {
            const parts = urlPath.split('/artist=')[1];
            artistId = parts ? parts.split('/')[0] : '';
        }
        
        // Fallback: try query params
        if (!artistId) {
            const params = new URLSearchParams(window.location.search);
            artistId = params.get('artist') || '';
        }
        
        if (!artistId) {
            console.error('❌ Could not determine artistId from URL:', urlPath);
            throw new Error('Could not determine artist from URL');
        }
        
        console.log('🔍 DEBUG: Purchasing download:', { artistId, user: userAddress, urlPath });
        
        const mintResponse = await fetch('/api/purchase/1155', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                artistId: artistId,
                assetNumber: 1,
                quantity: 1,
                userAddress: userAddress
            })
        });
        
        const mintData = await mintResponse.json();
        
        console.log('🔍 DEBUG: Mint response:', {
            status: mintResponse.status,
            ok: mintResponse.ok,
            data: mintData
        });
        
        if (mintResponse.ok) {
            console.log('✅ Download token minted successfully:', mintData.txHash);
            // Refresh download access to show the newly minted token
            refreshDownloadAccess();
            return mintData.txHash;
        } else {
            // Create user-friendly error message
            let errorMessage = `⚠️ Download Token Update\n\n`;
            
            if (mintData.error === 'Transaction not found on blockchain' || 
                mintData.error === 'Transaction still pending confirmation') {
                errorMessage += `Your payment was successful! 🎉\n\n`;
                errorMessage += `However, we need to wait for the network to confirm it.\n`;
                errorMessage += `This usually takes 1-2 minutes.\n\n`;
                errorMessage += mintData.details?.suggestion || 'Please wait a moment and try again.';
            } else {
                errorMessage += `There was an issue processing your download:\n`;
                errorMessage += mintData.error;
                
                if (mintData.details?.suggestion) {
                    errorMessage += `\n\n${mintData.details.suggestion}`;
                }
            }
            
            throw new Error(errorMessage);
        }
    };

    // 🎯 DEDICATED: Download-only purchase (no artistocks logic)
    const handleDownloadOnlyPurchase = async () => {
        if (!magic || !user) {
            console.error('Magic or user not available');
            return;
        }

        setIsSwapping(true); // ← Immediate loading state
        try {
            console.log('💰 Download-only purchase: $1.00');
            
            // Mint the download token
            const downloadTxHash = await mintDownloadToken(user);
            
            // Success feedback
            const successMessage = `🎉 DOWNLOAD PURCHASED!\n\n✅ Payment: $1.00\n🎵 Download Token Minted!\n\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
            alert(successMessage);
            
            // Refresh wallet after delay
            setTimeout(() => {
                console.log('🔄 Triggering wallet balance refresh after download purchase...');
                localStorage.removeItem('zeyodaUserTokenBalances');
                window.location.reload();
            }, 8000);
            
        } catch (error: any) {
            console.error('❌ Download purchase failed:', error);
            alert(error.message || 'Download purchase failed');
        } finally {
            setIsSwapping(false);
        }
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
            
            // Routing logic: Check for USD cash-out path
            
            let transactionHash = '';
            let swapType = '';
            let downloadTxHash = '';
            
            // Check if we should skip swap entirely (amount is 0)
            const swapAmountNum = parseFloat(swapFromAmount) || 0;
            const shouldExecuteSwap = swapAmountNum > 0;
            
            console.log('🎯 Purchase decision:', {
                swapAmount: swapAmountNum,
                shouldExecuteSwap,
                includeDownload,
                swapFromAsset,
                swapToAsset: swapToAsset || artistConfig.tokenName
            });
            
            if (shouldExecuteSwap && hasLiquidityPool && swapFromAsset === "USD") {
                // ✅ PRIORITY: Use AMM for USD purchases when liquidity pools exist (live pricing)
                console.log('🏊 Using AMM system for LP-based swap (live pricing)');
                
                // Import new swap utils
                const { swapETHForTokens, getReserves, calculateAmountOut } = await import('../utils/swapUtils');
                
                // Convert total USD amount (including download fee) to ETH for AMM with proper precision
                const ethAmount = ethers.parseEther((totalUsdAmount / 2500).toFixed(18)); // Convert to wei
                swapType = `$${totalUsdAmount} USD → ${artistConfig.tokenName}${includeDownload ? ' + Download' : ''} (AMM Live Price)`;
                
                // Get reserves and calculate expected output
                const ammAddress = artistConfig.swap;
                if (!ammAddress) throw new Error('No AMM address for this artist');
                
                const reserves = await getReserves(ammAddress, artistConfig.contract, signer.provider!);
                const expectedOut = calculateAmountOut(ethAmount, reserves.ethReserve, reserves.tokenReserve);
                const minTokensOut = (expectedOut * 95n) / 100n; // 5% slippage tolerance
                
                console.log('📊 AMM Quote:', {
                    ethAmount: ethers.formatEther(ethAmount),
                    expectedTokens: ethers.formatUnits(expectedOut, 18),
                    minimumOutput: ethers.formatUnits(minTokensOut, 18),
                    ammAddress
                });
                
                const tx = await swapETHForTokens(
                    ammAddress,
                    artistConfig.contract,
                    ethAmount,
                    minTokensOut,
                    signer
                );
                
                const receipt = await tx.wait();
                transactionHash = tx.hash;
                console.log('✅ AMM swap successful:', tx.hash);
                
                // Log protocol fee to database (0.3% of ETH input)
                try {
                    const feeAmountWei = (ethAmount * 30n) / 10000n; // 0.3%
                    
                    // Get artistId from URL
                    const urlPath = window.location.pathname;
                    let artistId = '';
                    if (urlPath.includes('/artist=')) {
                        const parts = urlPath.split('/artist=')[1];
                        artistId = parts ? parts.split('/')[0] : '';
                    }
                    if (!artistId) {
                        const params = new URLSearchParams(window.location.search);
                        artistId = params.get('artist') || '';
                    }
                    
                    await fetch('/api/protocol-fees/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            txHash: tx.hash,
                            artistId: artistId || null,
                            tokenAddress: artistConfig.contract,
                            userAddress: user,
                            swapDirection: 'ETH_TO_TOKEN',
                            feeAmountWei: feeAmountWei.toString(),
                            feeToken: 'ETH',
                            blockNumber: receipt?.blockNumber || 0
                        })
                    });
                    console.log('✅ Protocol fee logged to database');
                } catch (logError) {
                    console.error('⚠️ Failed to log protocol fee (non-critical):', logError);
                }
                
                // Trigger balance refresh
                window.dispatchEvent(new CustomEvent('transactionSuccess', {
                    detail: { type: 'swap', hash: tx.hash }
                }));
                
            } else if (hasLiquidityPool && swapFromAsset !== "USD" && swapToAsset !== "USD") {
                // ⚠️ Token-to-token swaps disabled - requires multiple UUPS artists
                console.warn('⚠️ Token-to-token swaps not yet implemented for UUPS');
                throw new Error('Token-to-token swaps require multiple artists. Coming soon!');
                
            } else if (shouldExecuteSwap && swapFromAsset !== "USD" && swapToAsset === "USD") {
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
                
            } else if (shouldExecuteSwap) {
                // No valid swap path found
                throw new Error('No swap system available for this configuration');
            } else {
                // Skip swap entirely when amount is 0
                console.log('⏭️ Skipping swap (amount = $0), proceeding to download only...');
            }
            
            // 🎯 DOWNLOAD TOKEN MINTING (after successful swap OR if no swap was needed)
            if (includeDownload && user) {
                try {
                    downloadTxHash = await mintDownloadToken(user);
                } catch (mintError: any) {
                    console.error('❌ Download token mint failed:', mintError);
                    alert(mintError.message || 'Download purchase failed');
                }
            }
            
            // 🎉 SUCCESS - Show user-facing feedback
            if (transactionHash || downloadTxHash) {
                let successMessage = '';
                
                // If only download (no swap)
                if (downloadTxHash && !transactionHash) {
                    successMessage = `🎉 DOWNLOAD PURCHASED!\n\n✅ Payment: $1.00\n🎵 Download Token Minted!\n\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
                } 
                // If both swap + download
                else if (transactionHash && downloadTxHash) {
                    successMessage = `🎉 PURCHASE SUCCESSFUL!\n\n${swapType}\n\nSwap Transaction: ${transactionHash.substring(0, 10)}...\n\n🎵 Download Token Minted! ✅\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
                }
                // If only swap (no download)
                else if (transactionHash) {
                    successMessage = `🎉 PURCHASE SUCCESSFUL!\n\n${swapType}\n\nSwap Transaction: ${transactionHash.substring(0, 10)}...`;
                    if (includeDownload) {
                        successMessage += `\n\n💡 Download processing: Your payment included $1 for download access. Download tokens are being credited to your wallet.`;
                    }
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
                        
                        // Shake the login prompts container
                        const loginContainer = document.getElementById('login-prompts-container');
                        if (loginContainer) {
                            loginContainer.classList.add('shake');
                            setTimeout(() => loginContainer.classList.remove('shake'), 500);
                        }
                        
                        // Scroll to and focus bottom chat input
                        const chatInput = document.querySelector<HTMLInputElement>('input[placeholder*="Enter your email"]');
                        if (chatInput) {
                            chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => chatInput?.focus(), 600);
                        }
                    } else {
                        // Call dedicated download-only function (clean, no artistocks logic)
                        handleDownloadOnlyPurchase();
                    }
                    }}
                    disabled={isSwapping || (isActionLoading && !!user)}
                    className={`w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 
                    ${!user ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
                >
                    {isSwapping ? 'Processing...' : 
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
                          const isCurrentArtist = artist.tokenName === artistConfig?.tokenName;

                          // Show current artist OR artists user owns
                          if (artist.tokenName && (isCurrentArtist || hasTokens)) {
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
                                    const availableAssets = ["GOSH33SH", "JAIT33", "CANCAK33"].filter(token => token !== newToAsset);
                                    const oppositeAsset = availableAssets[0] || "GOSH33SH";
                                    setSwapFromAsset(oppositeAsset);
                                }
                            }}
                            className="w-2/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                            >
                            {swapFromAsset === "USD" ? (
                                // For USD swaps, show all available artist tokens
                                allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                                    if (!artist || !artist.tokenName) return null;
                                    
                                    const isCurrentArtist = artist.tokenName === artistConfig?.tokenName;
                                    const userBalance = userTokenBalances[artist.tokenName] || 0;
                                    const hasTokens = userBalance > 0;
                                    
                                    // Show current artist OR artists user owns
                                    if (isCurrentArtist || hasTokens) {
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
                                        
                                        const isCurrentArtist = artist.tokenName === artistConfig?.tokenName;
                                        const userBalance = userTokenBalances[artist.tokenName] || 0;
                                        const hasTokens = userBalance > 0;
                                        
                                        // Show if different from FROM asset AND (current OR owned)
                                        if (artist.tokenName !== swapFromAsset && (isCurrentArtist || hasTokens)) {
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
                                    1 {artistConfig.tokenName} = ${(artistConfig.realTimePrice || artistConfig.tokenPrice).toFixed(10)} USD
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
                                        1 {fromTokenConfig.tokenName} = ${(fromTokenConfig.realTimePrice || fromTokenConfig.tokenPrice).toFixed(10)} USD
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
                                <p className="text-blue-400">🎯 AMM Pool Active</p>
                                <p className="text-xs">Live market pricing</p>
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
                        disabled={isSwapping || (!includeDownload && (!swapFromAmount || parseFloat(swapFromAmount) <= 0))}
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
                                ? `🔄 GET DOWNLOAD + ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ARTISTOCKS ($${(parseFloat(swapFromAmount || '0') + (featuredAsset?.price_usd || 1)).toFixed(2)})`
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