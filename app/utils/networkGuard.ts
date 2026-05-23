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
  1, // Ethereum Mainnet
  10, // Optimism Mainnet
  8453, // Base Mainnet
  137, // Polygon Mainnet
  42161, // Arbitrum Mainnet
];

export class ChainGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainGuardError';
  }
}

/**
 * Require Base Sepolia network (chainId 84532)
 *
 * Uses provider.getNetwork() which may cache after the first call on a provider instance.
 * Use requireFreshBaseSepolia immediately before signing transactions.
 */
export async function requireBaseSepolia(provider: JsonRpcProvider): Promise<void> {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      if (BLOCKED_MAINNET_CHAIN_IDS.includes(chainId)) {
        throw new ChainGuardError(
          `SECURITY BLOCKED: Attempted transaction on MAINNET (chainId=${chainId}). ` +
            `Only Base Sepolia (84532) is allowed. This is a testnet-only deployment.`,
        );
      }

      throw new ChainGuardError(
        `SECURITY BLOCKED: Invalid chainId=${chainId}. ` +
          `Only Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}) is allowed.`,
      );
    }
  } catch (error) {
    if (error instanceof ChainGuardError) {
      throw error;
    }

    throw new ChainGuardError(
      `SECURITY BLOCKED: Failed to verify network. ` +
        `Cannot proceed without network verification. Original error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Fresh wire check via eth_chainId — bypasses JsonRpcProvider.getNetwork() cache.
 * Call immediately before sendTransaction when a mid-session RPC swap must be detected.
 */
export async function requireFreshBaseSepolia(provider: JsonRpcProvider): Promise<void> {
  try {
    const chainIdHex = await provider.send('eth_chainId', []);
    const chainId = parseInt(chainIdHex, 16);

    if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
      if (BLOCKED_MAINNET_CHAIN_IDS.includes(chainId)) {
        throw new ChainGuardError(
          `SECURITY BLOCKED: Attempted transaction on MAINNET (chainId=${chainId}). ` +
            `Only Base Sepolia (84532) is allowed. This is a testnet-only deployment.`,
        );
      }

      throw new ChainGuardError(
        `SECURITY BLOCKED: fresh chainId check failed, got ${chainId}, expected ${BASE_SEPOLIA_CHAIN_ID}`,
      );
    }
  } catch (error) {
    if (error instanceof ChainGuardError) {
      throw error;
    }

    throw new ChainGuardError(
      `SECURITY BLOCKED: Failed fresh eth_chainId verification. Original error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Check if a chainId is Base Sepolia
 */
export function isBaseSepolia(chainId: number): boolean {
  return chainId === BASE_SEPOLIA_CHAIN_ID;
}

/**
 * Check if a chainId is a blocked mainnet
 */
export function isBlockedMainnet(chainId: number): boolean {
  return BLOCKED_MAINNET_CHAIN_IDS.includes(chainId);
}
