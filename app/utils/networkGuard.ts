/**
 * Network Guard Utility
 * 
 * Prevents accidental mainnet transactions by enforcing Base Sepolia (84532) only.
 * All blockchain transactions MUST use this guard before execution.
 * 
 * SECURITY: This is a critical safety mechanism. Never bypass or modify without
 * explicit security review.
 */

import { JsonRpcProvider } from 'ethers';

/**
 * Base Sepolia chainId (testnet only)
 */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Mainnet chainIds that are BLOCKED
 */
const BLOCKED_MAINNET_CHAIN_IDS = [
  1,    // Ethereum Mainnet
  10,   // Optimism Mainnet
  8453, // Base Mainnet
  137,  // Polygon Mainnet
  42161 // Arbitrum Mainnet
];

/**
 * Require Base Sepolia network (chainId 84532)
 * 
 * Throws an error if the provider is connected to any network other than Base Sepolia.
 * This prevents accidental mainnet transactions.
 * 
 * @param provider - Ethers JsonRpcProvider instance
 * @throws Error if chainId is not 84532
 * 
 * @example
 * ```ts
 * const provider = new JsonRpcProvider(rpcUrl);
 * await requireBaseSepolia(provider); // Throws if not Base Sepolia
 * const wallet = new Wallet(privateKey, provider);
 * ```
 */
export async function requireBaseSepolia(provider: JsonRpcProvider): Promise<void> {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      // Check if it's a known mainnet (for better error message)
      if (BLOCKED_MAINNET_CHAIN_IDS.includes(chainId)) {
        throw new Error(
          `SECURITY BLOCKED: Attempted transaction on MAINNET (chainId=${chainId}). ` +
          `Only Base Sepolia (84532) is allowed. This is a testnet-only deployment.`
        );
      }
      
      throw new Error(
        `SECURITY BLOCKED: Invalid chainId=${chainId}. ` +
        `Only Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}) is allowed.`
      );
    }
  } catch (error) {
    // If it's already our security error, re-throw it
    if (error instanceof Error && error.message.includes('SECURITY BLOCKED')) {
      throw error;
    }
    
    // If network detection fails, fail safe (block the transaction)
    throw new Error(
      `SECURITY BLOCKED: Failed to verify network. ` +
      `Cannot proceed without network verification. Original error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a chainId is Base Sepolia
 * 
 * @param chainId - Chain ID to check
 * @returns true if chainId is 84532 (Base Sepolia)
 */
export function isBaseSepolia(chainId: number): boolean {
  return chainId === BASE_SEPOLIA_CHAIN_ID;
}

/**
 * Check if a chainId is a blocked mainnet
 * 
 * @param chainId - Chain ID to check
 * @returns true if chainId is a known mainnet
 */
export function isBlockedMainnet(chainId: number): boolean {
  return BLOCKED_MAINNET_CHAIN_IDS.includes(chainId);
}

