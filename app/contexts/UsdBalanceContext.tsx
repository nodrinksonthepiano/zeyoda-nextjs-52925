'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet } from '../components/MagicProvider';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { supabase } from '../utils/supabaseClient';

interface UsdBalanceContextType {
  usdBalance: number;
  setUsdBalance: (balance: number) => void;
  isLoading: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
  saveBalance: (balance: number) => Promise<void>;
}

const UsdBalanceContext = createContext<UsdBalanceContextType | undefined>(undefined);

interface UsdBalanceProviderProps {
  children: ReactNode;
  userAddress: string | null;
}

export function UsdBalanceProvider({ children, userAddress }: UsdBalanceProviderProps) {
  const [usdBalance, setUsdBalanceState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getDidToken } = useWallet();

  /** Treasure balance — server reads `cash_balances` with service role (avoids browser RLS gaps). */
  const loadBalance = useCallback(
    async (address: string) => {
      if (!address) return;

      setIsLoading(true);
      setError(null);

      try {
        console.log('💰 Loading Treasure balance for:', address);

        const response = await authenticatedFetch('/api/me/cash-balance', { method: 'GET' }, getDidToken);
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error || body.message || `HTTP ${response.status}`);
        }

        const apiWallet = typeof body.walletAddress === 'string' ? body.walletAddress.toLowerCase() : '';
        if (apiWallet && apiWallet !== address.toLowerCase()) {
          console.warn('[UsdBalance] Session wallet differs from userAddress prop', {
            apiWallet,
            address,
          });
        }

        const raw = body.usdBalance;
        const balance =
          typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
        const safe = Number.isFinite(balance) ? balance : 0;
        console.log('✅ Loaded Treasure (USD) via API:', safe);
        setUsdBalanceState(safe);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load USD balance';
        console.error('❌ Error loading Treasure balance:', err);
        setError(msg);
        setUsdBalanceState(0);
      } finally {
        setIsLoading(false);
      }
    },
    [getDidToken]
  );

  // Save balance to Supabase
  const saveBalance = async (balance: number) => {
    if (!userAddress) {
      throw new Error('No user address available');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('💾 Saving USD balance:', balance, 'for:', userAddress);
      
      // Use upsert to insert or update
      const { error: dbError } = await supabase
        .from('cash_balances')
        .upsert({
          wallet_address: userAddress.toLowerCase(),
          usd_balance: balance.toFixed(2), // Ensure 2 decimal places
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'wallet_address'
        });

      if (dbError) {
        throw dbError;
      }
      
      console.log('✅ USD balance saved successfully');
      setUsdBalanceState(balance);
      
    } catch (err: any) {
      console.error('❌ Error saving USD balance:', err);
      setError(err.message || 'Failed to save USD balance');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh balance from database
  const refreshBalance = async () => {
    if (userAddress) {
      await loadBalance(userAddress);
    }
  };

  // Public setBalance function that also saves to DB
  const setUsdBalance = async (balance: number) => {
    await saveBalance(balance);
  };

  // Load balance when user address changes
  useEffect(() => {
    if (userAddress) {
      loadBalance(userAddress);
    } else {
      setUsdBalanceState(0);
      setError(null);
    }
  }, [userAddress, loadBalance]);

  // Keep Treasure (cash_balances) in sync after purchases / withdrawals (same event as token refresh)
  useEffect(() => {
    const onBalanceUpdate = () => {
      if (userAddress) {
        loadBalance(userAddress);
      }
    };
    window.addEventListener('balanceUpdate', onBalanceUpdate);
    return () => window.removeEventListener('balanceUpdate', onBalanceUpdate);
  }, [userAddress, loadBalance]);

  const contextValue: UsdBalanceContextType = {
    usdBalance,
    setUsdBalance,
    isLoading,
    error,
    refreshBalance,
    saveBalance
  };

  return (
    <UsdBalanceContext.Provider value={contextValue}>
      {children}
    </UsdBalanceContext.Provider>
  );
}

export function useUsdBalance() {
  const context = useContext(UsdBalanceContext);
  if (context === undefined) {
    throw new Error('useUsdBalance must be used within a UsdBalanceProvider');
  }
  return context;
} 