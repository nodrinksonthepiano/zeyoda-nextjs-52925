# ZEYODA ARTISTOCKS - CURRENT STATE & NEXT STEPS (October 2025)

> **Context:** This document captures the VERIFIED current state after completing Sprint 3 (Factory Integration) and Asset Editing features. Use this to continue development in a fresh chat.

---

## 🎯 PROJECT OVERVIEW

**Zeyoda Artistocks Protocol** - Web3 artist platform with:
- Artists post art/music
- Fans buy collectible downloads (ERC-1155)
- Each artist has their own token (ERC-20)
- Protocol uses UUPS (upgradeable) architecture for new artists
- Legacy artists remain on non-upgradeable contracts

**Tech Stack:**
- Frontend: Next.js 15, TypeScript, Tailwind CSS
- Authentication: Magic.link (email-based wallets)
- Database: Supabase (PostgreSQL)
- Blockchain: Base Sepolia testnet
- Smart Contracts: Solidity 0.8.24, OpenZeppelin UUPS

---

## ✅ COMPLETED (Verified October 30, 2025)

### **Sprint 1: Core UUPS Contracts (100% Complete)**

**Deployed Contracts:**

1. **ArtistTokenUUPS Implementation:** `0xe31608a3C5A7924D4C0f8A0b760839Caa2E4e90D`
   - ERC-20, pausable, upgradeable
   - 10B distribution: 1B artist, 100M LP seed, 8.9B protocol vault
   - Storage gaps for safe upgrades

2. **ArtistDownloadsUUPS Implementation V2:** `0x9de11C68d6f124BdAef175D51C7Ebb0bDb13d88e`
   - ERC-1155 with sponsor role
   - Artist owns contract, server can mint (sponsor)
   - Includes `buyFor()` for gas-sponsored purchases
   - 100% of purchase price goes to artist owner

3. **UupsAMM Proxy:** `0x49B9538e0022dD919d9af2358783e89d08bCd82c`
   - Upgradeable AMM
   - 0.3% trading fee (stays in pool)
   - Constant product formula (x * y = k)

4. **ArtistFactory:** `0xD0786D75Cabc6a88869eE369302c65f52d16eCd2`
   - One-click UUPS deployment
   - Deploys token + downloads + creates AMM pool
   - Current balance: 0 ETH (needs refunding)
   - Artists created: 4+

**Protocol Vault:** `0x615258a5263DBEe0DDEED3166ddC1f442D937eB3`

**Minter/Sponsor Wallet:** (private key in .env as MINTER_PRIVATE_KEY)

### **Sprint 2: Frontend Factory Integration (100% Complete)**

**Files Modified:**

1. **`app/page.tsx` (Lines 315-398)**
   - `handleSaveArtist` now calls `ArtistFactory.createArtist()`
   - Event parsing extracts tokenProxy, downloadsProxy, ammProxy
   - Uploads featured content
   - Saves to Supabase
   - Redirects to new artist page
   - ✅ **WORKING - Successfully deployed joZen!**

2. **`app/utils/abis/ArtistFactoryABI.ts`**
   - Factory ABI with createArtist function
   - ArtistCreated event signature
   - Imported in app/page.tsx

3. **`.env.local`**
   - `NEXT_PUBLIC_ARTIST_FACTORY=0xD0786D75Cabc6a88869eE369302c65f52d16eCd2` ✅
   - `NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS` ✅

### **Sprint 3: Asset Editing (100% Complete)**

**Files Created:**

1. **`app/components/AssetEditPanel.tsx`**
   - Panel (not overlay) in swap area
   - Edit title, description, price
   - Matches OnboardingPanel styling
   - Owner-only (checks `isOwner`)

2. **`app/api/updateAsset/route.ts`**
   - POST endpoint for asset updates
   - Updates `metadata` JSONB and `price_usd`
   - Ownership verification

**Files Modified:**

3. **`app/components/OrbitPeekCarousel.tsx`**
   - Pencil icon on LEFT of title
   - Desktop: hover shows pencil
   - Mobile: click title shows pencil
   - `onEditAsset` callback triggers edit mode

4. **`app/page.tsx`**
   - Added `'edit-asset'` app mode
   - Renders `AssetEditPanel` conditionally
   - `handleSaveAssetEdit` callback

---

## 📊 CURRENT DEPLOYED ARTISTS

### **Legacy (Non-UUPS) Artists:**

1. **GOSHEESH** (default artist, fully functional)
   - Token: `0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac`
   - Downloads: `0x51A70725D8842E856971C71bAE389f0EA5EEC676`
   - Treasury: `0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8`

2. **JAITEA** (fully functional)
   - Token: `0x9D06564a8D98e146CAb1dE74BF815bf05d24D685`
   - Downloads: `0xec7BaDb433504aEbeFF747ADc8586E5663C0ea21`
   - Treasury: `0x0B893D9D0dA09096C75e43c310316dC61b2773be`

