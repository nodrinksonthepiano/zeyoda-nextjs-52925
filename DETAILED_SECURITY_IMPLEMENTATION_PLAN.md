# 🔒 Detailed Security Implementation Plan
## Surgical, Step-by-Step Approach - Steps 1-4 Only

**Status:** Planning Phase - NO CODE CHANGES YET  
**Goal:** Lock down whitelist enforcement with zero workarounds  
**Approach:** Whole systems thinking - verify everything before changing anything

---

## 📊 CURRENT STATE ANALYSIS (Verified Facts)

### ✅ What EXISTS:
1. **Frontend whitelist check:** `app/page.tsx` line 1755 - checks whitelist before Magic.login
2. **Whitelist API:** `app/api/checkWhitelist/route.ts` - queries Supabase `whitelist_emails` table
3. **Magic SDK:** Installed (`magic-sdk@29.1.0`) - client-side only
4. **Supabase setup:** Service role key exists, `whitelist_emails` table exists
5. **API secret guard:** `INTERNAL_API_SECRET` header check in some routes
6. **Public proxy routes:** 6 routes in `/app/api/public/*` that proxy to internal routes

### ❌ What's MISSING:
1. **NO middleware.ts** - No server-side request interception
2. **NO Magic Admin SDK** - Cannot verify DID tokens server-side
3. **NO DID token sending** - Frontend never sends Magic tokens to APIs
4. **NO server-side whitelist checks** - APIs don't verify whitelist status
5. **NO session invalidation** - MagicProvider doesn't check whitelist on load

### 🔍 CRITICAL FINDINGS:

**Frontend Flow (Current):**
```
User enters email → Frontend checks whitelist → Magic.loginWithEmailOTP() 
→ Gets DID token → Stores in Magic SDK → NEVER sends to server
```

**API Flow (Current):**
```
Client calls API → No auth header → Route checks INTERNAL_API_SECRET only 
→ No whitelist check → Executes handler
```

**Public Routes Flow (Current):**
```
Client calls /api/public/* → Proxy adds INTERNAL_API_SECRET → 
Forwards to internal route → No whitelist check → Executes handler
```

---

## 🎯 IMPLEMENTATION PLAN - 4 STEPS

---

## STEP 1: Install Dependencies & Setup Environment

### 1.1 Install Magic Admin SDK
**File:** `package.json`  
**Action:** Add dependency  
**Command:**
```bash
npm install @magic-sdk/admin
```

**Why:** Need server-side SDK to verify Magic DID tokens

**Verification:**
- [ ] Run `npm install`
- [ ] Check `node_modules/@magic-sdk/admin` exists
- [ ] Check `package.json` has `"@magic-sdk/admin": "^X.X.X"`

---

### 1.2 Add Environment Variables
**Files:** 
- `.env.local` (local development)
- Vercel Environment Variables (production)

**Variables Needed:**
```bash
# Already exists (verify these are set):
NEXT_PUBLIC_MAGIC_PK=your_magic_publishable_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
INTERNAL_API_SECRET=your_random_secret

# NEW - Add this:
MAGIC_SECRET_KEY=your_magic_secret_key  # Get from Magic Dashboard
```

**Where to get `MAGIC_SECRET_KEY`:**
1. Go to Magic Dashboard → Settings → API Keys
2. Copy "Secret Key" (NOT publishable key)
3. Add to `.env.local` and Vercel

**Verification:**
- [ ] `.env.local` has `MAGIC_SECRET_KEY`
- [ ] Vercel dashboard has `MAGIC_SECRET_KEY` set
- [ ] Restart dev server after adding

---

## STEP 2: Create Server-Side Whitelist Utility

### 2.1 Create Whitelist Check Utility
**File:** `app/utils/server/whitelistCheck.ts` (NEW FILE)

**Purpose:** Reusable function to verify Magic DID token + check whitelist

**What it does:**
1. Takes a Magic DID token from request header
2. Verifies token using Magic Admin SDK
3. Extracts email from verified token
4. Queries Supabase `whitelist_emails` table
5. Returns `{ verified: boolean, email: string | null, error: string | null }`

