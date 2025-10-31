# ZEYODA ARTISTOCKS PROTOCOL - MASTER PROMPT FOR UUPS IMPLEMENTATION

> **Mission:** Build complete UUPS (Universal Upgradeable Proxy Standard) architecture for artist token sovereignty while preserving existing testnet functionality. Mainnet will be 100% UUPS with zero legacy code.

---

## 🎯 PROJECT OVERVIEW

**Zeyoda Artistocks Protocol** is an open-source Web3 platform (no crypto jargon visible on frontend) where:
- Artists post art and music
- Fans buy collectible downloads (ERC-1155)
- Each artist has their own token (ERC-20)
- Protocol uses custody model - artists create, protocol secures
- Goal: Full artist autonomy with pause/upgrade capabilities

**Tech Stack:**
- Frontend: Next.js 15, TypeScript, Tailwind CSS
- Authentication: Magic.link (email-based EOA wallets)
- Database: Supabase (PostgreSQL)
- Blockchain: Base Sepolia testnet → Base mainnet
- Smart Contracts: Solidity 0.8.24

---

## 📊 CURRENT STATE (What's Been Built)

### **Deployed on Base Sepolia Testnet:**

#### **3 Live Artists (Legacy Non-UUPS Contracts):**

**GOSHEESH:**
- ERC-20 Token: `0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac` (ArtistToken.sol - NON-UUPS)
- ERC-1155 Downloads: `0x51A70725D8842E856971C71bAE389f0EA5EEC676` (ArtistDownloads.sol - NON-UUPS)
- Treasury Wallet: `0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8`

**JAITEA:**
- ERC-20 Token: `0x9D06564a8D98e146CAb1dE74BF815bf05d24D685` (ArtistToken.sol - NON-UUPS)
- ERC-1155 Downloads: `0xec7BaDb433504aEbeFF747ADc8586E5663C0ea21` (ArtistDownloads.sol - NON-UUPS)
- Treasury Wallet: `0x0B893D9D0dA09096C75e43c310316dC61b2773be`

**CANCAKES:**
- ERC-20 Token: `0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65` (ArtistToken.sol - NON-UUPS)
- ERC-1155 Downloads: `0x1942756cA3dc2484b55E3417551159b56F66d467` (ArtistDownloads.sol - NON-UUPS)
- Treasury Wallet: `0xe42C291143e03f3Bd7D5a095815DAD3e82835C05`

#### **Shared Infrastructure:**

**Main AMM Swap (Uniswap V2-style):**
- Address: `0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE`
- Contract: `Swap.sol` (NON-UUPS)
- Features: ETH/Token pools, cross-token swaps, 0.3% trading fee
- Used by: ALL current token purchases
- Liquidity pools exist for all 3 artists

**Protocol Vault:**
- Address: `0x615258a5263DBEe0DDEED3166ddC1f442D937eB3`
- Holds: 8.9B tokens per artist (89% of supply)

---

### **Working Features (Just Completed):**

✅ **ERC-1155 Minting** (Sprint 1)
- Fixed critical bug: env var `DEPLOYER_PRIVATE_KEY` → `MINTER_PRIVATE_KEY`
- Mints to artist's treasury wallet (not uploader)
- Idempotency guard prevents double mints
- Proper error handling with explorer links
- **Confirmed working:** Emerald Gaia Asset #6 minted to jaitea

✅ **Description Field** (Sprint 2)
- 500-char description textarea in upload forms
- Displays in carousel title overlay (clickable dropdown)
- Responsive sizing (180x60px mobile, 320x120px desktop)
- Scroll-isolated (description scrolls independently of carousel)
- Backward compatible (reads `description ?? desc`)
- Dual-write to metadata JSONB

---

### **Current Architecture Limitations:**

❌ **All Contracts NON-Upgradeable:**
- Cannot pause trading if needed
- Cannot upgrade to fix bugs
- Cannot add new features without full redeployment
- Artist sovereignty transfer is one-way and final

❌ **Dead Code in Repo:**
- `TreasurySwapLite.sol` - UUPS contract exists but NOT used by frontend
- `treasurySwapUtils.ts` - Utility file exists but NOT imported anywhere
- Various deployment scripts reference TreasurySwapLite

---

## 🎯 MISSION: BUILD COMPLETE UUPS ARCHITECTURE

### **Objectives:**

1. **Create UUPS Contracts** for new artist onboarding
2. **Build Factory Pattern** for one-click UUPS deployment
3. **Implement Swap Router** to handle legacy + UUPS swaps
4. **Clean Testnet Path** - new artists use UUPS, existing 3 stay functional
5. **Delete TreasurySwapLite** - remove all traces from codebase
6. **Mainnet Ready** - ensure code can be cloned for clean mainnet launch

### **Non-Objectives:**

❌ DO NOT migrate existing 3 testnet artists to UUPS
❌ DO NOT break existing functionality
❌ DO NOT create complex bridge contracts
❌ DO NOT add unnecessary complexity

---

## 🏗️ REQUIRED CONTRACTS (To Be Built)

### **1. ArtistTokenUUPS.sol** (Upgradeable ERC-20)

**Inheritance:**
```solidity
contract ArtistTokenUUPS is 
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
```

**Key Features:**
- 10B total supply with automatic distribution
- `pause()` / `unpause()` for emergency stops
- `transferEverything()` for artist sovereignty transfer
- `_authorizeUpgrade()` restricted to owner (protocol → artist)

**Storage Layout (CRITICAL FOR UPGRADES):**
```solidity
contract ArtistTokenUUPS is ... {
    // State variables
    address public artistWallet;
    address public protocolVault;
    bool public hasInitialMinted;
    
    // REQUIRED: Storage gap for future upgrades
    uint256[47] private __gap;
}
```

**Distribution (initialMint):**
- **1,000,000,000 (1B)** → Artist treasury wallet (10%)
- **100,000,000 (100M)** → LP seed wallet (1%)
- **8,900,000,000 (8.9B)** → Protocol vault (89%)

**Critical:** MUST preserve exact same distribution as current ArtistToken.sol

**⚠️ UPGRADE SAFETY:** Never reorder state variables, never change types, always add new variables before __gap

### **2. ArtistDownloadsUUPS.sol** (Upgradeable ERC-1155 with On-Chain Fees)