3. **CANCAKES** (fully functional)
   - Token: `0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65`
   - Downloads: `0x1942756cA3dc2484b55E3417551159b56F66d467`
   - Treasury: `0xe42C291143e03f3Bd7D5a095815DAD3e82835C05`

### **UUPS Artists (Deployed via Factory):**

4. **TESTARTIST** (test deployment)
   - Deployed via factory
   - Full UUPS infrastructure
   - Upgradeable, pausable

5. **JOZEN** (latest successful deployment)
   - Deployed via factory October 30, 2025
   - Full UUPS infrastructure
   - Token, Downloads, AMM pool created
   - ✅ **Confirms factory integration works!**

---

## 🚨 CRITICAL ISSUE: Download Purchases NOT Using buyFor()

### **Current State (WRONG):**

**File:** `app/api/uploadAsset/route.ts` (Line 173)

```typescript
// 🚨 STILL USING LEGACY MINT METHOD
const tx = await contract.mintDownload(artistWallet, nextAssetNumber, 1);
```

**Problems:**
- Only mints "featured copy" to artist on upload ✅
- NO purchase flow for users ❌
- NO payment to artist ❌
- NO gas-sponsored user purchases ❌

### **Required Flow (UUPS - 100% to Artist):**

**New File Needed:** `app/api/purchase/1155/route.ts`

```typescript
// Server-sponsored purchase flow (buyFor)
export async function POST(request: NextRequest) {
  const { artistId, assetNumber, quantity, userAddress } = await request.json();
  
  // 1. Look up price from database (USD)
  const { data: asset } = await supabase
    .from('artist_assets')
    .select('price_usd, artist_id')
    .eq('artist_id', artistId)
    .eq('asset_number', assetNumber)
    .single();
  
  // 2. Get download contract address
  const { data: artist } = await supabase
    .from('artists')
    .select('download_address, treasury_wallet')
    .eq('id', artistId)
    .single();
  
  // 3. Convert USD → ETH → wei
  const ethPrice = await getCachedETHPrice(); // Cache for 5 min
  const priceETH = asset.price_usd / ethPrice;
  const priceWei = ethers.parseEther(priceETH.toString());
  
  // 4. Call buyFor() with server signer (gas sponsored)
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!, provider);
  
  const contract = new ethers.Contract(
    artist.download_address,
    ArtistDownloadsUUPSABI,
    signer
  );
  
  // 5. buyFor mints to user + sends payment to artist owner (100%)
  const tx = await contract.buyFor(userAddress, assetNumber, quantity, {
    value: priceWei,
    gasLimit: 300000
  });
  
  const receipt = await tx.wait();
  
  // 6. Log to database
  await logPurchase(artistId, userAddress, assetNumber, priceWei, receipt.hash);
  
  return NextResponse.json({
    txHash: receipt.hash,
    tokenId: assetNumber,
    amountWei: priceWei.toString()
  });
}
```

**Key Points:**
- ✅ User sees USD prices (no crypto)
- ✅ Backend sponsors gas
- ✅ Artist receives 100% of payment directly
- ✅ NFT mints to user in same transaction
- ✅ On-chain transparency (BaseScan shows payment)
- ✅ **Idempotency**: Hash-based duplicate prevention (artistId, assetNumber, userAddress, priceWei, day)
- ✅ **Free-mint caps**: Enforced before chain call (5/user/day, 500/system/day, 5000/lifetime)
- ✅ **Precision**: Integer wei math (avoid parseEther on tiny decimals)
- ✅ **Safety**: Receipt status check, rate limiting, structured errors

---

## 🎯 WHAT'S LEFT TO BUILD

### **Priority 1: Download Purchase Flow (CRITICAL)**

**Status:** Not started

**What's Needed:**

1. **Create `/api/purchase/1155/route.ts`**
   - Backend route for gas-sponsored purchases
   - Calls `buyFor(recipient, tokenId, quantity)` with msg.value
   - 100% payment goes to artist owner
   - User gets NFT instantly

2. **Create ArtistDownloadsUUPS ABI**
   - File: `app/utils/abis/ArtistDownloadsUUPSABI.ts`
   - Include: `buyFor()`, `mintDownload()`, `owner()`, `pause()`

3. **Update Frontend Purchase Button**
   - File: `app/components/OrbitPeekCarousel.tsx` (or wherever "Buy" button is)
   - Change from old flow → call `/api/purchase/1155`
   - Handle structured errors from API (show precise messages)

4. **Add Free Mint Caps** (Enforce BEFORE calling `buyFor()`)
   - Per-user daily limit: 5 free downloads
   - System daily limit: 500 free downloads
   - Global cap: 5,000 free downloads
   - Check `price_usd = 0` AND quantity ≤ caps before chain call