**Dependencies:**
- `@magic-sdk/admin` - Token verification
- `@supabase/supabase-js` - Whitelist query
- `process.env.MAGIC_SECRET_KEY` - Magic Admin SDK init
- `process.env.SUPABASE_SERVICE_ROLE_KEY` - Supabase query

**Error Handling:**
- Missing token → `{ verified: false, email: null, error: 'No token provided' }`
- Invalid token → `{ verified: false, email: null, error: 'Invalid token' }`
- Not whitelisted → `{ verified: false, email: 'user@example.com', error: 'Not whitelisted' }`
- Database error → `{ verified: false, email: null, error: 'Database error' }`

**Logging:**
- Log every verification attempt (email, result)
- Log whitelist check results
- Log errors with context

**Verification:**
- [ ] File created at `app/utils/server/whitelistCheck.ts`
- [ ] Function exports `verifyWhitelist(request: NextRequest)`
- [ ] Function handles all error cases
- [ ] Function logs appropriately

---

## STEP 3: Create Next.js Middleware

### 3.1 Create Middleware File
**File:** `middleware.ts` (ROOT LEVEL - same directory as `package.json`)

**Purpose:** Intercept ALL API requests before they reach route handlers

**What it does:**
1. Matches all `/api/*` routes EXCEPT public routes that should be open
2. Extracts Magic DID token from `Authorization: Bearer <token>` header
3. Calls `verifyWhitelist()` utility
4. If not verified/whitelisted → Return 403 immediately
5. If verified → Add verified email to request headers, continue

**Route Matching:**
```typescript
// Protect ALL /api/* routes EXCEPT:
- /api/_health (health check - keep public)
- /api/checkWhitelist (needed for login - keep public)
- /api/registry (GET only - public read access)
```

**Header Extraction:**
- Look for `Authorization: Bearer <did_token>`
- If missing → 401 Unauthorized
- If present → Verify token

**Response Codes:**
- `401` - No token provided
- `403` - Token invalid OR not whitelisted
- `500` - Server error (database/Magic API failure)

**Request Modification:**
- Add `x-verified-email` header to request (for route handlers to use)
- Add `x-verified-user` header (wallet address if available)

**Edge Runtime:**
- Use `export const config = { matcher: [...] }` for route matching
- Ensure middleware runs at Edge (faster, before route handlers)

**Verification:**
- [ ] File created at root: `middleware.ts`
- [ ] Matches correct routes
- [ ] Extracts token from Authorization header
- [ ] Calls whitelist utility
- [ ] Returns correct status codes
- [ ] Adds verified email to request headers

---

### 3.2 Update Frontend to Send DID Tokens

**Files to Update:**
1. `app/components/MagicProvider.tsx`
2. `app/page.tsx` (login function)
3. All API call locations (see list below)

**What to Change:**

**A. MagicProvider.tsx - Add token getter:**
- Add function: `getDidToken(): Promise<string | null>`
- This calls `magic.user.getIdToken()` when user is logged in
- Returns token or null

**B. Create API wrapper utility:**
**File:** `app/utils/apiClient.ts` (NEW FILE)

**Purpose:** Centralized fetch wrapper that automatically adds DID token

**What it does:**
```typescript
export async function authenticatedFetch(url: string, options: RequestInit) {
  const token = await magic.user.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}
```

**C. Update all API calls:**

**Files with API calls (need to update):**
1. `app/page.tsx` - Lines: 755, 766, 792, 803, 834, 868, 1132, 1180, 1450, 1477, 1778
2. `app/components/PurchaseFlow.tsx` - Line: 171
3. `app/components/Wallet.tsx` - Lines: 183, 229, 255, 336, 379
4. `app/components/ProfileEditPanel.tsx` - Lines: 154, 215, 335, 537, 740
5. `app/hooks/usePurchase1155.ts` - Line: 35

**Update Pattern:**
```typescript
// BEFORE:
const response = await fetch('/api/someRoute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

// AFTER:
const token = await magic.user.getIdToken();
const response = await fetch('/api/someRoute', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // ADD THIS
  },
  body: JSON.stringify(data)
});
```

**Exception:** `/api/checkWhitelist` - Don't add token (needed for login)

