# ZEYODA - Artistocks Protocol

> **Next.js Web3 platform enabling artists to sell art while maintaining token sovereignty through protocol custody model.**

## 🎯 **Architecture Overview**

### **Protocol Custody Model** ✨
- **Artistocks Protocol** controls smart contracts, liquidity pools, and private keys
- **Artists** focus on creativity, community, and content while earning from their tokens  
- **Security** through hardware wallets/multisig instead of individual key management
- **Scalability** with seamless onboarding without technical barriers

### **Token Economics**
- **10 Billion** total supply per artist
- **10%** → Artist wallet (1B tokens)
- **1%** → LP seeding (100M tokens)  
- **89%** → Protocol vault (8.9B tokens)

---

## 🚀 **Onboarding a New Artist**

### **Prerequisites**
1. Artist's **Magic.link wallet address**
2. Protocol wallet funded with **~0.02 ETH** per artist
3. **Supabase** access for artist data

### **Step 1: Deploy Artist Token**

```bash
# Edit deploy/04_deploy_artist_token.js with artist details
const ARTIST_CONFIG = {
  name: "GosheeshToken",
  symbol: "GOSHEESH", 
  artistWallet: "0x...", # Artist's Magic.link address
  artistId: "gosheesh"
};

# Deploy to Base Sepolia
npx hardhat deploy --tags ArtistToken --network baseSepolia
```

**This automatically:**
- ✅ Deploys ArtistToken contract
- ✅ Mints 10B tokens with distribution
- ✅ Saves deployment data
- ✅ Provides Supabase update instructions

### **Step 2: Update Supabase**

Add artist record to `artists` table:
```sql
INSERT INTO artists (
  id, name, contract, symbol, artistWallet, launchBlock, 
  -- Leave tokenprice NULL - LP will drive pricing
  displayName, artworkTitle, videoSrc, theme, orbitalTokens
) VALUES (
  'gosheesh', 'GosheeshToken', '0x...', 'GOSHEESH', '0x...', 12345,
  'GOSHEESH', 'Artwork Title', '/videos/gosheesh.mp4', {...}, [...]
);
```

### **Step 3: Seed Liquidity Pool**

```bash
# This uses protocol vault tokens automatically
npx hardhat seed-lp --token 0x... --artist gosheesh --network baseSepolia
```

**This automatically:**
- ✅ Calculates 1% of total supply for LP
- ✅ Uses 0.01 ETH constant for seeding
- ✅ Creates pool via swap contract  
- ✅ Logs initial price and reserves
- ✅ Verifies pool creation

### **Step 4: Verify Live Pricing**

```bash
# Frontend automatically detects LP and switches to live pricing
npm run dev
# Visit: http://localhost:3000?artist=gosheesh
```

**Frontend shows:**
- 🟢 **"● Live Price"** when LP exists
- 🟡 **"● Fallback Price"** when no LP
- Real-time price updates every 30 seconds
- Dynamic token calculations based on live reserves

### **Step 5: Testing**

```bash
# Run smoke tests
npx cypress run --spec cypress/e2e/lp-seeding-smoke-test.cy.js
```

---

## 🔧 **Technical Stack**

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Authentication**: Magic.link (EOA wallets)
- **Database**: Supabase
- **Blockchain**: Base Sepolia testnet
- **Smart Contracts**: Solidity 0.8.24
- **AMM**: Custom Uniswap V2-style implementation

## 📊 **Live Pricing System**

### **Price Discovery**
1. **LP Exists**: Use `getReserves()` from pool
2. **No LP**: Fallback to Supabase `tokenprice`
3. **Auto-refresh**: Every 30 seconds
4. **ETH/USD**: Live from Coinbase API

### **Frontend Integration**
```typescript
// useArtistConfig hook automatically:
const effectivePrice = artistConfig?.realTimePrice ?? artistConfig?.tokenPrice;

// Shows appropriate indicator:
{artistConfig.hasLiquidityPool ? "● Live Price" : "● Fallback Price"}
```

---

## 💰 **Gas & Funding**

### **Protocol Wallet Requirements**
- **0.01 ETH** per LP seeding
- **~0.005 ETH** for gas fees
- **Total: ~0.015 ETH** per artist

### **Revenue Flows**
- **Artists**: Earn from token appreciation and sales
- **Protocol**: Transaction fees and platform growth
- **Users**: Token utility and exclusive content access

---

## 🔐 **Security Model**

### **What Artists DON'T Need**
- ❌ Private key management
- ❌ Gas fee handling
- ❌ Smart contract deployment
- ❌ LP management
- ❌ Recovery phrases

### **What Artists Control**
- ✅ Creative content and IP
- ✅ Community engagement
- ✅ Token earnings
- ✅ Brand and theming
- ✅ NFT/download releases

### **Protocol Responsibilities**
- 🔒 Contract ownership & security
- 🔒 LP creation & management
- 🔒 Private key custody (hardware/multisig)
- 🔒 Emergency recovery
- 🔒 Cross-chain migrations

---

## 🎨 **Artist Hand-off (Optional)**

When an artist is ready for full sovereignty:

```bash
# Protocol calls transferEverything() on artist contract
# This transfers:
# - Contract ownership
# - All protocol vault tokens  
# - Any LP tokens
# - All control to artist's cold storage address
```

**Benefits:**
- Artist gets full control when ready
- Protocol provides training wheels initially
- Seamless transition path
- No technical debt

---

## 🛠 **Development Commands**

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy contracts
npx hardhat deploy --network baseSepolia

# Seed liquidity pool
npx hardhat seed-lp --token 0x... --artist artistId --network baseSepolia

# Run tests
npm test
npx cypress run

# Build for production
npm run build
```

---

## 📂 **Project Structure**

```
zeyoda-nextjs-52925/
├── app/                    # Next.js app directory
│   ├── components/        # React components
│   ├── hooks/            # Custom hooks (useArtistConfig)
│   ├── utils/            # Utilities (swapUtils, supabase)
│   └── page.tsx          # Main artist page
├── contracts/            # Smart contracts
│   ├── ArtistToken.sol   # New artist token with distribution
│   ├── Artistock.sol     # Legacy individual tokens
│   └── Swap.sol          # AMM implementation
├── deploy/               # Deployment scripts
│   ├── 04_deploy_artist_token.js  # New artist onboarding
│   └── tasks/seed-lp.js  # LP seeding task
├── cypress/              # E2E tests
└── types/                # TypeScript definitions
```

---

## 🎯 **Key Features**

### **For Artists**
- 🎨 Custom theming and branding
- 🎵 Video/audio content integration
- 💎 NFT and download sales
- 📈 Real-time token metrics
- 🌍 Cross-platform compatibility

### **For Users**  
- 🔐 Magic.link authentication
- 💰 Multiple payment methods
- 🎯 Token trading and swapping
- 📱 Mobile-responsive UI
- 🔄 Real-time price updates

### **For Protocol**
- 🏛️ Centralized custody & security
- 📊 Automated LP management
- 🔧 Scalable onboarding
- 💼 Revenue optimization
- 🛡️ Risk management

---

## 📞 **Support**

- **Documentation**: This README
- **Testing**: Cypress smoke tests
- **Monitoring**: Console logs and error tracking
- **Recovery**: Protocol emergency functions

---

**🎉 Built with the Artistocks Protocol ownership model - where artists create, protocol secures, and everyone wins! 🎉**