5. **Implement Idempotency**
   - Hash: `(artistId, assetNumber, userAddress, priceWei, day)` 
   - Check `artist_purchases` table for duplicate hash
   - Reject duplicates to prevent double-buys on retries

6. **Database Tables Required**
   - `artist_purchases` (idempotency + history)
   - `gas_sponsorship_events` (track protocol gas costs)

**Acceptance:**
- User clicks "Buy for $4" → NFT appears in wallet
- BaseScan shows payment to artist owner
- No user wallet signature required
- Gas sponsored by protocol

---

### **Priority 2: Router for Legacy + UUPS Swaps**

**Status:** Not started

**Problem:**
- Legacy artists (gosheesh, jaitea, cancakes) use Legacy AMM: `0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE`
- UUPS artists use UupsAMM: `0x49B9538e0022dD919d9af2358783e89d08bCd82c`
- Frontend needs to route correctly

**Solution A: Frontend Routing (Simple)**

File: `app/utils/swapUtils.ts` (CREATE NEW FILE)

```typescript
export function getAMMAddress(artistId: string): string {
  const LEGACY = ['gosheesh', 'jaitea', 'cancakes'];
  
  return LEGACY.includes(artistId)
    ? process.env.NEXT_PUBLIC_LEGACY_AMM!
    : process.env.NEXT_PUBLIC_UUPS_AMM!;
}
```

**Usage:** Import and use wherever swaps are constructed (token swap UI, buy/sell flows).

**Solution B: Smart Contract Router (More Complex)**

Deploy `TestnetRouter.sol` that routes internally. Not necessary if Solution A works.

**Acceptance:**
- Legacy artists can still trade
- UUPS artists can trade
- No breaking changes

---

### **Priority 3: Fix Factory Balance Script**

**Problem:**
`scripts/checkFactoryBalance.js` has hardcoded wrong factory address:

```javascript
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xAbCaf3Ebb71aF649d3535c285501e44767CE5825";
```

Should be:
```javascript
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xD0786D75Cabc6a88869eE369302c65f52d16eCd2";
```

**Fix:**
Replace line 4 in `scripts/checkFactoryBalance.js` with correct address from `.env.local`.

---

### **Priority 4: Fund Factory**

**Current Balance:** 0 ETH

**Command:**
```bash
FUND_AMOUNT=0.05 npx hardhat run scripts/fundFactory.js --network baseSepolia
```

**After Funding:**
```bash
npx hardhat run scripts/checkFactoryBalance.js --network baseSepolia
```

**Expected:** Can deploy 10 more artists (0.005 ETH per artist)

---

## 📝 DATABASE SCHEMA (Supabase)

### **artists table (19 columns):**

```sql
CREATE TABLE artists (
  id TEXT PRIMARY KEY,                  -- lowercase artist ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  displayname TEXT,
  "tokenName" TEXT,                     -- Note: case-sensitive!
  artworktitle TEXT,
  artworkyear TEXT,
  tokenprice NUMERIC,
  videosrc TEXT,
  contract TEXT,                        -- ERC-20 token address
  theme JSONB,                          -- {primaryColor, accentColor, fontFamily, gradients}
  orbitaltokens JSONB,
  swap_address TEXT,                    -- AMM/Router address
  paused BOOLEAN DEFAULT FALSE,
  download_address TEXT,                -- ERC-1155 contract address
  owner_user_id UUID,                   -- FK to auth.users
  treasury_wallet TEXT,                 -- Artist's Magic.link wallet
  total_earnings_usd NUMERIC DEFAULT 0,
  total_sales_count INTEGER DEFAULT 0
);
```

### **artist_assets table:**

```sql
CREATE TABLE artist_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id TEXT REFERENCES artists(id),
  asset_number INTEGER,                 -- tokenId for ERC-1155
  file_url TEXT,
  file_type TEXT,
  price_usd NUMERIC,
  metadata JSONB,                       -- {title, description, desc}
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist_id, asset_number)
);
```

### **artist_purchases table (NEW - CREATE THIS):**

```sql
CREATE TABLE artist_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_hash TEXT UNIQUE NOT NULL,    -- Idempotency hash (keccak256)
  artist_id TEXT REFERENCES artists(id),
  user_address TEXT NOT NULL,
  asset_number INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price_usd NUMERIC,
  price_wei TEXT NOT NULL,              -- Store as string to avoid precision loss
  tx_hash TEXT NOT NULL,
  block_number BIGINT,
  gas_cost_wei TEXT,                    -- Protocol-sponsored gas cost
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_request_hash (request_hash),
  INDEX idx_user_date (user_address, DATE(created_at)),
  INDEX idx_artist_date (artist_id, DATE(created_at))
);
```

### **gas_sponsorship_events table (NEW - CREATE THIS):**

