import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ARTIST_REGISTRY } from '../utils/addressRegistryFallback';
import { ArtistConfig } from '../../types/artist-types';

interface UserTokenBalances {
  [tokenSymbol: string]: bigint;
  ETH?: bigint; // Add ETH balance
}

interface UseWalletBalancesProps {
  magic: any | null;
  userAddress: string | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  autoRefreshOnMount?: boolean;
  suspendAutoRefresh?: boolean;
}

interface UseWalletBalancesReturn {
  balances: UserTokenBalances;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: Date | null;
  refreshBalances: () => Promise<void>;
}

export const useWalletBalances = ({
  magic,
  userAddress,
  allArtistsConfig,
  autoRefreshOnMount = true,
  suspendAutoRefresh = false
}: UseWalletBalancesProps): UseWalletBalancesReturn => {
  const [balances, setBalances] = useState<UserTokenBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Fetch real-time token balances from the blockchain
  const fetchRealBalances = useCallback(async () => {
    if (!userAddress || !magic || !allArtistsConfig) {
      console.debug('[BAL-TRACE] Missing requirements:', {
        userAddress: !!userAddress,
        magic: !!magic,
        allArtistsConfig: !!allArtistsConfig
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    const freshBalances: UserTokenBalances = {};
    
    try {
      const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
      
      // Fetch ETH balance first
      try {
        const ethBalance = await provider.getBalance(userAddress);
        freshBalances['ETH'] = ethBalance;
        console.debug(`[BAL-DEBUG] ETH balance:`, ethers.formatEther(ethBalance));
      } catch (error: any) {
        console.warn('[BAL-TRACE] Error fetching ETH balance:', error.message);
        freshBalances['ETH'] = BigInt(0);
      }
      
      // Fetch token balances for ALL artists from allArtistsConfig (not hardcoded registry)
      if (allArtistsConfig) {
        for (const [artistId, config] of Object.entries(allArtistsConfig)) {
          if (!config.contract || !config.tokenName) continue;
          
          try {
            console.debug(`[BAL-TRACE] Fetching ${config.tokenName} balance from ${config.contract}`);
            
            const contract = new ethers.Contract(config.contract, [
              "function balanceOf(address owner) view returns (uint256)",
              "function decimals() view returns (uint8)",
              "function symbol() view returns (string)"
            ], provider);
            
            const rawBalance = await contract.balanceOf(userAddress);
            const decimals = await contract.decimals();
            
            console.log(`[BAL-DEBUG] raw balance for ${config.tokenName}:`, rawBalance.toString());
            console.log(`[BAL-DEBUG] decimals for ${config.tokenName}:`, decimals);
            
            freshBalances[config.tokenName] = rawBalance;
          } catch (error: any) {
            console.warn(`[BAL-TRACE] Error fetching ${config.tokenName} balance:`, error.message);
            freshBalances[config.tokenName] = BigInt(0);
          }
        }
      }
      
      setBalances(freshBalances);
      setLastFetchTime(new Date());
      
      try {
        localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify({
          balances: Object.fromEntries(
            Object.entries(freshBalances).map(([k, v]) => [k, v.toString()])
          ),
          timestamp: Date.now(),
          userAddress
        }));
      } catch (cacheError) {
        console.warn('[BAL-TRACE] Could not cache balances:', cacheError);
      }
      
      // 🔄 CRITICAL FIX: Notify parent component of fresh balance data
      const formattedBalances: { [key: string]: bigint } = {};
      Object.entries(freshBalances).forEach(([token, balance]) => {
        formattedBalances[token] = balance;
      });
      
      console.log('📤 Dispatching walletBalancesUpdated event with', Object.keys(formattedBalances).length, 'tokens');
      window.dispatchEvent(new CustomEvent('walletBalancesUpdated', {
        detail: formattedBalances
      }));
      
    } catch (error: any) {
      console.error('[BAL-TRACE] Balance fetch failed:', error);
      setError(`Failed to fetch balances: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, magic, allArtistsConfig]);

  // Auto-refresh balances when dependencies change
  useEffect(() => {
    if (autoRefreshOnMount && userAddress && magic && allArtistsConfig) {
      fetchRealBalances();
    }
  }, [fetchRealBalances, userAddress, magic, allArtistsConfig, autoRefreshOnMount]);

  // DISABLED: 30-second polling to prevent page remounts
  // Auto-refresh moved to SWR-based system for stability
  // useEffect(() => {
  //   if (!userAddress || !magic || !allArtistsConfig || suspendAutoRefresh) return;
  //   const interval = setInterval(() => {
  //     console.log('⏰ Auto-refreshing wallet balances...');
  //     fetchRealBalances();
  //   }, 30000);
  //   return () => clearInterval(interval);
  // }, [fetchRealBalances, userAddress, magic, allArtistsConfig, suspendAutoRefresh]);

  // Listen for transaction success events
  useEffect(() => {
    const handleTransactionSuccess = (event: any) => {
      console.debug('[BAL-TRACE] txSuccess event', event?.detail);
      setError(null);
      localStorage.removeItem('zeyodaUserTokenBalances');
      setTimeout(() => {
        fetchRealBalances();
      }, 2000);
    };

    window.addEventListener('transactionSuccess', handleTransactionSuccess);
    return () => window.removeEventListener('transactionSuccess', handleTransactionSuccess);
  }, [fetchRealBalances]);

  // Purchase / LP / cash flows dispatch `balanceUpdate` but did not refresh reads — keep panel in sync
  useEffect(() => {
    const handleBalanceUpdate = () => {
      setError(null);
      localStorage.removeItem('zeyodaUserTokenBalances');
      setTimeout(() => {
        fetchRealBalances();
      }, 800);
    };

    window.addEventListener('balanceUpdate', handleBalanceUpdate);
    return () => window.removeEventListener('balanceUpdate', handleBalanceUpdate);
  }, [fetchRealBalances]);

  return {
    balances,
    isLoading,
    error,
    lastFetchTime,
    refreshBalances: fetchRealBalances
  };
}; 