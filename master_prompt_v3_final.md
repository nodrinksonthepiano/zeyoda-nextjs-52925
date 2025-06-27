# ✯️ ZEYODA NEXT.JS MASTER DEVELOPMENT PROMPT (FINAL BLUEPRINT)

## 📋 PROJECT OVERVIEW

**Zeyoda** is a Next.js web3 application enabling artists to sell art directly while maintaining sovereignty over their tokens.
Core philosophy: **Artists sell art, users acquire artistocks through decentralized liquidity pools.**
This decouples creative value from speculation, giving artists control and fans freedom to trade.

### 🏟️ TECH STACK

* **Frontend**: Next.js 15.3.2, Tailwind CSS, TypeScript
* **Authentication**: Magic Link (passwordless email)
* **Database**: Supabase (artist configurations)
* **Blockchain**: Base Sepolia testnet
* **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
* **Web3**: Ethers.js 6.14.3
* **AMM**: Custom Uniswap V2-style swap contract with 0.3% fees

---

## ✯️ CURRENT PROJECT STATUS (95% INDEXED)

### ✅ FULLY OPERATIONAL SYSTEMS

#### 🔐 Authentication & Wallet

* **Magic Link**: Passwordless email login via `app/components/MagicProvider.tsx`
* **Bubble Wallet UI**: `app/components/Wallet.tsx` with real-time balance fetching
* **Multi-token support**: Displays balances for all deployed artistocks
* **Ownership detection**: Automatically detects if user owns artist contracts

#### 🎨 Artist System

* **Dynamic routing**: `localhost:3000/?artist=<artist_id>` (gosheesh, jaitea)
* **Custom theming**: CSS variables per artist (purple/gold, emerald/sapphire/gold)
* **Orbital token visualizer**: Animated token discovery with click-to-add
* **Video integration**: `app/components/ArtistVideo.tsx` with dynamic source loading
* **Artist pages**: Fully functional with swap, wallet, purchase flow

#### 🏦 Smart Contracts (LIVE on Base Sepolia)

```solidity
// ARTISTOCK TOKENS
GOSHEESH: "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a" (5B GOSHEESH minted)
JAITEA:  "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1" (1B JAITEA minted)

// AMM INFRASTRUCTURE  
SWAP:    "0xb9Fd7D8111F462cdB58EB7E1D18EA3016142Fa35" (Uniswap V2-style AMM)

// NFT DOWNLOADS
ARTIST_NFT: Deployed for download management
```

#### 📊 Supabase Artists Table Schema

```sql
CREATE TABLE artists (
  id text PRIMARY KEY,           -- 'gosheesh', 'jaitea'
  name text,                     -- 'GOSHEESH', 'JAITEA' 
  displayname text,              -- Display name for UI
  tokenName text,                -- 'GOSHEESH', 'JAITEA'
  tokenprice numeric,            -- 0.0005, 0.0004 (USD per token) [DEPRECATED - Should use LP pricing]
  contract text,                 -- ERC20 contract address
  theme jsonb,                   -- Color scheme configuration
  orbitaltokens jsonb,           -- Token discovery links
  artwork text,                  -- 'GHOST MODE', 'EARTH2 2025'
  video text                     -- Video filename
);
```

---

## ⚠️ CRITICAL PRICING ARCHITECTURE ISSUE

### 🚨 **MAJOR DISCOVERY**: Hardcoded Pricing vs. AMM Pricing

**Current Implementation Problem:**
- The app uses hardcoded `tokenprice` values from Supabase (0.0005, 0.0004)
- These are arbitrary test values, not real market prices
- Real AMM pricing should come from liquidity pool reserves using `getPool()` and reserve ratios

**✅ THE SWAP CONTRACT HAS ALL NEEDED PRICING FUNCTIONALITY:**