```sql
CREATE TABLE gas_sponsorship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id TEXT REFERENCES artists(id),
  tx_hash TEXT NOT NULL,
  gas_used BIGINT,
  gas_price_wei TEXT,
  gas_cost_wei TEXT NOT NULL,           -- Total cost in wei
  block_number BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_artist_date (artist_id, DATE(created_at))
);
```

**Critical:** `metadata` is JSONB with:
- `title` (string)
- `description` (string) - new field
- `desc` (string) - legacy field (backward compat)

Always dual-write: `description` and `desc` should match.

### **artist_registry table:**

```sql
CREATE TABLE artist_registry (
  id TEXT PRIMARY KEY,                  -- artist ID
  token TEXT,                           -- ERC-20 address
  swap TEXT,                            -- AMM address
  downloads TEXT,                       -- ERC-1155 address
  treasury_wallet TEXT
);
```

---

## 🎨 TOKEN ECONOMICS (DO NOT CHANGE)

### **10 Billion Token Distribution:**

**Per Artist (on `initialMint()`):**

1. **1,000,000,000 (1B)** → Artist treasury wallet (10%)
2. **100,000,000 (100M)** → LP seed (1%) - used for initial pool
3. **8,900,000,000 (8.9B)** → Protocol vault (89%)

**LP Pool Initial Conditions:**
- 100M tokens
- 0.005 ETH
- Initial price: ~$0.000000125 USD per token

---

## 💰 FEE STRUCTURE (DO NOT CHANGE)

### **Swap Fees:**
- **0.3%** trading fee on all token swaps
- Fee stays in pool (benefits LP owner = protocol)

### **Download Sales (ERC-1155):**
- **UUPS Contracts:** 0% fee - artist gets 100% ✅
- **Legacy Contracts:** 0% fee - artist gets 100% ✅
- **Gas:** Protocol sponsors (server pays)
- **Payment:** Direct to artist owner address

### **Free Giveaways (Price = $0):**
- `buyFor()` accepts `msg.value = 0`
- No payment sent
- Artist still gets NFT minted to fan
- Caps enforced:
  - 5 per user per day
  - 500 system-wide per day
  - 5,000 global lifetime

---

## 🔐 KEY ENVIRONMENT VARIABLES

**From `.env.local`:**

```env
# Factory & Deployment
NEXT_PUBLIC_ARTIST_FACTORY=0xD0786D75Cabc6a88869eE369302c65f52d16eCd2
NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS

# Network
BASE_SEPOLIA_RPC_URL=https://base-sepolia.rpc.url
NEXT_PUBLIC_RPC=https://base-sepolia.rpc.url

# Server Signer (Gas Sponsor)
MINTER_PRIVATE_KEY=c912b8ad5ad1f3eec1b96b00be8a1f89c658f9edb8ab0d1c163768783cc19521
DOWNLOAD_MINTER_PK=c912b8ad5ad1f3eec1b96b00be8a1f89c658f9edb8ab0d1c163768783cc19521

# Protocol Addresses
NEXT_PUBLIC_PROTOCOL_VAULT=0x615258a5263DBEe0DDEED3166ddC1f442D937eB3

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://fnvvldzscjvhnrveuxgx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Magic Link
NEXT_PUBLIC_MAGIC_PK=pk_live_0A9...
MAGIC_SECRET_KEY=sk_live_C07A57B...

# BaseScan
BASESCAN_API_KEY=26MQE4MWU7GG6YY...
```

**Missing (Need to Add):**
```env
NEXT_PUBLIC_UUPS_AMM=0x49B9538e0022dD919d9af2358783e89d08bCd82c
NEXT_PUBLIC_LEGACY_AMM=0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE
FACTORY_ADDRESS=0xD0786D75Cabc6a88869eE369302c65f52d16eCd2
```

**⚠️ SECURITY WARNING:**
- This document contains live keys from `.env.local`
- **DO NOT** commit `.env.local` to git
- If keys were pushed, **rotate them immediately**
- Purchase API should be gated by origin/rate-limiting (basic DoS protection)

---

## 🧪 TESTING CHECKLIST

### **Verify Current State:**

```bash
# 1. Check factory balance
npx hardhat run scripts/checkFactoryBalance.js --network baseSepolia

# 2. Check deployed contracts on BaseScan
# Token: 0xe31608a3C5A7924D4C0f8A0b760839Caa2E4e90D
# Downloads: 0x9de11C68d6f124BdAef175D51C7Ebb0bDb13d88e
# AMM: 0x49B9538e0022dD919d9af2358783e89d08bCd82c
# Factory: 0xD0786D75Cabc6a88869eE369302c65f52d16eCd2

# 3. Start dev server
npm run dev

# 4. Test onboarding
# Go to localhost:3000?artist=newtest
# Type "zeyoda" → fill form → deploy
# Should create artist in one transaction
```

### **Purchase Flow Verification (Fast Checklist):**

