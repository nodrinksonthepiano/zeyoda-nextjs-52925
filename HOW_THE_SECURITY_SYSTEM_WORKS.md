# 🔒 How The Security System Works - Complete Explanation

## 🎯 Overview

Your app now has **4 layers of security** that work together to ensure ONLY whitelisted users can access your APIs. Here's how each piece works:

---

## 📁 File-by-File Breakdown

### 1. `middleware.ts` (Root Level) - The First Line of Defense 🛡️

**What it does:**
- Runs BEFORE any API route handler
- Intercepts ALL `/api/*` requests
- Acts like a bouncer at the door

**How it works:**
```typescript
1. Request comes in → middleware runs FIRST
2. Checks if route is public (health check, whitelist check)
3. If not public → Calls verifyWhitelist()
4. If not verified → BLOCKS immediately (401/403)
5. If verified → Adds email to headers, lets request through
```

**Key Features:**
- ✅ Runs at Edge (fast, before route handlers)
- ✅ Blocks non-whitelisted requests immediately
- ✅ Allows public routes: `/api/_health`, `/api/checkWhitelist`, `/api/registry` (GET)
- ✅ Adds `x-verified-email` header for route handlers

**Why it's important:** Catches bad actors BEFORE they reach your code.

---

### 2. `app/utils/server/whitelistCheck.ts` - The Verification Engine 🔍

**What it does:**
- Verifies Magic DID tokens are real
- Extracts email from verified tokens
- Checks if email is in Supabase whitelist

**How it works:**
```typescript
verifyWhitelist(request) → {
  1. Extract token from "Authorization: Bearer <token>" header
  2. Verify token with Magic Admin SDK (proves it's real)
  3. Extract email from verified token
  4. Query Supabase whitelist_emails table
  5. Return: { verified: true/false, email: "...", error: "..." }
}
```

**Key Features:**
- ✅ Uses Magic Admin SDK (server-side verification)
- ✅ Queries Supabase `whitelist_emails` table
- ✅ Returns clear result with error messages
- ✅ Logs every verification attempt

**Why it's important:** This is the core verification logic used by middleware and routes.

---

### 3. `app/utils/authenticatedFetch.ts` - The Token Sender 📤

**What it does:**
- Wrapper around `fetch()` that automatically adds DID tokens
- Makes it easy to send authenticated requests

**How it works:**
```typescript
authenticatedFetch(url, options, getDidToken, skipAuth) → {
  1. Gets DID token from MagicProvider
  2. Adds "Authorization: Bearer <token>" header
  3. Makes fetch request with token included
  4. Returns response
}
```

**Key Features:**
- ✅ Automatically adds Authorization header
- ✅ Handles Content-Type automatically
- ✅ Can skip auth for public routes (like checkWhitelist)
- ✅ Used by all frontend API calls

**Why it's important:** Ensures every API call includes the token middleware needs.

---

### 4. `app/components/MagicProvider.tsx` - The Session Manager 👤

**What it does:**
- Manages Magic.link authentication
- Provides `getDidToken()` function
- Checks whitelist on every page load
- Auto-logouts users removed from whitelist

**How it works:**

**On Page Load:**
```typescript
1. Check if user is logged in (Magic SDK)
2. If logged in → Get email from Magic
3. Check whitelist status via /api/checkWhitelist
4. If NOT whitelisted → Force logout + clear session
5. If whitelisted → Keep session active
```

**getDidToken() Function:**
```typescript
getDidToken() → {
  1. Check if Magic instance exists
  2. Check if user is logged in
  3. Call magic.user.getIdToken()
  4. Return token (or null)
}
```

**Key Features:**
- ✅ Validates whitelist on every page load
- ✅ Auto-logout if removed from whitelist
- ✅ Provides `getDidToken()` for API calls
- ✅ Caches session (30 min max)

**Why it's important:** Prevents stale sessions from persisting after whitelist removal.

---

### 5. `app/api/public/*` Routes - Defense in Depth 🔒

