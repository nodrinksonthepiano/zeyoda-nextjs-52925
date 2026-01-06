# 🔒 Security Fix Plan - Simple & Clear

## 🎯 Goal
Make sure ONLY whitelisted users can use your site, with NO workarounds.

---

## 📋 The 3-Step Fix Plan

### ✅ Step 1: Add a Server Guard (CRITICAL - Do This First)
**What:** Create a "bouncer" that checks every API request on the server.

**Why:** Right now only your browser checks the whitelist. Bad actors can skip the browser and call your APIs directly.

**How:**
- Create a file called `middleware.ts` at the root of your project
- This file runs BEFORE any API route
- It will:
  1. Check if user has a valid Magic.link login token
  2. Extract their email from the token
  3. Check if that email is in your whitelist database
  4. Block them if not whitelisted

**Result:** Even if someone bypasses your browser, they can't use your APIs.

---

### ✅ Step 2: Fix Public Routes (CRITICAL)
**What:** Protect the `/api/public/*` routes with the same whitelist check.

**Why:** These routes are currently "open" - anyone who finds them can use them.

**How:**
- Add the same server guard (from Step 1) to these routes
- Or remove them if you don't need them public

**Routes to fix:**
- `/api/public/purchase1155`
- `/api/public/mintDownload`
- `/api/public/uploadAsset`
- `/api/public/mintCollectible`
- `/api/public/lpWithdraw`

**Result:** No one can use these routes without being whitelisted.

---

### ✅ Step 3: Fix Old Sessions (IMPORTANT)
**What:** Make sure if someone is removed from whitelist, their old login stops working immediately.

**Why:** Right now if you remove someone from whitelist, they can still use the site if they're already logged in.

**How:**
- Update `MagicProvider.tsx` to check whitelist on every page load
- If whitelist check fails, force logout and clear their session
- Don't trust cached sessions - always verify fresh

**Result:** Removing someone from whitelist = instant access removal.

---

## 🎯 Success Criteria (How You'll Know It Works)

After implementing these fixes, test this:

1. ✅ **Test 1:** Remove an email from whitelist → that user should be logged out immediately
2. ✅ **Test 2:** Try calling `/api/public/purchase1155` without being logged in → should get blocked
3. ✅ **Test 3:** Try calling an API with a fake email → should get blocked
4. ✅ **Test 4:** Check your server logs → should see "whitelist check" for every API call

---

## 📝 Implementation Checklist

### Phase 1: Server Guard (Do This First!)
- [ ] Install Magic Admin SDK (for server-side token verification)
- [ ] Create `middleware.ts` file
- [ ] Add Magic token verification function
- [ ] Add whitelist check function
- [ ] Test: Try API call without token → should fail
- [ ] Test: Try API call with non-whitelisted email → should fail

### Phase 2: Public Routes
- [ ] Add whitelist check to `/api/public/purchase1155`
- [ ] Add whitelist check to `/api/public/mintDownload`
- [ ] Add whitelist check to `/api/public/uploadAsset`
- [ ] Add whitelist check to `/api/public/mintCollectible`
- [ ] Add whitelist check to `/api/public/lpWithdraw`
- [ ] Test: Try calling these routes without being whitelisted → should fail

### Phase 3: Session Management
- [ ] Update `MagicProvider.tsx` to check whitelist on load
- [ ] Add logout function if whitelist check fails
- [ ] Clear sessionStorage if not whitelisted
- [ ] Test: Remove email from whitelist → user should be logged out on next page load

---

## 🔍 What Each Fix Prevents

| Fix | Prevents This Attack |
|-----|---------------------|
| **Step 1: Server Guard** | Someone bypassing browser and calling APIs directly |
| **Step 2: Public Routes** | Someone discovering and using public API endpoints |
| **Step 3: Session Fix** | Someone staying logged in after being removed from whitelist |

---

## 🚨 Before You Deploy to Vercel

Make sure:
- [ ] Step 1 is complete and tested
- [ ] Step 2 is complete and tested  
- [ ] Step 3 is complete and tested
- [ ] All tests pass (see Success Criteria above)
- [ ] Environment variables are set in Vercel:
  - `MAGIC_SECRET_KEY` (for server-side token verification)
  - `SUPABASE_SERVICE_ROLE_KEY` (for whitelist checks)
  - `INTERNAL_API_SECRET` (keep this secret!)

---

## 💡 Simple Explanation of What We're Doing

**Before:** 
- Browser checks whitelist → User can bypass browser → APIs are open

**After:**
- Server checks whitelist on EVERY request → No way to bypass → APIs are locked down

---

## 📞 Need Help?

If any step is confusing:
1. Read the code comments (they'll explain what each part does)
2. Test after each step (don't do all 3 at once)
3. Check the logs (they'll show you what's happening)

---

**Remember:** Security is about layers. We're adding the server layer so even if someone breaks through the browser layer, they still can't get in.