1. **Sponsor Set?**
   ```bash
   npx hardhat console --network baseSepolia
   > const d = await ethers.getContractAt("ArtistDownloadsUUPS", "<downloadsProxy>");
   > await d.sponsor(); // Should return server signer address
   ```

2. **Buy Button Calls API?**
   - Open browser DevTools → Network tab
   - Click "Buy for $4" button
   - Should see `POST /api/purchase/1155` request

3. **On-Chain Verification (BaseScan):**
   - Find transaction hash from API response
   - Verify:
     - Payment → **artist owner address** (not protocol)
     - ERC-1155 `TransferSingle` event → user address
     - Transaction sender = server signer (gas sponsored)

4. **Database Verification:**
   ```sql
   -- Check purchase logged
   SELECT * FROM artist_purchases WHERE tx_hash = '<txHash>';
   
   -- Check gas sponsorship logged
   SELECT * FROM gas_sponsorship_events WHERE tx_hash = '<txHash>';
   
   -- Check free-mint caps enforced
   SELECT COUNT(*) FROM artist_purchases 
   WHERE user_address = '<userAddress>' 
   AND DATE(created_at) = CURRENT_DATE 
   AND price_wei = '0';
   -- Should be ≤ 5
   ```

5. **Idempotency Test:**
   - Purchase same asset twice rapidly
   - Second request should return existing `txHash` (no duplicate charge)

### **Test Legacy Artists (Should Work):**

```bash
# Visit each legacy artist page
localhost:3000?artist=gosheesh  # Default
localhost:3000?artist=jaitea
localhost:3000?artist=cancakes

# Verify:
# - Page loads
# - Assets display
# - Can view downloads
# - Swap interface present (may not work until router fixed)
```

### **Test UUPS Artists:**

```bash
# Visit UUPS artists
localhost:3000?artist=testartist
localhost:3000?artist=jozen

# Verify:
# - Page loads
# - Can upload assets (owner only)
# - Can edit asset metadata (owner only)
# - Pencil icon appears (owner only)
```

---

## 📂 KEY FILES & LINE NUMBERS

### **Smart Contracts:**

```
contracts/uups/
├── ArtistTokenUUPS.sol           (221 lines) - ERC-20 UUPS
├── ArtistDownloadsUUPS.sol       (270 lines) - ERC-1155 UUPS with sponsor
├── UupsAMM.sol                   (??  lines) - AMM UUPS
└── ArtistFactory.sol             (210 lines) - Factory

contracts/ (legacy - DO NOT USE FOR NEW ARTISTS)
├── ArtistToken.sol               - Legacy ERC-20
├── ArtistDownloads.sol           - Legacy ERC-1155
└── Swap.sol                      - Legacy AMM
```

### **Frontend:**

```
app/
├── page.tsx                      (2216 lines)
│   ├── Line 315-398: handleSaveArtist (uses factory) ✅
│   ├── Line 32: ArtistFactoryABI import ✅
│   └── Line 85: artistIdFromUrl (defaults to 'gosheesh')
│
├── components/
│   ├── OnboardingPanel.tsx       (572 lines) - Upload/create forms
│   ├── OrbitPeekCarousel.tsx     (1219 lines) - Asset carousel + edit button
│   └── AssetEditPanel.tsx        (NEW) - Edit panel in swap area ✅
│
├── api/
│   ├── createArtist/route.ts     - Saves artist to database
│   ├── uploadAsset/route.ts      - Line 173: mintDownload() 🚨 NEEDS FIX
│   ├── updateAsset/route.ts      - Updates asset metadata ✅
│   └── purchase/1155/route.ts    - ❌ DOES NOT EXIST (needs creation)
│
└── utils/
    └── abis/
        ├── ArtistFactoryABI.ts   - Factory ABI ✅
        └── ArtistDownloadsUUPSABI.ts - ❌ NEEDS CREATION
```

### **Scripts:**

```
scripts/
├── deployArtistFactory.js        (93 lines) - Deploy factory
├── deployUUPSToken.js            (150 lines) - Deploy token implementation
├── deployUUPSDownloads.js        (110 lines) - Deploy downloads implementation
├── fundFactory.js                - Fund factory with ETH
├── checkFactoryBalance.js        - 🚨 Line 4: WRONG ADDRESS (needs fix)
└── upgradeDownloadsV2.js         (69 lines) - Upgrade downloads to V2
```

---

## 🎯 NEXT IMMEDIATE STEPS (Priority Order)

### **Step 1: Fix checkFactoryBalance.js** (5 min)

Change line 4 from:
```javascript
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xAbCaf3Ebb71aF649d3535c285501e44767CE5825";
```

To:
```javascript
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xD0786D75Cabc6a88869eE369302c65f52d16eCd2";
```

### **Step 2: Fund Factory** (2 min)

