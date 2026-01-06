# ✅ CORRECTED Step Sequence - Review & Fix

## ⚠️ Issue with Chat's Order

The chat suggested this order:
1. Step 2 - Build middleware (guard)
2. Step 3 - Send tokens from frontend
3. Step 4 - Verify tokens on server

**Problem:** Step 2 tries to use a verification function that doesn't exist yet!  
**Solution:** Build the verification function FIRST, then the middleware.

---

## ✅ CORRECT Order (What We'll Actually Do)

### Step 1: Install Dependencies & Environment
**What:** Get the tools we need
- Install `@magic-sdk/admin`
- Add `MAGIC_SECRET_KEY` to environment

**Why First:** Can't build anything without tools

**Pass Check:**
- [ ] `npm install` completes without errors
- [ ] `MAGIC_SECRET_KEY` exists in `.env.local`
- [ ] Can import `@magic-sdk/admin` in code

---

### Step 2: Build the Checker Tool 🔍
**What:** Create reusable function to verify tokens + check whitelist
- File: `app/utils/server/whitelistCheck.ts` (NEW)

**Why Second:** Everything else needs this!

**What It Does:**
```typescript
verifyWhitelist(request) → {
  verified: true/false,
  email: "user@example.com" or null,
  error: "reason" or null
}
```

**Pass Check:**
- [ ] File exists at `app/utils/server/whitelistCheck.ts`
- [ ] Function exports correctly
- [ ] Can import it in other files
- [ ] No TypeScript errors

---

### Step 3: Build the Security Guard 🛡️
**What:** Create middleware that intercepts ALL API requests
- File: `middleware.ts` (NEW at root)

**Why Third:** Now it can use the checker tool from Step 2!

**What It Does:**
1. Intercepts `/api/*` requests (except health/whitelist check)
2. Extracts token from `Authorization: Bearer <token>` header
3. Calls `verifyWhitelist()` from Step 2
4. Blocks if not verified/whitelisted (403)
5. Lets through if verified (adds email to request headers)

**Pass Check:**
- [ ] File exists at root `middleware.ts`
- [ ] Call API without token → Get 401/403 ✅
- [ ] Call API with fake token → Get 403 ✅
- [ ] Server logs show "middleware intercepting request"

---

### Step 4: Send Tokens from Frontend 🎫
**What:** Update all API calls to include Magic DID token
- Update: `MagicProvider.tsx` (add `getDidToken()`)
- Update: All files that call APIs (~15 files)

**Why Fourth:** Guard is ready, now give it tokens to check!

**What Changes:**
```typescript
// BEFORE:
fetch('/api/someRoute', { ... })

// AFTER:
const token = await magic.user.getIdToken();
fetch('/api/someRoute', {
  headers: {
    'Authorization': `Bearer ${token}`  // ADD THIS
  }
})
```

**Pass Check:**
- [ ] DevTools → Network → See `Authorization: Bearer ...` headers ✅
- [ ] All API calls include token (except `/api/checkWhitelist`)
- [ ] Whitelisted user can use site normally ✅

---

### Step 5: Lock Down Public Routes 🔒
**What:** Add whitelist check to public proxy routes
- Update: 6 files in `/app/api/public/*`

**Why Fifth:** Defense in depth - no bypass routes

**What Changes:**
```typescript
// BEFORE: Just proxies with secret
export async function POST(request) {
  const response = await fetch('/api/internal', {
    headers: { 'x-internal-secret': secret }
  });
}

// AFTER: Checks whitelist FIRST
export async function POST(request) {
  const check = await verifyWhitelist(request);
  if (!check.verified) return 403;
  
  const response = await fetch('/api/internal', {
    headers: { 'x-internal-secret': secret }
  });
}
```

**Pass Check:**
- [ ] Call `/api/public/purchase1155` without token → 403 ✅
- [ ] Call with valid whitelisted token → 200 ✅
- [ ] All 6 public routes protected

---

### Step 6: Remove Secret-Only Access 🔐
**What:** Ensure `INTERNAL_API_SECRET` alone isn't enough
- Update: Routes that only check secret (add whitelist check)

**Why Sixth:** Secret header shouldn't bypass whitelist

**What Changes:**
```typescript
// BEFORE: Only checks secret
if (gotSecret !== expectedSecret) return 401;

// AFTER: Checks secret AND whitelist
if (gotSecret !== expectedSecret) return 401;
const whitelistCheck = await verifyWhitelist(request);
if (!whitelistCheck.verified) return 403;
```

