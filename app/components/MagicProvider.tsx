'use client'
import { Magic } from 'magic-sdk'
import { createContext, useState, useEffect, useContext } from 'react'
import { ethers } from 'ethers'

type WalletCtx = {
  magic?: Magic
  provider?: ethers.BrowserProvider
  user?: string | null
  isReady: boolean      // true once auth check finished
  isLoading: boolean    // initial loader
  error?: string | null
}

const WalletContext = createContext<WalletCtx>({
  user: null,
  isReady: false,
  isLoading: true,
  error: null
})

export function useWallet() {
  return useContext(WalletContext)
}

export function MagicProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletCtx>({ 
    user: null, 
    isReady: false, 
    isLoading: true,
    error: null 
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    async function initializeAuth() {
      try {
        console.log("🔧 MagicProvider: Starting authentication initialization...")
        
        // Create Magic instance
        const magic = new Magic(process.env.NEXT_PUBLIC_MAGIC_PK!, {
          network: {
            rpcUrl: process.env.NEXT_PUBLIC_RPC!,
            chainId: 84532 // Base Sepolia
          }
        })
        const provider = new ethers.BrowserProvider(magic.rpcProvider as any)

        // Check for cached auth state first for faster loading
        let cachedUser = null
        try {
          const cachedAuth = sessionStorage.getItem('magic-auth-state')
          if (cachedAuth) {
            const { user, timestamp } = JSON.parse(cachedAuth)
            // Only use cached data if it's less than 30 minutes old (shorter cache)
            if (Date.now() - timestamp < 1800000) {
              cachedUser = user
              console.log("🔍 MagicProvider: Using cached auth state:", cachedUser)
            } else {
              console.log("🔍 MagicProvider: Cached auth state expired, clearing...")
              sessionStorage.removeItem('magic-auth-state')
            }
          }
        } catch (e) {
          console.warn("⚠️ MagicProvider: Error reading cached auth:", e)
          sessionStorage.removeItem('magic-auth-state')
        }

        // Perform actual auth check (let Magic.link handle its own flow)
        console.log("🔍 MagicProvider: Checking Magic.link authentication...")
        const isLoggedIn = await magic.user.isLoggedIn()
        let userAddress = null
        
        if (isLoggedIn) {
          console.log("🔍 MagicProvider: User session detected, getting user info...")
          const meta = await magic.user.getInfo()
          userAddress = meta.publicAddress || null
          console.log("👤 MagicProvider: User authenticated:", userAddress)
          
          // Cache successful auth (but don't cache too aggressively)
          if (userAddress) {
            sessionStorage.setItem('magic-auth-state', JSON.stringify({
              user: userAddress,
              timestamp: Date.now()
            }))
          }
        } else {
          console.log("❌ MagicProvider: No existing user session")
          // Clear any stale cached data
          sessionStorage.removeItem('magic-auth-state')
        }
        
        // SINGLE ATOMIC STATE UPDATE
        setState({ 
          magic, 
          provider, 
          user: userAddress,
          isReady: true,
          isLoading: false,
          error: null
        })
        
        console.log("✅ MagicProvider: Authentication initialization complete")
      } catch (error) {
        console.error("❌ MagicProvider: Authentication initialization failed:", error)
        
        // Clear any cached data on error
        sessionStorage.removeItem('magic-auth-state')
        
        // Single error state update
        setState(prev => ({ 
          ...prev,
          magic: prev.magic, // Keep magic instance if it was created
          provider: prev.provider, // Keep provider if it was created
          user: null,
          isReady: true,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed'
        }))
      }
    }

    initializeAuth()
  }, [])

  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
} 