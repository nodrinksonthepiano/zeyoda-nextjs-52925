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
| T-011 | Treasure lower chassis parity with live portal | Mirror live post-hero regions (`login-prompts`, `unified-input`/lore strip) on `TreasureInviteShell` with **claim-first** copy and behavior — **no** full `PurchaseFlow`, **no** swap/marketplace. See Part 8. | `app/components/TreasureInviteShell.tsx`, `app/page.tsx` (reference only) |

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

---

## Part 7: Strategic Decisions From Founder Review

### Product Phase

- Current repo = **private testnet rehearsal**
- Inner-circle artists may test here before a later clean public fork
- Public-ready launch should likely happen from a fresh repo with fresh keys and cleaner assumptions

### ArtisTalks Relationship

- **ArtisTalks** is a different website, different login, and different codebase
- It is more public-facing and functions as an education / onboarding path
- Discovery is word of mouth, initiation, and secret knowledge rather than broad marketing

### Voice And Language

- This is **not** a stock market for artists
- Core phrasing: **stock up on your favorite art**
- Feedback is not only for Gosheesh to submit; fans and artists should be able to send feedback **to** GOSHEESH
- The chat is the command center; safewords should reveal tools and worlds

### Economics Clarification

- Current test LP appears to be `100M` tokens out of `10B`, which is **1%**, not 10%
- Current shallow launch is therefore even more fragile than first described
- Strong current direction to assess: `1B artist / 1B LP / 8B reserve vault`
- LP health depends on both token-side and ETH-side depth

### Reserve Vault / Treasury Meaning

- Reserve is positive if treated as a **protected reserve under stewardship**
- It should support later sovereignty, not act like hidden supply
- Borrowing against reserve is a later-stage idea, not an early launch feature

### Artist Launch Model

- Best current direction: protocol-funded launch with just an email
- Protocol fronts launch support, stewards the reserve, and helps the artist toward sovereignty
- Later, reserve control, fee rights, and ownership may be handed over to the artist when they are ready

### Onboarding Direction

- Main bottleneck is the onboarding experience
- For the first inner-circle cohort, prefer **pre-curated onboarding** over blank-canvas-first
- Let artists arrive to something that already feels alive, then fine tune it
- NFCs inside custom 3D printed coins are central to the fan discovery experience

### Future Experience Work

- Upload flow should support tags and per-asset splits
- Wallet should eventually support reload flows
- Toppins per view should likely be metered internally and settled in batches
- A grounded language model should eventually guide both ArtisTalks curriculum and portal navigation in founder voice

---

## Part 8: Phase 3B — Treasure invite vs live portal chassis (May 2026)

### Product direction

- **Treasure** (`?coin=…` nested invite) should feel like the **same portal** as **live** published artist pages: same mobile rhythm and hero/button layout; **different permissions** (claim / Magic / continue-to-launch vs purchase / wallet when allowed). Theme paint may differ.

### Implemented (this workstream)

| Area | Notes |
|------|--------|
| Treasure shell | Closer to `ArtistPageContent`: outer flex shell, `applyArtistBackground(stubConfig)`, hero stack `OvalGlowBackdrop` → `OrbitPeekCarousel` → `ThemeOrbitRenderer` (gift-scoped orbit), no extra sizing wrapper duplicating carousel on image/video path. |
| Claim-first | Removed purchase-y “Download · $1” line; primary **`CLAIM_CTA_LABEL`**; empty-email click shakes/focuses (`.shake` in `globals.css`); **unchanged** claim API + auto-claim `useEffect`. |
| Shared title | **`app/components/ArtistPortalTitle.tsx`**: `clamp` + wrap; used in **`app/page.tsx`** and **`TreasureInviteShell.tsx`**. |
| Carousel story | Synthetic **`ArtistAsset`** sets **`metadata.description`** from `treasure.description` so **`OrbitPeekCarousel`** caret/expand matches live; title line includes **year** when present; under-hero duplicate title/description **only** when there is **no** image/video carousel (audio/placeholder). |
| Post-hero rhythm | **Hero →** `my-4 w-full max-w-md mx-auto` **primary blue CTA** (guest styling aligned with `PurchaseFlow`) **→** supporting card (Magic lead + **email + Continue** row, `rounded-l` / `rounded-r`, `accentColor`). **No** `PurchaseFlow` import on treasure. |

### Intentionally not touched

- Claim routes, media persistence / draft-upload / save-draft, contracts, swap/tokenomics implementation, `useOrbitTokens` internals, ArtisTalks, new APIs.

### Files touched

- `app/components/TreasureInviteShell.tsx`
- `app/components/ArtistPortalTitle.tsx` (new)
- `app/page.tsx` (live title wiring only)

### Next slice (see T-011)

- Full **lower stack** parity: optional `login-prompts`-style block + future **unified input / lore** region — **claim copy only**, no swap slider, no marketplace noise.

### QA before shipping / next PR

- [ ] Long-name treasure + short-name live titles
- [ ] Treasure with and without `description` (caret on overlay)
- [ ] Audio or placeholder hero (text still under hero)
- [ ] Empty email → shake + focus; filled email → OTP → auto-claim
- [ ] Continue to launch after claim

### Safe-area note

- iPhone bottom padding deferred / watch-only unless QA shows repeat issues (Safari chrome collapse often sufficient).