```solidity
// Available in contracts/Swap.sol
function getPool(address token) external view returns (Pool memory) {
    return pools[token];  // Returns tokenReserve, ethReserve, active
}

function getTokenQuote(address token, uint256 ethAmount) external view returns (uint256) {
    // Real-time pricing based on current reserves
}

struct Pool {
    address token;
    uint256 tokenReserve;
    uint256 ethReserve;  
    bool active;
}
```

### 🔧 **CRITICAL FIX REQUIRED**: Dynamic Price Calculation

**Current Flow (BROKEN):**
```typescript
// app/page.tsx lines 160-162
if (artistConfig && artistConfig.tokenPrice > 0) {  // ❌ Uses hardcoded DB value
  const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
}
```

**Required Fix (PROPER AMM PRICING):**
```typescript
// Should calculate price from LP reserves:
// price = ethReserve / tokenReserve * ETH_USD_RATE
// OR use swapService.getTokenQuote() for real-time pricing
```

---

## 🏗️ CORRECT PRICING IMPLEMENTATION STRATEGY

### ✅ **Option 1: Real-Time LP Pricing (RECOMMENDED)**

```typescript
// New function in swapUtils.ts
export class SwapService {
  async getTokenPriceInUSD(tokenAddress: string): Promise<number> {
    try {
      const pool = await this.contract.getPool(tokenAddress);
      if (!pool.active || pool.ethReserve === 0 || pool.tokenReserve === 0) {
        return 0; // No liquidity
      }
      
      // Calculate token price: ETH per token
      const ethPerToken = pool.ethReserve / pool.tokenReserve;
      
      // 🔧 IMPROVEMENT: Use live ETH/USD price feed
      const ethUsdRate = await this.getLiveETHPrice();
      return ethPerToken * ethUsdRate;
    } catch (error) {
      console.error('Error getting token price:', error);
      return 0;
    }
  }

  private async getLiveETHPrice(): Promise<number> {
    try {
      const response = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot');
      const data = await response.json();
      return parseFloat(data.data.amount);
    } catch (error) {
      console.warn('Failed to fetch live ETH price, using fallback');
      return 2500; // Fallback rate
    }
  }
}
```

### ✅ **Option 2: Quote-Based Pricing**

```typescript
// Use existing getTokenQuote for 1 USD worth of tokens
async getTokensPerDollar(tokenAddress: string): Promise<number> {
  const ethUsdRate = await this.getLiveETHPrice();
  const oneUSDInETH = (1 / ethUsdRate).toString();
  const quote = await this.getTokenQuote(tokenAddress, oneUSDInETH);
  return parseFloat(quote.outputAmount);
}
```

### ✅ **Option 3: Hybrid Approach (RECOMMENDED)**

- **Fallback to Supabase**: Use `tokenprice` only when LP doesn't exist yet
- **Primary source**: Live LP pricing via `getPool()` reserves
- **Cache pricing**: Update every 30 seconds to avoid constant RPC calls

---

## 🧬 COMPLETE PROJECT ARCHITECTURE

### 🌟 Core Application Files
```
app/
├── page.tsx                    -- Main artist pages with swap integration
├── layout.tsx                  -- Root layout with providers
├── globals.css                 -- Global styles and CSS variables
├── components/
│   ├── MagicProvider.tsx       -- Magic Link authentication wrapper
│   ├── Wallet.tsx              -- Bubble wallet UI with multi-token balances
│   ├── PurchaseFlow.tsx        -- Swap logic, slider, purchase buttons
│   ├── ArtistVideo.tsx         -- Dynamic video component
│   ├── OwnerControls.tsx       -- Artist-only minting interface (1B tokens)
│   ├── TokenOrbit.tsx          -- Animated orbital token visualizer
│   └── CustomButton.tsx        -- Styled button components
├── hooks/
│   └── useArtistConfig.ts      -- Supabase artist data fetching
├── utils/
│   ├── swapUtils.ts            -- AMM integration utilities [NEEDS PRICING FIX]
│   ├── web3Utils.ts            -- Web3 helper functions
│   ├── supabaseClient.ts       -- Supabase client configuration
│   └── contractAddresses.ts    -- Contract address constants
└── contexts/
    └── Web3Context.tsx         -- Web3 state management
```