**Inheritance:**
```solidity
contract ArtistDownloadsUUPS is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
```

**Key Features:**
- Protocol-sponsored purchases (backend pays gas)
- NO fee on 1155 downloads (artist gets 100%)
- buyFor() function mints to user, backend pays
- Pricing stored in database (USD), converted at purchase
- Free giveaways supported (protocol sponsors gas)
- Pause capability for emergencies
- Artist receives payments directly on-chain

**Storage Layout:**
```solidity
contract ArtistDownloadsUUPS is ... {
    string public artistId;
    
    mapping(uint256 => uint256) public totalMinted;
    
    // REQUIRED: Storage gap for future upgrades
    uint256[48] private __gap;
}
```

**Critical Functions:**

```solidity
// Protocol-sponsored purchase - mints to user, protocol pays gas
function buyFor(address recipient, uint256 tokenId, uint256 quantity) 
    external payable onlyOwner nonReentrant whenNotPaused {
    require(recipient != address(0), "Invalid recipient");
    require(quantity > 0, "Quantity must be > 0");
    
    // Mint to recipient (user gets NFT)
    _mint(recipient, tokenId, quantity, "");
    totalMinted[tokenId] += quantity;
    
    // Handle payment to artist owner
    if (msg.value > 0) {
        // NO FEE - 100% goes to artist (owner)
        (bool success, ) = payable(owner()).call{value: msg.value}("");
        require(success, "Payment failed");
        
        emit DownloadPurchased(recipient, tokenId, quantity, msg.value);
    } else {
        // Free giveaway
        emit DownloadPurchased(recipient, tokenId, quantity, 0);
    }
}

// Legacy mint function (for backward compatibility)
function mintDownload(address user, uint256 tokenId, uint256 amount) 
    external onlyOwner whenNotPaused {
    _mint(user, tokenId, amount, "");
    totalMinted[tokenId] += amount;
    emit DownloadMinted(user, tokenId, amount, artistId);
}
```

**Events:**
```solidity
event DownloadPurchased(
    address indexed buyer, 
    uint256 indexed tokenId, 
    uint256 quantity, 
    uint256 amount
);
event DownloadMinted(address indexed user, uint256 indexed tokenId, uint256 amount, string artistId);
```

**Key Points:**
- ✅ **NO fee on 1155 downloads** (artist gets 100%)
- ✅ **buyFor()** mints to user, backend pays gas
- ✅ Protocol sponsors gas via server signer (MINTER_PRIVATE_KEY)
- ✅ Pricing stored in database (USD), converted to wei at purchase time
- ✅ Simple, clean, artist-friendly

**⚠️ UPGRADE SAFETY:** Storage gaps required, never reorder variables

### **3. UupsAMM.sol** (Upgradeable Swap Contract - ERC-1967 Proxy)

**Inheritance:**
```solidity
contract UupsAMM is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
```

**Features:**
- Uniswap-V2 math cloned from current `Swap.sol` (unit-tested parity)
- 0.3% trading fee (30 bps) - fee stays in pool, benefits protocol as LP owner
- Constant product formula: x * y = k
- Pool creation, liquidity management
- ETH/Token and Token/Token swaps

**Storage Layout (CRITICAL FOR UPGRADES):**
```solidity
contract UupsAMM is ... {
    // State variables here
    mapping(address => Pool) public pools;
    address[] public supportedTokens;
    uint256 public tradingFee;
    
    // REQUIRED: Storage gap for future upgrades
    uint256[47] private __gap;
}
```

**⚠️ UPGRADE SAFETY RULES:**
- NEVER reorder existing state variables
- NEVER change variable types
- NEVER remove variables
- ALWAYS add new variables at the end (before __gap)
- Reduce __gap size when adding new variables

**Critical:** MUST maintain exact same fee structure and math as Swap.sol

### **4. TestnetRouter.sol** (TESTNET ONLY - Routes Legacy + UUPS)

**Purpose:** Route swaps to correct AMM based on token type (TESTNET ONLY)

**Logic:**
```solidity
function swapEthForTokens(address token, uint256 minTokens) external payable {
    if (isLegacyToken[token]) {
        // Route to Legacy AMM (existing 3 artists)
        ILegacyAMM(LEGACY_AMM).swapEthForTokens{value: msg.value}(token, minTokens);
    } else {
        // Route to UUPS AMM (all new artists)
        IUupsAMM(uupsAMM).swapEthForTokens{value: msg.value}(token, minTokens);
    }
}
```

**Configuration:**
- Hardcoded legacy tokens: gosheesh, jaitea, cancakes (3 addresses)
- UUPS AMM address
- Legacy AMM address
- **THIS FILE DOES NOT EXIST ON MAINNET**

### **4b. MainnetRouter.sol** (MAINNET - UUPS Only Passthrough)

**Purpose:** Simple passthrough to UUPS AMM (no legacy logic)

**Logic:**
```solidity
function swapEthForTokens(address token, uint256 minTokens) external payable {
    // Direct passthrough to UUPS AMM
    IUupsAMM(uupsAMM).swapEthForTokens{value: msg.value}(token, minTokens);
}
```

**Configuration:**
- UUPS AMM address only
- Zero legacy references
- Clean, simple, auditable

### **5. ArtistFactory.sol** (UUPS Deployment Factory)

**Purpose:** One-transaction deployment of complete artist infrastructure

**Function:**
```solidity
event ArtistCreated(
    string indexed artistId,
    address tokenProxy,
    address downloadsProxy,
    address poolAddress,
    uint256 lpTokenSeed,
    uint256 lpEthSeed
);

function createArtist(
    string memory name,
    string memory symbol,
    string memory artistId,
    address artistWallet,
    address protocolVault,
    address lpSeedWallet
) external payable onlyOwner returns (
    address tokenProxy,
    address downloadsProxy,
    address poolAddress
) {
    // Validate minimum funding
    require(msg.value >= 0.005 ether, "Insufficient ETH for LP seed");
    
    // 1. Deploy ArtistTokenUUPS proxy (ERC-1967)
    tokenProxy = _deployTokenProxy(name, symbol, artistWallet, protocolVault);
    
    // 2. Call initialMint on proxy (1B, 100M, 8.9B split)
    ArtistTokenUUPS(tokenProxy).initialMint();
    
    // 3. Deploy ArtistDownloadsUUPS proxy (ERC-1967)
    downloadsProxy = _deployDownloadsProxy(artistId);
    
    // 4. Create AMM pool with 100M tokens from protocol vault
    uint256 LP_TOKENS = 100_000_000 * 1e18;
    uint256 LP_ETH = msg.value; // Usually 0.005 ETH
    poolAddress = _createInitialPool(tokenProxy, LP_TOKENS, LP_ETH);
    
    emit ArtistCreated(artistId, tokenProxy, downloadsProxy, poolAddress, LP_TOKENS, LP_ETH);
}
```

