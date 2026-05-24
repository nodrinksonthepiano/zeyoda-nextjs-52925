import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import { useAllArtistsDownloadAccess } from '../hooks/useDownloadAccess';
import { useWalletBalances } from '../hooks/useWalletBalances';
import { useOwnedArtistsEarnings } from '../hooks/useOwnedArtistsEarnings';
import { useTreasuryEarnings } from '../hooks/useTreasuryEarnings';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useWallet } from './MagicProvider';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { toBigIntStrict } from '../utils/bigint';

import { ArtistConfig } from '../../types/artist-types';

interface UserTokenBalances {
  [tokenSymbol: string]: bigint;
}

interface AssetMetadata {
  id: string;
  artist_id: string;
  asset_number: number;
  file_url: string;
  file_type: string;
  metadata: any;
}

interface FeedbackItem {
  id: string;
  message: string;
  submitted_by: string;
  source: string;
  status: string;
  artist_id: string | null;
  created_at: string;
}

interface WalletProps {
  artistConfig: ArtistConfig | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  userTokenBalances: UserTokenBalances;
  showAssetsPanel: boolean;
  onClose: () => void;
  userAddress?: string;
  magic?: any;
  isAdmin?: boolean;
  /** When true, dims the panel during vault launch so the ceremony stays the focus */
  vaultLaunchDimmed?: boolean;
}

