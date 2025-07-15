import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ARTIST_REGISTRY } from '../utils/addressRegistryFallback';
import { ArtistConfig } from '../../types/artist-types';

interface UserTokenBalances {
  [tokenSymbol: string]: bigint;
}

interface UseWalletBalancesProps {
  magic: any | null;
  userAddress: string | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  autoRefreshOnMount?: boolean;
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
  autoRefreshOnMount = true
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
      
      // Use the contract addresses from the registry
      for (const [artistId, registryEntry] of Object.entries(ARTIST_REGISTRY)) {
        if (!registryEntry.token) continue;
        
        const tokenName = artistId === 'gosheesh' ? 'GOSH33SH' : artistId === 'jaitea' ? 'JAIT33' : '';
        if (!tokenName) continue;
        
        try {
          console.debug(`[BAL-TRACE] Fetching ${tokenName} balance from ${registryEntry.token}`);
          
          const contract = new ethers.Contract(registryEntry.token, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)"
          ], provider);
          
          const rawBalance = await contract.balanceOf(userAddress);
          const decimals = await contract.decimals();
          
          console.log(`[BAL-DEBUG] raw balance for ${tokenName}:`, rawBalance.toString());
          console.log(`[BAL-DEBUG] decimals for ${tokenName}:`, decimals);
          
          freshBalances[tokenName] = rawBalance;
        } catch (error: any) {
          console.warn(`[BAL-TRACE] Error fetching ${tokenName} balance:`, error.message);
          freshBalances[tokenName] = BigInt(0);
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

  // Set up 30-second polling
  useEffect(() => {
    if (!userAddress || !magic || !allArtistsConfig) return;

    const interval = setInterval(() => {
      fetchRealBalances();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchRealBalances, userAddress, magic, allArtistsConfig]);

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

  return {
    balances,
    isLoading,
    error,
    lastFetchTime,
    refreshBalances: fetchRealBalances
  };
}; 