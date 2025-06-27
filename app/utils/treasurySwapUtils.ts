import { ethers } from 'ethers';

// TreasurySwapLite ABI - matches the deployed contract
const TREASURY_SWAP_LITE_ABI = [
  "function initialize(address _token, address _artist) external",
  "function swapIn() external payable",
  "function swapOut(uint256 tokenAmount) external",
  "function emergencyPause(bool _state) external",
  "function getTokenQuote(uint256 ethAmount) external pure returns (uint256)",
  "function getEthQuote(uint256 tokenAmount) external pure returns (uint256)",
  "function paused() external view returns (bool)",
  "function artistToken() external view returns (address)",
  "function artist() external view returns (address)",
  "event SwapIn(address indexed user, uint256 ethAmount, uint256 tokenAmount)",
  "event SwapOut(address indexed user, uint256 tokenAmount, uint256 ethAmount)"
];

export interface TreasurySwapQuote {
  inputAmount: string;
  outputAmount: string;
  rate: string;
  minimumOutput: string;
}

/**
 * TreasurySwapLite Service for Day-0 MVP
 * Fixed rate: 1 ETH = 1,000,000 tokens
 */
export class TreasurySwapLiteService {
  private contract: ethers.Contract;
  private signerOrProvider: ethers.Signer | ethers.Provider;
  
  // Fixed rate from contract: 1 ETH = 1,000,000 tokens
  private static readonly TOKENS_PER_ETH = 1_000_000;

  constructor(contractAddress: string, signerOrProvider: ethers.Signer | ethers.Provider) {
    this.signerOrProvider = signerOrProvider;
    this.contract = new ethers.Contract(
      contractAddress,
      TREASURY_SWAP_LITE_ABI,
      signerOrProvider
    );
  }

