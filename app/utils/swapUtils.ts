import { ethers } from 'ethers';
import SwapArtifact from '../../artifacts/contracts/Swap.sol/Swap.json';

// Swap contract deployed on Base Sepolia (NEW - with correct ownership)
export const SWAP_CONTRACT_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  minimumOutput: string;
}

// Price cache to avoid constant RPC calls
interface PriceCache {
  price: number;
  timestamp: number;
  ethPrice: number;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_DURATION = 30000; // 30 seconds

export class SwapService {
  private contract: ethers.Contract;
  private signerOrProvider: ethers.Signer | ethers.Provider;

  constructor(signerOrProvider: ethers.Signer | ethers.Provider) {
    this.signerOrProvider = signerOrProvider;
    this.contract = new ethers.Contract(
      SWAP_CONTRACT_ADDRESS,
      SwapArtifact.abi,
      signerOrProvider
    );
  }

  /**
   * Get live ETH price from Coinbase API with fallback
   */
  private async getLiveETHPrice(): Promise<number> {
    try {
      const response = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
      const data = await response.json();
      const price = parseFloat(data.data.amount);
      
      if (isNaN(price) || price <= 0) {
        throw new Error('Invalid price data');
      }
      
      return price;
    } catch (error) {
      console.warn('Failed to fetch live ETH price, using fallback:', error);
      return 2500; // Fallback rate
    }
  }

  /**
   * Get real-time token price in USD from LP reserves
   */
  async getTokenPriceInUSD(tokenAddress: string): Promise<number> {
    try {
      // Check cache first
      const cached = priceCache.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.price;
      }

      const pool = await this.contract.getPool(tokenAddress);
      
      if (!pool.active || pool.ethReserve === 0 || pool.tokenReserve === 0) {
        console.log(`No active liquidity pool for token ${tokenAddress}`);
        return 0; // No liquidity
      }

      // Calculate token price: ETH per token
      const ethPerToken = Number(ethers.formatEther(pool.ethReserve)) / Number(ethers.formatUnits(pool.tokenReserve, 18));
      
      // Get live ETH/USD price
      const ethUsdRate = await this.getLiveETHPrice();
      const tokenPriceUSD = ethPerToken * ethUsdRate;

      // Cache the result
      priceCache.set(tokenAddress, {
        price: tokenPriceUSD,
        timestamp: Date.now(),
        ethPrice: ethUsdRate
      });

      console.log(`💰 Live LP Price for ${tokenAddress}:`, {
        ethPerToken,
        ethUsdRate,
        tokenPriceUSD,
        tokenReserve: ethers.formatUnits(pool.tokenReserve, 18),
        ethReserve: ethers.formatEther(pool.ethReserve)
      });

      return tokenPriceUSD;
    } catch (error) {
      console.error('Error getting token price from LP:', error);
      return 0;
    }
  }

  /**
   * Get tokens per dollar (inverse of price)
   */
  async getTokensPerDollar(tokenAddress: string): Promise<number> {
    const priceUSD = await this.getTokenPriceInUSD(tokenAddress);
    if (priceUSD <= 0) return 0;
    return 1 / priceUSD;
  }

  /**
   * Check if liquidity pool exists for token
   */
  async hasLiquidityPool(tokenAddress: string): Promise<boolean> {
    try {
      const pool = await this.contract.getPool(tokenAddress);
      return pool.active && pool.ethReserve > 0 && pool.tokenReserve > 0;
    } catch (error) {
      console.error('Error checking pool existence:', error);
      return false;
    }
  }

  /**
   * Get pool information for debugging
   */
  async getPoolInfo(tokenAddress: string): Promise<any> {
    try {
      const pool = await this.contract.getPool(tokenAddress);
      return {
        token: pool.token,
        tokenReserve: ethers.formatUnits(pool.tokenReserve, 18),
        ethReserve: ethers.formatEther(pool.ethReserve),
        active: pool.active
      };
    } catch (error) {
      console.error('Error getting pool info:', error);
      return null;
    }
  }

  /**
   * Clear price cache (useful for testing)
   */
  clearPriceCache(): void {
    priceCache.clear();
  }