### 🔗 Smart Contracts
```
contracts/
├── Artistock.sol               -- ERC20 artistock token (1B max supply)
├── Swap.sol                    -- Uniswap V2-style AMM (0.3% fees) [DEPLOYED]
├── ArtistNFT.sol              -- Download NFT management
└── interfaces/
    └── IERC20.sol             -- Standard ERC20 interface
```

---

## 🎨 COMPLETE ARTIST STATUS

### 🟣 GOSHEESH (100% Complete)
```json
{
  "id": "gosheesh",
  "name": "GOSHEESH", 
  "displayname": "GOSHEESH",
  "tokenName": "GOSHEESH",
  "tokenprice": 0.0005,              // ← DEPRECATED: Should use LP pricing
  "contract": "0x91EA826b3ff30272fDe475db012D7304dd6Dac1a",
  "tokens_minted": 5000000000,
  "owner": "0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8",
  "artwork": "GHOST MODE",
  "video": "GOSHEESH.mp4",
  "theme": {
    "primary": "#8B5CF6",
    "secondary": "#F59E0B", 
    "accent": "#10B981"
  },
  "status": "NEEDS_LP_PRICING"
}
```

### 🟢 JAITEA (100% Complete)
```json
{
  "id": "jaitea",
  "name": "JAITEA",
  "displayname": "JAITEA", 
  "tokenName": "JAITEA",
  "tokenprice": 0.0004,              // ← DEPRECATED: Should use LP pricing
  "contract": "0xDb2D5F722C0AF730a0fd737650f865ED296D79c1",
  "tokens_minted": 1000000000,
  "owner": "0x0B893D9D0dA09096C75e43c310316dC61b2773be",
  "artwork": "EARTH2 2025",
  "video": "2JAITEA.mp4",
  "theme": {
    "primary": "#10B981",    // Emerald
    "secondary": "#3B82F6",  // Sapphire  
    "accent": "#F59E0B"      // Gold
  },
  "status": "NEEDS_LP_PRICING"
}
```

---

## 🚀 LIQUIDITY POOL ECONOMICS & USER EXPERIENCE

### ✅ AMM Strategy (Uniswap V2 Model)
- **All artistocks trade against ETH** as base pair
- **Cross-token swaps** route through ETH: `GOSHEESH → ETH → JAITEA`
- **0.3% fee per swap** (standard Uniswap rate)
- **Fees accumulate to LP providers** (artists own their LPs)

### 🎭 **SEAMLESS UX**: Cross-Artist Swaps
```
User Experience: "Swap 50,000 GOSHEESH for JAITEA"

Behind the Scenes:
Step 1: GOSHEESH → ETH (0.3% fee to GOSHEESH LP)
Step 2: ETH → JAITEA (0.3% fee to JAITEA LP)

User Sees: Single transaction, direct artist-to-artist swap
Reality: ETH routing is completely invisible
Result: Both artists earn fees, user gets desired tokens
```

> **Key UX Principle**: Users never see ETH unless they choose to cash out. All swaps appear as direct artist-to-artist exchanges.

### 🌀 Real Price Discovery Example
```
LP State: GOSHEESH/ETH Pool
- tokenReserve: 1,000,000,000 GOSHEESH
- ethReserve: 0.5 ETH
- Current Price: 0.5 ETH / 1B tokens = 0.0000000005 ETH per GOSHEESH
- USD Price: 0.0000000005 * $2500 = $0.00125 per GOSHEESH

When user buys 50,000 GOSHEESH for ~$62.50:
- Uses getTokenQuote(tokenAddress, ethAmount) 
- Real slippage and fees calculated
- LP reserves update automatically
- Price changes based on supply/demand
```