**Pass Check:**
- [ ] Call API with only `x-internal-secret` header → 403 ✅
- [ ] Need BOTH secret AND whitelisted token → 200 ✅

---

### Step 7: Invalidate Stale Sessions 🚪
**What:** Check whitelist on every page load, logout if removed
- Update: `app/components/MagicProvider.tsx`

**Why Seventh:** Prevents old sessions from persisting

**What Changes:**
```typescript
// BEFORE: Just checks if logged in
const isLoggedIn = await magic.user.isLoggedIn();
if (isLoggedIn) {
  // Use cached session - NO WHITELIST CHECK ❌
}

// AFTER: Checks whitelist on every load
const isLoggedIn = await magic.user.isLoggedIn();
if (isLoggedIn) {
  const email = await magic.user.getInfo().email;
  const whitelistCheck = await checkWhitelist(email);
  if (!whitelistCheck.isWhitelisted) {
    await magic.user.logout(); // FORCE LOGOUT ✅
  }
}
```

**Pass Check:**
- [ ] Remove email from whitelist → Refresh page → Logged out ✅
- [ ] Session cleared from storage ✅

---

## 🧪 Complete Test Sequence (After All Steps)

Run these in order:

### Test 1: No Token
```bash
curl -X POST http://localhost:3000/api/purchase/1155 \
  -H "Content-Type: application/json" \
  -d '{"artistId":"test"}'
```
**Expected:** `401 Unauthorized` or `403 Forbidden`

---

### Test 2: Fake Token
```bash
curl -X POST http://localhost:3000/api/purchase/1155 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake_token_123" \
  -d '{"artistId":"test"}'
```
**Expected:** `403 Forbidden`

---

### Test 3: Valid Token, Not Whitelisted
1. Login with email NOT in whitelist
2. Get token from DevTools → Network → Request Headers
3. Call API with that token
**Expected:** `403 Forbidden`

---

### Test 4: Valid Token, Whitelisted
1. Login with email IN whitelist
2. Use site normally
**Expected:** `200 OK`, everything works

---

### Test 5: Public Route Without Token
```bash
curl -X POST http://localhost:3000/api/public/purchase1155 \
  -H "Content-Type: application/json" \
  -d '{"artistId":"test"}'
```
**Expected:** `403 Forbidden` (not 200!)

---

### Test 6: Secret Header Only
```bash
curl -X POST http://localhost:3000/api/purchase/1155 \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: your_secret" \
  -d '{"artistId":"test"}'
```
**Expected:** `403 Forbidden` (secret alone not enough)

---

### Test 7: Session Invalidation
1. Login with whitelisted email
2. Remove email from `whitelist_emails` table in Supabase
3. Refresh page
**Expected:** Automatically logged out

---

### Test 8: Health Check Still Public
```bash
curl http://localhost:3000/api/_health
```
**Expected:** `200 OK` with `{"ok":true}`

---

## 📊 Comparison: Chat's Order vs Correct Order

| Step | Chat's Order | Correct Order | Why Changed |
|------|-------------|--------------|-------------|
| 1 | (Missing) | Install dependencies | Need tools first |
| 2 | Build middleware | Build checker tool | Middleware needs checker |
| 3 | Send tokens | Build middleware | Guard needs checker ready |
| 4 | Verify tokens | Send tokens | Guard ready, add tokens |
| 5 | Lock public routes | Lock public routes | Same |
| 6 | Remove secret-only | Remove secret-only | Same |
| 7 | Invalidate sessions | Invalidate sessions | Same |

**Key Fix:** Steps 2-3 swapped - build checker BEFORE guard!

---

## ✅ Final Checklist Before Starting

- [ ] Understand correct order (checker → guard → tokens)
- [ ] Have Magic Dashboard access
- [ ] Have Supabase access
- [ ] Ready to test after each step
- [ ] Know how to verify each step works
- [ ] Have backup/commit of current code

---

## 🎯 Success Criteria

You'll know it's perfect when:

1. ✅ Every API call requires valid Magic token
2. ✅ Every API call checks whitelist
3. ✅ No way to bypass (browser, direct API, public routes)
4. ✅ Removing email = instant logout
5. ✅ Health check still works
6. ✅ Logs show whitelist checks on every request

---

**Ready to start with Step 1?** Let's install the dependencies! 🚀

