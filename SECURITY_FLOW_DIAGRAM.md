# 🔄 Security Flow Diagram

## Complete Request Flow (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER IN BROWSER                           │
│  Clicks "Purchase" button                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND CODE (app/page.tsx)                     │
│                                                              │
│  authenticatedFetch('/api/public/purchase1155', ...)        │
│    ↓                                                         │
│  Gets DID token from MagicProvider.getDidToken()            │
│    ↓                                                         │
│  Adds: Authorization: Bearer <did_token>                   │
│    ↓                                                         │
│  Sends request                                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              MIDDLEWARE (middleware.ts)                      │
│              🛡️ FIRST CHECKPOINT                             │
│                                                              │
│  1. Intercepts request                                        │
│  2. Checks if public route?                                  │
│     - /api/_health → Allow ✅                                │
│     - /api/checkWhitelist → Allow ✅                         │
│     - /api/registry GET → Allow ✅                          │
│     - Everything else → Check whitelist                      │
│                                                              │
│  3. Calls verifyWhitelist(request)                           │
│     ↓                                                        │
│     ┌──────────────────────────────────────┐              │
│     │  verifyWhitelist() Function           │              │
│     │  (app/utils/server/whitelistCheck.ts)  │              │
│     │                                        │              │
│     │  a) Extract token from header          │              │
│     │  b) Verify with Magic Admin SDK        │              │
│     │  c) Extract email from token          │              │
│     │  d) Query Supabase whitelist_emails   │              │
│     │  e) Return: verified + email          │              │
│     └──────────────────────────────────────┘              │
│                                                              │
│  4. If NOT verified → BLOCK (401/403) ❌                     │
│  5. If verified → Add x-verified-email header ✅             │
│  6. Allow request through                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│        PUBLIC ROUTE (app/api/public/purchase1155/route.ts)   │
│              🔒 SECOND CHECKPOINT                            │
│                                                              │
│  1. Receives request (already passed middleware)             │
│  2. ALSO checks whitelist (defense-in-depth)                │
│     Calls verifyWhitelist() again                            │
│  3. If NOT verified → BLOCK (403) ❌                         │
│  4. If verified → Proxy to internal route                    │
│     - Adds: x-internal-secret header                         │
│     - Adds: x-verified-email header                          │
│     - Forwards to /api/purchase/1155                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│      INTERNAL ROUTE (app/api/purchase/1155/route.ts)        │
│              ✅ THIRD CHECKPOINT                             │
│                                                              │
│  1. Receives request (already passed 2 checks)               │
│  2. Checks: x-internal-secret header ✅                      │
│  3. ALSO checks whitelist (backup) ✅                        │
│  4. Executes business logic:                                 │
│     - Process purchase                                       │
│     - Mint NFT                                               │
│     - Record sale                                            │
│  5. Returns success response                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSE TO USER                           │
│  ✅ Purchase complete!                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚫 Blocked Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER IN BROWSER                           │
│  Tries to call API (no token or not whitelisted)            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              MIDDLEWARE (middleware.ts)                      │
│                                                              │
│  verifyWhitelist(request)                                   │
│    ↓                                                         │
│  ❌ No token OR invalid token OR not whitelisted             │
│    ↓                                                         │
│  Returns: 401 or 403                                         │
│    ↓                                                         │
│  BLOCKS REQUEST                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    ERROR RESPONSE                             │
│  { error: "Unauthorized" }                                   │
│  Status: 401 or 403                                          │
│                                                              │
│  Route handler: NEVER REACHED ✅                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Session Validation Flow (On Page Load)

```
┌─────────────────────────────────────────────────────────────┐
│              USER REFRESHES PAGE                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         MagicProvider (app/components/MagicProvider.tsx)    │
│                                                              │
│  1. Check if user is logged in (Magic SDK)                  │
│  2. If logged in → Get email from Magic                      │
│  3. Call /api/checkWhitelist with email                      │
│     ↓                                                        │
│     ┌──────────────────────────────────────┐               │
│     │  /api/checkWhitelist                 │               │
│     │  Queries Supabase whitelist_emails   │               │
│     │  Returns: isWhitelisted: true/false   │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  4. If NOT whitelisted:                                      │
│     - magic.user.logout()                                    │
│     - Clear sessionStorage                                   │
│     - Set user = null                                        │
│     - User is logged out ✅                                   │
│                                                              │
│  5. If whitelisted:                                          │
│     - Keep session active                                    │
│     - Cache auth state                                       │
│     - User stays logged in ✅                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Layers Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUEST COMES IN                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  LAYER 1: MIDDLEWARE            │
        │  Checks whitelist FIRST         │
        │  Blocks if not verified         │
        └───────────────┬─────────────────┘
                        │ ✅ Passed
                        ▼
        ┌───────────────────────────────┐
        │  LAYER 2: PUBLIC ROUTE         │
        │  Double-checks whitelist       │
        │  Blocks if not verified        │
        └───────────────┬─────────────────┘
                        │ ✅ Passed
                        ▼
        ┌───────────────────────────────┐
        │  LAYER 3: INTERNAL ROUTE       │
        │  Triple-checks whitelist       │
        │  Checks secret header          │
        │  Blocks if not verified        │
        └───────────────┬─────────────────┘
                        │ ✅ Passed
                        ▼
        ┌───────────────────────────────┐
        │  BUSINESS LOGIC EXECUTES        │
        │  ✅ Request succeeds            │
        └───────────────────────────────┘
```

---

## 🎯 Key Points

1. **Middleware runs FIRST** - Catches bad requests before they reach code
2. **verifyWhitelist() is the core** - Used by middleware and routes
3. **Multiple checks** - Defense in depth (3-4 layers)
4. **Session validation** - Checks whitelist on every page load
5. **No bypass routes** - All paths are protected

---

## 📝 File Responsibilities

| File | Responsibility | When It Runs |
|------|---------------|--------------|
| `middleware.ts` | First whitelist check | Before ALL API routes |
| `whitelistCheck.ts` | Verify tokens + check DB | Called by middleware/routes |
| `authenticatedFetch.ts` | Add tokens to requests | Every frontend API call |
| `MagicProvider.tsx` | Manage sessions + validate | On every page load |
| `public/*` routes | Double-check whitelist | After middleware |
| Internal routes | Triple-check whitelist | After middleware + public route |

---

**The system is now bulletproof!** 🛡️