**Event Decoding (Frontend):**
```typescript
// Strongly typed event decoding (NOT generic log parsing)
const iface = new ethers.Interface(ArtistFactoryABI);
const event = receipt.logs
  .map(log => {
    try { return iface.parseLog(log); } catch { return null; }
  })
  .find(e => e && e.name === 'ArtistCreated');

if (!event) throw new Error('ArtistCreated event not found');

const { artistId, tokenProxy, downloadsProxy, poolAddress, lpTokenSeed, lpEthSeed } = event.args;
```

**Funding Requirements:**
- LP seed = 0.005 ETH + 100M tokens (sent as msg.value to factory)
- Gas costs: ~0.005 ETH per deployment
- Total: ~0.01 ETH per artist deployment

**Gas Optimization:** All in one transaction, atomic deployment

---

## 📁 FILES TO DELETE (TreasurySwapLite Cleanup - EXHAUSTIVE)

### **Search & Destroy:**

**Command to find all references:**
```bash
grep -r "TreasurySwapLite" . --exclude-dir=node_modules
grep -r "treasurySwapUtils" . --exclude-dir=node_modules
```

### **Files to Delete:**

**Contracts:**
- `contracts/TreasurySwapLite.sol` - DELETE

**Scripts:**
- `scripts/deployCancakesTreasurySwap.js` - DELETE
- `scripts/seedSwapContracts.js` - DELETE
- Any script with "TreasurySwap" in name or content

**Frontend:**
- `app/utils/treasurySwapUtils.ts` - DELETE

**Deployment:**
- Any deploy script referencing TreasurySwapLite


---

## 🔧 FRONTEND INTEGRATION

### **Environment Variables:**

**Testnet .env:**
```env
# Deployment mode (SINGLE SOURCE OF TRUTH)
NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS
NEXT_PUBLIC_NETWORK_ENV=TESTNET

# UUPS Contracts (to be deployed)
NEXT_PUBLIC_ARTIST_FACTORY=<address>
NEXT_PUBLIC_UUPS_AMM=<address>
NEXT_PUBLIC_TESTNET_ROUTER=<address>

# Legacy support (TESTNET ONLY - for existing 3 artists)
NEXT_PUBLIC_ENABLE_LEGACY_SWAP_ROUTER=true
NEXT_PUBLIC_LEGACY_AMM_ADDRESS=0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE

# Free minting caps (prevent abuse)
FREE_MINT_PER_USER_DAILY=5
FREE_MINT_DAILY_CAP=500
FREE_MINT_GLOBAL_CAP=5000

# Existing
BASE_SEPOLIA_RPC_URL=https://base-sepolia.rpc.url
MINTER_PRIVATE_KEY=<key>
NEXT_PUBLIC_PROTOCOL_VAULT=0x615258a5263DBEe0DDEED3166ddC1f442D937eB3
```

**Mainnet .env (Future - STRICT):**
```env
# SINGLE deployment mode - NO legacy allowed
NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS
NEXT_PUBLIC_NETWORK_ENV=MAINNET

# UUPS Contracts only
NEXT_PUBLIC_ARTIST_FACTORY=<mainnet_address>
NEXT_PUBLIC_UUPS_AMM=<mainnet_address>
NEXT_PUBLIC_MAINNET_ROUTER=<mainnet_address>

# Free minting caps
FREE_MINT_PER_USER_DAILY=5
FREE_MINT_DAILY_CAP=500
FREE_MINT_GLOBAL_CAP=5000
```

### **Update Onboarding Flow:**

**File:** `app/page.tsx`

**Replace deployArtistToken function** to use factory:

```typescript
const deployArtistToken = async (artistData: any) => {
  if (!magic) throw new Error('Magic not initialized');
  
  const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
  const signer = await provider.getSigner();
  
  // Check deployment mode
  const useUUPS = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'UUPS';
  
  if (useUUPS) {
    // NEW: Use ArtistFactory for UUPS deployment
    const factoryAddress = process.env.NEXT_PUBLIC_ARTIST_FACTORY;
    const factory = new ethers.Contract(factoryAddress, ArtistFactoryABI, signer);
    
    const artistWallet = await signer.getAddress();
    const protocolVault = process.env.NEXT_PUBLIC_PROTOCOL_VAULT;
    
    const tx = await factory.createArtist(
      artistData.tokenName,
      artistData.tokenName.toUpperCase(),
      artistData.id,
      artistWallet,
      protocolVault,
      protocolVault // LP seed wallet (same as protocol for now)
    );
    
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => 
      log.fragment?.name === 'ArtistCreated'
    );
    
    return {
      tokenAddress: event.args.tokenProxy,
      downloadsAddress: event.args.downloadsProxy,
      poolAddress: event.args.poolAddress
    };
    
  } else {
    // LEGACY: Current non-UUPS deployment (keep for now)
    // ... existing code ...
  }
};
```

### ### **Update Swap Service:**

**File:** `app/utils/swapUtils.ts`

**Add router detection:**

```typescript
export const getSwapAddress = (tokenAddress: string): string => {
  const isTestnet = process.env.NEXT_PUBLIC_NETWORK_ENV === 'TESTNET';
  const enableLegacy = process.env.NEXT_PUBLIC_ENABLE_LEGACY_SWAP_ROUTER === 'true';
  
  // Check if token is legacy (testnet only)
  const LEGACY_TOKENS = [
    '0xB5610c9c05c6B2995d55BB0Fa6e03Ce11b1Bf6Ac', // gosheesh
    '0x9D06564a8D98e146CAb1dE74BF815bf05d24D685', // jaitea
    '0xdF0f956Be58D0ed027AbdF993A8c61e4cf31CA65'  // cancakes
  ];
  
  if (isTestnet && enableLegacy && LEGACY_TOKENS.includes(tokenAddress)) {
    // Route to legacy AMM
    return '0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE';
  }
  
  // Route to UUPS Router (testnet or mainnet)
  const routerAddress = isTestnet 
    ? process.env.NEXT_PUBLIC_TESTNET_ROUTER 
    : process.env.NEXT_PUBLIC_MAINNET_ROUTER;
  
  return routerAddress!;
};
```