  /**
   * Get quote for swapping ETH to tokens
   */
  async getTokenQuote(tokenAddress: string, ethAmount: string): Promise<SwapQuote> {
    try {
      const ethAmountWei = ethers.parseEther(ethAmount);
      const tokenAmountWei = await this.contract.getTokenQuote(tokenAddress, ethAmountWei);
      
      const tokenAmount = ethers.formatUnits(tokenAmountWei, 18);
      const slippage = 0.10; // 10% slippage tolerance (for small test pools)
      const minimumOutput = (parseFloat(tokenAmount) * (1 - slippage)).toString();
      
      return {
        inputAmount: ethAmount,
        outputAmount: tokenAmount,
        priceImpact: 0.3, // 0.3% fee
        minimumOutput
      };
    } catch (error) {
      console.error('Error getting token quote:', error);
      throw error;
    }
  }

  /**
   * Get quote for swapping tokens to ETH  
   */
  async getEthQuote(tokenAddress: string, tokenAmount: string): Promise<SwapQuote> {
    try {
      const tokenAmountWei = ethers.parseUnits(tokenAmount, 18);
      const ethAmountWei = await this.contract.getEthQuote(tokenAddress, tokenAmountWei);
      
      const ethAmount = ethers.formatEther(ethAmountWei);
      const slippage = 0.10; // 10% slippage tolerance (for small test pools)
      const minimumOutput = (parseFloat(ethAmount) * (1 - slippage)).toString();
      
      return {
        inputAmount: tokenAmount,
        outputAmount: ethAmount,
        priceImpact: 0.3, // 0.3% fee
        minimumOutput
      };
    } catch (error) {
      console.error('Error getting ETH quote:', error);
      throw error;
    }
  }

  /**
   * Swap ETH for tokens
   */
  async swapEthForTokens(
    tokenAddress: string, 
    ethAmount: string, 
    minimumTokens: string
  ): Promise<ethers.TransactionResponse> {
    try {
      const ethAmountWei = ethers.parseEther(ethAmount);
      const minimumTokensWei = ethers.parseUnits(minimumTokens, 18);
      
      const tx = await this.contract.swapEthForTokens(
        tokenAddress,
        minimumTokensWei,
        { value: ethAmountWei }
      );
      
      return tx;
    } catch (error) {
      console.error('Error swapping ETH for tokens:', error);
      throw error;
    }
  }

  /**
   * Swap tokens for ETH
   */
  async swapTokensForEth(
    tokenAddress: string,
    tokenAmount: string,
    minimumEth: string
  ): Promise<ethers.TransactionResponse> {
    try {
      const tokenAmountWei = ethers.parseUnits(tokenAmount, 18);
      const minimumEthWei = ethers.parseEther(minimumEth);
      
      const tx = await this.contract.swapTokensForEth(
        tokenAddress,
        tokenAmountWei,
        minimumEthWei
      );
      
      return tx;
    } catch (error) {
      console.error('Error swapping tokens for ETH:', error);
      throw error;
    }
  }

  /**
   * Swap one token for another
   */
  async swapTokens(
    tokenInAddress: string,
    tokenOutAddress: string,
    tokenInAmount: string,
    minimumTokensOut: string
  ): Promise<ethers.TransactionResponse> {
    try {
      const tokenInAmountWei = ethers.parseUnits(tokenInAmount, 18);
      const minimumTokensOutWei = ethers.parseUnits(minimumTokensOut, 18);
      
      console.log('🔄 Executing swapTokens with params:', {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn: tokenInAmount,
        minimumOut: minimumTokensOut,
        gasLimit: 1500000
      });
      
      // Try to estimate gas first
      try {
        const gasEstimate = await this.contract.swapTokens.estimateGas(
          tokenInAddress,
          tokenOutAddress,
          tokenInAmountWei,
          minimumTokensOutWei
        );
        console.log('⛽ Estimated gas:', gasEstimate.toString());
      } catch (gasError) {
        console.warn('⚠️ Gas estimation failed:', gasError);
      }
      
      const tx = await this.contract.swapTokens(
        tokenInAddress,
        tokenOutAddress,
        tokenInAmountWei,
        minimumTokensOutWei,
        { 
          gasLimit: 1500000, // Massively increased gas limit for cross-token swaps
          gasPrice: undefined // Let the network set gas price
        }
      );
      
      return tx;
    } catch (error: any) {
      console.error('Error swapping tokens:', error);
      
      // Try to decode the revert reason
      if (error?.reason) {
        console.error('Revert reason:', error.reason);
      }
      if (error?.data) {
        console.error('Error data:', error.data);
      }
      
      throw error;
    }
  }
} 