```bash
FUND_AMOUNT=0.05 npx hardhat run scripts/fundFactory.js --network baseSepolia
```

### **Step 3: Create ArtistDownloadsUUPSABI.ts** (10 min)

**New File:** `app/utils/abis/ArtistDownloadsUUPSABI.ts`

```typescript
export const ArtistDownloadsUUPSABI = [
  "function buyFor(address recipient, uint256 tokenId, uint256 quantity) external payable",
  "function mintDownload(address user, uint256 tokenId, uint256 amount) external",
  "function owner() view returns (address)",
  "function sponsor() view returns (address)",
  "function pause() external",
  "function unpause() external",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "event DownloadPurchased(address indexed buyer, uint256 indexed tokenId, uint256 quantity, uint256 amount)"
];
```

**Minimal ABI** - only functions you actually call.

### **Step 4: Create Purchase API Route** (1 hour)

**New File:** `app/api/purchase/1155/route.ts`

**Requirements:**
1. **Validate body:** `{ artistId, assetNumber, quantity, userAddress }`
2. **Load from DB:** `price_usd`, `download_address`, verify existence
3. **USD→ETH conversion:**
   - Cache ETH price for 5 minutes (API rate limits)
   - Use integer wei math (avoid `parseEther` precision issues on tiny decimals)
   - Formula: `priceWei = BigInt(Math.floor((priceUSD / ethPrice) * 1e18))`
4. **Enforce free-mint caps BEFORE chain call:**
   - If `price_usd = 0`, check:
     - User daily count ≤ 5
     - System daily count ≤ 500
     - Global lifetime count ≤ 5000
5. **Idempotency check:**
   - Hash: `keccak256(artistId + assetNumber + userAddress + priceWei + today)`
   - Query `artist_purchases` table for duplicate hash
   - Reject if exists (prevents double-buys on retries)
6. **Call `buyFor()`:**
   ```typescript
   const tx = await contract.buyFor(userAddress, assetNumber, quantity, {
     value: priceWei,
     gasLimit: 300000
   });
   ```
7. **Wait receipt, verify status:**
   ```typescript
   const receipt = await tx.wait();
   if (receipt.status !== 1) throw new Error('Transaction failed');
   ```
   - Consider confirming to N blocks for extra safety (reorgs/slow RPC)
8. **Log to database:**
   - Insert into `artist_purchases` (tx_hash, request_hash, artist_id, user_address, price_wei, etc.)
   - Insert into `gas_sponsorship_events` (gas_cost, artist_id, tx_hash)
9. **Return structured response:**
   ```typescript
   return NextResponse.json({
     txHash: receipt.hash,
     tokenId: assetNumber,
     amountWei: priceWei.toString()
   });
   ```
10. **Error handling:**
    - Return structured errors (400/500 with message)
    - UI can show precise error messages
    - Rate limit (per IP throttling avoids spam)

**Security:**
- Gate by origin (verify request from your domain)
- Rate limit per IP (basic DoS protection)
- Validate `userAddress` format (checksummed address)

### **Step 5: Add Frontend Purchase Button** (30 min)

Find where users click "Buy" and update to call `/api/purchase/1155`.

### **Step 6: Test Purchase Flow** (30 min)

1. Set asset price to $4
2. Click "Buy"
3. Check NFT minted to user
4. Check payment went to artist on BaseScan

### **Step 7: Add Swap Routing** (30 min)

**New File:** `app/utils/swapUtils.ts`

Create the file with exact code from "Priority 2" section above. Import and use wherever swaps are constructed (find all swap-related components and update).

### **Step 8: Verify Sponsor Role** (5 min)

**After deploying a new artist via factory:**

```bash
# Check sponsor is set correctly
npx hardhat console --network baseSepolia
> const downloads = await ethers.getContractAt("ArtistDownloadsUUPS", "<downloadsProxy>");
> await downloads.sponsor();
# Should return: <server signer address> (from MINTER_PRIVATE_KEY public key)
```

**Fix for existing UUPS artists if sponsor missing:**
- Call `downloads.setSponsor(SPONSOR_ADDRESS)` with owner account
- Or redeploy via factory (factory sets sponsor automatically)

---

## 🚨 CRITICAL WARNINGS

### **DO NOT:**
- ❌ Change token distribution (1B / 100M / 8.9B is sacred)
- ❌ Change 0.3% swap fee
- ❌ Add platform fee on downloads (artist gets 100%)
- ❌ Break legacy artist functionality
- ❌ Deploy new factory without funding it
- ❌ Commit private keys to git
- ❌ Use `parseEther()` on tiny decimals (precision issues)

