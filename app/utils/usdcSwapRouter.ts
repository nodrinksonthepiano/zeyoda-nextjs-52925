import { ethers } from 'ethers';
import { SwapService, SWAP_CONTRACT_ADDRESS } from './swapUtils';
// TreasurySwapLite removed - AMM only
import { toBigIntStrict } from './bigint';

// TypeScript declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Base Sepolia USDC contract address
const USDC_BASE_SEPOLIA = "0x6Ac3aB54Dc5019A2e57eCcb214337FF5bbD52897";

// Development logging helper
const isDevelopment = process.env.NODE_ENV === 'development';
const devLog = (message: string, ...args: any[]) => {
  if (isDevelopment) {
    console.log(message, ...args);
  }
};
const devWarn = (message: string, ...args: any[]) => {
  if (isDevelopment) {
    console.warn(message, ...args);
  }
};

// 0x API endpoint for Base network
const ZEROX_API_BASE = "https://base.api.0x.org/swap/v1/quote";

// Base Sepolia UniswapV3Router02 (EIP-1559 compatible)
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Base Sepolia WETH address
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// Minimum ETH balance required for gas (0.0002 ETH)
const MIN_GAS_BALANCE = ethers.parseEther('0.0002');

// ABI for Uniswap V3 SwapRouter exactInputSingle function
const SWAP_ROUTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address", "name": "tokenIn", "type": "address"},
          {"internalType": "address", "name": "tokenOut", "type": "address"},
          {"internalType": "uint24", "name": "fee", "type": "uint24"},
          {"internalType": "address", "name": "recipient", "type": "address"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"},
          {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
          {"internalType": "uint256", "name": "amountOutMinimum", "type": "uint256"},
          {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
        ],
        "internalType": "struct ISwapRouter.ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "exactInputSingle",
    "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  }
];

interface SwapResult {
  success: boolean;
  usdcReceived?: number;  // In actual USD (not wei)
  amountOut?: string;     // Amount out in wei/smallest unit
  estimatedUsd?: number;  // Estimated USD value
  txHash?: string;
  error?: string;
}

interface ZeroXQuoteResponse {
  sellAmount: string;
  buyAmount: string;
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  validationErrors?: Array<{
    field: string;
    code: number;
    reason: string;
  }>;
}

/**
 * USDC Swap Router - Converts artist tokens to USDC then to USD balance
 * 
 * Primary Route: Token → USDC (via 0x DEX aggregator)
 * Fallback Route: Token → WETH → USDC (via existing AMM + Uniswap V3)
 * 
 * Safety Features:
 * - Gas balance validation
 * - Unknown token detection
 * - 5% slippage protection (appropriate for testnet)
 * - Atomic operations
 */
export class UsdcSwapRouter {
  private signer: ethers.Signer;
  private provider: ethers.Provider;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.provider = signer.provider!;
  }

  /**
   * Main entry point for cash-out flow
   * Converts artist tokens to USDC and returns USD amount
   */
  async executeCashOut(
    tokenAddress: string,
    tokenAmount: string,
    userAddress: string
  ): Promise<SwapResult> {
    try {
      devLog('💰 Starting USDC cash-out:', {
        token: tokenAddress,
        amount: tokenAmount,
        user: userAddress
      });

      // Guard Rail 1: Check user has sufficient ETH for gas
      const userBalance = await this.provider.getBalance(userAddress);
      if (userBalance < MIN_GAS_BALANCE) {
        console.warn('⚠️ Insufficient gas balance for swap');
        return {
          success: false,
          error: 'Cash-out can\'t complete right now—please try again later.'
        };
      }

      // Primary Route: Try 0x DEX aggregator
              devLog('🔄 Attempting 0x DEX aggregator route...');
        const zeroXResult = await this.try0xSwap(tokenAddress, tokenAmount, userAddress);
        if (zeroXResult.success) {
          devLog('✅ 0x swap successful');
          return zeroXResult;
        }

        // Fallback Route: Try existing AMM → Uniswap V3
        devLog('🔄 Falling back to AMM + Uniswap V3 route...');
      const fallbackResult = await this.tryUniswapV3Fallback(tokenAddress, tokenAmount, userAddress);
      
      return fallbackResult;

    } catch (error: any) {
      console.error('❌ Cash-out failed:', error);
      return {
        success: false,
        error: 'Cash-out can\'t complete right now—please try again later.'
      };
    }
  }

  /**
   * Primary route: Direct token → USDC via 0x DEX aggregator
   */
  private async try0xSwap(
    tokenAddress: string,
    tokenAmount: string,
    userAddress: string
  ): Promise<SwapResult> {
    try {
      // Step 1: Get quote from 0x
      const quote = await this.get0xQuote(tokenAddress, tokenAmount);
      if (!quote) {
        return { success: false, error: '0x quote failed' };
      }

      // Step 2: Check slippage protection (5% max - appropriate for testnet)
      const expectedUsdcWei = BigInt(quote.buyAmount);
      const minimumUsdcWei = expectedUsdcWei * BigInt(95) / BigInt(100); // 5% slippage
      
      if (BigInt(quote.guaranteedPrice) < minimumUsdcWei) {
        console.warn('⚠️ 0x slippage too high, aborting');
        return { success: false, error: 'Slippage too high' };
      }

      // Step 3: Execute the swap
      const result = await this.execute0xSwap(quote, tokenAddress, tokenAmount, userAddress);
      
      if (result.success && result.usdcReceived) {
        console.log('✅ 0x swap completed:', {
          usdcReceived: result.usdcReceived,
          txHash: result.txHash
        });
      }

      return result;

    } catch (error: any) {
      console.warn('⚠️ 0x swap failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get quote from 0x API
   */
  private async get0xQuote(tokenAddress: string, tokenAmount: string): Promise<ZeroXQuoteResponse | null> {
    try {
      const tokenAmountWei = ethers.parseUnits(tokenAmount, 18);
      
      const params = new URLSearchParams({
        sellToken: tokenAddress,
        buyToken: USDC_BASE_SEPOLIA,
        sellAmount: tokenAmountWei.toString(),
        slippagePercentage: '0.05' // 5% slippage - appropriate for testnet
      });

      const response = await fetch(`${ZEROX_API_BASE}?${params}`);
      const data = await response.json();

      // Guard Rail 2: Handle unknown token explicitly
      if (response.status === 400 && 
          data.validationErrors?.some((e: any) => e.reason.includes('unlisted'))) {
        console.log('⚠️ Token unlisted on 0x, triggering fallback');
        return null;
      }

      if (!response.ok) {
        throw new Error(`0x API error: ${data.reason || response.statusText}`);
      }

      return data;

    } catch (error: any) {
      console.warn('⚠️ 0x quote failed:', error.message);
      return null;
    }
  }

  /**
   * Execute 0x swap transaction
   */
  private async execute0xSwap(
    quote: ZeroXQuoteResponse,
    tokenAddress: string,
    tokenAmount: string,
    userAddress: string
  ): Promise<SwapResult> {
    try {
      // Step 1: Silent token approval
      await this.ensureTokenApproval(tokenAddress, quote.to, tokenAmount);

      // Step 2: Execute the swap
      const tx = await this.signer.sendTransaction({
        to: quote.to,
        data: quote.data,
        value: BigInt(quote.value),
        gasLimit: BigInt(quote.gas),
        gasPrice: BigInt(quote.gasPrice)
      });

      console.log('📡 0x swap transaction sent:', tx.hash);
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        // Convert USDC wei to USD (USDC has 6 decimals)
        const usdcWei = BigInt(quote.buyAmount);
        const usdAmount = this.convertUsdcToUsd(usdcWei);

        return {
          success: true,
          usdcReceived: usdAmount,
          txHash: tx.hash
        };
      } else {
        throw new Error('Transaction failed');
      }

    } catch (error: any) {
      console.error('❌ 0x swap execution failed:', error);
      return {
        success: false,
        error: 'Transaction failed'
      };
    }
  }

  /**
   * Fallback route: Token → WETH → USDC via existing AMM + Uniswap V3
   */
  private async tryUniswapV3Fallback(
    tokenAddress: string,
    tokenAmount: string,
    userAddress: string
  ): Promise<SwapResult> {
    // ⚠️ Cash-out via AMM disabled - needs refactoring for UUPS
    throw new Error('Cash-out to USD temporarily disabled. Coming soon!');
  }

  /**
   * Convert WETH to USDC via Uniswap V3
   * This is a simplified implementation - in production you'd use the full Uniswap SDK
   */
  private async swapEthToUsdcViaUniswap(ethAmount: string): Promise<SwapResult> {
    try {
      devLog(`🔄 Real Uniswap V3 WETH → USDC swap: ${ethAmount} WETH`);
      
      // Get provider and signer
      if (!window.ethereum) {
        throw new Error('No web3 provider found');
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      // Convert ETH amount to wei with BigInt precision
      const ethWei = ethers.parseEther(ethAmount);
      
      // Calculate minimum USDC output (with 5% slippage tolerance)
      // Approximate rate: 1 ETH ≈ 2500 USDC, so 0.95 * rate for 5% slippage
      const approxUsdcOut = ethWei * BigInt(2375); // 2500 * 0.95 = 2375
      const usdcDecimals = 6; // USDC has 6 decimals
      const minUsdcOut = approxUsdcOut / BigInt(10 ** (18 - usdcDecimals)); // Convert from 18 to 6 decimals
      
             // Create Uniswap V3 SwapRouter contract
       const swapRouterContract = new ethers.Contract(
         UNISWAP_V3_ROUTER,
         SWAP_ROUTER_ABI,
         signer
       );
       
       // Prepare swap parameters
       const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
       const swapParams = {
         tokenIn: WETH_ADDRESS,
         tokenOut: USDC_BASE_SEPOLIA,
         fee: 500, // 0.05% fee tier - optimal for stable pairs like WETH/USDC
         recipient: userAddress,
         deadline: deadline,
         amountIn: ethWei,
         amountOutMinimum: minUsdcOut,
         sqrtPriceLimitX96: 0 // No price limit
       };
      
      devLog('🔧 Uniswap V3 swap params:', {
        tokenIn: swapParams.tokenIn,
        tokenOut: swapParams.tokenOut,
        fee: swapParams.fee,
        amountIn: ethers.formatEther(swapParams.amountIn),
        amountOutMinimum: ethers.formatUnits(swapParams.amountOutMinimum, 6),
        deadline: new Date(deadline * 1000).toISOString()
      });
      
      // Check gas estimation
      try {
        const estimatedGas = await swapRouterContract.exactInputSingle.estimateGas(swapParams, {
          value: ethWei // Send ETH with the transaction for WETH conversion
        });
        devLog('⛽ Estimated gas:', estimatedGas.toString());
        
        // Check if user has enough ETH for gas + swap
        const balance = await provider.getBalance(userAddress);
        const gasPrice = (await provider.getFeeData()).gasPrice || ethers.parseUnits('20', 'gwei');
        const totalGasCost = estimatedGas * gasPrice;
        
        if (balance < ethWei + totalGasCost) {
          throw new Error(`Insufficient ETH balance. Need ${ethers.formatEther(ethWei + totalGasCost)} ETH, have ${ethers.formatEther(balance)} ETH`);
        }
        
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        throw new Error('Unable to estimate gas for Uniswap swap. Please check liquidity and try again.');
      }
      
      // Execute the swap
      devLog('🚀 Executing Uniswap V3 swap...');
      const swapTx = await swapRouterContract.exactInputSingle(swapParams, {
        value: ethWei, // Send ETH to convert to WETH
        gasLimit: 300000 // Set reasonable gas limit
      });
      
      devLog('⏳ Swap transaction sent:', swapTx.hash);
      const receipt = await swapTx.wait();
      devLog('✅ Swap transaction confirmed in block:', receipt.blockNumber);
      
      // Parse the swap result from transaction receipt
      // For simplicity, we'll estimate the USDC received based on the input
      const estimatedUsdcReceived = minUsdcOut; // This is conservative (minimum output)
      const usdValue = this.convertUsdcToUsd(estimatedUsdcReceived);
      
      devLog(`💰 Uniswap V3 swap complete: ~${ethers.formatUnits(estimatedUsdcReceived, 6)} USDC ≈ $${usdValue.toFixed(2)}`);
      
      return {
        success: true,
        amountOut: estimatedUsdcReceived.toString(),
        estimatedUsd: usdValue,
        txHash: swapTx.hash
      };
      
         } catch (error: any) {
       console.error('❌ Uniswap V3 swap failed:', error);
       
       // Return user-friendly error messages
       if (error?.message?.includes('insufficient funds')) {
         return {
           success: false,
           error: 'Insufficient ETH balance for swap and gas fees',
           estimatedUsd: 0
         };
       } else if (error?.message?.includes('liquidity')) {
         return {
           success: false,
           error: 'Insufficient liquidity for this swap size',
           estimatedUsd: 0
         };
       } else if (error?.message?.includes('slippage')) {
         return {
           success: false,
           error: 'Price moved too much during swap. Please try again.',
           estimatedUsd: 0
         };
       } else {
         return {
           success: false,
           error: 'Cash-out can\'t complete right now—please try again later.',
           estimatedUsd: 0
         };
       }
    }
  }

  /**
   * Ensure token approval for swap contract
   * Silent approval - no crypto jargon exposed to user
   */
  private async ensureTokenApproval(tokenAddress: string, spenderAddress: string, amount: string): Promise<void> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function approve(address spender, uint256 amount) external returns (bool)"],
        this.signer
      );

      const amountWei = ethers.parseUnits(amount, 18);
      
      devLog('🔑 Ensuring token approval...');
      const approveTx = await tokenContract.approve(spenderAddress, amountWei);
      await approveTx.wait();
      devLog('✅ Token approval confirmed');

    } catch (error: any) {
      console.error('❌ Token approval failed:', error);
      throw new Error('Token approval failed');
    }
  }

  /**
   * Convert USDC wei to USD amount
   * USDC has 6 decimals, we want 2 decimal places for USD
   */
  private convertUsdcToUsd(usdcWei: bigint): number {
    // Use BigInt precision to avoid scientific notation issues
    // USDC has 6 decimals: 1 USDC = 1_000_000 wei
    // Convert to USD cents first, then to dollars
    const usdCents = usdcWei / BigInt(10_000); // Convert to cents (remove 4 decimals)
    const usd = Number(usdCents) / 100; // Convert cents to dollars
    return usd;
  }

  /**
   * Helper to format USD amounts for display
   */
  static formatUsdAmount(amount: number): string {
    if (amount < 0.01 && amount > 0) {
      return '< $0.01';
    }
    return `$${amount.toFixed(2)}`;
  }
}

export default UsdcSwapRouter; 