### **Add Asset Edit Modal (Price + Description):**

**New Component:** `app/components/AssetEditModal.tsx`

```typescript
interface AssetEditModalProps {
  asset: any; // Current asset with metadata
  onSave: (updates: { price: number; description: string }) => Promise<void>;
  onClose: () => void;
  isUUPS: boolean; // Whether this is a UUPS contract
}

const AssetEditModal: React.FC<AssetEditModalProps> = ({ asset, onSave, onClose, isUUPS }) => {
  const [price, setPrice] = useState(asset.price_usd || 1);
  const [description, setDescription] = useState(asset.metadata?.description || '');
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ price, description });
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Edit Asset #{asset.asset_number}</h2>
        
        {/* Price Input */}
        <div>
          <label>Price (USD)</label>
          <input 
            type="number" 
            value={price} 
            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
          />
          {price === 0 && <p className="text-green-400">Free giveaway - no fee</p>}
          {isUUPS && price > 0 && (
            <p className="text-xs text-gray-400">
              Protocol fee on downloads: 0%. You keep 100%.
            </p>
          )}
        </div>
        
        {/* Description Textarea */}
        <div>
          <label>Description</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className="text-xs text-right">{description.length}/500</div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
```

### **Add Save Functions:**

**File:** `app/page.tsx` or dedicated utils file

```typescript
// Save price and description (UUPS contracts only)
async function saveAssetUpdates(
  artistId: string,
  assetNumber: number,
  updates: { price: number; description: string },
  downloadsContractAddress: string,
  isUUPS: boolean
) {
  // 1. Update database
  const { error: dbError } = await supabase
    .from('artist_assets')
    .update({
      price_usd: updates.price,
      metadata: {
        title: asset.metadata.title,
        description: updates.description,
        desc: updates.description // Dual-write for backward compat
      }
    })
    .eq('artist_id', artistId)
    .eq('asset_number', assetNumber);
  
  if (dbError) throw new Error('Database update failed');
  
  // Pricing is DB-only for MVP. No on-chain price updates needed.
  // Backend converts USD → wei at purchase time.
  
  return { success: true };
}
```

### **Purchase Flow (Backend API - Server-Sponsored):**

**Frontend:** `app/components/PurchaseFlow.tsx`

```typescript
// User clicks "Buy for $4" - frontend calls backend
async function purchaseDownload(artistId: string, assetNumber: number) {
  const response = await fetch('/api/purchase/1155', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      artistId, 
      assetNumber, 
      quantity: 1 
    })
  });
  
  if (!response.ok) throw new Error('Purchase failed');
  
  const { txHash, amountWei, tokenId } = await response.json();
  
  return { txHash, tokenId };
}
```

**Backend:** `app/api/purchase/1155/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { artistId, assetNumber, quantity } = await request.json();
  
  // 0. Get user address from session/auth
  const userAddress = await getUserAddressFromSession(request);
  if (!userAddress) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // 1. Look up asset price from database
  const { data: asset } = await supabase
    .from('artist_assets')
    .select('price_usd, artist_id')
    .eq('artist_id', artistId)
    .eq('asset_number', assetNumber)
    .single();
  
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  
  // 2. Get artist's download contract address
  const { data: registry } = await supabase
    .from('artist_registry')
    .select('downloads')
    .eq('id', artistId)
    .single();
  
  if (!registry?.downloads) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  
  // 3. Enforce free mint caps (if price = 0)
  if (asset.price_usd === 0) {
    await enforceFreeMintsystemCaps(userAddress); // Throws if exceeded
  }
  
  // 4. Convert USD → wei (cache ETH price to avoid API spam)
  const ethPrice = await getCachedETHPrice(); // 2500 fallback
  const priceETH = asset.price_usd / ethPrice;
  const priceWei = ethers.parseEther(priceETH.toString());
  
  // 5. Call buyFor() with server signer (gas sponsored)
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!, provider);
  
  const contract = new ethers.Contract(
    registry.downloads,
    ['function buyFor(address recipient, uint256 tokenId, uint256 quantity) external payable'],
    signer
  );
  
  const tx = await contract.buyFor(userAddress, assetNumber, quantity, {
    value: priceWei,
    gasLimit: 300000
  });
  
  const receipt = await tx.wait();
  
  // 6. Log gas sponsorship to gas_sponsorship_events table
  await logGasSponsorship(receipt, artistId, userAddress, priceWei);
  
  return NextResponse.json({
    txHash: receipt.hash,
    amountWei: priceWei.toString(),
    tokenId: assetNumber
  });
}
```

