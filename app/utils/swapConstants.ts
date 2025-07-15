/**
 * Swap UI Configuration Constants
 * Centralized values for consistent behavior across the swap interface
 */

export const SWAP_SLIDER_CONFIG = {
  USD: {
    min: 1,
    max: 1000,
    step: 0.01,
    unit: '$'
  },
  TOKEN: {
    min: 1,
    max: 100000, // Default max, can be overridden by user balance
    step: 1,
    unit: ''
  }
} as const;

export const SWAP_PRICING_CONFIG = {
  // Debounce interval for live price polling (15 seconds)
  LIVE_PRICE_DEBOUNCE_MS: 15000,
  
  // Default ETH/USD rate for calculations
  DEFAULT_ETH_USD_RATE: 2500,
  
  // Slippage tolerance
  DEFAULT_SLIPPAGE: 0.05 // 5%
} as const;

export const SWAP_UI_CONFIG = {
  // Animation timings
  TRANSITION_DURATION: 300,
  
  // Balance refresh delay after transactions
  BALANCE_REFRESH_DELAY: 8000,
  
  // Gas limits
  DEFAULT_GAS_LIMIT: 300000,
  TOKEN_SWAP_GAS_LIMIT: 1500000
} as const;

/**
 * Get slider configuration for a specific asset type
 */
export const getSliderConfig = (assetType: 'USD' | 'TOKEN', userBalance?: number) => {
  const config = SWAP_SLIDER_CONFIG[assetType];
  
  if (assetType === 'TOKEN' && userBalance) {
    return {
      ...config,
      max: Math.max(config.max, userBalance)
    };
  }
  
  return config;
}; 