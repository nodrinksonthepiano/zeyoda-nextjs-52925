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
  getDidToken?: () => Promise<string | null>  // Get Magic DID token for API calls
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
          const userEmail = meta.email || null
          console.log("👤 MagicProvider: User authenticated:", userAddress, "Email:", userEmail)
          
          // CRITICAL: Check whitelist on every page load
          if (userEmail) {
            console.log("🔍 MagicProvider: Checking whitelist status for:", userEmail)
            try {
              const whitelistCheck = await fetch('/api/checkWhitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail })
              })
              
              const whitelistResult = await whitelistCheck.json()
              
              if (!whitelistResult.isWhitelisted) {
                console.log("❌ MagicProvider: User no longer whitelisted, forcing logout")
                // Force logout if not whitelisted
                await magic.user.logout()
                sessionStorage.removeItem('magic-auth-state')
                userAddress = null
                console.log("✅ MagicProvider: User logged out due to whitelist removal")
              } else {
                console.log("✅ MagicProvider: User is whitelisted, session valid")
                // Cache successful auth (but don't cache too aggressively)
                if (userAddress) {
                  sessionStorage.setItem('magic-auth-state', JSON.stringify({
                    user: userAddress,
                    timestamp: Date.now()
                  }))
                }
              }
            } catch (whitelistError) {
              console.error("❌ MagicProvider: Whitelist check failed:", whitelistError)
              // On error, be safe and logout (fail-closed)
              await magic.user.logout()
              sessionStorage.removeItem('magic-auth-state')
              userAddress = null
            }
          } else {
            console.warn("⚠️ MagicProvider: No email found in Magic metadata")
            // No email = can't verify whitelist = logout for safety
            await magic.user.logout()
            sessionStorage.removeItem('magic-auth-state')
            userAddress = null
          }
        } else {
          console.log("❌ MagicProvider: No existing user session")
          // Clear any stale cached data
          sessionStorage.removeItem('magic-auth-state')
        }
        
        // Helper function to get DID token for API calls
        const getDidToken = async (): Promise<string | null> => {
          try {
            if (!magic) return null
            const isLoggedIn = await magic.user.isLoggedIn()
            if (!isLoggedIn) return null
            const token = await magic.user.getIdToken()
            return token
          } catch (error) {
            console.error('❌ Error getting DID token:', error)
            return null
          }
        }

        // SINGLE ATOMIC STATE UPDATE
        setState({ 
          magic, 
          provider, 
          user: userAddress,
          isReady: true,
          isLoading: false,
          error: null,
          getDidToken
        })
        
        console.log("✅ MagicProvider: Authentication initialization complete")
      } catch (error) {
        console.error("❌ MagicProvider: Authentication initialization failed:", error)
        
        // Clear any cached data on error
        sessionStorage.removeItem('magic-auth-state')
        
        // Helper function (even on error, provide it if magic exists)
        const getDidToken = async (): Promise<string | null> => {
          try {
            if (!state.magic) return null
            const isLoggedIn = await state.magic.user.isLoggedIn()
            if (!isLoggedIn) return null
            const token = await state.magic.user.getIdToken()
            return token
          } catch (error) {
            console.error('❌ Error getting DID token:', error)
            return null
          }
        }

        // Single error state update
        setState(prev => ({ 
          ...prev,
          magic: prev.magic, // Keep magic instance if it was created
          provider: prev.provider, // Keep provider if it was created
          user: null,
          isReady: true,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
          getDidToken: prev.magic ? getDidToken : undefined
        }))
      }
    }

    initializeAuth()
  }, [])

  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
} 