const Wallet: React.FC<WalletProps> = ({
  artistConfig,
  allArtistsConfig,
  userTokenBalances: initialBalances,
  showAssetsPanel,
  onClose,
  userAddress,
  magic,
  isAdmin = false,
  vaultLaunchDimmed = false,
}) => {
  const [downloadingAssets, setDownloadingAssets] = useState<Set<string>>(new Set());
  const [assetMetadata, setAssetMetadata] = useState<{ [key: string]: AssetMetadata }>({});
  const [showUsdBalance, setShowUsdBalance] = useState<boolean>(true);
  const [lpPanelArtistId, setLpPanelArtistId] = useState<string | null>(null);
  const [lpPct, setLpPct] = useState<number>(0);
  const [quoteUsd, setQuoteUsd] = useState<string>('0.00');
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [showCashPanel, setShowCashPanel] = useState<boolean>(false);
  const [showSendEthPanel, setShowSendEthPanel] = useState<boolean>(false);
  const [sendEthTo, setSendEthTo] = useState<string>('');
  const [sendEthAmount, setSendEthAmount] = useState<string>('');
  const [isSendingEth, setIsSendingEth] = useState<boolean>(false);
  const [cashPct, setCashPct] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<string>('0.00');
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [walletIdentityExpanded, setWalletIdentityExpanded] = useState(false);
  /** Per-artist panel open state; `undefined`/`true` = expanded (default), `false` = collapsed */
  const [assetArtistExpanded, setAssetArtistExpanded] = useState<Record<string, boolean>>({});
  const [earningsArtistExpanded, setEarningsArtistExpanded] = useState<Record<string, boolean>>({});
  const isAssetArtistOpen = useCallback(
    (artistId: string) => assetArtistExpanded[artistId] !== false,
    [assetArtistExpanded]
  );
  const toggleAssetArtist = useCallback((artistId: string) => {
    setAssetArtistExpanded((prev) => {
      const open = prev[artistId] !== false;
      return { ...prev, [artistId]: !open };
    });
  }, []);
  const isEarningsArtistOpen = useCallback(
    (artistId: string) => earningsArtistExpanded[artistId] !== false,
    [earningsArtistExpanded]
  );
  const toggleEarningsArtist = useCallback((artistId: string) => {
    setEarningsArtistExpanded((prev) => {
      const open = prev[artistId] !== false;
      return { ...prev, [artistId]: !open };
    });
  }, []);
  const { showToast } = useToast();
  const { usdBalance, isLoading: usdLoading, refreshBalance: refreshUsdBalance } = useUsdBalance();
  const { getDidToken } = useWallet();
  const router = useRouter();

  // Use the new wallet balances hook
  const { 
    balances: realTimeBalances, 
    isLoading: balancesLoading, 
    error: balancesError, 
    lastFetchTime, 
    refreshBalances 
  } = useWalletBalances({
    magic,
    userAddress: userAddress || null,
    allArtistsConfig,
    // Fetch on mount whenever the user session is live so PurchaseFlow (and the rest of the page)
    // has fresh balances without opening the wallet panel first.
    autoRefreshOnMount: Boolean(userAddress && magic && allArtistsConfig),
    suspendAutoRefresh: (window as any).onboardingMode || false
  });

  // Using strict BigInt conversion utility to prevent precision loss

  // Convert initial balances to BigInt
  const userTokenBalances = useMemo(() => {
    const converted: UserTokenBalances = {};
    if (initialBalances) {
      Object.entries(initialBalances).forEach(([token, balance]) => {
        if (balance !== undefined && balance !== null) {
          try {
            converted[token] = toBigIntStrict(balance);
          } catch (error) {
            console.warn(`[BAL-WARN] Could not convert balance for ${token}:`, balance, error);
            converted[token] = BigInt(0);
          }
        }
      });
    }
    return converted;
  }, [initialBalances]);

  // Use the new hook to get all download access data at once
  const { allDownloads, isLoading: downloadsLoading, error: downloadsError } = useAllArtistsDownloadAccess(
    userAddress || null,
    allArtistsConfig
  );

  // Fetch feedback list when admin opens wallet
  useEffect(() => {
    if (!isAdmin || !showAssetsPanel) return;
    let cancelled = false;
    setFeedbackLoading(true);
    (async () => {
      try {
        const token = getDidToken ? await getDidToken() : null;
        const res = await fetch('/api/feedback/list', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setFeedbackList(data.feedback || []);
        }
      } catch {
        if (!cancelled) setFeedbackList([]);
      } finally {
        if (!cancelled) setFeedbackLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, showAssetsPanel, getDidToken]);

  // All artist pages this wallet launched (treasury matches connected address)
  const { ownedArtistIds, isArtistWallet } = useMemo(() => {
    if (!userAddress || !allArtistsConfig) {
      return { ownedArtistIds: [] as string[], isArtistWallet: false };
    }
    const ids = Object.entries(allArtistsConfig)
      .filter(
        ([, config]) =>
          config.treasury_wallet &&
          config.treasury_wallet.toLowerCase() === userAddress.toLowerCase()
      )
      .map(([artistId]) => artistId);
    if (ids.length > 0) {
      console.debug('[Wallet] Artist ownership:', { count: ids.length, wallet: userAddress.slice(0, 8) + '...' });
    }
    return { ownedArtistIds: ids, isArtistWallet: ids.length > 0 };
  }, [userAddress, allArtistsConfig]);

  /** Sorted like useOwnedArtistsEarnings; used for card order and global cash withdraw artistId. */
  const sortedOwnedArtistIds = useMemo(
    () => [...ownedArtistIds].sort(),
    [ownedArtistIds]
  );
  const cashWithdrawArtistId =
    sortedOwnedArtistIds.length > 0 ? sortedOwnedArtistIds[0] : null;

  const {
    entries: creatorEarningsEntries,
    refetch: refetchCreatorEarnings
  } = useOwnedArtistsEarnings({
    ownedArtistIds,
    userAddress: userAddress || null,
    allArtistsConfig,
    autoRefresh: showAssetsPanel
  });

  useEffect(() => {
    const onBalanceUpdate = () => {
      void refetchCreatorEarnings();
    };
    window.addEventListener('balanceUpdate', onBalanceUpdate);
    return () => window.removeEventListener('balanceUpdate', onBalanceUpdate);
  }, [refetchCreatorEarnings]);

  // Use treasury earnings hook for treasury mode
  const { isTreasury, data: treasuryEarnings, isLoading: treasuryLoading, error: treasuryError, refetch: refetchTreasury } = useTreasuryEarnings({
    userAddress: userAddress || null,
    autoRefresh: showAssetsPanel
  });

  // Memoize the artist IDs to prevent re-renders
  const artistIds = useMemo(() => {
    return allArtistsConfig ? Object.keys(allArtistsConfig) : [];
  }, [allArtistsConfig]);

  // Fetch asset metadata for all owned downloads
  useEffect(() => {
    const fetchAssetMetadata = async () => {
      if (Object.keys(allDownloads).length === 0) return;
      
      const metadata: { [key: string]: AssetMetadata } = {};
      const allAccessEntries = Object.values(allDownloads).flat();

      await Promise.all(allAccessEntries.map(async (access) => {
        const key = `${access.artistId}_${access.assetNumber}`;
        try {
          const { data, error } = await supabase
            .from('artist_assets')
            .select('*')
            .eq('artist_id', access.artistId)
            .eq('asset_number', access.assetNumber)
            .single();
          
          if (data && !error) {
            metadata[key] = {
              ...data,
              metadata: {
                ...data.metadata,
                title: data.metadata?.title || `Asset #${access.assetNumber}`
              }
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch metadata for ${key}:`, error);
        }
      }));
      
      setAssetMetadata(metadata);
    };
    
    fetchAssetMetadata();
  }, [allDownloads]);

  // Handle download logic
  const handleDownload = async (artistId: string, assetNumber: number) => {
    const key = `${artistId}_${assetNumber}`;
    if (downloadingAssets.has(key)) return;
    
    setDownloadingAssets(prev => new Set([...prev, key]));
    
    try {
      const response = await authenticatedFetch('/api/createSignedUrl', {
        method: 'POST',
        body: JSON.stringify({ artistId, assetNumber, userAddress })
      }, getDidToken);
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get download URL');
      
      const link = document.createElement('a');
      link.href = data.url;
      const fileType = assetMetadata[key]?.file_type?.split('/')[1] || 'mp4';
      link.download = `${artistId}_asset_${assetNumber}.${fileType}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error: any) {
      console.error('Download failed:', error);
      showToast(`Download failed: ${error.message}`, 'error');
    } finally {
      setDownloadingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Balance logic is now handled by useWalletBalances hook

  // Manual refresh using the hook
  const handleManualRefresh = async () => {
    localStorage.removeItem('zeyodaUserTokenBalances');
    await Promise.all([
      refreshBalances(),
      refreshUsdBalance(),
      refetchCreatorEarnings()
    ]);
  };

  const quoteLPWithdraw = async (artistId: string, percent: number) => {
    if (!artistId || percent <= 0) {
      setQuoteUsd('0.00');
      return;
    }

    setIsQuoting(true);
    try {
      const response = await authenticatedFetch(
        `/api/lp/quote?artistId=${encodeURIComponent(artistId)}&percent=${percent}`,
        { method: 'GET' },
        getDidToken
      );
      const result = await response.json();

      if (response.ok) {
        setQuoteUsd(result.quoteUsd?.toFixed(2) || '0.00');
      } else {
        setQuoteUsd('Error');
      }
    } catch {
      setQuoteUsd('Error');
    } finally {
      setIsQuoting(false);
    }
  };

  const handleLPWithdraw = async () => {
    const artistId = lpPanelArtistId;
    if (!artistId || !userAddress || !isArtistWallet || lpPct <= 0 || isWithdrawing) {
      showToast('Invalid withdrawal parameters', 'error');
      return;
    }

    setIsWithdrawing(true);
    try {
      console.log('💎 Starting LP withdrawal:', { artistId, percent: lpPct });
      showToast(`Withdrawing ${lpPct}% of LP position...`, 'info');

      const response = await authenticatedFetch(
        '/api/public/lpWithdraw',
        {
          method: 'POST',
          headers: {
            'x-wallet-address': userAddress.toLowerCase()
          },
          body: JSON.stringify({
            artistId,
            percent: lpPct
          })
        },
        getDidToken
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.floorBreached) {
          showToast('Withdrawal cancelled: price moved too much', 'info');
        } else if (result.duplicate) {
          showToast('Withdrawal already processed', 'info');
        } else {
          const hint = result.details ? `${result.error} — ${result.details}` : result.error;
          showToast(hint || 'Withdrawal failed', 'error');
        }
        return;
      }

      console.log('✅ LP withdrawal successful:', result);
      showToast(`✅ Withdrew ${result.breakdown.percent}% of LP ($${result.usdProceeds.toFixed(2)})`, 'success');

      setTimeout(() => {
        setLpPanelArtistId(null);
        setLpPct(0);
        setQuoteUsd('0.00');
      }, 800);

      window.dispatchEvent(new CustomEvent('balanceUpdate'));
      await refreshUsdBalance();
      await refetchCreatorEarnings();
    } catch (error: unknown) {
      console.error('❌ LP withdrawal error:', error);
      showToast('LP withdrawal failed', 'error');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleDeposit = async () => {
    if (!userAddress) {
      showToast('No wallet address available', 'error');
      return;
    }

    try {
      setShowSendEthPanel(false);
      // Copy wallet address to clipboard
      await navigator.clipboard.writeText(userAddress);
      showToast('Wallet address copied to clipboard!', 'success');
      
      // Open Base Sepolia faucet in new tab
      window.open('https://www.alchemy.com/faucets/base-sepolia', '_blank');
      
      // Additional helper message
      setTimeout(() => {
        showToast('Paste your wallet address on the faucet to fund your cash balance', 'info');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Deposit helper error:', error);
      showToast('Could not copy address. Please copy manually from wallet.', 'error');
    }
  };

  const handleCopyAddress = useCallback(async () => {
    if (!userAddress) return;
    try {
      await navigator.clipboard.writeText(userAddress);
      showToast('Wallet address copied', 'success');
    } catch {
      showToast('Copy blocked — select and copy manually', 'error');
    }
  }, [userAddress, showToast]);

  const handleCashWithdraw = async () => {
    const artistId = cashWithdrawArtistId || 'unknown';
    if (!userAddress || parseFloat(cashAmount) <= 0) {
      showToast('Invalid withdrawal amount', 'error');
      return;
    }

    try {
      const amount = parseFloat(cashAmount);
      showToast(`Withdrawing $${amount.toFixed(2)} from cash balance...`, 'info');

      const response = await authenticatedFetch('/api/artist/withdraw', {
        method: 'POST',
        headers: {
          'x-wallet-address': userAddress.toLowerCase()
        },
        body: JSON.stringify({
          artistId,
          type: 'cash',
          amountUsd: amount,
          method: 'eth_balance'
        })
      });

      const result = await response.json();

      if (response.ok) {
        showToast(`✅ Withdrew $${amount.toFixed(2)} to your wallet!`, 'success');
        setShowCashPanel(false);
        setCashPct(0);
        setCashAmount('0.00');
        window.dispatchEvent(new CustomEvent('balanceUpdate'));
        await refetchCreatorEarnings();
      } else {
        showToast(result.error || 'Cash withdrawal failed', 'error');
      }
    } catch (error: unknown) {
      console.error('❌ Cash withdrawal error:', error);
      showToast('Cash withdrawal failed', 'error');
    }
  };

  // Combine balances
  const combinedBalances = useMemo(() => {
    const combined: { [tokenSymbol: string]: bigint } = {};
    
    Object.entries(userTokenBalances).forEach(([token, balance]) => {
      if (balance !== undefined && balance !== null) {
        try {
          combined[token] = toBigIntStrict(balance);
        } catch (error) {
          console.warn(`[BAL-WARN] Could not convert user balance for ${token}:`, balance, error);
          combined[token] = BigInt(0);
        }
      }
    });
    
    Object.entries(realTimeBalances).forEach(([token, balance]) => {
      if (balance !== undefined && balance !== null) {
        combined[token] = balance;
      }
    });
    
    return combined;
  }, [userTokenBalances, realTimeBalances]);

  /** Native ETH transfer on Base Sepolia via Magic signer (e.g. fund MetaMask deployer). */
  const handleSendNativeEth = async () => {
    if (!magic?.rpcProvider) {
      showToast('Wallet not ready', 'error');
      return;
    }
    const to = sendEthTo.trim();
    if (!to || !ethers.isAddress(to)) {
      showToast('Enter a valid recipient address (0x…)', 'error');
      return;
    }
    const amtStr = sendEthAmount.trim();
    let value: bigint;
    try {
      value = ethers.parseEther(amtStr === '' ? '0' : amtStr);
    } catch {
      showToast('Invalid ETH amount', 'error');
      return;
    }
    if (value <= 0n) {
      showToast('Amount must be greater than zero', 'error');
      return;
    }

    const bal = combinedBalances['ETH'] ?? BigInt(0);
    if (value > bal) {
      showToast('Amount exceeds balance. Leave ETH for gas.', 'error');
      return;
    }

    try {
      setIsSendingEth(true);
      const provider = new ethers.BrowserProvider(magic.rpcProvider as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const from = await signer.getAddress();
      if (userAddress && from.toLowerCase() !== userAddress.toLowerCase()) {
        showToast('Signer does not match connected address', 'error');
        return;
      }
      const tx = await signer.sendTransaction({
        to: ethers.getAddress(to),
        value,
      });
      showToast('Transaction sent…', 'info');
      await tx.wait();
      showToast(`Sent ${ethers.formatEther(value)} ETH (Base Sepolia)`, 'success');
      setShowSendEthPanel(false);
      setSendEthTo('');
      setSendEthAmount('');
      window.dispatchEvent(new CustomEvent('balanceUpdate'));
      await refreshBalances();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Send ETH error:', e);
      showToast(msg.length > 120 ? `${msg.slice(0, 120)}…` : msg, 'error');
    } finally {
      setIsSendingEth(false);
    }
  };

  if (!showAssetsPanel) {
    return null;
  }

  // Filter artists to only show those with assets
  const artistsWithAssets = allArtistsConfig ? Object.entries(allArtistsConfig).filter(([id, config]) => {
    const tokenBalance = combinedBalances[config.tokenName];
    const hasTokens = tokenBalance && tokenBalance > BigInt(0);
    const hasDownloads = allDownloads[id] && allDownloads[id].length > 0;
    return hasTokens || hasDownloads;
  }) : [];

  const isAnythingLoading = balancesLoading || downloadsLoading || usdLoading;

  return (
    <div
      className={`fixed top-16 left-4 w-80 max-h-96 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 rounded-2xl shadow-2xl border border-yellow-400 z-[9999] overflow-hidden flex flex-col transition-opacity duration-300 ${
        vaultLaunchDimmed ? 'opacity-35 pointer-events-none brightness-75' : ''
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black flex-shrink-0">
        <h2 className="text-lg font-bold">💰 Your Assets</h2>
        <div className="flex items-center space-x-2">
          {!balancesError && (
            <button
              onClick={handleManualRefresh}
              disabled={isAnythingLoading}
              title="Refresh balances"
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-sm disabled:opacity-50"
            >
              {isAnythingLoading ? '⟳' : '🔄'}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-xl"
          >
            ✕
          </button>
        </div>
      </div>

      {userAddress && (
        <div className="bg-gray-900/90 border-b border-gray-700 text-xs text-gray-200 flex-shrink-0">
          <button
            type="button"
            id="wallet-identity-toggle"
            aria-expanded={walletIdentityExpanded}
            aria-controls="wallet-identity-details"
            onClick={() => setWalletIdentityExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-1.5 text-left hover:bg-gray-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/80 focus-visible:ring-inset"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-green-400 flex-shrink-0" aria-hidden>
                ✅
              </span>
              <span className="font-medium text-gray-100">Wallet address</span>
            </span>
            <span className="text-gray-400 flex-shrink-0" aria-hidden>
              {walletIdentityExpanded ? '▴' : '▾'}
            </span>
          </button>

          <div id="wallet-identity-details" className="px-4 pb-2">
            {walletIdentityExpanded ? (
              <>
                <p className="font-mono text-xs text-gray-300 break-all leading-relaxed mb-2">
                  {userAddress}
                </p>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  title="Copy wallet address"
                  aria-label="Copy wallet address"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs font-medium transition-colors"
                >
                  📋 Copy
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 pb-0.5">
                <span className="truncate font-mono flex-1 min-w-0 text-gray-300">
                  {`${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  title="Copy wallet address"
                  aria-label="Copy wallet address"
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs font-medium transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Feedback section - admin only */}
      {isAdmin && (
        <div className="p-4 border-b border-gray-700 bg-gray-900 bg-opacity-50 flex-shrink-0">
          <button
            type="button"
            id="wallet-feedback-toggle"
            aria-expanded={feedbackExpanded}
            aria-controls="wallet-admin-feedback-panel"
            onClick={() => setFeedbackExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 text-left rounded-md px-1 py-1.5 -mx-1 hover:bg-gray-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            <span className="flex items-center gap-2 min-w-0 text-sm font-bold text-gray-300">
              <span>📢 Feedback</span>
              {feedbackList.length > 0 && (
                <span className="text-xs font-normal text-gray-400 tabular-nums">
                  ({feedbackList.length})
                </span>
              )}
            </span>
            <span className="text-gray-400 flex-shrink-0 text-xs" aria-hidden>
              {feedbackExpanded ? '▼' : '▶'}
            </span>
          </button>
          {feedbackExpanded && (
            <div
              id="wallet-admin-feedback-panel"
              role="region"
              aria-labelledby="wallet-feedback-toggle"
              className="mt-2"
            >
              {feedbackLoading ? (
                <div className="text-xs text-gray-400">Loading...</div>
              ) : feedbackList.length === 0 ? (
                <div className="text-xs text-gray-400">No feedback yet.</div>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {feedbackList.map((f) => (
                      <div
                        key={f.id}
                        className="text-xs p-2 rounded bg-gray-800 border border-gray-700"
                      >
                        <div className="text-white">{f.message}</div>
                        <div className="text-gray-400 mt-1">
                          {f.submitted_by} • {f.source} • {f.artist_id || '—'} •{' '}
                          {new Date(f.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedbackExpanded(false)}
                    className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1 rounded transition-colors"
                  >
                    Collapse
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-4 overflow-y-auto">
        {isAnythingLoading ? (
          <div className="text-center text-gray-300 py-8">
            <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Loading assets...</p>
          </div>
        ) : artistsWithAssets.length === 0 ? (
          <div className="text-center text-gray-300 py-6">
            <div className="text-3xl mb-2">🎨</div>
            <p className="text-sm">No assets yet.</p>
            <p className="text-xs text-gray-400">Start collecting artistocks!</p>
          </div>
        ) : (
          artistsWithAssets.map(([artistId, config]) => {
            const tokenName = artistId === 'gosheesh' ? 'GOSH33SH' : artistId === 'jaitea' ? 'JAIT33' : config.tokenName;
            const tokenBalance = combinedBalances[tokenName];
            const downloads = allDownloads[artistId] || [];
            const artistDisplayTitle =
              artistId === 'gosheesh' ? 'GOSHEESH' : artistId === 'jaitea' ? 'JAI TEA' : config.displayName;

            const assetOpen = isAssetArtistOpen(artistId);
            const assetSummaryParts: string[] = [];
            if (tokenBalance && tokenBalance > BigInt(0)) assetSummaryParts.push('tokens');
            if (downloads.length > 0) {
              assetSummaryParts.push(`${downloads.length} download${downloads.length === 1 ? '' : 's'}`);
            }

            return (
              <div key={artistId} className="mb-3 rounded-lg p-3 border border-opacity-50" style={{ 
                backgroundColor: `${config.theme.primaryColor}80`, // 50% opacity
                borderColor: config.theme.accentColor 
              }}>
                <div className="flex flex-col">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-expanded={assetOpen}
                      aria-controls={`wallet-asset-body-${artistId}`}
                      id={`wallet-asset-toggle-${artistId}`}
                      onClick={() => toggleAssetArtist(artistId)}
                      className="mt-1 p-0.5 rounded text-white/90 hover:text-white hover:bg-black/20 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      title={assetOpen ? 'Collapse' : 'Expand'}
                    >
                      <span className="text-xs tabular-nums" aria-hidden>
                        {assetOpen ? '▼' : '▶'}
                      </span>
                    </button>
                    <div className="flex flex-col flex-1 min-w-0">
                      {/* Artist Name — navigates to artist page */}
                      <button
                        type="button"
                        id={`wallet-asset-title-${artistId}`}
                        className="text-lg font-bold text-white text-left w-full bg-transparent border-0 p-0 cursor-pointer hover:opacity-80 transition-opacity rounded"
                        style={{ color: config.theme.accentColor }}
                        aria-label={`View ${artistDisplayTitle} on artist page`}
                        onClick={() => {
                          const targetUrl = `/?artist=${artistId}`;
                          if (typeof window !== 'undefined') router.prefetch(targetUrl);
                          router.push(targetUrl);
                        }}
                        onMouseEnter={() => {
                          if (typeof window !== 'undefined') router.prefetch(`/?artist=${artistId}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const targetUrl = `/?artist=${artistId}`;
                            if (typeof window !== 'undefined') router.prefetch(targetUrl);
                            router.push(targetUrl);
                          }
                        }}
                      >
                        {artistDisplayTitle}
                      </button>
                      {!assetOpen && assetSummaryParts.length > 0 && (
                        <div className="text-[11px] text-white/75 mt-0.5">
                          {assetSummaryParts.join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {assetOpen && (
                  <div
                    id={`wallet-asset-body-${artistId}`}
                    role="region"
                    aria-labelledby={`wallet-asset-title-${artistId}`}
                    className="flex flex-col mt-2"
                  >
                  {/* Token Balance */}
                  {tokenBalance && tokenBalance > BigInt(0) && (
                    <div className="flex flex-col mb-2 rounded p-2" style={{ 
                      backgroundColor: `${config.theme.primaryColor}CC` // 80% opacity for contrast
                    }}>
                      <div className="text-xs mb-1" style={{ color: config.theme.accentColor }}>
                        {tokenName}
                      </div>
                      <div className="text-white font-medium text-sm">
                        {Number(ethers.formatUnits(tokenBalance, 18)).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Downloads Section */}
                  {downloads.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {downloads.map(download => {
                        const assetKey = `${download.artistId}_${download.assetNumber}`;
                        const metadata = assetMetadata[assetKey];
                        const isDownloading = downloadingAssets.has(assetKey);
                        
                        const handleCardClick = () => {
                          const targetUrl = `/?artist=${download.artistId}&asset=${download.assetNumber}`;
                          if (typeof window !== 'undefined') {
                            router.prefetch(targetUrl);
                          }
                          router.push(targetUrl);
                        };
                        
                        const handleCardKeyDown = (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCardClick();
                          }
                        };
                        
                        return (
                          <div 
                            key={assetKey} 
                            className="flex items-center justify-between rounded p-2 cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity" 
                            style={{ 
                              backgroundColor: `${config.theme.primaryColor}80`, // 50% opacity like ERC-20 tokens
                              borderColor: config.theme.accentColor 
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`View ${metadata?.metadata?.title || `${config.artworkTitle} #${download.assetNumber}`} on artist page`}
                            onClick={handleCardClick}
                            onKeyDown={handleCardKeyDown}
                            onMouseEnter={() => {
                              if (typeof window !== 'undefined') {
                                router.prefetch(`/?artist=${download.artistId}&asset=${download.assetNumber}`);
                              }
                            }}
                          >
                            <div>
                              <div className="text-white font-medium text-sm">
                                {metadata?.metadata?.title || `${config.artworkTitle} #${download.assetNumber}`}
                              </div>
                              <div className="text-xs" style={{ color: config.theme.accentColor }}>
                                Balance: {download.balance}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(download.artistId, download.assetNumber);
                              }}
                              disabled={isDownloading}
                              className="text-xs font-medium px-2 py-1 rounded disabled:opacity-50 hover:opacity-80 transition-opacity"
                              style={{ 
                                color: config.theme.accentColor,
                                backgroundColor: `${config.theme.primaryColor}CC` // 80% opacity for contrast
                              }}
                              aria-label={`Download ${metadata?.metadata?.title || `asset #${download.assetNumber}`}`}
                            >
                              {isDownloading ? '...' : 'Download'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* ETH Balance Display (as USD) */}
        {combinedBalances['ETH'] && combinedBalances['ETH'] > BigInt(0) && (
          <div className="mt-4 bg-gray-800 bg-opacity-50 rounded-lg p-3 border border-gray-400 border-opacity-50">
            <div className="flex justify-between items-start">
              <div className="flex flex-col flex-grow">
                <div className="text-gray-300 text-xs mb-1">💰 Cash (USD)</div>
                <div className="text-white font-bold text-lg">
                  {!showUsdBalance ? (
                    <span className="text-gray-400">••••••</span>
                  ) : (
                    `$${(parseFloat(ethers.formatEther(combinedBalances['ETH'])) * 2500).toFixed(2)}`
                  )}
                </div>
                {showUsdBalance && (
                  <div className="text-gray-300 text-xs mt-1">
                    {`${parseFloat(ethers.formatEther(combinedBalances['ETH'])).toFixed(4)} ETH • Base Sepolia`}
                  </div>
                )}
                
                {/* Cash Action Buttons */}
                {showUsdBalance && (
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDeposit}
                        className="flex-1 py-1 px-3 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                      >
                        Deposit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSendEthPanel(false);
                          setShowCashPanel(true);
                          setCashPct(0);
                          setCashAmount('0.00');
                        }}
                        className="flex-1 py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                      >
                        Withdraw Cash
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCashPanel(false);
                        setShowSendEthPanel((v) => !v);
                      }}
                      className="w-full py-1 px-3 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                    >
                      {showSendEthPanel ? 'Close send' : 'Send ETH (Base Sepolia)'}
                    </button>
                  </div>
                )}

                {showSendEthPanel && showUsdBalance && (
                  <div className="mt-3 p-3 bg-gray-700 bg-opacity-50 rounded border border-blue-400 border-opacity-40">
                    <div className="text-gray-300 text-xs mb-2">
                      Send native ETH from this Magic wallet. Same network as the app (Base Sepolia). Leave
                      extra ETH for gas.
                    </div>
                    <input
                      type="text"
                      value={sendEthTo}
                      onChange={(e) => setSendEthTo(e.target.value)}
                      placeholder="Recipient 0x…"
                      className="w-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-600 font-mono"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={sendEthAmount}
                      onChange={(e) => setSendEthAmount(e.target.value)}
                      placeholder="Amount (ETH), e.g. 0.04"
                      className="w-full mb-3 px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-600"
                      autoComplete="off"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSendEthPanel(false);
                          setSendEthTo('');
                          setSendEthAmount('');
                        }}
                        className="flex-1 py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSendNativeEth}
                        disabled={isSendingEth}
                        className="flex-1 py-1 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
                      >
                        {isSendingEth ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cash Withdrawal Panel */}
                {showCashPanel && showUsdBalance && (
                  <div className="mt-3 p-3 bg-gray-700 bg-opacity-50 rounded border border-gray-400 border-opacity-50">
                    <div className="mb-3">
                      <div className="text-gray-300 text-xs mb-1">Withdraw Cash</div>
                      <div className="text-gray-200 text-xs">Available: ${(parseFloat(ethers.formatEther(combinedBalances['ETH'])) * 2500).toFixed(2)}</div>
                    </div>

                    <div className="flex items-center space-x-3 mb-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={cashPct}
                        onChange={(e) => {
                          const newPct = Number(e.target.value);
                          setCashPct(newPct);
                          const maxAmount = parseFloat(ethers.formatEther(combinedBalances['ETH'])) * 2500;
                          setCashAmount((maxAmount * newPct / 100).toFixed(2));
                        }}
                        className="flex-1"
                      />
                      <div className="text-right min-w-[80px]">
                        <div className="text-gray-300 text-xs">Amount</div>
                        <input
                          type="number"
                          value={cashAmount}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value) || 0;
                            setCashAmount(e.target.value);
                            const maxAmount = parseFloat(ethers.formatEther(combinedBalances['ETH'])) * 2500;
                            setCashPct(maxAmount > 0 ? (amount / maxAmount) * 100 : 0);
                          }}
                          className="w-16 px-1 py-1 bg-gray-800 text-white text-xs rounded border border-gray-600"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="text-gray-300 text-xs mb-3">
                      Withdrawing ${cashAmount} ({cashPct.toFixed(1)}% of cash balance)
                    </div>

                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowCashPanel(false)}
                        className="flex-1 py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCashWithdraw}
                        disabled={parseFloat(cashAmount) <= 0}
                        className="flex-1 py-1 px-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                      >
                        Confirm Withdraw
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowUsdBalance(!showUsdBalance)}
                className="ml-2 p-1 text-gray-300 hover:text-white transition-colors duration-200 text-lg"
                title={showUsdBalance ? "Hide balance" : "Show balance"}
              >
                {showUsdBalance ? '🔓' : '🔒'}
              </button>
            </div>
          </div>
        )}

        {/* USD Balance Display */}
        {(usdBalance > 0 || usdLoading) && (
          <div className="mt-4 bg-green-900 bg-opacity-50 rounded-lg p-3 border border-green-400 border-opacity-50">
            <div className="flex justify-between items-start">
              <div className="flex flex-col flex-grow">
                <div className="text-green-300 text-xs mb-1">💰 Treasure Balance</div>
                <div className="text-white font-bold text-lg">
                  {usdLoading ? (
                    <span className="text-gray-300">Loading...</span>
                  ) : !showUsdBalance ? (
                    <span className="text-gray-400">••••••</span>
                  ) : usdBalance < 0.01 && usdBalance > 0 ? (
                    '< $0.01'
                  ) : (
                    `$${usdBalance.toFixed(2)}`
                  )}
                </div>
                {!usdLoading && usdBalance > 0 && showUsdBalance && (
                  <div className="text-green-200 text-xs mt-1">
                    Available for withdrawal
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowUsdBalance(!showUsdBalance)}
                className="ml-2 p-1 text-green-300 hover:text-white transition-colors duration-200 text-lg"
                title={showUsdBalance ? "Hide balance" : "Show balance"}
              >
                {showUsdBalance ? '🔓' : '🔒'}
              </button>
            </div>
          </div>
        )}

        {/* Artist Earnings Display — original card, repeated per owned artist */}
        {isArtistWallet &&
          sortedOwnedArtistIds.map((artistId) => {
            const row = creatorEarningsEntries.find((e) => e.artistId === artistId);
            const earningsLoading = row?.isLoading ?? true;
            const artistEarnings = row?.data ?? null;
            const error = row?.error ?? null;
            const earningsOpen = isEarningsArtistOpen(artistId);

            return (
              <div
                key={artistId}
                className="mt-4 bg-yellow-900 bg-opacity-50 rounded-lg p-3 border border-yellow-400 border-opacity-50"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      aria-expanded={earningsOpen}
                      aria-controls={`wallet-earnings-body-${artistId}`}
                      id={`wallet-earnings-toggle-${artistId}`}
                      onClick={() => toggleEarningsArtist(artistId)}
                      className="mt-0.5 p-0.5 rounded text-yellow-300/90 hover:text-white hover:bg-black/20 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60"
                      title={earningsOpen ? 'Collapse details' : 'Expand details'}
                    >
                      <span className="text-xs tabular-nums" aria-hidden>
                        {earningsOpen ? '▼' : '▶'}
                      </span>
                    </button>
                    <div className="flex flex-col flex-grow min-w-0">
                      <div
                        id={`wallet-earnings-title-${artistId}`}
                        className="text-yellow-300 text-xs mb-1"
                      >
                        🎨 {artistEarnings?.artist?.displayName || artistId.toUpperCase() || 'Artist'} Earnings
                      </div>
                      <div className="text-white font-bold text-lg">
                        {earningsLoading && !artistEarnings ? (
                          <span className="text-gray-300">Loading...</span>
                        ) : !showUsdBalance ? (
                          <span className="text-gray-400">••••••</span>
                        ) : error ? (
                          <span className="text-red-300 text-sm font-normal">{error}</span>
                        ) : !artistEarnings ? (
                          '$0.00'
                        ) : artistEarnings.totals.availableBalance < 0.01 &&
                          artistEarnings.totals.availableBalance > 0 ? (
                          '< $0.01'
                        ) : (
                          `$${artistEarnings.totals.availableBalance.toFixed(2)}`
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUsdBalance(!showUsdBalance)}
                    className="ml-2 p-1 text-yellow-300 hover:text-white transition-colors duration-200 text-lg shrink-0"
                    title={showUsdBalance ? 'Hide balance' : 'Show balance'}
                  >
                    {showUsdBalance ? '🔓' : '🔒'}
                  </button>
                </div>

                {earningsOpen && (
                  <div
                    id={`wallet-earnings-body-${artistId}`}
                    role="region"
                    aria-labelledby={`wallet-earnings-title-${artistId}`}
                    className="mt-2"
                  >
                    {!earningsLoading && showUsdBalance && artistEarnings && !error && (
                      <div className="space-y-2">
                        <div className="text-yellow-200 text-xs">📊 Sales History</div>
                        <div className="text-yellow-200 text-xs">
                          {artistEarnings.totals.totalSales} sales • Gross $
                          {artistEarnings.totals.totalEarnings.toFixed(2)} • Net ~
                          {(artistEarnings.totals.totalEarnings * 0.997).toFixed(2)}
                        </div>
                        <div className="text-yellow-300 text-xs opacity-75">
                          All net earnings credited to Cash
                        </div>

                        {artistEarnings.totals.lpWithdrawable > 0 && (
                          <div className="border-t border-yellow-400 border-opacity-30 pt-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="text-yellow-200 text-xs">🏦 LP Position</div>
                              <div className="text-yellow-200 text-xs">
                                ${artistEarnings.totals.lpWithdrawable.toFixed(2)} (in pool)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setLpPanelArtistId(artistId);
                                setLpPct(0);
                                setQuoteUsd('0.00');
                                quoteLPWithdraw(artistId, 0);
                              }}
                              disabled={!isArtistWallet || artistEarnings.totals.lpWithdrawable <= 0}
                              className="w-full py-1 px-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                            >
                              Withdraw LP
                            </button>

                            {lpPanelArtistId === artistId && (
                              <div className="mt-3 p-3 bg-yellow-800 bg-opacity-50 rounded border border-yellow-400 border-opacity-50">
                                <div className="mb-3">
                                  <div className="text-yellow-300 text-xs mb-1">Withdraw LP</div>
                                  <div className="text-yellow-200 text-xs">
                                    LP Withdrawable: ${artistEarnings.totals.lpWithdrawable.toFixed(2)}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-3 mb-3">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={lpPct}
                                    onChange={(e) => {
                                      const newPct = Number(e.target.value);
                                      setLpPct(newPct);
                                      quoteLPWithdraw(artistId, newPct);
                                    }}
                                    className="flex-1"
                                  />
                                  <div className="text-right min-w-[80px]">
                                    <div className="text-yellow-300 text-xs">Estimated</div>
                                    <div className="text-white font-bold text-sm">
                                      ${isQuoting ? '...' : quoteUsd}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-yellow-300 text-xs mb-3">
                                  Withdrawing {lpPct}% of LP position
                                </div>

                                <div className="flex space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => setLpPanelArtistId(null)}
                                    className="flex-1 py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleLPWithdraw}
                                    disabled={lpPct <= 0 || isWithdrawing}
                                    className="flex-1 py-1 px-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                                  >
                                    {isWithdrawing ? 'Withdrawing...' : `Confirm Withdraw ${lpPct}%`}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!earningsLoading && artistEarnings && showUsdBalance && artistEarnings.recentEarnings.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-400 border-opacity-30">
                        <div className="text-purple-300 text-xs mb-2">Recent Sales</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {artistEarnings.recentEarnings.slice(0, 5).map((earning) => (
                            <div key={earning.id} className="flex justify-between items-center text-xs">
                              <div className="text-gray-300">
                                {earning.assetTitle} • {new Date(earning.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-white font-medium">
                                +${earning.netEarnings.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                        {artistEarnings.recentEarnings.length > 5 && (
                          <div className="text-purple-300 text-xs mt-2 opacity-70">
                            +{artistEarnings.recentEarnings.length - 5} more sales
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {/* Treasury Earnings Display - always show when treasury wallet, even if fetch failed */}
        {isTreasury && (
          <div className="mt-4 bg-yellow-900 bg-opacity-50 rounded-lg p-3 border border-yellow-400 border-opacity-50">
            <div className="flex justify-between items-start">
              <div className="flex flex-col flex-grow">
                <div className="text-yellow-300 text-xs mb-1">🏦 Protocol Treasury</div>
                <div className="text-white font-bold text-lg">
                  {treasuryLoading ? (
                    <span className="text-gray-300">Loading...</span>
                  ) : treasuryError ? (
                    <span className="text-red-300 text-sm">{treasuryError}</span>
                  ) : !showUsdBalance ? (
                    <span className="text-gray-400">••••••</span>
                  ) : (treasuryEarnings?.totalProtocolFees ?? 0) < 0.01 && (treasuryEarnings?.totalProtocolFees ?? 0) > 0 ? (
                    '< $0.01'
                  ) : (
                    `$${(treasuryEarnings?.totalProtocolFees || 0).toFixed(4)}`
                  )}
                </div>
                {treasuryError && (
                  <button
                    onClick={() => refetchTreasury()}
                    className="mt-2 py-1 px-2 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition-colors"
                  >
                    Retry
                  </button>
                )}
                {!treasuryLoading && !treasuryError && treasuryEarnings && showUsdBalance && (
                  <div className="text-yellow-200 text-xs mt-1">
                    <div>Swap Fees: ${treasuryEarnings.swapFeesUsd.toFixed(4)}</div>
                    {treasuryEarnings.totalTransactions > 0 && (
                      <div>{treasuryEarnings.totalTransactions} transactions • 0.3% protocol fee</div>
                    )}
                    {treasuryEarnings.totalTransactions === 0 && (
                      <div>0.3% protocol fee on all swaps</div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowUsdBalance(!showUsdBalance)}
                className="ml-2 p-1 text-yellow-300 hover:text-white transition-colors duration-200 text-lg"
                title={showUsdBalance ? "Hide balance" : "Show balance"}
              >
                {showUsdBalance ? '🔓' : '🔒'}
              </button>
            </div>
            
            {/* Recent Protocol Fees List */}
            {!treasuryLoading && treasuryEarnings && showUsdBalance && treasuryEarnings.recentFees.length > 0 && (
              <div className="mt-3 pt-3 border-t border-yellow-400 border-opacity-30">
                <div className="text-yellow-300 text-xs mb-2">Recent Protocol Fees</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {treasuryEarnings.recentFees.slice(0, 5).map((fee) => (
                    <div key={fee.id} className="flex justify-between items-center text-xs">
                      <div className="text-gray-300">
                        {fee.artistName} • {fee.feeType} • {new Date(fee.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-white font-medium">
                        +${fee.feeAmount.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
                {treasuryEarnings.recentFees.length > 5 && (
                  <div className="text-yellow-300 text-xs mt-2 opacity-70">
                    +{treasuryEarnings.recentFees.length - 5} more fees
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bubble pointer */}
      <div className="absolute -top-2 left-8 w-4 h-4 bg-gradient-to-br from-yellow-600 to-yellow-500 transform rotate-45 border-l border-t border-yellow-400"></div>
    </div>
  );
};

export default Wallet;