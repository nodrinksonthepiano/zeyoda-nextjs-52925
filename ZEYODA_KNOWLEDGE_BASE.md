# Zeyoda Knowledge Base

> **AI Agent Context** — Read this before making changes to features, architecture, or auth/security.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Integration Points (Downstream: ArtisTalks)](#integration-points-downstream-artistalks)
4. [Security Enhancements](#security-enhancements-already-built)
5. [Auth & Security](#auth--security)
6. [Key Flows](#key-flows)
7. [Conventions](#conventions)
8. [Known Gotchas](#known-gotchas)
9. [References](#references)

---

## Project Overview

**Zeyoda** (Artistocks Protocol) is a Next.js Web3 platform enabling artists to sell art while maintaining token sovereignty through a protocol custody model.

- **Protocol** controls smart contracts, liquidity pools, and private keys
- **Artists** focus on creativity and content; earn from their tokens
- **Users** authenticate via Magic.link, trade tokens, purchase NFTs/downloads

**Tech Stack:** Next.js 15, TypeScript, Tailwind, Magic.link, Supabase, Base Sepolia, Solidity

---

## Architecture

### Folder Structure

```
app/
├── api/                    # API routes (all protected except whitelist)
│   ├── checkWhitelist/     # Public — login flow
│   ├── artist-earnings/    # Whitelist + token
│   ├── fundWallet/         # Whitelist
│   ├── purchase/1155/      # ERC-1155 purchase flow
│   ├── public/             # Proxy routes (whitelist, forward to internal)
│   └── ...
├── components/             # Wallet, PurchaseFlow, MagicProvider
├── contexts/               # ArtistRegistryContext
├── hooks/                  # useArtistConfig, useDownloadAccess, useWalletBalances
└── utils/
    ├── authenticatedFetch.ts   # Adds Bearer token to requests
    └── server/
        ├── whitelistCheck.ts   # verifyWhitelist()
        └── artistRegistry.ts   # getArtistContractsFromServer()
contracts/                  # ArtistToken, Swap, ERC-1155
deploy/                     # Hardhat deploy scripts
middleware.ts               # API route guard (token or internal secret)
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `middleware.ts` | Intercepts `/api/*`; requires Bearer token or `x-internal-secret`; public: `_health`, `checkWhitelist`, `GET /api/registry` |
| `whitelistCheck.ts` | Verifies Magic DID token + Supabase `whitelist_emails` |
| `authenticatedFetch` | Client-side fetch wrapper; adds `Authorization: Bearer <DID>` |
| `ArtistRegistryContext` | Provides `artist_registry` (token, swap, downloads) per artist |
| `useDownloadAccess` | Checks ERC-1155 balances for user's download access |
| `useArtistConfig` | Artist config + live LP pricing (30s refresh) |

---

## Integration Points (Downstream: ArtisTalks)

**ArtisTalks** is built on Zeyoda patterns. It does **not** call Zeyoda APIs directly; it shares:

- **Patterns:** Event-driven preview (`profilePreview`, `primaryColorChange`), `applyLogoBackground`
- **Utilities:** `themeBackground.ts`, color/font/logo handling
- **UI concepts:** Orbit renderer, halo, token theming

**Zeyoda files ArtisTalks references:**

- `app/utils/themeBackground.ts` → `applyLogoBackground()`
- `app/components/ProfileEditPanel.tsx` (panel UI patterns)
- `app/components/ThemeOrbitRenderer.tsx` (token color events)

**ArtisTalks repo:** `https://github.com/nodrinksonthepiano/ArtisTalks112025`

---

## Security Enhancements (Already Built)

| Module | Purpose |
|--------|---------|
| `app/utils/networkGuard.ts` | `requireBaseSepolia(provider)` — throws if chainId !== 84532. Blocks mainnet (1, 10, 8453, etc.). |
| `app/utils/guardedSigner.ts` | `createGuardedSigner`, `createGuardedProvider` — wrap ethers Wallet/Provider with network guard. Used by purchase/1155, lp/withdraw, mintDownload, uploadAsset, mint-collectible. |
| `app/utils/apiGuard.ts` | `requireSecret(req)` — x-internal-secret header. `rateLimit(req, key)` — uses x-forwarded-for, x-real-ip. |
| **Proxy pattern** | `/api/public/*` routes verify whitelist, forward to internal with `x-internal-secret` and `x-verified-email`. Internal routes trust proxy when headers present. |
| **fundWallet** | **DISABLED** — returns 403. Original logic commented out. Do not re-enable until SEC-001 remediation complete. |

---

## Auth & Security

### Magic.link Flow

1. User enters email → `checkWhitelist` (public, no token)
2. If whitelisted → Magic.loginWithEmailOTP()
3. Client gets DID token → stored in MagicProvider
4. All protected API calls use `authenticatedFetch` → adds `Authorization: Bearer <DID>`
5. Middleware checks token presence; route handlers call `verifyWhitelist()` for full validation

### Whitelist

- **Table:** `whitelist_emails` (email, role, used, notes)
- **Check:** `verifyWhitelist(request)` in `app/utils/server/whitelistCheck.ts`
- **Flow:** Magic token → email → Supabase lookup → verified/not
- **Login attempts:** Logged to `login_attempts` (email, whitelisted, clue, timestamp)

### Middleware Public Routes

- `/api/_health`
- `/api/checkWhitelist`
- `GET /api/registry`

### Internal Routes

- `x-internal-secret` header + `INTERNAL_API_SECRET` env → bypasses token check
- Used for server-to-server calls (e.g. public proxy → internal route)

### Defense-in-Depth

Protected routes call `verifyWhitelist()` even though middleware checks token. Middleware blocks missing tokens; route handlers verify Magic + whitelist.

---

## Key Flows

### LP Pricing

- **LP exists:** `getReserves()` from pool → live price
- **No LP:** Supabase `tokenprice` fallback
- **Refresh:** 30 seconds
- **Indicator:** "● Live Price" vs "● Fallback Price"

### Download Access (ERC-1155)

- `useDownloadAccess(userAddress, artistId)` → checks `balanceOf` for assets 1–10
- `useAllArtistsDownloadAccess` → checks all artists' assets from `artist_assets`
- Registry provides `downloads` contract address per artist

### Artist Registry

- **Source:** Supabase `artist_registry` (id, token, swap, downloads, treasury_wallet)
- **Cache:** 5 min server-side in `artistRegistry.ts`
- **Fallback:** `addressRegistryFallback.ts` if DB fails
- **Context:** `ArtistRegistryProvider` wraps app; `useArtistRegistryContext()` in components

### Purchase Flow (1155)

- Whitelist verified
- Proxy routes (`/api/public/purchase1155`) verify whitelist, forward to internal with `x-verified-email`

---

## Conventions

- **Never** read or modify `.env` — agent must not touch env files
- **Never** run git commands — user manages version control
- **Propose a plan** before non-trivial edits
- **Event naming:** `profilePreview`, `profilePreviewClear`, `primaryColorChange`, `logoPreviewChange`
- **API errors:** Return `{ error, message }` with appropriate status (401/403/500)

---

## Known Gotchas

1. **PGRST116** — Supabase "no rows" is not an error; check `whitelistError.code !== 'PGRST116'`
2. **BigInt** — `useDownloadAccess` / ethers v6 use `0n` for zero; `balance > 0n`
3. **Provider chainId** — Base Sepolia = 84532; RPC from `NEXT_PUBLIC_RPC`
4. **MagicProvider** — Checks whitelist on every page load; forces logout if user removed from whitelist
5. **Proxy routes** — `/api/public/*` verify whitelist, then forward with `x-verified-email`; internal route trusts header

---

## References

- **README:** `README.md` — onboarding, LP seeding, deployment
- **ArtisTalks KB:** `https://github.com/nodrinksonthepiano/ArtisTalks112025` — `ARTISTALKS_KNOWLEDGE_BASE.md`
- **Zeyoda repo:** `https://github.com/nodrinksonthepiano/zeyoda-nextjs-52925` (branch: `feat/secure-middleware-whitelist-clean`)
