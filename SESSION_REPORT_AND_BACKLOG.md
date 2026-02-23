# Zeyoda Session Report & Ticket Backlog

> Generated for review. Use this to build tickets in GitHub Issues, Notion, Linear, etc.

---

## Part 1: Session Summary (What Happened Here)

### Problem 1: Treasury Missing in Gosheesh's Wallet
- **Symptom:** Protocol Treasury section disappeared; showed "No token provided" with Retry button
- **Root cause:** Middleware requires `Authorization: Bearer <token>` for all API routes. `useTreasuryEarnings` used plain `fetch()` with no token → middleware blocked the request
- **Fix:** Switched `useTreasuryEarnings` to use `authenticatedFetch` with `getDidToken` from `useWallet()` (same pattern as `useArtistEarnings`)
- **Files changed:** `app/hooks/useTreasuryEarnings.ts`

### Problem 2: Feedback Feature (New)
- **Request:** Feedback button in chat input; Gosheesh sees all feedback in Wallet
- **Implemented:**
  - **DB:** `sql/feedback.sql` — feedback table (message, submitted_by, source, status, artist_id)
  - **APIs:** POST `/api/feedback`, GET `/api/feedback/list` (admin only), GET `/api/me` (isAdmin)
  - **UI:** 🎤→📢 button next to chat input; inline feedback panel; admin feedback section at top of Wallet
- **Files changed:** `app/page.tsx`, `app/components/Wallet.tsx`, `app/api/feedback/route.ts`, `app/api/feedback/list/route.ts`, `app/api/me/route.ts`, `sql/feedback.sql`

### Problem 3: Login (Earlier Fix)
- **Symptom:** Login failed after Data Reset
- **Cause:** Missing `encoding` dependency for `@magic-sdk/admin`
- **Fix:** `npm install encoding`

### Verification
- User confirmed feedback now appears in Gosheesh's wallet after submitting via 🎤→📢
- Treasury section visible when connected as Gosheesh

---

## Part 2: Architecture Context (How It Works)

### Auth Flow
1. User enters email → `checkWhitelist` (public)
2. If whitelisted → Magic.loginWithEmailOTP() → DID token
3. All protected API calls use `authenticatedFetch` or manual `Authorization: Bearer <token>`
4. Middleware blocks requests without token; routes call `verifyWhitelist()` for full validation

### Feedback Flow
1. User clicks 🎤→📢 → feedback panel opens
2. User types and sends → POST `/api/feedback` (whitelist verified, source = admin/user)
3. Gosheesh opens Wallet → GET `/api/feedback/list` (admin only) → sees list

### Treasury Flow
1. Wallet detects `userAddress === 0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8` → `isTreasury`
2. `useTreasuryEarnings` fetches `/api/treasury-earnings` with `authenticatedFetch`
3. API reads `protocol_swap_fees` table, returns totals and recent fees

---

## Part 3: Ticket Backlog (All Work Items)

### 🔴 Critical / Security

| ID | Title | Description | Location |
|----|-------|-------------|----------|
| T-001 | Add ownership verification to uploadAsset | `uploadAsset` route does not verify caller owns the artist before allowing upload | `app/api/uploadAsset/route.ts:64` |

### 🟠 High / Core Features

| ID | Title | Description | Location |
|----|-------|-------------|----------|
| T-002 | Refresh page after new asset upload | After upload, new asset doesn't appear until manual refresh | `app/page.tsx:1222` |
| T-003 | Implement proper LP calculation in artist/balances | `lpWithdrawableUsd` is hardcoded to 0; LP calculation not implemented | `app/api/artist/balances/route.ts:87` |

### 🟡 Medium / Performance & Reliability

| ID | Title | Description | Location |
|----|-------|-------------|----------|
| T-004 | Implement Redis cache for purchase/1155 | 5-min TTL cache for price/quote data | `app/api/purchase/1155/route.ts:50` |
| T-005 | Implement proper session management with Magic.link | Session handling for purchase flow | `app/api/purchase/1155/route.ts:261` |

### 🟢 Low / Nice to Have

| ID | Title | Description | Location |
|----|-------|-------------|----------|
| T-006 | Add server-side treasury wallet check | Treasury API returns data to any logged-in user; UI restricts to Gosheesh. Add server-side check for defense-in-depth | `app/api/treasury-earnings/route.ts` |
| T-007 | Refactor feedback submit to use authenticatedFetch | Feedback submit uses manual fetch with token; other flows use `authenticatedFetch` — consistency | `app/page.tsx` (feedback submit handlers) |

### 📋 Documentation & Process

| ID | Title | Description |
|----|-------|-------------|
| T-008 | Add AGENT_NOTES.md | Central place for agent context, conventions, gotchas |
| T-009 | Add ROADMAP.md | High-level roadmap and milestones |
| T-010 | Add PRD.json | Product requirements document |

### ⚠️ Known Constraints (Do Not Change Without Explicit Decision)

| Item | Notes |
|------|-------|
| fundWallet | Disabled (returns 403). Do not re-enable until SEC-001 remediation |
| .env | Never read or modify — agent must not touch env files |
| git | User manages version control — no git commands |

---

## Part 4: How to Build Out Tickets

### Option A: GitHub Issues
1. Create a project board or use labels
2. For each ticket above, create an Issue with:
   - Title = ticket title
   - Description = description + location
   - Labels: `critical`, `high`, `medium`, `low`, `docs`
3. Link to this file: `SESSION_REPORT_AND_BACKLOG.md`

### Option B: Notion / Linear / Jira
1. Create a "Zeyoda Backlog" database/board
2. Add columns: ID, Title, Priority, Status, Location
3. Import each row from Part 3 above

### Option C: Markdown Checklist
Keep this file in repo; add a "Status" column and manually check off:
```markdown
| T-001 | Add ownership verification | [ ] |
| T-002 | Refresh after upload       | [ ] |
...
```

### Option D: Cursor Rules
Add a `.cursor/rules/backlog.mdc` that references this file so agents know the backlog.

---

## Part 5: Files Touched This Session

| File | Change |
|------|--------|
| `app/hooks/useTreasuryEarnings.ts` | Add useWallet, authenticatedFetch; replace fetch with authenticatedFetch |
| `app/api/feedback/route.ts` | New — POST feedback, verifyWhitelist, source from role |
| `app/api/feedback/list/route.ts` | New — GET feedback list, admin only |
| `app/api/me/route.ts` | New — GET current user email, role, isAdmin |
| `app/page.tsx` | Feedback button, panel, isAdmin state, fetch /api/me |
| `app/components/Wallet.tsx` | isAdmin prop, feedback section, fetch /api/feedback/list |
| `sql/feedback.sql` | New — feedback table schema |

---

## Part 6: Prerequisites for Deployment

- [ ] Run `sql/feedback.sql` in Supabase (if not already done)
- [ ] Ensure `gosheeshnli10@gmail.com` has `role: 'admin'` in `whitelist_emails`
- [ ] `encoding` package installed (for Magic login)