**Note:** owner() in contract receives 100% of msg.value. Ensure owner is payable EOA (Magic.link wallet) or contract with receive() function.
```

---

## 🎨 TOKEN ECONOMICS (CRITICAL - DO NOT CHANGE)

### **10 Billion Token Distribution:**

**Per Artist:**
- **Total Supply:** 10,000,000,000 tokens (10B)

**Distribution on initialMint():**
1. **1,000,000,000 (10%)** → Artist treasury wallet
   - Artist controls these immediately
   - Can sell, distribute, or hold
   
2. **100,000,000 (1%)** → LP seed wallet
   - Used to create initial liquidity pool
   - 100M tokens + 0.005 ETH seed
   - Provides immediate trading liquidity
   
3. **8,900,000,000 (89%)** → Protocol treasury vault
   - Protocol holds until artist sovereignty transfer
   - Used for future LP increases
   - Used for protocol operations
   - Transferred to artist via `transferEverything()` when ready

**LP Pool Initial Conditions:**
- 100M tokens (from LP seed allocation)
- 0.005 ETH (from protocol)
- Initial price: ~$0.000000125 USD per token (lower starting price)
- 0.3% trading fee accrues to protocol

---

## 💰 FEE STRUCTURE (CRITICAL - DO NOT CHANGE)

### **Swap Fees (0.3%):**
- **Trading Fee:** 30 basis points (0.3%)
- **Stays in Pool:** Fee remains in liquidity, benefiting LP owner (protocol)
- **Implementation:** Constant product formula with fee deduction

### **Download Sales (NO FEE - Artist Gets 100%):**

**UUPS Contracts (New Artists):**
- **Protocol Fee:** ZERO (0%) - artist gets full payment
- **Artist Earnings:** 100% of sale price
- **Payment:** Backend calls buyFor() with USD converted to ETH
- **Gas Sponsorship:** Protocol pays gas via server signer (MINTER_PRIVATE_KEY)
- **User Experience:** USD-only, no crypto, no fees visible
- **Revenue Source:** Protocol earns from ERC-20 swap fees (0.3%), not downloads

**Legacy Contracts (Existing 3 Artists):**
- **Same as UUPS:** NO fee on downloads
- **Payment:** Backend mints via mintDownload()
- **Gas:** Protocol sponsors
- **Keep unchanged** on testnet

### **Free Giveaways (Price = 0):**
- **Artist sets price to 0** via database
- **buyFor() function:** Accepts msg.value = 0 (no payment required)
- **No fee charged:** Free means truly free
- **Per-User Cap:** 5 free mints per user per day (FREE_MINT_PER_USER_DAILY)
- **Daily Cap:** 500 free mints total per day (FREE_MINT_DAILY_CAP)
- **Global Cap:** 5,000 total free mints (FREE_MINT_GLOBAL_CAP)
- **Implementation:** Backend checks caps before calling buyFor()
- **Prevents abuse:** Per-user + system-wide limits

---

## 📋 DATABASE SCHEMA (Supabase)

### **Critical Tables:**

**artists** (19 columns - COMPLETE SCHEMA):
- `id` (text) PRIMARY KEY - lowercase artist identifier
- `created_at` (timestamp with time zone) - Creation timestamp
- `name` (text) - Artist name
- `displayname` (text) - Display name
- `tokenName` (text) - ERC-20 token name/symbol
- `artworktitle` (text) - Featured content title
- `artworkyear` (text) - Artwork year
- `tokenprice` (numeric) - Token price (fallback if no LP)
- `videosrc` (text) - Featured content URL
- `contract` (text) - ERC-20 token address
- `theme` (jsonb) - Theme config {primaryColor, accentColor, fontFamily, gradients}
- `orbitaltokens` (jsonb) - Orbital token configuration array
- `swap_address` (text) - Swap contract address (will point to router for UUPS)
- `paused` (boolean) - Emergency pause flag
- `download_address` (text) - ERC-1155 contract address
- `owner_user_id` (uuid) - Foreign key to auth.users
- `treasury_wallet` (text) - Artist's Magic.link wallet address
- `total_earnings_usd` (numeric) - Cumulative earnings
- `total_sales_count` (integer) - Total sales count

**artist_registry:**
- `id` (text) - artist identifier
- `token` (text) - ERC-20 address
- `swap` (text) - Swap address
- `downloads` (text) - ERC-1155 address
- `treasury_wallet` (text) - Treasury address

**artist_assets:**
- `id` (uuid)
- `artist_id` (text)
- `asset_number` (integer) - tokenId for ERC-1155
- `file_url` (text) - Supabase storage URL
- `file_type` (text) - MIME type
- `price_usd` (numeric)
- `metadata` (jsonb) - **{ title, description, desc }**
- `download_count` (integer)

**artist_earnings:**
- Tracks all download sales (0% platform fee - artist gets 100%)
- Tracks swap fee events (0.3% on AMM trades)
- Links to asset purchases
- Records mint transactions with tx_hash

---

## 🚀 IMPLEMENTATION PLAN

### **Phase 1: Build UUPS Contracts (Week 1)**

**Deliverables:**
1. `contracts/uups/ArtistTokenUUPS.sol`
2. `contracts/uups/ArtistDownloadsUUPS.sol`
3. `contracts/uups/UupsAMM.sol`
4. `contracts/uups/SwapRouterUUPS.sol`
5. `contracts/uups/ArtistFactory.sol`

**Testing:**
- Unit tests for each contract
- Upgrade tests (deploy, upgrade, verify state preserved)
- Pause tests
- Integration tests

### **Phase 2: Deploy UUPS Infrastructure (Week 1)**

**Deployment Scripts:**
1. `deploy/uups/01_deploy_uups_amm.js`
2. `deploy/uups/02_deploy_swap_router.js`
3. `deploy/uups/03_deploy_artist_factory.js`
4. `deploy/uups/04_configure_legacy_tokens.js` (testnet only)

**Verification:**
- Confirm proxy patterns (ERC1967)
- Verify upgrade authority
- Test pause functionality
- Confirm AMM 0.3% fee only (no 1155 fee)

### **Phase 3: Frontend Integration (Week 2)**

**Files to Modify:**
1. `app/page.tsx` - Update handleSaveArtist to use factory
2. `app/utils/swapUtils.ts` - Add router selection logic
3. `app/hooks/useArtistConfig.ts` - Handle UUPS vs legacy tokens
4. `app/components/PurchaseFlow.tsx` - Call backend API for purchases
5. `app/components/AssetEditModal.tsx` - NEW: Edit price + description (DB only)
6. `app/api/purchase/1155/route.ts` - NEW: Server-sponsored purchase endpoint

**Purchase Flow Logic:**
```typescript
// Frontend always calls backend API (gas-sponsored)
async function purchaseDownload(artistId: string, assetNumber: number) {
  const response = await fetch('/api/purchase/1155', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      artistId, 
      assetNumber, 
      quantity: 1 
    })
  });
  
  if (!response.ok) throw new Error('Purchase failed');
  
  const { txHash, tokenId, amountWei } = await response.json();
  
  return { txHash, tokenId };
}
```

**Backend Detection (in /api/purchase/1155):**
```typescript
// Detect if legacy artist (testnet only)
const LEGACY_ARTISTS = ['gosheesh', 'jaitea', 'cancakes'];
const isLegacy = LEGACY_ARTISTS.includes(artistId);

if (isLegacy) {
  // Use current mintDownload() flow (existing system)
  return await legacyMintFlow(userAddress, artistId, assetNumber);
} else {
  // Use buyFor() flow (UUPS)
  return await uupsBuyForFlow(userAddress, artistId, assetNumber);
}
```

**This keeps existing 3 artists working unchanged.**
```

