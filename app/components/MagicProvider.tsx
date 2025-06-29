'use client'
import { Magic } from 'magic-sdk'
import { createContext, useState, useEffect, useContext } from 'react'
import { ethers } from 'ethers'

type WalletCtx = {
  magic?: Magic
  provider?: ethers.BrowserProvider
  user?: string | null
  isInitialized?: boolean
}

const WalletContext = createContext<WalletCtx>({})

export function useWallet() {
  return useContext(WalletContext)
}

export function MagicProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletCtx>({ user: null, isInitialized: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const magic = new Magic(process.env.NEXT_PUBLIC_MAGIC_PK!, {
      network: {
        rpcUrl: process.env.NEXT_PUBLIC_RPC!,
        chainId: 84532 // Base Sepolia
      }
    })
    const provider = new ethers.BrowserProvider(magic.rpcProvider as any)

    async function init() {
      try {
        console.log("🔧 MagicProvider: Initializing Magic Link...")
        
        // Check if user is already logged in (without forcing logout)
        const isLoggedIn = await magic.user.isLoggedIn()
        let userAddress = null
        
        if (isLoggedIn) {
          console.log("🔍 MagicProvider: User session detected, getting user info...")
          const meta = await magic.user.getInfo()
          userAddress = meta.publicAddress || null
          console.log("👤 MagicProvider: User restored:", userAddress)
        } else {
          console.log("❌ MagicProvider: No existing user session")
        }
        
        setState({ 
          magic, 
          provider, 
          user: userAddress,
          isInitialized: true 
        })
        
        console.log("✅ MagicProvider: Initialization complete")
      } catch (error) {
        console.error("❌ MagicProvider: Initialization error:", error)
        setState({ 
          magic, 
          provider, 
          user: null,
          isInitialized: true 
        })
      }
    }
    init()
  }, [])

  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
} 