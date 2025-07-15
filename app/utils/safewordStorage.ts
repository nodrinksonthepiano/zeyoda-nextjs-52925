/**
 * Safeword Storage Utility
 * 
 * Manages persistent storage of safeword unlock states with:
 * - Chain-scoped, user-specific keys
 * - Robust error handling and corruption recovery
 * - Migration from legacy sessionStorage
 * - Clean separation of concerns
 */

const CHAIN_ID = 84532; // Base Sepolia
const LEGACY_SESSION_KEY = 'zeyodaUnlockedArtists';
const LEGACY_TEMP_KEY = 'zeyodaUnlockedArtists_temp';

/**
 * Generate storage key for current user and chain
 */
function getStorageKey(userAddress: string): string {
  return `zua_${CHAIN_ID}_${userAddress.toLowerCase()}`;
}

/**
 * Load unlocked artist states for a user
 */
export function loadUnlockedStates(userAddress: string | null): { [key: string]: boolean } {
  if (!userAddress) return {};
  
  const storageKey = getStorageKey(userAddress);
  
  try {
    // Check for localStorage first
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log(`🔑 Loaded safeword states for ${userAddress.slice(0, 6)}...`);
      return parsed;
    }
    
    // Migration: Check for legacy sessionStorage
    const legacySession = sessionStorage.getItem(LEGACY_SESSION_KEY);
    const legacyTemp = localStorage.getItem(LEGACY_TEMP_KEY);
    
    if (legacySession || legacyTemp) {
      console.log('🔄 Migrating safeword state from legacy storage...');
      const legacyData = legacySession || legacyTemp;
      if (!legacyData) return {};
      const parsed = JSON.parse(legacyData);
      
      // Save to new format
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      
      // Clean up legacy storage
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      localStorage.removeItem(LEGACY_TEMP_KEY);
      
      console.log('✅ Migration complete');
      return parsed;
    }
    
    return {};
  } catch (error) {
    console.warn('⚠️ Corrupted safeword storage detected, clearing...', error);
    
    // Clear corrupted storage to prevent infinite loops
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    localStorage.removeItem(LEGACY_TEMP_KEY);
    
    return {};
  }
}

/**
 * Save unlocked artist states for a user
 */
export function saveUnlockedStates(userAddress: string | null, states: { [key: string]: boolean }): void {
  if (!userAddress) return;
  
  const storageKey = getStorageKey(userAddress);
  
  try {
    localStorage.setItem(storageKey, JSON.stringify(states));
    console.log(`💾 Saved safeword states for ${userAddress.slice(0, 6)}...`);
  } catch (error) {
    console.error('❌ Failed to save safeword states:', error);
  }
}

/**
 * Clear unlocked artist states for a user
 */
export function clearUnlockedStates(userAddress: string | null): void {
  if (!userAddress) return;
  
  const storageKey = getStorageKey(userAddress);
  
  try {
    localStorage.removeItem(storageKey);
    console.log(`🗑️ Cleared safeword states for ${userAddress.slice(0, 6)}...`);
  } catch (error) {
    console.error('❌ Failed to clear safeword states:', error);
  }
}

/**
 * Clear all safeword-related storage (for logout)
 */
export function clearAllSafewordStorage(): void {
  try {
    // Clear legacy storage
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    localStorage.removeItem(LEGACY_TEMP_KEY);
    
    // Clear all chain-scoped keys for this chain
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`zua_${CHAIN_ID}_`)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('🗑️ Cleared all safeword storage');
  } catch (error) {
    console.error('❌ Failed to clear safeword storage:', error);
  }
}

/**
 * Check if any artist is unlocked for a user
 */
export function hasAnyUnlockedArtist(userAddress: string | null): boolean {
  const states = loadUnlockedStates(userAddress);
  return Object.values(states).some(Boolean);
} 