### **DO:**
- ✅ Use `buyFor()` for UUPS purchases (100% to artist)
- ✅ Keep legacy artists on `mintDownload()` flow
- ✅ Test on testnet before mainnet
- ✅ Verify all transactions on BaseScan
- ✅ Check database after every artist creation
- ✅ Fund factory before deploying artists
- ✅ Verify sponsor role on every new UUPS artist
- ✅ Implement idempotency to prevent double-buys
- ✅ Gate purchase API by origin + rate limit
- ✅ Use integer wei math for USD→ETH conversion

## ⚠️ GOTCHAS TO PREEMPT

### **1. Sponsor Missing → OwnableUnauthorizedAccount**
**Error:** `execution reverted: OwnableUnauthorizedAccount`  
**Cause:** Downloads V2 contract `sponsor` not set  
**Fix:** 
- Factory auto-sets sponsor during deployment ✅
- For existing UUPS artists: call `downloads.setSponsor(SPONSOR_ADDRESS)` with owner account

### **2. Precision Loss with parseEther()**
**Error:** Tiny USD prices round to 0 wei  
**Cause:** `parseEther("0.0001")` may lose precision  
**Fix:** Use integer math:
```typescript
const priceWei = BigInt(Math.floor((priceUSD / ethPrice) * 1e18));
```

### **3. Reorgs / Slow RPC**
**Error:** Transaction succeeds but receipt shows failure later  
**Cause:** Chain reorgs, slow RPC responses  
**Fix:** 
- Check `receipt.status === 1` before marking success
- Consider waiting N block confirmations for high-value purchases

### **4. Rate Limit Spam**
**Error:** API gets hammered, costs spike  
**Cause:** No throttling on purchase route  
**Fix:** 
- Per-IP rate limiting (e.g., 10 requests/minute)
- Use middleware or Supabase edge function throttling

### **5. Double-Buy on Retries**
**Error:** User clicks "Buy" twice, charged twice  
**Cause:** No idempotency check  
**Fix:** 
- Hash request: `(artistId, assetNumber, userAddress, priceWei, day)`
- Check `artist_purchases` table before calling `buyFor()`
- Return existing `txHash` if duplicate found

---

## 🎓 ARCHITECTURE DECISIONS

### **Why Two Factory Addresses?**

You deployed factory twice:
1. `0xAbCaf3Ebb71aF649d3535c285501e44767CE5825` - First deploy (shows 4 artists, 0 ETH)
2. `0xD0786D75Cabc6a88869eE369302c65f52d16eCd2` - Current (in .env.local)

Frontend uses #2. Script checks #1. Need to sync.

### **Why Sponsor Role?**

Artist owns downloads contract → receives payments.
Server has sponsor role → can mint without owning.

This allows:
- Artist receives 100% of sales
- Server sponsors gas for users
- No artist signature required

### **Why buyFor() Instead of Direct Purchase?**

`buyFor()` combines:
- Minting NFT to user
- Sending payment to artist
- Single atomic transaction
- Gas sponsored by server

User experience:
- Click "Buy for $4" (sees USD)
- NFT appears (no wallet interaction)
- Artist paid instantly

---

## 📚 USEFUL COMMANDS

```bash
# Check factory status
npx hardhat run scripts/checkFactoryBalance.js --network baseSepolia

# Fund factory
FUND_AMOUNT=0.05 npx hardhat run scripts/fundFactory.js --network baseSepolia

# Compile contracts
npx hardhat compile

# Start dev server
npm run dev

# Check git status
git status

# View logs
tail -f .next/server.log  # (if exists)
```

---

## 📞 QUICK REFERENCE

**Line Numbers for Key Code:**

- Factory integration: `app/page.tsx:315-398`
- Mint issue: `app/api/uploadAsset/route.ts:173`
- Asset editing: `app/components/AssetEditPanel.tsx:1-572`
- Edit button: `app/components/OrbitPeekCarousel.tsx:800-850` (approx)
- Factory ABI: `app/utils/abis/ArtistFactoryABI.ts:1-11`
- Wrong factory address: `scripts/checkFactoryBalance.js:4`

**Key Contract Addresses:**

- Factory: `0xD0786D75Cabc6a88869eE369302c65f52d16eCd2`
- Token Impl: `0xe31608a3C5A7924D4C0f8A0b760839Caa2E4e90D`
- Downloads Impl V2: `0x9de11C68d6f124BdAef175D51C7Ebb0bDb13d88e`
- UUPS AMM: `0x49B9538e0022dD919d9af2358783e89d08bCd82c`
- Legacy AMM: `0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE`
- Protocol Vault: `0x615258a5263DBEe0DDEED3166ddC1f442D937eB3`

**Total Lines of Code:** ~30,461

**Completion Status:** ~65% (contracts done, purchase flow needed)

---

## 🏁 SUCCESS CRITERIA FOR COMPLETION

