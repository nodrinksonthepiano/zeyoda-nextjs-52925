import { ethers } from 'ethers';
import SwapArtifact from '../../artifacts/contracts/Swap.sol/Swap.json';

// This will be set after deploying the swap contract
export const SWAP_CONTRACT_ADDRESS = ""; // TODO: Update after deployment

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  minimumOutput: string;
}

export class SwapService {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(
      SWAP_CONTRACT_ADDRESS,
      SwapArtifact.abi,
      signer
    );
  }

  /**
   * Get quote for swapping ETH to tokens
   */
  async getTokenQuote(tokenAddress: string, ethAmount: string): Promise<SwapQuote> {
    try {
      const ethAmountWei = ethers.parseEther(ethAmount);
      const tokenAmountWei = await this.contract.getTokenQuote(tokenAddress, ethAmountWei);
      
      const tokenAmount = ethers.formatUnits(tokenAmountWei, 18);
      const slippage = 0.02; // 2% slippage tolerance
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
      const slippage = 0.02; // 2% slippage tolerance
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
      
      const tx = await this.contract.swapTokens(
        tokenInAddress,
        tokenOutAddress,
        tokenInAmountWei,
        minimumTokensOutWei
      );
      
      return tx;
    } catch (error) {
      console.error('Error swapping tokens:', error);
      throw error;
    }
  }
} 