**Feature Flag:**
- `NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS`
- Controls whether onboarding uses factory or legacy deployment

### **Phase 4: Cleanup (Week 2)**

**Delete Files:**
1. `contracts/TreasurySwapLite.sol`
2. `app/utils/treasurySwapUtils.ts`
3. All deployment scripts mentioning TreasurySwapLite
4. Legacy deployment patterns

**Update Documentation:**
- README with UUPS architecture
- Deployment guide
- Artist sovereignty transfer guide

---

## 🧪 TESTING STRATEGY

### **Testnet Testing:**

**Existing Artists (gosheesh, jaitea, cancakes):**
- ✅ Continue working exactly as before
- ✅ Trade via legacy AMM (through router)
- ✅ No changes to their contracts
- ✅ Users see no difference

**New UUPS Artists:**
- ✅ Deploy via factory
- ✅ Fully upgradeable
- ✅ Pausable
- ✅ Trade via UUPS AMM (through same router)
- ✅ Test upgrade scenarios
- ✅ Test pause functionality

**Cross-Trading:**
- ✅ Legacy ↔ Legacy (via legacy AMM)
- ✅ UUPS ↔ UUPS (via UUPS AMM)
- ✅ Legacy ↔ UUPS (via router - two-hop)

**Friend Testing:**
- Invite friends to create new artist pages (UUPS)
- They test full flow: upload, mint, sell
- Protocol team tests admin functions: pause, upgrade

---

## 🌐 MAINNET STRATEGY (Future)

### **Fresh Clone Approach:**

**Step 1: Prepare Mainnet Repo**
```bash
# Clone repo
git clone <repo> zeyoda-mainnet
cd zeyoda-mainnet

# Create mainnet branch
git checkout -b mainnet-launch

# Remove ALL legacy code
rm -rf contracts/TreasurySwapLite.sol
rm -rf contracts/Artistock.sol (old simple version)
rm -rf app/utils/treasurySwapUtils.ts
# Remove SwapRouterUUPS legacy logic
# Remove ENABLE_LEGACY_* flags
```

**Step 2: Mainnet .env**
```env
DEPLOYMENT_MODE=UUPS
NETWORK_ENV=MAINNET
# NO legacy flags
```

**Step 3: Deploy UUPS Infrastructure**
```bash
# Deploy to Base mainnet
npx hardhat run deploy/uups/01_deploy_uups_amm.js --network base
npx hardhat run deploy/uups/03_deploy_artist_factory.js --network base
```

**Step 4: First Mainnet Artist**
- Use factory from day 1
- All UUPS
- Perfect sovereignty path

**Result:** Clean mainnet with zero legacy baggage

---

## 🔐 SECURITY & OWNERSHIP MODEL

### **Protocol Custody (Initial):**

**Protocol Controls:**
- ERC-20 proxy admin (can upgrade, pause)
- ERC-1155 proxy admin (can upgrade, pause)
- AMM pool owner (can adjust fees, pause)
- 8.9B token reserve

**Artist Controls:**
- 1B tokens in their wallet (immediate)
- Content creation (uploads, descriptions)
- Pricing for downloads
- Theme customization

### **Artist Sovereignty Transfer (Future):**

**When artist ready:**
```solidity
// Transfer proxy admin to artist cold wallet
ProxyAdmin.changeProxyAdmin(tokenProxy, artistColdWallet);
ProxyAdmin.changeProxyAdmin(downloadsProxy, artistColdWallet);

// Transfer ownership
ArtistTokenUUPS(tokenProxy).transferOwnership(artistColdWallet);

// Transfer protocol treasury tokens
ArtistTokenUUPS(tokenProxy).transferEverything(artistColdWallet);
```

**Result:** Artist has full sovereignty with upgrade/pause powers

---

## 📝 ACCEPTANCE CRITERIA

### **Before Deployment:**

**Contracts:**
- [ ] ArtistTokenUUPS.sol deployed and verified
- [ ] ArtistDownloadsUUPS.sol deployed and verified
- [ ] UupsAMM.sol deployed and verified
- [ ] SwapRouterUUPS.sol deployed and verified
- [ ] ArtistFactory.sol deployed and verified
- [ ] All contracts pausable
- [ ] All contracts upgradeable
- [ ] 10B distribution verified (1B, 100M, 8.9B)

**Integration:**
- [ ] Onboarding uses factory when DEPLOYMENT_MODE=UUPS
- [ ] Swaps route correctly (legacy vs UUPS)
- [ ] Existing 3 artists still functional
- [ ] New UUPS artists fully functional
- [ ] Cross-trading works

**Cleanup:**
- [ ] TreasurySwapLite.sol deleted
- [ ] treasurySwapUtils.ts deleted
- [ ] All TreasurySwapLite references removed
- [ ] No dead code remains

**Testing:**
- [ ] Create new UUPS artist via onboarding
- [ ] Verify contract addresses are proxies
- [ ] Test pause on new artist token
- [ ] Test upgrade on new artist token
- [ ] Verify 1B, 100M, 8.9B distribution
- [ ] Test swaps work through router
- [ ] Test cross-trading legacy ↔ UUPS

### **Mainnet Readiness:**

**Code Quality:**
- [ ] Zero ENABLE_LEGACY_* flags in mainnet branch
- [ ] Zero TreasurySwapLite references
- [ ] SwapRouterUUPS has no legacy logic on mainnet
- [ ] Clean, auditable codebase
- [ ] Documentation complete

---

## 🎓 BABY DEVELOPER GUIDANCE

### **What This Means in Simple Terms:**

**Current System:**
- You have 3 test artists with simple contracts
- They work but can't be paused or upgraded
- If there's a bug, you need to redeploy everything

**UUPS System:**
- New artists get upgradeable contracts
- You can pause if needed
- You can upgrade to add features
- You can transfer full control to artists

**Testnet vs Mainnet:**
- **Testnet:** Keep old 3 artists working, new artists use UUPS, test everything
- **Mainnet:** Fresh start, everyone uses UUPS, no legacy code

**What You're Building:**
1. Factory that deploys complete artist setup in one click
2. Router that handles both old and new swap types
3. Upgradeable contracts for all new artists
4. Clean path to mainnet with zero baggage

