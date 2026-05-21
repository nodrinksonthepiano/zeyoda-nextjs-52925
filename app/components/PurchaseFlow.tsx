import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ArtistConfig, UserTokenBalances } from '../../types/artist-types';
// SwapService removed - using direct AMM helper functions instead
// TreasurySwapLite removed - using AMM only
import { useWallet } from './MagicProvider';
import { useDownloadAccess } from '../hooks/useDownloadAccess';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { getArtistContracts } from '../utils/addressRegistryFallback';
import { getDownloadPrice } from '../utils/downloadUtils';

// ERC-1155 ABI for minting download tokens
const DOWNLOAD_CONTRACT_ABI = [
  "function mintDownload(address user, uint256 assetId, uint256 amount) external",
  "function owner() view returns (address)"
];

function coerceBalanceToBigInt(entry: unknown): bigint {
  if (typeof entry === 'bigint') return entry;
  if (typeof entry === 'number' && Number.isFinite(entry)) {
    try {
      return BigInt(Math.trunc(entry));
    } catch {
      return 0n;
    }
  }
  if (typeof entry === 'string' && entry.trim() !== '') {
    try {
      const base = entry.includes('.') ? entry.split('.')[0] : entry;
      return BigInt(base || '0');
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function trimTokenAmountDecimalString(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
}

/** Truncate wei toward zero so at most `decimals` fractional digits (safe vs balance). */
function truncateTokenWeiForUiDecimals(wei: bigint, decimals: number): bigint {
  if (wei <= 0n) return 0n;
  if (decimals <= 0) return 0n;
  if (decimals >= 18) return wei;
  const shift = BigInt(18 - decimals);
  const step = 10n ** shift;
  return (wei / step) * step;
}

function tokenWeiToHumanSwapInput(wei: bigint, fractionalDigits: number): string {
  const w = truncateTokenWeiForUiDecimals(wei, fractionalDigits);
  const s = trimTokenAmountDecimalString(ethers.formatUnits(w, 18));
  return s === '' ? '0' : s;
}

/** Thousands separators on integer part; preserves fractional digits as given (Artistock DISPLAY). */
function formatSwapFromDisplay(fromTrimmed: string): string {
  const raw = fromTrimmed.replace(/,/g, '').trim();
  if (!raw) return '0';
  const neg = raw.startsWith('-');
  const u = neg ? raw.slice(1) : raw;
  const [whole, frac] = u.split('.');
  const wi = whole || '0';
  const grouped = wi.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const f = frac != null && frac !== '' ? `.${frac}` : '';
  return (neg ? '-' : '') + grouped + f;
}

function parseQuotedUsdRough(s: string | undefined): number {
  const n = parseFloat(String(s ?? '').replace(/[^\d.-]+/g, '') || '');
  return Number.isFinite(n) ? n : 0;
}

/** One-line cash-out CTA: receive ~proceeds; if download checked, subtract download → net (~left in wallet notion). */
function cashOutCtaSingleLine(args: {
  fromAmountTrimmed: string;
  tokenSymbol: string;
  proceedsUsd: number;
  includeDownload: boolean;
  downloadUsd: number | null | undefined;
}): string {
  const fmt = formatSwapFromDisplay(args.fromAmountTrimmed);
  const p = args.proceedsUsd.toFixed(2);
  const d =
    args.includeDownload && args.downloadUsd != null && args.downloadUsd > 0
      ? args.downloadUsd
      : null;
  if (d != null) {
    const net = args.proceedsUsd - d;
    const nf = net.toFixed(2);
    return `🔄 Cash Out ${fmt} ${args.tokenSymbol} — receive ~$${p}, download −$${d.toFixed(2)} → net ~$${nf}`;
  }
  return `🔄 Cash Out ${fmt} ${args.tokenSymbol} — receive ~$${p}`;
}

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
  /** Parent sets true once live balances arrived (avoid false insufficient before RPC). */
  swapTokenBalancesReady: boolean;
  setSwapFromAmount: (amount: string) => void;
  setIncludeDownload: (v: boolean) => void;
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

/** Slider 0…1000 = 0.0%…100.0% of token balance (BigInt-safe, never use balanceWei as DOM max). */
const TOKEN_SLIDER_PERMILLE_MAX = 1000;
/** Max fractional digits shown for Artistock amounts (FROM field / CTA labels). */
const TOKEN_AMOUNT_UI_DECIMALS = 4;

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
  swapTokenBalancesReady,
  setSwapFromAmount,
  setIncludeDownload,
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
    const { magic, getDidToken } = useWallet();
    const [tokenSliderPermille, setTokenSliderPermille] = useState(0);
    const [isSwapping, setIsSwapping] = useState(false);
    const [downloadingAssets, setDownloadingAssets] = useState<Set<number>>(new Set());
    const [confirmationMode, setConfirmationMode] = useState<'config' | 'confirm'>('config');
    const [confirmationSnapshot, setConfirmationSnapshot] = useState<{
        fromAmountTrimmed: string;
        artistocks: number;
        includeDownload: boolean;
        downloadPrice: number;
        /** USD-from only: swap dollars + optional featured download — wallet sufficiency uses this only. */
        usdSpendTotalCombined: number | null;
        usdSwapDollars: number | null;
        /** Artistock → USD quoted USD out (~) */
        cashOutUsdEstimate: number | null;
    } | null>(null);
    
    // Check download access for current artist
    const { hasAccessToAsset, hasAnyAccess, downloadAccess, isLoading: checkingAccess, refreshDownloadAccess } = useDownloadAccess(
        user || null, 
        artistConfig?.name?.toLowerCase() || null
    );

    const resolvedDownloadPrice = getDownloadPrice(featuredAsset);
    const downloadPriceLabel = resolvedDownloadPrice == null ? '—' : resolvedDownloadPrice.toFixed(2);

    // Calculate slider value for proper positioning (USD buy only)
    const maxSliderValue = 1000; // Maximum slider range
    const minSliderValue = 1;    // Minimum slider range
    const isCashOutToUsd = swapFromAsset !== 'USD' && swapToAsset === 'USD';
    const sellingFromToken = swapFromAsset !== 'USD';
    const rawTokenBalanceWei = sellingFromToken ? coerceBalanceToBigInt(userTokenBalances[swapFromAsset]) : 0n;
    const formattedTokenBalanceLabel = sellingFromToken
      ? Number(ethers.formatUnits(rawTokenBalanceWei, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '';

    const hasValidSwapFromAmount = (): boolean => {
      const t = (swapFromAmount ?? '').replace(/,/g, '').trim();
      if (t === '') return false;
      try {
        if (swapFromAsset === 'USD') {
          const n = parseFloat(t);
          return !Number.isNaN(n) && n > 0;
        }
        return ethers.parseUnits(t, 18) > 0n;
      } catch {
        return false;
      }
    };

    const handleUsdSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleSwapFromAmountChange({ target: { value: e.target.value } } as React.ChangeEvent<HTMLInputElement>);
    };

    /** Token FROM: slider = permille of balance; amount derived with BigInt (no Number(balanceWei) as range max). */
    const handleTokenSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const pv = Number.parseInt(e.target.value, 10);
      const permille = Math.min(
        TOKEN_SLIDER_PERMILLE_MAX,
        Math.max(0, Number.isFinite(pv) ? pv : 0)
      );
      setTokenSliderPermille(permille);
      if (rawTokenBalanceWei <= 0n) {
        setSwapFromAmount('');
        return;
      }
      const wei = (rawTokenBalanceWei * BigInt(permille)) / BigInt(TOKEN_SLIDER_PERMILLE_MAX);
      if (wei <= 0n) {
        setSwapFromAmount('');
        return;
      }
      const s = tokenWeiToHumanSwapInput(wei, TOKEN_AMOUNT_UI_DECIMALS);
      setSwapFromAmount(s);
    };

    /** After manual edits, shorten crazy-long fractional tails without rounding up balance. */
    const normalizeDisplayedTokenSwapFromAmount = (): void => {
      if (swapFromAsset === 'USD') return;
      const raw = (swapFromAmount ?? '').replace(/,/g, '').trim();
      if (!raw) return;
      try {
        const w = ethers.parseUnits(raw, 18);
        if (w <= 0n) return;
        const next = tokenWeiToHumanSwapInput(w, TOKEN_AMOUNT_UI_DECIMALS);
        if (next !== raw) setSwapFromAmount(next);
      } catch {
        /* incomplete paste / invalid */
      }
    };

    const sliderValueUsd = swapFromAsset === "USD" ? parseFloat(swapFromAmount || "0") : 0;

    /** Keep slider in sync when the user edits the FROM amount manually. */
    useEffect(() => {
      if (swapFromAsset === 'USD') return;
      if (!swapTokenBalancesReady || rawTokenBalanceWei <= 0n) {
        setTokenSliderPermille(0);
        return;
      }
      const t = (swapFromAmount ?? '').replace(/,/g, '').trim();
      if (t === '') {
        setTokenSliderPermille(0);
        return;
      }
      try {
        const w = ethers.parseUnits(t, 18);
        const pBig = (w * BigInt(TOKEN_SLIDER_PERMILLE_MAX)) / rawTokenBalanceWei;
        const clamped =
          pBig > BigInt(TOKEN_SLIDER_PERMILLE_MAX)
            ? TOKEN_SLIDER_PERMILLE_MAX
            : Number(pBig);
        setTokenSliderPermille(clamped);
      } catch {
        /* keep previous */
      }
    }, [swapFromAmount, swapFromAsset, rawTokenBalanceWei, swapTokenBalancesReady]);

    /** Token slider irrelevant in USD-from mode; avoids stale UI when switching. */
    useEffect(() => {
      if (swapFromAsset === 'USD') setTokenSliderPermille(0);
    }, [swapFromAsset]);

    // Capture snapshot for confirmation view (never mix token qty + USD as one "total" except USD buy.)
    const captureSnapshot = () => {
        const fromAmountTrimmed = (swapFromAmount ?? '').replace(/,/g, '').trim();
        const artistocks = Math.floor(parseFloat(swapToAmount || artistocksInput || '0'));
        const downloadPrice =
          includeDownload && resolvedDownloadPrice != null ? resolvedDownloadPrice : 0;

        const isUsdFrom = swapFromAsset === 'USD';
        let usdSwapDollars: number | null = null;
        let usdSpendTotalCombined: number | null = null;
        if (isUsdFrom) {
          const base = parseFloat(fromAmountTrimmed || '0');
          const safe = Number.isFinite(base) ? base : 0;
          usdSwapDollars = safe;
          usdSpendTotalCombined = safe + (includeDownload ? downloadPrice : 0);
        }

        const cashOutUsdEstimate =
          isCashOutToUsd && !isUsdFrom ? parseQuotedUsdRough(swapToAmount || undefined) : null;

        return {
          fromAmountTrimmed,
          artistocks,
          includeDownload,
          downloadPrice,
          usdSpendTotalCombined,
          usdSwapDollars,
          cashOutUsdEstimate,
        };
    };

    // Calculate ETH balance in USD (same as wallet chip uses)
    const ethBalance = coerceBalanceToBigInt(userTokenBalances['ETH']);
    const ethBalanceUsd = parseFloat(ethers.formatEther(ethBalance)) * 2500;

    const isBuyWithUsd = swapFromAsset === 'USD';

    /** Buy-side only: ETH wallet must cover combined USD spend (swap + optional download). */
    const isInsufficientBuy =
      confirmationMode === 'confirm' &&
      isBuyWithUsd &&
      typeof ethBalanceUsd === 'number' &&
      confirmationSnapshot?.usdSpendTotalCombined != null &&
      ethBalanceUsd < confirmationSnapshot.usdSpendTotalCombined;

    /** Cash-out: compare parsed token amount to balance (only after live balances known). */
    let isInsufficientCashOutTokens = false;
    if (
      confirmationMode === 'confirm' &&
      isCashOutToUsd &&
      confirmationSnapshot &&
      swapTokenBalancesReady
    ) {
      try {
        const cleaned = (swapFromAmount || '0').replace(/,/g, '').trim();
        const want = ethers.parseUnits(cleaned === '' ? '0' : cleaned, 18);
        const have = coerceBalanceToBigInt(userTokenBalances[swapFromAsset]);
        isInsufficientCashOutTokens = want > 0n && have < want;
      } catch {
        isInsufficientCashOutTokens = true;
      }
    }

    const confirmBlockedInsufficient =
      confirmationMode === 'confirm' &&
      (isInsufficientBuy || isInsufficientCashOutTokens);

    /** Non-blocking hint for sells when ETH is very low (still need gas for approvals / router tx) */
    const showLowGasCashOutHint =
      confirmationMode === 'confirm' &&
      isCashOutToUsd &&
      typeof ethBalanceUsd === 'number' &&
      ethBalanceUsd >= 0 &&
      ethBalanceUsd < 0.25;

    // Must run before any early return — otherwise hook order changes when artistConfig loads (breaks React / pricing UI).
    useEffect(() => {
        if (!artistConfig) return;
        if (confirmationMode === 'confirm' && confirmationSnapshot) {
            const currentSnapshot = captureSnapshot();
            if (
                currentSnapshot.fromAmountTrimmed !== confirmationSnapshot.fromAmountTrimmed ||
                currentSnapshot.includeDownload !== confirmationSnapshot.includeDownload ||
                currentSnapshot.downloadPrice !== confirmationSnapshot.downloadPrice ||
                (currentSnapshot.usdSwapDollars ?? -1) !== (confirmationSnapshot.usdSwapDollars ?? -1) ||
                (currentSnapshot.usdSpendTotalCombined ?? -1) !==
                  (confirmationSnapshot.usdSpendTotalCombined ?? -1) ||
                (currentSnapshot.cashOutUsdEstimate ?? -1) !== (confirmationSnapshot.cashOutUsdEstimate ?? -1) ||
                currentSnapshot.artistocks !== confirmationSnapshot.artistocks
            ) {
                setConfirmationMode('config');
                setConfirmationSnapshot(null);
            }
        }
    }, [
        artistConfig,
        swapFromAsset,
        swapToAsset,
        swapFromAmount,
        includeDownload,
        swapToAmount,
        artistocksInput,
        confirmationMode,
        confirmationSnapshot,
        resolvedDownloadPrice,
    ]);

    if (!artistConfig) return null;

    // 🎯 HELPER: Mint download token (extracted for reuse)
    const mintDownloadToken = async (userAddress: string): Promise<string> => {
        console.log('🪙 Starting download token purchase via new API...');
        
        // Verify getDidToken is available
        if (!getDidToken) {
            console.error('❌ getDidToken not available');
            throw new Error('Authentication not available. Please refresh the page and try again.');
        }
        
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
        
        // Verify token before making request
        const token = await getDidToken();
        if (!token) {
            console.error('❌ No DID token available');
            throw new Error('Authentication token expired. Please refresh the page and try again.');
        }
        
        const mintResponse = await authenticatedFetch('/api/public/purchase1155', {
            method: 'POST',
            body: JSON.stringify({
                artistId: artistId,
                assetNumber: 1,
                quantity: 1,
                userAddress: userAddress
            })
        }, getDidToken);
        
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
            if (resolvedDownloadPrice == null) {
                alert('Download is not available for this asset yet.');
                return;
            }
            const downloadPrice = resolvedDownloadPrice;
            console.log(`💰 Download-only purchase: $${downloadPrice.toFixed(2)}`);
            
            // Mint the download token
            const downloadTxHash = await mintDownloadToken(user);
            
            // Success feedback
            const successMessage = `🎉 DOWNLOAD PURCHASED!\n\n✅ Payment: $${downloadPrice.toFixed(2)}\n🎵 Download Token Minted!\n\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
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
            const browserProvider = new ethers.BrowserProvider(provider as any);
            const signer = await browserProvider.getSigner();
            
            const trimmedFromAmount = (swapFromAmount ?? '').replace(/,/g, '').trim();

            // Calculate total USD amount including download fee (USD → Artistock buys only)
            const baseUsdAmount =
              swapFromAsset === 'USD' ? parseFloat(trimmedFromAmount || '0') || 0 : 0;
            if (includeDownload && resolvedDownloadPrice == null) {
                alert('Featured download pricing is not set for this featured asset yet. Uncheck download or try again later.');
                return;
            }
            const downloadFee = includeDownload ? resolvedDownloadPrice! : 0.0;
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
            
            // FIXED ROUTING LOGIC: Prioritize AMM when liquidity pools exist
            const hasLiquidityPool = artistConfig.hasLiquidityPool;
            
            // Routing logic: Check for USD cash-out path
            
            let transactionHash = '';
            let swapType = '';
            let downloadTxHash = '';
            let performedCashOut = false;
            
            let shouldExecuteSwap = false;
            try {
                if (swapFromAsset === 'USD') {
                    const n = parseFloat(trimmedFromAmount);
                    shouldExecuteSwap = trimmedFromAmount !== '' && !Number.isNaN(n) && n > 0;
                } else {
                    const w = ethers.parseUnits(trimmedFromAmount === '' ? '0' : trimmedFromAmount, 18);
                    shouldExecuteSwap = w > 0n;
                }
            } catch {
                shouldExecuteSwap = false;
            }
            const swapAmountNum = swapFromAsset === 'USD' ? parseFloat(trimmedFromAmount) || 0 : 0;
            
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
                
                const {
                    swapETHForTokens,
                    estimateTokensOutFromEthIn,
                    readAmmCurveParams,
                    AMM_FEE_DENOMINATOR
                } = await import('../utils/swapUtils');
                
                // Convert total USD amount (including download fee) to ETH for AMM with proper precision
                const ethAmount = ethers.parseEther((totalUsdAmount / 2500).toFixed(18)); // Convert to wei
                swapType = `$${totalUsdAmount} USD → ${artistConfig.tokenName}${includeDownload ? ' + Download' : ''} (AMM Live Price)`;
                
                const ammAddress = artistConfig.swap;
                if (!ammAddress) throw new Error('No AMM address for this artist');
                
                const expectedOut = await estimateTokensOutFromEthIn(
                    ammAddress,
                    artistConfig.contract,
                    ethAmount,
                    signer.provider!
                );
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
                
                // Log protocol skim to database when V2 feeBps applies
                try {
                    const curve = await readAmmCurveParams(ammAddress, signer.provider!);
                    const feeAmountWei = (ethAmount * curve.feeProtocolBps) / AMM_FEE_DENOMINATOR;
                    
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
                console.warn('⚠️ Artistock-to-Artistock trading not enabled in this build');
                throw new Error(
                    'Trading one Artistock for another is not available in this rehearsal yet. Cash out to your wallet, then buy the other Artistock.'
                );
                
            } else if (shouldExecuteSwap && swapFromAsset !== "USD" && swapToAsset === "USD") {
                console.log('💰 Cash-out via AMM (Artistocks → ETH in wallet)');
                
                const fromTokenConfig = Object.values(allArtistsConfig || {}).find(
                    config => config.tokenName === swapFromAsset
                );
                
                if (!fromTokenConfig?.contract) {
                    throw new Error(`We couldn’t find ${swapFromAsset} in the catalog. Try refreshing the page.`);
                }
                if (!fromTokenConfig.hasLiquidityPool || !fromTokenConfig.swap) {
                    throw new Error(
                        'Cash-out isn’t available for this Artistock right now — the market isn’t active.'
                    );
                }
                
                let tokenWeiIn: bigint;
                try {
                    tokenWeiIn = ethers.parseUnits(trimmedFromAmount === '' ? '0' : trimmedFromAmount, 18);
                } catch (e) {
                    console.error('Invalid cash-out amount:', e);
                    throw new Error('Enter a valid amount to cash out.');
                }
                if (tokenWeiIn <= 0n) {
                    throw new Error('Enter an amount greater than zero to cash out.');
                }
                
                swapType = `Cash out ${swapFromAmount} ${swapFromAsset} (wallet balance updates after confirm)`;
                
                const { swapTokensForETH, estimateEthOutFromTokenIn } = await import('../utils/swapUtils');
                const ammAddr = fromTokenConfig.swap;
                
                const expectedEth = await estimateEthOutFromTokenIn(
                    ammAddr,
                    fromTokenConfig.contract,
                    tokenWeiIn,
                    signer.provider!
                );
                if (expectedEth <= 0n) {
                    throw new Error('This trade would return nothing — try a smaller amount or check the market.');
                }
                const minEthOut = (expectedEth * 95n) / 100n;
                
                console.log('📊 Cash-out AMM quote:', {
                    tokenIn: swapFromAsset,
                    tokenWei: tokenWeiIn.toString(),
                    expectedEth: ethers.formatEther(expectedEth),
                    minEth: ethers.formatEther(minEthOut),
                    amm: ammAddr
                });
                
                const tx = await swapTokensForETH(
                    ammAddr,
                    fromTokenConfig.contract,
                    tokenWeiIn,
                    minEthOut,
                    signer
                );
                await tx.wait();
                transactionHash = tx.hash;
                console.log('✅ Cash-out swap confirmed:', tx.hash);
                
                window.dispatchEvent(new CustomEvent('transactionSuccess', {
                    detail: { type: 'cashout', hash: transactionHash }
                }));
                performedCashOut = true;
                
            } else if (shouldExecuteSwap) {
                // No valid swap path found
                throw new Error('No swap system available for this configuration');
            } else {
                // Skip swap entirely when amount is 0
                console.log('⏭️ Skipping swap (amount = $0), proceeding to download only...');
            }
            
            // 🎯 Featured download: never bundled with the swap tx. USD buy = mint after swap; cash-out = refresh then mint if affordable.
            let downloadMintFailed = false;
            let downloadMintError: string | null = null;
            if (includeDownload && user && resolvedDownloadPrice != null) {
                if (swapFromAsset === 'USD') {
                    try {
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        downloadTxHash = await mintDownloadToken(user);
                    } catch (mintError: any) {
                        console.error('❌ Download token mint failed:', mintError);
                        downloadMintFailed = true;
                        downloadMintError = mintError.message || 'Download purchase failed';
                        if (
                            mintError.message?.includes('token') ||
                            mintError.message?.includes('Authentication')
                        ) {
                            downloadMintError =
                                'Authentication expired. Please refresh the page and your download token will be minted automatically.';
                        }
                        if (!transactionHash) {
                            alert(downloadMintError);
                        }
                    }
                }
                if (performedCashOut) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent('refreshWalletBalances', {
                                detail: { forceRefresh: true, reason: 'post-cashout-download' },
                            })
                        );
                        await new Promise((resolve) => setTimeout(resolve, 2400));
                        const balWei = await browserProvider.getBalance(user as string);
                        const usdApprox = parseFloat(ethers.formatEther(balWei)) * 2500;
                        const dl = resolvedDownloadPrice;
                        if (!Number.isFinite(usdApprox) || usdApprox < dl - 1e-6) {
                            throw new Error(
                                `Featured download (~$${dl.toFixed(
                                    2
                                )}) needs a bit more wallet value after cash-out (~$${usdApprox.toFixed(
                                    2
                                )} now). Your cash-out is done—add value and unlock the download from here when you're ready.`
                            );
                        }
                        downloadTxHash = await mintDownloadToken(user);
                    } catch (mintError: any) {
                        console.error('❌ Post-cash-out download mint failed:', mintError);
                        downloadMintFailed = true;
                        downloadMintError = mintError.message || 'Download purchase failed';
                        if (
                            mintError.message?.includes('token') ||
                            mintError.message?.includes('Authentication')
                        ) {
                            downloadMintError =
                                'Authentication expired. Please refresh the page and try unlocking the download again.';
                        }
                    }
                }
            }
            
            // 🎉 SUCCESS - Show user-facing feedback
            if (transactionHash || downloadTxHash) {
                let successMessage = '';
                
                // If only download (no swap)
                if (downloadTxHash && !transactionHash) {
                    const dp = resolvedDownloadPrice ?? 0;
                    successMessage = `🎉 DOWNLOAD PURCHASED!\n\n✅ Payment: $${dp.toFixed(2)}\n🎵 Download Token Minted!\n\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
                } 
                // If both swap + download
                else if (transactionHash && downloadTxHash) {
                    successMessage = `🎉 PURCHASE SUCCESSFUL!\n\n${swapType}\n\nSwap Transaction: ${transactionHash.substring(0, 10)}...\n\n🎵 Download Token Minted! ✅\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
                }
                // If only swap (no download) OR swap succeeded but download mint failed
                else if (transactionHash) {
                    successMessage = `🎉 PURCHASE SUCCESSFUL!\n\n${swapType}\n\nSwap Transaction: ${transactionHash.substring(0, 10)}...`;
                    if (includeDownload && downloadMintFailed) {
                        const dp = resolvedDownloadPrice ?? 0;
                        if (performedCashOut) {
                            successMessage += `\n\nCash-out completed successfully.\n\nThe featured download (~$${dp.toFixed(
                                2
                            )}) couldn’t unlock yet:\n${downloadMintError || 'Try again once your wallet balance updates, or toggle the checkbox off for cash-out only.'}`;
                        } else {
                            successMessage += `\n\n⚠️ Download token issue:\nYour swap succeeded, including ~$${dp.toFixed(
                                2
                            )} for the featured download in this flow—but minting ran into something:\n\n${downloadMintError || 'Please try again after refresh.'}`;
                        }
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
            } else if (error?.message?.includes('Insufficient output')) {
                errorMessage +=
                    'The trade moved too much for the limits we set — try again with a slightly smaller amount.';
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
                    className="custom-buy-button purchase-download-cta w-full text-lg"
                >
                    {isSwapping ? 'Processing...' : 
                    !user ? `$${downloadPriceLabel} INCLUDES PERMANENT ACCESS (SIGN IN TO SELECT)` : `GET DOWNLOAD ($${downloadPriceLabel})`}
                </button>
                </div>
            )}

            {user && globalSafewordVerified && !purchaseConfirmationData && (
                <div className="swap-panel-halo-wrap swap-panel-halo-wrap--linen max-w-2xl mx-auto mb-8">
                <div className="purchase-slider-section mock-ui-section swap-panel-glimmer p-4 md:p-6 shadow-xl rounded-lg border border-gray-700 backdrop-blur-md">
                <h3 className="text-xl font-semibold mb-3 text-center text-white">
                    Purchase Options
                </h3>
                
                {user && sellingFromToken && !swapTokenBalancesReady && (
                    <div className="mb-4 p-3 bg-blue-900/30 border border-blue-600 rounded-lg">
                        <p className="text-sm text-blue-100">Loading your Artistock balances…</p>
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {swapFromAsset === 'USD' ? 'Amount Slider ($)' : `Amount Slider (${swapFromAsset} balance)`}
                    </label>
                    {swapFromAsset === 'USD' ? (
                      <>
                        <input
                          type="range"
                          min={minSliderValue}
                          max={maxSliderValue}
                          value={Math.min(Math.max(sliderValueUsd || minSliderValue, minSliderValue), maxSliderValue)}
                          onChange={handleUsdSliderChange}
                          className="custom-token-slider w-full"
                          step="0.01"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>${minSliderValue}</span>
                          <span>${maxSliderValue}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <input
                          type="range"
                          min={0}
                          max={TOKEN_SLIDER_PERMILLE_MAX}
                          step={1}
                          disabled={!swapTokenBalancesReady || rawTokenBalanceWei <= 0n || isSwapping}
                          value={Math.min(Math.max(tokenSliderPermille, 0), TOKEN_SLIDER_PERMILLE_MAX)}
                          onChange={handleTokenSliderChange}
                          className="custom-token-slider w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Slide to choose what share of your balance to swap. Available:~{' '}
                          {formattedTokenBalanceLabel} {swapFromAsset}
                          {!swapTokenBalancesReady ? ' (confirming…)' : ''}.
                        </p>
                      </>
                    )}
                </div>
                
                <div className="swap-silver-bar mb-4">
                <div className="swap-silver-bar-row">
                    <label className="swap-silver-bar-label">FROM</label>
                    <div className="flex items-center space-x-2">
                    <select 
                        id="fromAsset"
                        value={swapFromAsset} 
                        onChange={(e) => {
                        const prev = swapFromAsset;
                        const next = e.target.value;
                        setSwapFromAsset(next);
                        if (next === 'USD' && prev !== 'USD') {
                            setSwapFromAmount('20.00');
                            setIncludeDownload(true);
                            setTokenSliderPermille(0);
                        }
                        if (next !== 'USD') {
                            if (prev !== next) {
                              setSwapFromAmount('');
                              setTokenSliderPermille(0);
                            }
                        }
                        }}
                        className="swap-silver-bar-select w-2/5 p-2 rounded-md"
                    >
                        <option value="USD">USD (Cash)</option>

                        {/* Show all artist tokens - user can trade any direction */}
                        {allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                          if (!artist || !artist.tokenName) return null;

                          const userBalanceBn = coerceBalanceToBigInt(userTokenBalances[artist.tokenName]);
                          const hasTokens = userBalanceBn > 0n;
                          const isCurrentArtist = artist.tokenName === artistConfig?.tokenName;

                          // Show current artist OR artists user owns
                          if (artist.tokenName && (isCurrentArtist || hasTokens)) {
                            return (
                              <option key={`from-${id}-${artist.tokenName}`} value={artist.tokenName!}>
                                {artist.tokenName} {hasTokens ? `(${Number(ethers.formatUnits(userBalanceBn, 18)).toLocaleString(undefined, {maximumFractionDigits: 0})})` : '(0)'}
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
                        onBlur={swapFromAsset === 'USD' ? undefined : normalizeDisplayedTokenSwapFromAmount}
                        className="swap-silver-bar-input flex-grow p-2 rounded-md custom-token-input"
                    />
                    </div>
                </div>

                <div className="swap-silver-bar-divider" aria-hidden="true" />

                <div className="swap-silver-bar-row">
                    <label className="swap-silver-bar-label">TO</label>
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
                            className="swap-silver-bar-select w-2/5 p-2 rounded-md"
                            >
                            {swapFromAsset === "USD" ? (
                                // For USD swaps, show all available artist tokens
                                allArtistsConfig && Object.entries(allArtistsConfig).map(([id, artist]) => {
                                    if (!artist || !artist.tokenName) return null;
                                    
                                    const isCurrentArtist = artist.tokenName === artistConfig?.tokenName;
                                    const ub = coerceBalanceToBigInt(userTokenBalances[artist.tokenName]);
                                    const hasTokens = ub > 0n;
                                    
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
                                        const ub = coerceBalanceToBigInt(userTokenBalances[artist.tokenName]);
                                        const hasTokens = ub > 0n;
                                        
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
                            className="swap-silver-bar-input flex-grow p-2 rounded-md custom-token-input"
                            readOnly={true}
                        />
                    </div>
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
                                <p className="text-green-400">🏊 Market active</p>
                                <p className="text-xs">Buying Artistocks (wallet balance) and Cash out work while the pool is active.</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Trading one Artistock for another isn&apos;t available yet — cash out first, then buy.
                                </p>
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
                    
                    <p className="text-xs mt-2">
                        Minimum purchase (USD → Artistocks): $1.00
                    </p>
                    <p className="text-xs mt-1 text-gray-500">
                        Cash-outs can be small on testnet; keep a little ETH for gas.
                    </p>
                </div>

                <div className="mt-6 space-y-2">
                    <div className="flex items-center">
                    <input
                        id="includeDownload"
                        type="checkbox"
                        checked={includeDownload}
                        onChange={handleIncludeDownloadChange}
                        disabled={resolvedDownloadPrice == null}
                        className="h-4 w-4 rounded border-gray-300 text-accentColor focus:ring-accentColor disabled:opacity-40"
                    />
                    <label htmlFor="includeDownload" className="ml-2 block text-sm text-gray-200">
                        {`Include Featured Download ($${downloadPriceLabel})`}
                    </label>
                    </div>
                    {resolvedDownloadPrice == null ? (
                      <p className="text-xs text-gray-500 ml-6">
                        Featured download pricing isn&apos;t loaded for this asset yet.
                      </p>
                    ) : sellingFromToken && isCashOutToUsd ? (
                      <p className="text-xs text-gray-400 ml-6">
                        After cash-out, we&apos;ll try to unlock the featured download if your wallet looks like it has enough value for it (separate step from the swap).
                      </p>
                    ) : swapFromAsset === 'USD' ? (
                      <p className="text-xs text-gray-400 ml-6">
                        Included in the same ETH spend as your buy when you confirm.
                      </p>
                    ) : null}
                </div>

                {/* Confirm: wallet + future checkout rails (stub only — wallet is live) */}
                {confirmationMode === 'confirm' && confirmationSnapshot && (
                    <div className="mb-4 mt-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                className="p-2 bg-blue-600 text-white rounded text-xs font-medium border-2 border-blue-500 flex items-center justify-center gap-1"
                                disabled
                            >
                                <span className="text-xs">💰</span>
                                <span className="text-xs">Wallet (approx.)</span>
                                <span className="text-xs font-semibold">
                                    {ethBalanceUsd > 0 ? `$${ethBalanceUsd.toFixed(2)}` : '$0.00'}
                                </span>
                            </button>
                            <button
                                type="button"
                                className="p-2 bg-gray-700 text-gray-400 rounded text-xs border border-gray-600 flex items-center justify-center gap-1"
                                disabled
                            >
                                <span className="text-xs opacity-50">Venmo</span>
                                <span className="text-[10px] opacity-50">soon</span>
                            </button>
                            <button
                                type="button"
                                className="p-2 bg-gray-700 text-gray-400 rounded text-xs border border-gray-600 flex items-center justify-center gap-1"
                                disabled
                            >
                                <span className="text-xs opacity-50">PayPal</span>
                                <span className="text-[10px] opacity-50">soon</span>
                            </button>
                            <button
                                type="button"
                                className="p-2 bg-gray-700 text-gray-400 rounded text-xs border border-gray-600 flex items-center justify-center gap-1"
                                disabled
                            >
                                <span className="text-xs opacity-50">Card</span>
                                <span className="text-[10px] opacity-50">soon</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Buy-side only: ETH must cover USD total (never treat token amounts as USD here) */}
                {confirmationMode === 'confirm' && isInsufficientBuy && confirmationSnapshot && (
                    <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-600 rounded-lg">
                        <p className="text-sm text-red-400">
                            Insufficient funds. Add $
                            {(confirmationSnapshot.usdSpendTotalCombined != null ? confirmationSnapshot.usdSpendTotalCombined - ethBalanceUsd : 0).toFixed(2)} to continue.
                        </p>
                    </div>
                )}

                {confirmationMode === 'confirm' && isCashOutToUsd && isInsufficientCashOutTokens && (
                    <div className="mb-4 p-3 bg-amber-900/30 border border-amber-600 rounded-lg">
                        <p className="text-sm text-amber-200">
                            Not enough {swapFromAsset} for this cash-out. Reduce the amount or adjust your
                            balance.
                        </p>
                    </div>
                )}

                {confirmationMode === 'confirm' && showLowGasCashOutHint && swapTokenBalancesReady && !isInsufficientCashOutTokens && (
                    <div className="mb-4 p-3 bg-gray-800 border border-gray-600 rounded-lg">
                        <p className="text-sm text-gray-300">
                            Low ETH balance—you may need more Sepolia ETH for gas (approve / router transaction).
                        </p>
                    </div>
                )}

                {/* Main Swap Button - Reused for both modes */}
                <div className="text-center">
                    <button
                        onClick={confirmationMode === 'config' 
                            ? () => {
                                if (swapFromAsset !== 'USD' && user && !swapTokenBalancesReady) return;
                                const snapshot = captureSnapshot();
                                setConfirmationSnapshot(snapshot);
                                setConfirmationMode('confirm');
                            }
                            : async () => {
                                setIsSwapping(true);
                                try {
                                    await handleRealSwap();
                                    setConfirmationMode('config');
                                    setConfirmationSnapshot(null);
                                } catch (error) {
                                    // Stay in confirm mode on error, existing error handling will show message
                                } finally {
                                    setIsSwapping(false);
                                }
                            }
                        }
                        disabled={isSwapping || 
                                  (!!user && sellingFromToken && !swapTokenBalancesReady) ||
                                  (includeDownload && resolvedDownloadPrice == null) ||
                                  !hasValidSwapFromAmount() ||
                                  confirmBlockedInsufficient}
                        className={`w-full font-bold text-lg transition-all duration-200 ${
                            isSwapping || confirmBlockedInsufficient || (!!user && sellingFromToken && !swapTokenBalancesReady)
                                ? 'py-4 px-6 rounded-lg bg-gray-600 cursor-not-allowed text-white'
                                : 'custom-buy-button text-white'
                        }`}
                    >
                        {isSwapping ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing Transaction...
                            </span>
                        ) : confirmationMode === 'confirm' && confirmationSnapshot ? (
                            swapFromAsset === 'USD' ? (
                                confirmationSnapshot.includeDownload &&
                                confirmationSnapshot.usdSpendTotalCombined != null ? (
                                    `🔄 GET DOWNLOAD + ${confirmationSnapshot.artistocks.toLocaleString()} ARTISTOCKS ($${confirmationSnapshot.usdSpendTotalCombined.toFixed(2)})`
                                ) : (
                                    `🔄 GET ${confirmationSnapshot.artistocks.toLocaleString()} ARTISTOCKS ($${(confirmationSnapshot.usdSwapDollars ?? 0).toFixed(2)})`
                                )
                            ) : swapToAsset === 'USD' ? (
                                cashOutCtaSingleLine({
                                  fromAmountTrimmed: confirmationSnapshot.fromAmountTrimmed,
                                  tokenSymbol: swapFromAsset,
                                  proceedsUsd:
                                    confirmationSnapshot.cashOutUsdEstimate ??
                                    parseQuotedUsdRough(swapToAmount),
                                  includeDownload: confirmationSnapshot.includeDownload,
                                  downloadUsd:
                                    confirmationSnapshot.downloadPrice > 0
                                      ? confirmationSnapshot.downloadPrice
                                      : null,
                                })
                            ) : (
                                `🔄 Swap ${formatSwapFromDisplay(confirmationSnapshot.fromAmountTrimmed)} ${swapFromAsset} for ${confirmationSnapshot.artistocks.toLocaleString()} ${swapToAsset || artistConfig.tokenName}`
                            )
                        ) : swapFromAsset === 'USD' ? (
                                includeDownload && resolvedDownloadPrice != null ? (
                                    `🔄 GET DOWNLOAD + ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ARTISTOCKS ($${(parseFloat(swapFromAmount || '0') + resolvedDownloadPrice).toFixed(2)})`
                                ) : (
                                    `🔄 GET ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ARTISTOCKS ($${parseFloat(swapFromAmount || '0').toFixed(2)})`
                                )
                        ) : swapToAsset === 'USD' ? (
                                cashOutCtaSingleLine({
                                  fromAmountTrimmed: (swapFromAmount || '').replace(/,/g, '').trim(),
                                  tokenSymbol: swapFromAsset,
                                  proceedsUsd: parseQuotedUsdRough(swapToAmount),
                                  includeDownload,
                                  downloadUsd:
                                    includeDownload && resolvedDownloadPrice != null
                                      ? resolvedDownloadPrice
                                      : null,
                                })
                        ) : (
                                `🔄 Swap ${formatSwapFromDisplay((swapFromAmount || '').replace(/,/g, '').trim())} ${swapFromAsset} for ${Math.floor(parseFloat(swapToAmount || artistocksInput || '0')).toLocaleString()} ${swapToAsset || artistConfig.tokenName}`
                        )}
                    </button>
                    
                    {/* Helpful hints */}
                    <div className="mt-3 text-xs text-gray-400">
                        {!!user && sellingFromToken && !swapTokenBalancesReady ? (
                            <p className="text-blue-300">⏳ Confirming balances from the chain…</p>
                        ) : !hasValidSwapFromAmount() ? (
                            <p>💡 Set an amount above to enable swapping</p>
                        ) : (
                            <p>💡 Transaction will be confirmed in your wallet</p>
                        )}
                    </div>
                </div>
                </div>
                </div>
            )}
        </>
    );
};

export default PurchaseFlow;