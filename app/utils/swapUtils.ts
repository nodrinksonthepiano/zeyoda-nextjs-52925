import { ethers } from 'ethers';

/** Matches Solidity UupsAMM / Swap `FEE_DENOMINATOR` (10000) */
export const AMM_FEE_DENOMINATOR = 10000n;

// UUPS AMM ABI (minimal - only what we need)
const UUPS_AMM_ABI = [
  'function swapEthForTokens(address token, uint256 minTokens) external payable',
  'function swapTokensForEth(address token, uint256 tokenAmount, uint256 minEth) external',
  'function getReserves(address token) view returns (uint256 tokenReserve, uint256 ethReserve)',
  'function getTokenQuote(address token, uint256 ethAmount) view returns (uint256)',
  'function getEthQuote(address token, uint256 tokenAmount) view returns (uint256)'
] as const;

const AMM_FEE_READ_ABI = [
  'function feeBps() view returns (uint16)',
  'function tradingFee() view returns (uint256)'
] as const;

/**
 * Get AMM contract instance
 * @param ammAddress - The AMM contract address (from artist config.swap)
 * @param signerOrProvider - Ethers signer or provider
 */
export function getAMMContract(
  ammAddress: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(ammAddress, UUPS_AMM_ABI, signerOrProvider);
}

/**
 * Swap ETH for tokens
 * @param ammAddress - AMM contract address
 * @param tokenAddress - Token to buy
 * @param ethAmount - Amount of ETH to spend (in wei)
 * @param minTokensOut - Minimum tokens expected (slippage protection)
 * @param signer - Ethers signer
 */
export async function swapETHForTokens(
  ammAddress: string,
  tokenAddress: string,
  ethAmount: bigint,
  minTokensOut: bigint,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const amm = getAMMContract(ammAddress, signer);
  return await amm.swapEthForTokens(tokenAddress, minTokensOut, { value: ethAmount });
}

/**
 * Swap tokens for ETH
 * @param ammAddress - AMM contract address
 * @param tokenAddress - Token to sell
 * @param tokenAmount - Amount of tokens to sell (in wei)
 * @param minEthOut - Minimum ETH expected (slippage protection)
 * @param signer - Ethers signer
 */
export async function swapTokensForETH(
  ammAddress: string,
  tokenAddress: string,
  tokenAmount: bigint,
  minEthOut: bigint,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const amm = getAMMContract(ammAddress, signer);
  
  // Approve AMM to spend tokens
  const tokenAbi = ['function approve(address spender, uint256 amount) returns (bool)'];
  const token = new ethers.Contract(tokenAddress, tokenAbi, signer);
  const approveTx = await token.approve(ammAddress, tokenAmount);
  await approveTx.wait();
  
  return await amm.swapTokensForEth(tokenAddress, tokenAmount, minEthOut);
}

/**
 * Get reserves for a token in the AMM
 * @param ammAddress - AMM contract address
 * @param tokenAddress - Token address
 * @param provider - Ethers provider
 */
export async function getReserves(
  ammAddress: string,
  tokenAddress: string,
  provider: ethers.Provider
): Promise<{ tokenReserve: bigint; ethReserve: bigint }> {
  const amm = getAMMContract(ammAddress, provider);
  const [tokenReserve, ethReserve] = await amm.getReserves(tokenAddress);
  return { tokenReserve, ethReserve };
}

/**
 * Calculate output amount with 0.3% fee
 * @param amountIn - Input amount
 * @param reserveIn - Reserve of input token
 * @param reserveOut - Reserve of output token
 */
export function calculateAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) {
    return 0n;
  }
  
  // Apply 0.3% fee: amountInWithFee = amountIn * 997
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  
  return numerator / denominator;
}

/**
 * Constant-product output after `tradingFee` bps, matching UupsAMM._getAmountOut / legacy Swap.
 */
export function constantProductAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  tradingFeeBps: bigint
): bigint {
  if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) {
    return 0n;
  }
  const fee = tradingFeeBps >= AMM_FEE_DENOMINATOR ? AMM_FEE_DENOMINATOR - 1n : AMM_FEE_DENOMINATOR - tradingFeeBps;
  const amountInWithFee = amountIn * fee;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * AMM_FEE_DENOMINATOR + amountInWithFee;
  return numerator / denominator;
}

/**
 * Protocol skim (feeBps) on input + curve fee (tradingFee). Legacy pools without `feeBps` use 0 skim.
 */
export async function readAmmCurveParams(
  ammAddress: string,
  provider: ethers.Provider
): Promise<{ feeProtocolBps: bigint; tradingFeeBps: bigint }> {
  const amm = new ethers.Contract(ammAddress, AMM_FEE_READ_ABI, provider);
  let tradingFeeBps = 30n;
  let feeProtocolBps = 0n;
  try {
    tradingFeeBps = BigInt(await amm.tradingFee());
  } catch {
    tradingFeeBps = 30n;
  }
  try {
    feeProtocolBps = BigInt(await amm.feeBps());
  } catch {
    feeProtocolBps = 0n;
  }
  if (feeProtocolBps > 100n) feeProtocolBps = 100n;
  if (tradingFeeBps > 1000n) tradingFeeBps = 30n;
  return { feeProtocolBps, tradingFeeBps };
}

/** Expected tokens out for swapEthForTokens path (ETH includes protocol skim when V2 feeBps set). */
export async function estimateTokensOutFromEthIn(
  ammAddress: string,
  tokenAddress: string,
  ethWeiIn: bigint,
  provider: ethers.Provider
): Promise<bigint> {
  const [{ tokenReserve, ethReserve }, params] = await Promise.all([
    getReserves(ammAddress, tokenAddress, provider),
    readAmmCurveParams(ammAddress, provider)
  ]);
  const protocolFee = (ethWeiIn * params.feeProtocolBps) / AMM_FEE_DENOMINATOR;
  const amountInEth = ethWeiIn - protocolFee;
  return constantProductAmountOut(
    amountInEth,
    ethReserve,
    tokenReserve,
    params.tradingFeeBps
  );
}

/** Expected ETH out for swapTokensForEth path (tokens include protocol skim when V2 feeBps set). */
export async function estimateEthOutFromTokenIn(
  ammAddress: string,
  tokenAddress: string,
  tokenWeiIn: bigint,
  provider: ethers.Provider
): Promise<bigint> {
  const [{ tokenReserve, ethReserve }, params] = await Promise.all([
    getReserves(ammAddress, tokenAddress, provider),
    readAmmCurveParams(ammAddress, provider)
  ]);
  const protocolFee = (tokenWeiIn * params.feeProtocolBps) / AMM_FEE_DENOMINATOR;
  const amountInTokens = tokenWeiIn - protocolFee;
  return constantProductAmountOut(
    amountInTokens,
    tokenReserve,
    ethReserve,
    params.tradingFeeBps
  );
}