**Verification:**
- [ ] MagicProvider has `getDidToken()` function
- [ ] All API calls include `Authorization: Bearer <token>` header
- [ ] `/api/checkWhitelist` remains without token
- [ ] Test: Check Network tab - all API calls have Authorization header

---

## STEP 4: Update Public Routes & Session Management

### 4.1 Update Public Proxy Routes

**Files to Update:**
1. `app/api/public/purchase1155/route.ts`
2. `app/api/public/mintDownload/route.ts`
3. `app/api/public/uploadAsset/route.ts`
4. `app/api/public/mintCollectible/route.ts`
5. `app/api/public/lpWithdraw/route.ts`
6. `app/api/public/deleteAsset/route.ts`

**What to Change:**

**BEFORE (Current):**
```typescript
export async function POST(request: NextRequest) {
  // Just proxies with INTERNAL_API_SECRET
  const secret = process.env.INTERNAL_API_SECRET;
  const response = await fetch(`${origin}/api/internal`, {
    headers: {
      'x-internal-secret': secret
    }
  });
}
```

**AFTER (Protected):**
```typescript
export async function POST(request: NextRequest) {
  // FIRST: Check whitelist (same as middleware)
  const whitelistResult = await verifyWhitelist(request);
  if (!whitelistResult.verified) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }
  
  // THEN: Proxy with secret (existing behavior)
  const secret = process.env.INTERNAL_API_SECRET;
  const response = await fetch(`${origin}/api/internal`, {
    headers: {
      'x-internal-secret': secret,
      'x-verified-email': whitelistResult.email  // Pass verified email
    }
  });
}
```

**Why:** Middleware might not catch these if they're excluded from matcher, so add defense-in-depth

**Verification:**
- [ ] All 6 public routes check whitelist before proxying
- [ ] Return 403 if not whitelisted
- [ ] Pass verified email to internal route

---

### 4.2 Update MagicProvider Session Validation

**File:** `app/components/MagicProvider.tsx`

**What to Change:**

**Current Flow:**
```typescript
useEffect(() => {
  const isLoggedIn = await magic.user.isLoggedIn();
  if (isLoggedIn) {
    const meta = await magic.user.getInfo();
    userAddress = meta.publicAddress;
    // NO WHITELIST CHECK HERE ❌
  }
}, []);
```

**New Flow:**
```typescript
useEffect(() => {
  async function validateSession() {
    const isLoggedIn = await magic.user.isLoggedIn();
    if (isLoggedIn) {
      const meta = await magic.user.getInfo();
      const email = meta.email;
      
      // CHECK WHITELIST ON EVERY LOAD ✅
      const whitelistCheck = await fetch('/api/checkWhitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const { isWhitelisted } = await whitelistCheck.json();
      
      if (!isWhitelisted) {
        // FORCE LOGOUT if not whitelisted
        await magic.user.logout();
        sessionStorage.removeItem('magic-auth-state');
        userAddress = null;
        return;
      }
      
      userAddress = meta.publicAddress;
    }
  }
  
  validateSession();
}, []);
```

**Why:** Prevents stale sessions from persisting after whitelist removal

**Verification:**
- [ ] MagicProvider checks whitelist on every page load
- [ ] Logs out user if not whitelisted
- [ ] Clears sessionStorage on logout
- [ ] Test: Remove email from whitelist → refresh page → user logged out

---

## 🧪 TESTING PLAN (After Implementation)

### Test 1: Unauthenticated Request
```bash
curl -X POST http://localhost:3000/api/purchase/1155 \
  -H "Content-Type: application/json" \
  -d '{"artistId":"test","assetNumber":1,"quantity":1}'
```
**Expected:** `401 Unauthorized` (no token)

---

### Test 2: Invalid Token
```bash
curl -X POST http://localhost:3000/api/purchase/1155 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake_token_12345" \
  -d '{"artistId":"test","assetNumber":1,"quantity":1}'
```
**Expected:** `403 Forbidden` (invalid token)

---

### Test 3: Valid Token, Not Whitelisted
1. Log in with email NOT in whitelist
2. Get DID token from browser DevTools → Network → Request Headers
3. Call API with that token
**Expected:** `403 Forbidden` (not whitelisted)