---

## 📞 SUPPORT & CONTEXT

### **Recent Completed Work:**

**Branch:** `fix/erc1155-minting-core`

**Sprint 1:** Fixed ERC-1155 minting
- Changed env var DEPLOYER_PRIVATE_KEY → MINTER_PRIVATE_KEY
- Mint to artist treasury wallet
- Added idempotency guard
- Fixed error handling
- **Result:** Minting works perfectly (Emerald Gaia Asset #6 confirmed)

**Sprint 2:** Added description field
- 500-char description in upload forms
- Clickable title overlay in carousel
- Scroll-isolated description panel
- Responsive sizing (mobile & desktop)
- Backward compatible with existing assets
- **Result:** Descriptions working on both devices

### **Key Files:**

**Contracts:**
- `contracts/ArtistToken.sol` - Current NON-UUPS token
- `contracts/ArtistDownloads.sol` - Current NON-UUPS 1155
- `contracts/Swap.sol` - Current NON-UUPS AMM
- `contracts/amm/SwapImplV1.sol` - UUPS AMM (reference)

**Frontend:**
- `app/page.tsx` - Main artist page, onboarding flow
- `app/components/OnboardingPanel.tsx` - Upload/create forms
- `app/utils/swapUtils.ts` - Swap service (uses Swap.sol)
- `app/api/uploadAsset/route.ts` - Asset upload & minting API

**Database:**
- Source of truth: Supabase `artist_registry` table
- Fallback: `app/utils/addressRegistryFallback.ts`

---

## 🎯 YOUR MISSION (For New Chat)

**Primary Goal:**
Build complete UUPS architecture for Artistocks Protocol that enables:
1. Pausable contracts (emergency stops)
2. Upgradeable logic (add features, fix bugs)
3. Artist sovereignty transfer (full control handoff)
4. Clean mainnet launch (zero legacy code)

**Constraints:**
- ✅ Preserve existing 3 testnet artists functionality
- ✅ Do not break any current working features
- ✅ Maintain exact 10B distribution (1B, 100M, 8.9B)
- ✅ Keep 0.3% fee structure
- ✅ Remove all TreasurySwapLite code
- ✅ Build for testnet testing first, mainnet clean launch later

**Success Criteria:**
- New artists onboard via factory (one transaction)
- All contracts are UUPS proxies
- Can pause/upgrade any new artist
- Existing artists still tradable
- Mainnet code has ZERO legacy references

**Testnet Environment:**
- Network: Base Sepolia
- RPC: `https://base-sepolia.rpc.url`
- Deployer: Uses MINTER_PRIVATE_KEY

**Philosophy:**
- Surgical, not destructive
- Test on testnet, perfect for mainnet
- Artist autonomy is the ultimate goal
- Protocol as training wheels, not prison

---

## 📚 REFERENCE MATERIALS

### **OpenZeppelin UUPS Pattern:**
- `@openzeppelin/contracts-upgradeable`
- Use `Initializable`, not constructors
- `__Contract_init()` pattern
- `_authorizeUpgrade()` for upgrade control

### **Existing UUPS Example in Repo:**
- See `contracts/TreasurySwapLite.sol` for reference (then delete it)
- See `contracts/amm/SwapImplV1.sol` for UUPS AMM pattern

### **Current Distribution Logic:**
- See `contracts/ArtistToken.sol` lines 60-82 for initialMint()
- MUST preserve this exact logic in UUPS version

---

## ⚠️ CRITICAL WARNINGS

### **DO NOT:**
- ❌ Change token distribution percentages
- ❌ Remove or modify 0.3% fee structure
- ❌ Break existing testnet artist functionality
- ❌ Migrate existing testnet tokens (not worth it)
- ❌ Add complexity for complexity's sake
- ❌ Use TreasurySwapLite (delete it)

### **DO:**
- ✅ Build clean UUPS contracts
- ✅ Use factory pattern for deployment
- ✅ Add pause capability
- ✅ Keep swap router simple
- ✅ Test thoroughly before mainnet
- ✅ Document everything clearly

---

## 🏁 FINAL NOTES

**This is a baby developer project**, so:
- Explain technical decisions clearly
- Ask questions before making assumptions
- Use established patterns (OpenZeppelin)
- Avoid clever tricks, prefer simple solutions
- Test everything twice

**Testnet Purpose:**
- Prove the system works
- Test with friends
- Find bugs safely
- Build confidence

**Mainnet Purpose:**
- Production-grade architecture
- UUPS everywhere
- Artist sovereignty
- Open source excellence

---

---

## ✅ GREEN-LIGHT CHECKLIST (Must Pass Before Merge)

### **Build Profiles Configured:**

**Testnet:**
- [ ] `NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS`
- [ ] `NEXT_PUBLIC_NETWORK_ENV=TESTNET`
- [ ] `NEXT_PUBLIC_ENABLE_LEGACY_SWAP_ROUTER=true`
- [ ] `NEXT_PUBLIC_TESTNET_ROUTER` deployed and configured

**Mainnet:**
- [ ] `NEXT_PUBLIC_DEPLOYMENT_MODE=UUPS`
- [ ] `NEXT_PUBLIC_NETWORK_ENV=MAINNET`
- [ ] ZERO `ENABLE_LEGACY_*` flags
- [ ] `NEXT_PUBLIC_MAINNET_ROUTER` (UUPS-only)

### **Contracts Deployed & Verified:**

- [ ] ArtistTokenUUPS implementation deployed
- [ ] ArtistDownloadsUUPS implementation deployed
- [ ] UupsAMM deployed (with 0.3% fee verified)
- [ ] TestnetRouter deployed (routes legacy + UUPS correctly)
- [ ] ArtistFactory deployed (creates proxies + seeds LP)
- [ ] All contracts have storage gaps (`uint256[N] private __gap`)
- [ ] All contracts have `_authorizeUpgrade` = `onlyOwner`
- [ ] All contracts are pausable

### **Factory Flow Tested:**

- [ ] Factory.createArtist() deploys in one transaction
- [ ] ERC-1967 proxies created (not implementation contracts)
- [ ] initialMint() produces: 1B artist, 100M LP, 8.9B protocol
- [ ] LP pool created with 100M tokens + 0.005 ETH
- [ ] ArtistCreated event emits all addresses + lpTokenSeed + lpEthSeed
- [ ] Event decoding uses strongly-typed Interface.parseLog()
- [ ] Balances verified on-chain

### **Router Logic Verified:**

**Testnet:**
- [ ] Legacy tokens (3 addresses) route to Legacy AMM
- [ ] New UUPS tokens route to UUPS AMM
- [ ] Cross-trading works (legacy ↔ UUPS via two-hop)
- [ ] Swaps execute with 0.3% fee

**Mainnet:**
- [ ] Router is MainnetRouter.sol (UUPS-only passthrough)
- [ ] No legacy logic exists
- [ ] No legacy token array

### **Cleanup Completed:**

- [ ] TreasurySwapLite.sol DELETED
- [ ] treasurySwapUtils.ts DELETED
- [ ] All scripts mentioning TreasurySwapLite DELETED
- [ ] `grep -r "TreasurySwapLite"` returns ZERO results
- [ ] `grep -r "treasurySwapUtils"` returns ZERO results


### **Pause & Upgrade Testing:**

- [ ] Can pause new UUPS token successfully
- [ ] Can unpause new UUPS token successfully
- [ ] Can upgrade UUPS token implementation
- [ ] State preserved after upgrade (balances unchanged)
- [ ] Can pause UUPS AMM successfully
- [ ] Can upgrade UUPS AMM successfully

### **Integration Testing:**

- [ ] Create new artist via onboarding (DEPLOYMENT_MODE=UUPS)
- [ ] Verify proxies deployed (check implementation slot)
- [ ] Buy new artist's tokens via router
- [ ] Upload 1155 asset with description
- [ ] Purchase 1155 download (mints correctly)
- [ ] Cross-trade new ↔ legacy tokens (testnet)
- [ ] Existing 3 artists still fully functional
- [ ] No breaking changes to current features

### **UUPS Download Purchase Testing:**

- [ ] Purchase $4 download via buyFor()
- [ ] Verify NFT mints to user (not server wallet)
- [ ] Check DownloadPurchased event emitted
- [ ] Verify artist owner received 100% of payment
- [ ] BaseScan shows payment went to artist address
- [ ] Gas sponsorship logged to gas_sponsorship_events
- [ ] Daily gas budget enforced
- [ ] User sees NO crypto, only USD

### **Free Giveaway Testing:**

- [ ] Set download price to $0
- [ ] Free buyFor() works with msg.value = 0
- [ ] NFT mints to user successfully
- [ ] No payment sent (truly free)
- [ ] Per-user limit enforced (5 per day)
- [ ] Daily system cap enforced (500 total)
- [ ] Global cap enforced (5000 total)
- [ ] User #6 blocked when trying 6th free mint same day
- [ ] Cap resets at midnight (daily)

### **Documentation:**

- [ ] README updated with UUPS architecture
- [ ] Deployment guide written
- [ ] Artist sovereignty transfer guide
- [ ] Storage gap rules documented
- [ ] Upgrade procedure documented

---


---

## 🎯 KEY ARCHITECTURAL CHANGES SUMMARY

### **From Off-Chain to On-Chain Payment (CRITICAL):**

**Current System (Legacy):**
- User clicks "Buy for $1" (sees USD only)
- Backend converts USD → ETH
- Protocol mints 1155 to user via `mintDownload()` using server signer
- Fee (0.3%) calculated and recorded in database
- Gas sponsored by protocol (server wallet pays)
- User never sees ETH or gas fees

**New UUPS System:**
- User clicks "Buy for $1" (STILL sees USD only)
- Backend converts USD → ETH  
- **Backend calls `buyFor(userAddress, tokenId, quantity)` using MINTER_PRIVATE_KEY**
- Contract mints NFT to user + sends 100% payment to artist owner
- NFT minted in same transaction
- **Gas STILL sponsored by protocol** (uses existing gas sponsorship system)
- **Logged to `gas_sponsorship_events`** table (existing infrastructure)
- **Daily budget checked** via `daily_gas_budgets` table (existing system)
- User never sees ETH or gas fees

**What Changed (Only the Implementation):**
- ❌ OLD: Backend mints via mintDownload() after processing payment
- ✅ NEW: Backend calls buyFor() which mints + sends payment in one transaction
- ✅ Payment goes DIRECTLY to artist owner address (100%, no fee)
- ✅ Simpler, more transparent

**What Stayed the Same (User Experience):**
- ✅ User sees USD prices only
- ✅ User clicks simple "Buy" button
- ✅ Protocol sponsors ALL gas
- ✅ No wallet signatures required from user
- ✅ NFT appears automatically

**Why This Matters:**
- ✅ Artist gets 100% of download sales (no platform fee)
- ✅ Transparent on-chain accounting (visible on BaseScan)
- ✅ Artist receives payment instantly (direct to their address)
- ✅ Protocol earns from token swaps (0.3% fee), not downloads
- ✅ **SAME USER EXPERIENCE** (still USD-first, gas-sponsored)
- ✅ Simpler, artist-friendly economics

### **Dual Flow During Transition (Testnet Only):**

**Legacy Artists (gosheesh, jaitea, cancakes):**
- Continue using off-chain payment + backend mint
- No changes to their contracts
- Keep working as-is

**UUPS Artists (All New Onboarding):**
- Server calls buyFor(recipient, tokenId, qty)
- 100% payment to artist owner
- Protocol sponsors gas
- Same UX as legacy

**Frontend Detects:**
```typescript
const isUUPS = !['gosheesh', 'jaitea', 'cancakes'].includes(artistId);
```

### **Mainnet = UUPS Only:**
- No detection logic needed
- No legacy flow
- All artists use buy()
- Clean, simple, auditable

---

**You are being asked to implement a clean UUPS architecture that enables true artist autonomy while maintaining protocol custody during onboarding. Build it right, test it thoroughly, launch it cleanly.**

**Key Economic Model: NO platform fee on ERC-1155 downloads (artist gets 100%). Protocol revenue comes from 0.3% AMM swap fees only. This creates artist-friendly economics while maintaining protocol sustainability.**

**Mainnet will be 100% UUPS with ZERO legacy code. Testnet bridges the gap.**

🚀 **Let's build the future of artist-owned economies.**