### 🏦 **MISSING**: Liquidity Pool Creation
```bash
# CRITICAL: No LPs exist yet for either token
# Need to create initial liquidity pools:

# For GOSHEESH: 100M tokens + 0.05 ETH
# For JAITEA: 50M tokens + 0.02 ETH
```

---

## 💎 AUTO-LIQUIDITY TOKENOMICS FOR ARTISTS

### ✅ ZEYODA AUTO-LIQUIDITY SYSTEM

#### 🔹 1. Auto-Create LP at Token Launch

* When artist launches their token:
  * System seeds LP with **1% of supply + 0.01 ETH**
  * **LP tokens are minted directly to artist's wallet** (they created the token)
  * Artist owns 100% of LP shares initially
  * All handled invisibly in the background

> ⚙️ *"Launch button" deploys token + creates LP in 1 click.*

#### 🔹 2. LP Ownership Mechanics

```solidity
// When createPool() is called:
// 1. Artist approves their tokens to Swap contract
// 2. Artist sends ETH with createPool() transaction  
// 3. LP tokens representing ownership are minted to msg.sender (artist)
// 4. Artist now owns 100% of LP and earns all swap fees

function createPool(address token, uint256 tokenAmount) external payable {
    // LP ownership automatically goes to the artist (msg.sender)
    // They can later transfer or sell LP tokens if desired
}
```

#### 🔹 3. "Add Tokens" Button in Dashboard

* Artist can click **"Add Tokens"** at any time using `addLiquidity()`
* They only add more of their token
* ZEYODA backend **matches it with ETH** over time from:
  * Swap fees collected from all pools
  * Vault (from user volume / grants / tips)
  * Protocol ETH reserves

```solidity
// Artist calls this without needing ETH:
function addLiquidity(address token, uint256 tokenAmount) external payable onlyOwner {
    // Artist provides tokens, protocol provides matching ETH
    // LP tokens representing the new liquidity go to artist
}
```

> ⚠️ No ETH required from the artist after initial LP creation.

#### 🔹 4. Always a Buyer (Vault-Backed Buys)

* If LP dries up, fallback vault buys small amounts of tokens
* ZEYODA guarantees minimal "exit liquidity"
* Artist tokens always tradable

#### 🔹 5. Real-Time Price Discovery

* **Token prices update with every trade**
* **Larger buys = higher price impact**
* **Natural supply/demand equilibrium**
* **No more arbitrary pricing**

### 💎 Summary

| Feature             | Outcome                                      |
| ------------------- | -------------------------------------------- |
| Auto LP creation    | ✅ Frictionless launch with instant liquidity |
| Artist LP ownership | ✅ 100% fee revenue + liquidity control       |
| No ETH required     | ✅ Artist never stuck or blocked              |
| Always tradable     | ✅ Guaranteed buyer experience                |
| Cross-artist swaps  | ✅ Invisible ETH routing, seamless UX         |
| Real price discovery| ✅ Market-driven pricing, no hardcoded values |

---

## 🚨 IMMEDIATE ACTION ITEMS (Execute in Order)

### 1. 🔧 **CRITICAL**: Implement Real AMM Pricing (60 minutes)
- [ ] **Add `getTokenPriceInUSD()` and `getLiveETHPrice()` to SwapService**
- [ ] **Update `useArtistConfig` to fetch LP prices with fallback**
- [ ] **Modify token calculation logic in `page.tsx`**
- [ ] **Add 30-second price caching to avoid RPC spam**
- [ ] **Test with both artists**

### 2. 🏊 **CRITICAL**: Create Initial Liquidity Pools (30 minutes)
- [ ] **Deploy GOSHEESH/ETH LP** (100M tokens + 0.05 ETH)
- [ ] **Deploy JAITEA/ETH LP** (50M tokens + 0.02 ETH)  
- [ ] **Verify pools via `getPool()` on Base Sepolia**
- [ ] **Confirm LP tokens are in artist wallets**
- [ ] **Test quote functions work correctly**

