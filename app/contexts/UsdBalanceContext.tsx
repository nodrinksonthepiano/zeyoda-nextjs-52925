'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  // Load balance from Supabase when user address changes
  const loadBalance = async (address: string) => {
    if (!address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('💰 Loading USD balance for:', address);
      
      const { data, error: dbError } = await supabase
        .from('cash_balances')
        .select('usd_balance')
        .eq('wallet_address', address.toLowerCase())
        .single();

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          // No record found - this is fine, user has no balance yet
          console.log('📝 No existing USD balance found for user');
          setUsdBalanceState(0);
        } else {
          throw dbError;
        }
      } else {
        const balance = parseFloat(data.usd_balance || '0');
        console.log('✅ Loaded USD balance:', balance);
        setUsdBalanceState(balance);
      }
    } catch (err: any) {
      console.error('❌ Error loading USD balance:', err);
      setError(err.message || 'Failed to load USD balance');
      setUsdBalanceState(0);
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [userAddress]);

  // Keep Treasure (cash_balances) in sync after purchases / withdrawals (same event as token refresh)
  useEffect(() => {
    const onBalanceUpdate = () => {
      if (userAddress) {
        loadBalance(userAddress);
      }
    };
    window.addEventListener('balanceUpdate', onBalanceUpdate);
    return () => window.removeEventListener('balanceUpdate', onBalanceUpdate);
  }, [userAddress]);

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