### **Purchase Flow Working:**
- [ ] `/api/purchase/1155/route.ts` created with full safety checks
- [ ] `ArtistDownloadsUUPSABI.ts` created
- [ ] `artist_purchases` table created in Supabase
- [ ] `gas_sponsorship_events` table created in Supabase
- [ ] Idempotency implemented (hash-based duplicate prevention)
- [ ] Free-mint caps enforced (5/user/day, 500/system/day, 5000/lifetime)
- [ ] USD→ETH conversion uses integer wei math (no precision loss)
- [ ] User can buy download for $4 USD
- [ ] NFT mints to user automatically
- [ ] Artist receives 100% payment on-chain
- [ ] BaseScan shows payment transaction
- [ ] No wallet signature from user
- [ ] Gas sponsored by protocol
- [ ] Rate limiting + origin gating on purchase API
- [ ] Structured error responses (UI shows precise messages)
- [ ] Receipt status verification (`receipt.status === 1`)

### **Routing Fixed:**
- [ ] `app/utils/swapUtils.ts` created with `getAMMAddress()`
- [ ] `NEXT_PUBLIC_UUPS_AMM` added to `.env.local`
- [ ] `NEXT_PUBLIC_LEGACY_AMM` added to `.env.local` (or hardcoded)
- [ ] All swap UI components use `getAMMAddress(artistId)`
- [ ] Legacy artists route to legacy AMM
- [ ] UUPS artists route to UUPS AMM
- [ ] All artists can trade tokens
- [ ] No breaking changes

### **Sponsor Verification:**
- [ ] Factory sets sponsor during downloads deployment ✅ (verified in code)
- [ ] Verified sponsor on fresh factory-deployed artist
- [ ] Existing UUPS artists have sponsor set (or call `setSponsor()`)

### **Factory Operational:**
- [ ] `checkFactoryBalance.js` line 4 updated to correct address
- [ ] `FACTORY_ADDRESS` added to `.env.local` (for scripts)
- [ ] Factory has ≥ 0.05 ETH balance
- [ ] Can deploy 10+ artists (0.005 ETH each)
- [ ] New artist creation works end-to-end
- [ ] Sponsor automatically set on downloads proxy ✅ (factory code verified)

### **Ready for Mainnet:**
- [ ] All tests pass on testnet
- [ ] Purchase flow verified on testnet
- [ ] Friend testing complete
- [ ] No critical bugs
- [ ] Documentation updated

---

## 🚀 YOU'RE CLOSER THAN YOU THINK!

**What Works:**
- ✅ Factory deploys full UUPS infrastructure
- ✅ Frontend onboarding uses factory
- ✅ Asset editing complete
- ✅ Database integration solid
- ✅ 5 artists deployed successfully

**What's Missing:**
- ❌ Purchase flow using `buyFor()` (1-2 hours work)
- ❌ Swap routing for legacy + UUPS (30 min)
- ❌ Factory balance script fix (5 min)

**You've built the hard stuff. Now just wire up purchases and you're done!**

---

## 📋 QUICK REFERENCE: EXACT CODE SNIPPETS

### **ArtistDownloadsUUPSABI.ts** (Complete)

```typescript
export const ArtistDownloadsUUPSABI = [
  "function buyFor(address recipient, uint256 tokenId, uint256 quantity) external payable",
  "function mintDownload(address user, uint256 tokenId, uint256 amount) external",
  "function owner() view returns (address)",
  "function sponsor() view returns (address)",
  "function pause() external",
  "function unpause() external",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "event DownloadPurchased(address indexed buyer, uint256 indexed tokenId, uint256 quantity, uint256 amount)"
];
```

### **swapUtils.ts** (Complete)

```typescript
export function getAMMAddress(artistId: string): string {
  const LEGACY = ['gosheesh', 'jaitea', 'cancakes'];
  
  return LEGACY.includes(artistId)
    ? process.env.NEXT_PUBLIC_LEGACY_AMM!
    : process.env.NEXT_PUBLIC_UUPS_AMM!;
}
```

### **checkFactoryBalance.js** (Line 4 Fix)

```javascript
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0xD0786D75Cabc6a88869eE369302c65f52d16eCd2";
```

### **Purchase API Essentials** (Template Structure)

```typescript
// Validate: artistId, assetNumber, quantity, userAddress
// Load: price_usd, download_address from DB
// Convert: USD → ETH → wei (integer math)
// Caps: Check free-mint limits if price_usd = 0
// Idempotency: Hash check in artist_purchases
// Call: buyFor(userAddress, tokenId, qty, { value: priceWei, gasLimit: 300000 })
// Verify: receipt.status === 1
// Log: artist_purchases + gas_sponsorship_events
// Return: { txHash, tokenId, amountWei }
```

---

*Document Generated: October 30, 2025*  
*Updated: October 30, 2025 (Added purchase flow details, idempotency, gotchas, verification)*  
*Based on verified code inspection of `/Users/j/Dev/zeyoda-nextjs-091825`*  
*Next update: After purchase flow completion*


