'use client'
import { Magic } from 'magic-sdk'
import { createContext, useState, useEffect, useContext } from 'react'
import { ethers } from 'ethers'

type WalletCtx = {
  magic?: Magic
  provider?: ethers.BrowserProvider
  user?: string | null
}

const WalletContext = createContext<WalletCtx>({})

export function useWallet() {
  return useContext(WalletContext)
}

export function MagicProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletCtx>({ user: null })

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
      const loggedIn = await magic.user.isLoggedIn()
      const userMeta = loggedIn ? await magic.user.getInfo() : null
      setState({ magic, provider, user: userMeta?.publicAddress || null })
    }
    init()
  }, [])

  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
} 