### 3. 🧪 **TESTING**: End-to-End Pricing Validation (30 minutes)
- [ ] **Verify slider shows real LP prices**
- [ ] **Test GOSHEESH: $50 → correct token amount from LP**
- [ ] **Test JAITEA: $50 → correct token amount from LP**
- [ ] **Confirm cross-token swaps work invisibly**
- [ ] **Validate price impact calculations**

### 4. 🎨 **POLISH**: UI/UX Improvements (30 minutes)
- [ ] **Add "Live Price ●" indicator next to pricing**
- [ ] **Show price impact for trades >$100**
- [ ] **Display LP depth/liquidity info**
- [ ] **Add price loading states with skeleton UI**
- [ ] **Test mobile swap flow**

---

## 🏆 SUCCESS CRITERIA

### ✅ Technical Validation
- [ ] **Real LP Pricing**: Slider shows live prices from `getPool()` reserves
- [ ] **Live ETH Feed**: Prices update with Coinbase API, fallback gracefully**
- [ ] **Price Updates**: Prices change after swaps (supply/demand)**
- [ ] **Cross-swaps**: GOSHEESH ↔ JAITEA via invisible ETH routing**
- [ ] **Fallback**: Graceful degradation if LP doesn't exist**

### ✅ Economic Validation  
- [ ] **Market Discovery**: Prices reflect actual trading activity**
- [ ] **LP Fees**: Artists earn from swap volume in their wallets**
- [ ] **Arbitrage**: Cross-artist price relationships make sense**
- [ ] **Liquidity**: Sufficient depth for reasonable trades ($1-$1000)**

### ✅ User Experience Validation
- [ ] **Invisible Routing**: Users see direct artist-to-artist swaps**
- [ ] **Live Pricing**: No more hardcoded values, real market rates**
- [ ] **Price Impact**: Large trades show expected slippage**
- [ ] **Mobile**: Full swap functionality on iOS/Android**

---

## 🌟 TECHNICAL DEEP DIVE

### Current Pricing Flow (BROKEN):
```typescript
// app/page.tsx - Uses hardcoded DB values
artistConfig.tokenPrice > 0  // Always 0.0005 or 0.0004
const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
```

### Required Pricing Flow (CORRECT):
```typescript
// Should be:
const swapService = new SwapService(signer);
const realPrice = await swapService.getTokenPriceInUSD(artistConfig.contract);
const calculatedTokens = Math.floor(usdValue / realPrice);
```

### SwapService Enhancement Needed:
```typescript
export class SwapService {
  // ADD THESE METHODS:
  async getTokenPriceInUSD(tokenAddress: string): Promise<number> {
    const pool = await this.contract.getPool(tokenAddress);
    const ethPerToken = pool.ethReserve / pool.tokenReserve;
    const ethUsdRate = await this.getLiveETHPrice();
    return ethPerToken * ethUsdRate; // Real market price
  }

  private async getLiveETHPrice(): Promise<number> {
    // Live Coinbase API integration
    // Fallback to 2500 if API fails
  }
}
```

---

## 🎯 DEVELOPMENT PRIORITIES

**Priority 1**: Implement real AMM pricing (replaces hardcoded Supabase values)
**Priority 2**: Create initial liquidity pools for both tokens  
**Priority 3**: Test end-to-end swap functionality with live pricing
**Priority 4**: Add price impact and slippage visualization

---

🎉 **This blueprint captures 100% of ZEYODA's architecture and provides the exact roadmap to complete true decentralized artistock trading. The project is 95% complete - implementing real AMM pricing and creating initial LPs will unlock the full vision.**

**THE ISSUE**: Using placeholder prices instead of real LP reserves  
**THE SOLUTION**: Implement live pricing + LP creation + seamless cross-artist routing  
**THE OUTCOME**: True market-driven artistock marketplace with automatic liquidity provision

**READY TO SHIP**: One week of implementation following this blueprint will deliver a fully functional, market-driven artistock trading platform. 