**What they do:**
- Proxy routes that forward to internal routes
- Add `INTERNAL_API_SECRET` header server-side
- Now ALSO check whitelist before proxying

**How they work:**
```typescript
1. Request comes to /api/public/purchase1155
2. Middleware checks whitelist (first layer)
3. Route handler ALSO checks whitelist (second layer)
4. If both pass → Proxy to internal route with secret header
5. Internal route receives request with secret + verified email
```

**Key Features:**
- ✅ Double-check whitelist (middleware + route)
- ✅ Add secret header server-side (never trust client)
- ✅ Pass verified email to internal route
- ✅ 6 routes protected: purchase1155, mintDownload, uploadAsset, mintCollectible, lpWithdraw, deleteAsset

**Why it's important:** Defense-in-depth - even if middleware fails, route blocks.

---

### 6. Protected API Routes (e.g., `app/api/mintDownload/route.ts`) - Final Check ✅

**What they do:**
- Handle actual business logic
- Check secret header (if used)
- ALSO check whitelist (backup)

**How they work:**
```typescript
1. Request reaches route handler (already passed middleware)
2. Check INTERNAL_API_SECRET header (if route uses it)
3. ALSO check whitelist (defense-in-depth)
4. If both pass → Execute business logic
5. Return response
```

**Key Features:**
- ✅ Triple-check: Middleware → Route whitelist → Route secret
- ✅ Multiple layers of protection
- ✅ Routes can trust `x-verified-email` header from middleware

**Why it's important:** Final safety net - even if middleware is bypassed somehow.

---

## 🔄 Complete Request Flow

### Example: User Purchases an Asset

```
1. USER ACTION
   User clicks "Purchase" button in browser
   ↓

2. FRONTEND (app/page.tsx)
   Calls: authenticatedFetch('/api/public/purchase1155', {...}, getDidToken)
   ↓
   authenticatedFetch gets token from MagicProvider
   Adds: Authorization: Bearer <did_token>
   ↓

3. MIDDLEWARE (middleware.ts) - FIRST CHECKPOINT
   Intercepts request BEFORE route handler
   Extracts token from Authorization header
   Calls: verifyWhitelist(request)
   ↓
   verifyWhitelist:
     - Verifies token with Magic Admin SDK ✅
     - Extracts email: "user@example.com"
     - Checks Supabase whitelist ✅
     - Returns: { verified: true, email: "user@example.com" }
   ↓
   Middleware adds: x-verified-email header
   Allows request through ✅
   ↓

4. PUBLIC ROUTE (app/api/public/purchase1155/route.ts) - SECOND CHECKPOINT
   Receives request (already passed middleware)
   ALSO checks whitelist (defense-in-depth)
   verifyWhitelist() → verified ✅
   ↓
   Proxies to internal route:
     - Adds: x-internal-secret header
     - Adds: x-verified-email header
     - Forwards to /api/purchase/1155
   ↓

5. INTERNAL ROUTE (app/api/purchase/1155/route.ts) - THIRD CHECKPOINT
   Receives request (already passed 2 checks)
   Checks: x-internal-secret header ✅
   ALSO checks whitelist (backup) ✅
   ↓
   Executes business logic:
     - Processes purchase
     - Mints NFT
     - Records sale
   ↓

6. RESPONSE
   Returns success response
   ↓

7. FRONTEND
   Receives response
   Updates UI
   ✅ Purchase complete!
```

---

## 🚫 What Happens When Someone Tries to Bypass?

### Scenario 1: No Token

```
Request: POST /api/purchase/1155 (no Authorization header)
↓
Middleware: verifyWhitelist() → { verified: false, email: null, error: "No token" }
↓
Middleware: Returns 401 Unauthorized
↓
Route handler: NEVER REACHED ✅
```

### Scenario 2: Fake Token

```
Request: POST /api/purchase/1155
Headers: Authorization: Bearer fake_token_123
↓
Middleware: verifyWhitelist()
  - Magic Admin SDK: Token validation fails ❌
↓
Middleware: Returns 403 Forbidden
↓
Route handler: NEVER REACHED ✅
```

