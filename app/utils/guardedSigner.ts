/**
 * Guarded Signer Utility
 * 
 * Creates an ethers Wallet signer with automatic network guard enforcement.
 * All blockchain transactions MUST use this wrapper to prevent mainnet accidents.
 * 
 * SECURITY: This wrapper enforces Base Sepolia (84532) only. Any attempt to
 * create a signer on a different network will throw an error.
 */

import { Wallet, JsonRpcProvider } from 'ethers';
import { requireBaseSepolia } from './networkGuard';

/**
 * Create a guarded signer that enforces Base Sepolia network
 * 
 * This function:
 * 1. Creates a JsonRpcProvider from the RPC URL
 * 2. Verifies the network is Base Sepolia (84532)
 * 3. Creates and returns a Wallet signer
 * 
 * If the network is not Base Sepolia, throws an error BEFORE creating the signer.
 * 
 * @param privateKey - Private key for the wallet (from env var, never hardcoded)
 * @param rpcUrl - RPC URL (should be SERVER_BASE_SEPOLIA_RPC_URL, not NEXT_PUBLIC_RPC)
 * @returns Promise<Wallet> - Guarded wallet signer connected to Base Sepolia
 * @throws Error if network is not Base Sepolia
 * 
 * @example
 * ```ts
 * const signer = await createGuardedSigner(
 *   process.env.MINTER_PRIVATE_KEY!,
 *   process.env.SERVER_BASE_SEPOLIA_RPC_URL!
 * );
 * // Safe to use - guaranteed to be on Base Sepolia
 * const tx = await signer.sendTransaction({ to: address, value: amount });
 * ```
 */
export async function createGuardedSigner(
  privateKey: string,
  rpcUrl: string
): Promise<Wallet> {
  // Create provider first
  const provider = new JsonRpcProvider(rpcUrl);
  
  // CRITICAL: Verify network BEFORE creating signer
  await requireBaseSepolia(provider);
  
  // Network verified - safe to create signer
  const wallet = new Wallet(privateKey, provider);
  
  return wallet;
}

/**
 * Create a guarded provider (read-only, no signer)
 * 
 * Useful for read-only operations that still need network verification.
 * 
 * @param rpcUrl - RPC URL (should be SERVER_BASE_SEPOLIA_RPC_URL for server code)
 * @returns Promise<JsonRpcProvider> - Guarded provider connected to Base Sepolia
 * @throws Error if network is not Base Sepolia
 * 
 * @example
 * ```ts
 * const provider = await createGuardedProvider(process.env.SERVER_BASE_SEPOLIA_RPC_URL!);
 * const balance = await provider.getBalance(address);
 * ```
 */
export async function createGuardedProvider(
  rpcUrl: string
): Promise<JsonRpcProvider> {
  const provider = new JsonRpcProvider(rpcUrl);
  await requireBaseSepolia(provider);
  return provider;
}

/**
 * Wrap an existing wallet with network guard (cached getNetwork check).
 *
 * For pre-send checks, prefer requireFreshBaseSepolia(provider) in networkGuard.ts —
 * getNetwork() may return cached chainId on the same provider instance.
 *
 * @param wallet - Existing ethers Wallet instance
 * @returns Promise<Wallet> - Same wallet, but network-verified
 * @throws ChainGuardError if network is not Base Sepolia
 */
export async function guardExistingWallet(wallet: Wallet): Promise<Wallet> {
  if (!wallet.provider) {
    throw new Error('Wallet must have a provider to verify network');
  }
  
  await requireBaseSepolia(wallet.provider as JsonRpcProvider);
  return wallet;
}