---

### Test 4: Valid Token, Whitelisted
1. Log in with email IN whitelist
2. Get DID token
3. Call API with that token
**Expected:** `200 OK` (success)

---

### Test 5: Public Route Protection
```bash
curl -X POST http://localhost:3000/api/public/purchase1155 \
  -H "Content-Type: application/json" \
  -d '{"artistId":"test","assetNumber":1,"quantity":1}'
```
**Expected:** `403 Forbidden` (no token, even though it's "public")

---

### Test 6: Session Invalidation
1. Log in with whitelisted email
2. Remove email from `whitelist_emails` table in Supabase
3. Refresh page
**Expected:** User automatically logged out, redirected to login

---

### Test 7: Health Check Still Works
```bash
curl http://localhost:3000/api/_health
```
**Expected:** `200 OK` with `{"ok":true}` (should remain public)

---

## 📋 IMPLEMENTATION CHECKLIST

### Pre-Implementation:
- [ ] Read this entire plan
- [ ] Understand each step
- [ ] Have Magic Dashboard access (for secret key)
- [ ] Have Supabase access (to verify whitelist table)
- [ ] Backup current code (git commit)

### Step 1: Dependencies
- [ ] Install `@magic-sdk/admin`
- [ ] Add `MAGIC_SECRET_KEY` to `.env.local`
- [ ] Add `MAGIC_SECRET_KEY` to Vercel
- [ ] Restart dev server
- [ ] Verify no build errors

### Step 2: Utility Function
- [ ] Create `app/utils/server/whitelistCheck.ts`
- [ ] Implement `verifyWhitelist()` function
- [ ] Test function with mock token (unit test if possible)
- [ ] Verify error handling works

### Step 3: Middleware
- [ ] Create `middleware.ts` at root
- [ ] Configure route matcher (exclude public routes)
- [ ] Extract Authorization header
- [ ] Call whitelist utility
- [ ] Return appropriate status codes
- [ ] Add verified email to request headers
- [ ] Test middleware intercepts requests

### Step 3.2: Frontend Token Sending
- [ ] Add `getDidToken()` to MagicProvider
- [ ] Update all API calls to include Authorization header
- [ ] Verify Network tab shows tokens in headers
- [ ] Test: Login → Check DevTools → See Authorization headers

### Step 4: Public Routes & Sessions
- [ ] Update all 6 public routes with whitelist check
- [ ] Update MagicProvider to check whitelist on load
- [ ] Test: Remove email → Refresh → Logged out
- [ ] Test: Public routes require auth

### Final Verification:
- [ ] All 7 tests pass
- [ ] No console errors
- [ ] Whitelisted users can use site normally
- [ ] Non-whitelisted users blocked at every level
- [ ] Logs show whitelist checks on every API call

---

## 🚨 ROLLBACK PLAN

If something breaks:

1. **Remove middleware.ts** - Site works without it (back to current state)
2. **Remove Authorization headers** - Frontend works without them
3. **Revert MagicProvider changes** - Back to current session handling
4. **Git revert:** `git revert <commit-hash>`

**Safe to test:** All changes are additive - can be removed without breaking existing functionality

---

## 📝 NOTES

- **Middleware runs FIRST** - Before any route handler
- **Edge Runtime** - Fast, runs at Vercel Edge
- **Defense in Depth** - Multiple layers of protection
- **Backward Compatible** - Existing functionality preserved
- **Logging** - Every check is logged for debugging

---

## ✅ ACCEPTANCE CRITERIA

You'll know it's working when:

1. ✅ Every API call (except `/api/_health`, `/api/checkWhitelist`, `/api/registry` GET) requires valid DID token
2. ✅ Every API call checks whitelist status
3. ✅ Removing email from whitelist immediately blocks access
4. ✅ Public routes are protected (not actually public)
5. ✅ Server logs show "whitelist check" for every API call
6. ✅ No way to bypass whitelist (browser, direct API calls, public routes)

---

**Ready to implement?** Review this plan, ask questions, then we'll proceed step-by-step with code changes.