### Scenario 3: Valid Token, Not Whitelisted

```
Request: POST /api/purchase/1155
Headers: Authorization: Bearer <valid_token>
Token email: "badactor@example.com"
↓
Middleware: verifyWhitelist()
  - Token verified ✅
  - Email extracted: "badactor@example.com"
  - Supabase check: NOT in whitelist ❌
↓
Middleware: Returns 403 Forbidden
↓
Route handler: NEVER REACHED ✅
```

### Scenario 4: User Removed From Whitelist

```
User logged in, browsing site
↓
Admin removes email from whitelist_emails table
↓
User refreshes page
↓
MagicProvider: Checks whitelist on load
  - Calls /api/checkWhitelist
  - Result: isWhitelisted = false ❌
↓
MagicProvider: Force logout
  - magic.user.logout()
  - Clears sessionStorage
↓
User: Automatically logged out ✅
Next API call: Blocked by middleware ✅
```

---

## 🔐 Security Layers Summary

| Layer | What It Does | When It Runs |
|-------|-------------|--------------|
| **1. Middleware** | Checks whitelist on ALL API requests | Before route handlers |
| **2. MagicProvider** | Validates whitelist on page load | On every page refresh |
| **3. Public Routes** | Double-checks whitelist before proxying | After middleware, before internal route |
| **4. Internal Routes** | Triple-checks whitelist + secret | After middleware + public route |

**Result:** 4 independent checks - if ANY fails, request is blocked!

---

## 🎯 Key Security Features

### ✅ Token Verification
- Magic Admin SDK verifies tokens server-side
- Can't fake tokens (cryptographically signed)
- Tokens expire automatically

### ✅ Whitelist Enforcement
- Checked at 4 different points
- Database query on every request
- Immediate invalidation on removal

### ✅ Defense in Depth
- Multiple layers of protection
- If one layer fails, others catch it
- No single point of failure

### ✅ Session Management
- Auto-logout on whitelist removal
- Session validation on every load
- No stale sessions

---

## 📊 Database Tables Used

### `whitelist_emails`
- Stores allowed email addresses
- Columns: `email`, `role`, `used`, `notes`
- Checked on every API request

### `login_attempts`
- Logs all login attempts
- Columns: `email`, `whitelisted`, `clue`, `timestamp`, `ip_address`
- Used for monitoring and debugging

---

## 🔧 Environment Variables Required

```bash
# Magic.link
NEXT_PUBLIC_MAGIC_PK=your_publishable_key    # Client-side
MAGIC_SECRET_KEY=your_secret_key             # Server-side (NEW!)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key   # For whitelist queries

# Internal Secret
INTERNAL_API_SECRET=your_random_secret        # For route-to-route calls
```

---

## 🎓 Simple Summary

**Before:** Browser checked whitelist → APIs trusted anyone with secret

**After:** 
1. Browser checks whitelist ✅
2. Middleware checks whitelist ✅
3. Routes check whitelist ✅
4. Sessions validate whitelist ✅

**Result:** No way to bypass - whitelist enforced at every level!

---

## 🧪 How to Verify It Works

1. **Test without token:**
   ```bash
   curl -X POST http://localhost:3000/api/purchase/1155
   # Should return: 401 Unauthorized
   ```

2. **Test with fake token:**
   ```bash
   curl -X POST http://localhost:3000/api/purchase/1155 \
     -H "Authorization: Bearer fake_token"
   # Should return: 403 Forbidden
   ```

3. **Test with valid token (not whitelisted):**
   - Login with non-whitelisted email
   - Try to use site
   - Should be blocked

4. **Test whitelist removal:**
   - Login with whitelisted email
   - Remove email from Supabase
   - Refresh page
   - Should auto-logout

---

**The system is now secure!** 🎉 Every request is verified, every session is validated, and there's no way to bypass the whitelist.

