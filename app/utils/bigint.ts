/**
 * Strict BigInt Conversion Utility
 * 
 * Prevents precision loss from JavaScript's Number() scientific notation
 * Safe for handling large Wei values (10^27 scale) without truncation
 */

/**
 * Convert unknown value to BigInt without precision loss
 * 
 * @param val - Value to convert (BigInt, string, ethers BigNumber, etc.)
 * @returns BigInt representation without precision loss
 * 
 * @example
 * // Safe - no precision loss
 * toBigIntStrict("1037000000000000000000000000") // 1037 * 10^24
 * toBigIntStrict(ethersBigNumber) // ethers BigNumber object
 * 
 * // Dangerous - would lose precision with Number()
 * BigInt(Number("1037000000000000000000000000")) // WRONG: scientific notation
 */
export const toBigIntStrict = (val: unknown): bigint => {
  // Already a BigInt
  if (typeof val === 'bigint') return val;
  
  // Handle ethers BigNumber objects or similar
  if (typeof val === 'object' && val !== null && 'toString' in val) {
    return BigInt((val as { toString(): string }).toString());
  }
  
  // Handle string values directly (most common case)
  if (typeof val === 'string') {
    return BigInt(val);
  }
  
  // Log unexpected types for debugging
  console.warn('⚠️ toBigIntStrict: Unexpected type:', typeof val, 'Value:', val);
  return 0n;
};

/**
 * Format BigInt balance for display with proper decimals
 * 
 * @param balance - Balance in Wei (BigInt)
 * @param decimals - Token decimals (default 18)
 * @param maxDigits - Maximum fraction digits to display
 * @returns Formatted string for UI display
 */
export const formatBalance = (
  balance: bigint, 
  decimals: number = 18, 
  maxDigits: number = 4
): string => {
  if (balance === 0n) return "0";
  
  try {
    // Use ethers.formatUnits for safe conversion
    const { ethers } = require('ethers');
    const formatted = ethers.formatUnits(balance, decimals);
    const num = parseFloat(formatted);
    
    // Format with appropriate precision
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    } else if (num >= 1) {
      return num.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
    } else {
      return num.toFixed(maxDigits);
    }
  } catch (error) {
    console.warn('⚠️ formatBalance error:', error);
    return balance.toString();
  }
};

/**
 * Check if a value can be safely converted to BigInt
 * 
 * @param val - Value to test
 * @returns true if conversion is safe
 */
export const isSafeBigIntConversion = (val: unknown): boolean => {
  try {
    toBigIntStrict(val);
    return true;
  } catch {
    return false;
  }
}; 