  /**
   * Check if contract is paused
   */
  async isPaused(): Promise<boolean> {
    try {
      return await this.contract.paused();
    } catch (error) {
      console.error('Error checking pause state:', error);
      return true; // Assume paused on error for safety
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo(): Promise<{
    tokenAddress: string;
    artistAddress: string;
    paused: boolean;
  }> {
    try {
      const [tokenAddress, artistAddress, paused] = await Promise.all([
        this.contract.artistToken(),
        this.contract.artist(), 
        this.contract.paused()
      ]);

      return {
        tokenAddress,
        artistAddress,
        paused
      };
    } catch (error) {
      console.error('Error getting contract info:', error);
      throw error;
    }
  }

  /**
   * Convert USD to ETH amount for swapping
   */
  private convertUSDToETH(usdAmount: number, ethPriceUSD: number = 2500): string {
    const ethAmount = usdAmount / ethPriceUSD;
    return ethAmount.toString();
  }

  /**
   * Get quote for buying tokens with USD
   * Master plan example: $20 USD → ~0.007 ETH at $3000/ETH → ~7000 tokens
   */
     async getTokenQuoteUSD(usdAmount: number, ethPriceUSD: number = 2500): Promise<TreasurySwapQuote> {
     try {
       // Convert USD to ETH with proper precision handling
       const ethAmount = usdAmount / ethPriceUSD;
       const ethAmountFormatted = parseFloat(ethAmount.toFixed(18)); // Limit to 18 decimals
       const ethAmountWei = ethers.parseEther(ethAmountFormatted.toString());
       
       // Get token quote from contract
       const tokenAmountWei = await this.contract.getTokenQuote(ethAmountWei);
       const tokenAmount = ethers.formatUnits(tokenAmountWei, 18);
       
       const slippage = 0.01; // 1% slippage tolerance
       const minimumOutput = (parseFloat(tokenAmount) * (1 - slippage)).toString();
       
       return {
         inputAmount: usdAmount.toString(),
         outputAmount: tokenAmount,
         rate: `1 ETH = ${TreasurySwapLiteService.TOKENS_PER_ETH.toLocaleString()} tokens`,
         minimumOutput
       };
     } catch (error) {
       console.error('Error getting USD token quote:', error);
       throw error;
     }
   }

  /**
   * Get quote for selling tokens for ETH
   */
  async getETHQuote(tokenAmount: string): Promise<TreasurySwapQuote> {
    try {
      const tokenAmountWei = ethers.parseUnits(tokenAmount, 18);
      const ethAmountWei = await this.contract.getEthQuote(tokenAmountWei);
      const ethAmount = ethers.formatEther(ethAmountWei);
      
      const slippage = 0.01; // 1% slippage tolerance
      const minimumOutput = (parseFloat(ethAmount) * (1 - slippage)).toString();
      
      return {
        inputAmount: tokenAmount,
        outputAmount: ethAmount,
        rate: `${TreasurySwapLiteService.TOKENS_PER_ETH.toLocaleString()} tokens = 1 ETH`,
        minimumOutput
      };
    } catch (error) {
      console.error('Error getting ETH quote:', error);
      throw error;
    }
  }

     /**
    * Buy tokens with USD (converts to ETH internally)
    * Master plan: handleBuyETH functionality
    */
   async buyTokensWithUSD(
     usdAmount: number, 
     ethPriceUSD: number = 2500
   ): Promise<ethers.TransactionResponse> {
     try {
       // Check if paused
       const paused = await this.isPaused();
       if (paused) {
         throw new Error('Treasury swap is currently paused');
       }

       // Convert USD to ETH with proper precision handling
       const ethAmount = usdAmount / ethPriceUSD;
       const ethAmountFormatted = parseFloat(ethAmount.toFixed(18)); // Limit to 18 decimals
       const ethAmountWei = ethers.parseEther(ethAmountFormatted.toString());
       
       console.log(`💰 Buying tokens with $${usdAmount} USD (${ethAmountFormatted.toFixed(6)} ETH)`);
       
       // Execute swap
       const tx = await this.contract.swapIn({ 
         value: ethAmountWei,
         gasLimit: 300000 // Reasonable gas limit
       });
       
       console.log('Swap transaction sent:', tx.hash);
       return tx;
     } catch (error) {
       console.error('Error buying tokens with USD:', error);
       throw error;
     }
   }

  /**
   * Sell tokens for ETH
   * Master plan: handleSellTokens functionality  
   */
  async sellTokensForETH(
    tokenAmount: string,
    tokenContractAddress: string
  ): Promise<ethers.TransactionResponse> {
    try {
      // Check if paused
      const paused = await this.isPaused();
      if (paused) {
        throw new Error('Treasury swap is currently paused');
      }

      const tokenAmountWei = ethers.parseUnits(tokenAmount, 18);
      
      // First approve tokens if using a signer
      if ('sendTransaction' in this.signerOrProvider) {
        const tokenContract = new ethers.Contract(
          tokenContractAddress,
          ['function approve(address spender, uint256 amount) external returns (bool)'],
          this.signerOrProvider
        );
        
        console.log('Approving tokens for swap...');
        const approveTx = await tokenContract.approve(
          await this.contract.getAddress(),
          tokenAmountWei
        );
        await approveTx.wait();
        console.log('Tokens approved');
      }
      
      console.log(`💰 Selling ${tokenAmount} tokens for ETH`);
      
      // Execute swap
      const tx = await this.contract.swapOut(tokenAmountWei, {
        gasLimit: 300000
      });
      
      console.log('Sell transaction sent:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error selling tokens:', error);
      throw error;
    }
  }

  /**
   * Calculate tokens from USD amount (helper for frontend)
   */
  static calculateTokensFromUSD(usdAmount: number, ethPriceUSD: number = 2500): number {
    const ethAmount = usdAmount / ethPriceUSD;
    return ethAmount * TreasurySwapLiteService.TOKENS_PER_ETH;
  }

  /**
   * Calculate USD value from token amount (helper for frontend)
   */
  static calculateUSDFromTokens(tokenAmount: number, ethPriceUSD: number = 2500): number {
    const ethAmount = tokenAmount / TreasurySwapLiteService.TOKENS_PER_ETH;
    return ethAmount * ethPriceUSD;
  }

  /**
   * Get current fixed exchange rate
   */
  static getFixedRate(): {
    tokensPerETH: number;
    description: string;
  } {
    return {
      tokensPerETH: TreasurySwapLiteService.TOKENS_PER_ETH,
      description: `Fixed rate: 1 ETH = ${TreasurySwapLiteService.TOKENS_PER_ETH.toLocaleString()} tokens`
    };
  }
} 