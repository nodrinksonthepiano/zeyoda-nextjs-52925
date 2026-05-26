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
| T-011 | Treasure lower chassis parity with live portal | **Shipped (May 2026).** Guest stack on `TreasureInviteShell`: `login-prompts`, `access-headline` + claim copy (`treasureCopy.ts`), stub social grid (`login-btn` + same `alert` as live guest `page.tsx`), `unified-input-container` email + Continue (live classes). **No** `PurchaseFlow`, **no** swap/marketplace. Live portal: hero `relative z-0` + post-hero `main` content in `relative z-10` wrapper so `OvalGlowBackdrop` halo does not paint over CTAs. See Part 8. | `app/components/TreasureInviteShell.tsx`, `app/constants/treasureCopy.ts`, `app/page.tsx` |
| T-012 | Treasure lore / unified chat strip | **Future slice.** Clue / lore / chat-style input (or extend unified strip) on the treasure invite flow — **claim-first**, no marketplace, no swap. | `app/components/TreasureInviteShell.tsx` |

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
| Post-hero rhythm | **Hero →** primary Claim CTA (`PurchaseFlow`-aligned guest blue button) **→** `login-prompts` + stub social grid **→** **`unified-input-container`** (Magic email + Continue, live classes). **No** `PurchaseFlow` on treasure. |
| Halo stacking | Treasure + live: hero column **`z-0`**, chassis (and live: all post-hero `main` content) **`z-10`** so halo `box-shadow` bleed stays underneath CTAs. |

### Intentionally not touched

- Claim routes, media persistence / draft-upload / save-draft, contracts, swap/tokenomics implementation, `useOrbitTokens` internals, ArtisTalks, new APIs.

### Files touched

- `app/components/TreasureInviteShell.tsx`
- `app/components/ArtistPortalTitle.tsx` (new)
- `app/constants/treasureCopy.ts` (`TREASURE_ACCESS_HEADLINE`, guest email placeholder)
- `app/page.tsx` (live title wiring; post-hero `z-10` wrapper for stacking parity)

### Next slice (T-012)

- **Lore / clue / chat-style** region on treasure invite — see **T-012** in Part 3. Lower chassis (**T-011**) is shipped.

### QA before shipping / next PR

- [ ] Long-name treasure + short-name live titles
- [ ] Treasure with and without `description` (caret on overlay)
- [ ] Audio or placeholder hero (text still under hero)
- [ ] Empty email → shake + focus; filled email → OTP → auto-claim
- [ ] Continue to launch after claim
- [ ] Treasure: social buttons stub-only (`alert`), no accidental form submit
- [ ] Treasure + live: primary CTA + email strip fully above halo (mobile + desktop)

### Safe-area note

- iPhone bottom padding deferred / watch-only unless QA shows repeat issues (Safari chrome collapse often sufficient).

---

## Part 9: MVP testnet spine & pre–artist-testing hardening (May 2026)

### Status decision

**The scary part is behind you for testnet rehearsal:** the core loop is validated, not “does the system ever work?” Focus shifts to **pre–artist-testing hardening** (clarity, telemetry, runbooks), **not** tokenomics, token-to-token trading, LP drains, or legacy cleanup—those stay **explicitly later**.

### What was proven (two launch families + public + marketplace shell)

| Lane | Meaning |
|------|--------|
| **Normal safeword launch** | Factory → DB → featured media → asset publish → **`finalizeLaunch`** path; re-verify after **`uploadFeaturedFile` + launch bootstrap** merge. |
| **Nested / treasure-style launch** | Invite / coin bridge → launch; **separate** QA path from normal; also reported working in session. |
| **Public logged-out** | **`/?artist=slug`** in **Incognito** without Magic = real “published” check. **Owner-logged-in-only** is **not** proof of public launch. |
| **Cash-out / swap UX** | Unified panel: USD slider = dollars; Artistock→USD = % of balance (BigInt); download checkbox on cash-out; **order:** cash-out → refresh → optional download mint; **partial success** if mint fails. |
| **Download + cash-out** | Not one combined swap tx; net-style CTA (receive − download ≈ net); snapshot semantics avoid bogus “token + USD” totals for cash-out. |

**Human follow-up:** Write down the **two disposable test slugs** (normal + nested), what passed, and **git commit** after saving **`uploadFeaturedFile` + `page.tsx` bootstrap**.

**Slug note (inferential — verify in Supabase):** Recent local `npm run dev` logs showed activity for **`pemfnash`** (e.g. `artist-earnings`) and **`rnr3333`** (e.g. `/?artist=rnr3333`). These are **leads**, not authoritative labels for which slug was normal vs treasure; confirm against **`artists.id`** before delete/relaunch.

### Important product / engineering decisions

- **`artists.paused`:** **`createArtist` always inserts `paused: true`**. Only **`POST /api/artist/finalizeLaunch`** (plus manual DB) flips **`false`**. **`LiveArtistPortal`** “not published yet” = **`paused === true`** **and** viewer **not** treasury—**not** “nested under GOSHEESH.”
- **Hero video file upload (launch):** Browser **`supabase.storage.upload`** with **anon** key hit **Storage RLS** (`new row violates row-level security`). **Fix:** **`/api/uploadFeaturedFile`** (service role + treasury check) + **`page.tsx` bootstrap:** persist artist row (placeholder **`videosrc`**) **before** file upload, then **PATCH** real **`videosrc`**. HTTPS draft path already used service role via **`/api/public/uploadFeatured`**.
- **Checkout confirm grid:** **2×2** — Wallet (approx.) + grey **Venmo / PayPal / Card** (**`soon`**) for rehearsal “future rails.”
- **Secrets / git:** Never commit **`.env.local`**; user owns git operations.

### Final tester checklist (before inviting wider artists)

Use **Incognito** where it says **public**.

- [ ] Normal launch → **public** in Incognito (`/?artist=<slug>`)
- [ ] Nested / treasure launch → **public** in Incognito
- [ ] Buy **~$1** (USD → Artistock)
- [ ] Cash out **small** amount
- [ ] Cash out **with** featured download checked (partial success acceptable if edge)
- [ ] Refresh balances / persistence sanity

### Next strategic fork (recommended order)

**Recommendation:** Add **light `finalizeLaunch` telemetry and/or explicit publish status in UI** (persist or log failure body; optional **“Retry publish”** calling **`finalizeLaunch` only**) **before** inviting **trusted external artist testers**—reduces “works for me logged in, black screen when logged out” without a diagnosable signal.

**Backlog cue:** e.g. **T-0xx Publish observability** — surface **`finalizeLaunch`** errors; optional retry affordance.

### Scope freeze (until post-checklist planning)

Do **not** prioritize in this slice: tokenomics rework, Artistock↔Artistock execution, LP drain tooling, wholesale legacy cleanup—boundary = **artist rehearsal quality** first.

---

## Part 10: Vault launch ceremony UI (May 2026)

### Purpose

Document the **presentation-only** vault launch experience above the chat strip during onboarding, without duplicating or replacing launch pipeline documentation elsewhere in this file.

### Engine vs UI

- **Engine (unchanged by ceremony work):** `handleSaveArtist` in `app/page.tsx`; `setLaunchProgressStep` only at real async boundaries; celebration delay before redirect is presentation-only (~4.2s); hard navigation remains `window.location.href`.
- **UI:** `app/components/VaultLaunchCeremonyCard.tsx`, focus/dim/frozen chat in `app/page.tsx`, styles in `app/globals.css`, optional `vaultLaunchDimmed` on `app/components/Wallet.tsx`.

### What the user sees (running)

- Dimmed page chrome; bright chat column (`vault-launch-chat-well`, higher z-index over scrim).
- “Launch in progress…”, **Milestone X of 6**, one **current** caption line (not a cumulative transcript list).
- Numbered checklist: prior steps ✓, current step highlighted, rest pending.
- Chat input disabled with “Vault sequence in progress…” while `running` or `celebrating`.

### Captions vs step indices

| Index | Caption theme |
|-------|----------------|
| 0 | Treasure found. |
| 1 | Opening the vault. |
| 2 | Forging {token} Artistocks. (`progressTokenName` from payload) |
| 3 | Placing the first treasure. |
| 4 | Minting the key. |
| 5 | Publishing the portal. |

### Success / failure

- **Success:** Green panel — “Contracts deployed successfully.”, “Entering your page…”, `{token} is live.` — then redirect.
- **Failure:** Card shows stopped step + error; Retry/Dismiss.

### Follow-ups (optional, not scoped here)

- Re-scroll vault into view on Retry if product wants a re-focus when `activeStepIndex` does not return to 0.
- First three step updates are very fast (short sleeps before factory); later steps match long-running work.

### Build note

- Stale `.next` can cause `Cannot find module './8548.js'` (or similar) on `next build`; clean rebuild: `rm -rf .next && npm run build`.

---

## Part 11: Mobile onboarding fix (`feature/mobile-onboarding-fix`) — May 2026

> **Checkpoint date:** 2026-05-24 (updated: Purchase Options panel polish documented). **Do not merge to `main` yet.**

### Branch, gate, and process

| Item | Status |
|------|--------|
| Branch | `feature/mobile-onboarding-fix` (user-managed) |
| Merge | **Not yet** — wait for mobile edit comfort + final iPhone QA |
| Workflow | One surgical step: **plan → approve → implement → build → audit → preview** |
| Git / env | User commits/pushes only; agent does not run git; never touch `.env` |
| `PRD.json` | Off limits for this arc unless user explicitly runs PRD sync workflow |
| Feedback sync | `npm run sync-feedback` failed in agent sandbox (network); **run locally** before PRD-driven work |

**Do not touch during polish:** faucet, factory contracts, Supabase schema, env, launch order, `TreasureInviteShell`, `OrbitPeekCarousel`, **`PurchaseFlow` swap/purchase handlers and confirm logic**. Layout/copy/CSS under **`.purchase-slider-section`** is OK when Jai explicitly approves (presentation only).

---

### Changelog / launch notes (2026-05-24)

**What changed (shipped on branch):**

- Pass 3 mobile onboarding chassis (hero pin, width chain, `portal-panel-chassis`)
- Full test launch path after factory ETH funding + `ArtistDownloadsUUPSABI` fix
- iPhone draft orbit tap fix (`ThemeOrbitRenderer`)
- Toolbar compact row: Wallet (full label) + tiny `+` + tiny ✏️
- Wallet address moved from header into Wallet panel identity card (reveal + Copy)
- Bad Phase 2 scroll-shell / `portal-form-panel` bundle **reverted and cleaned up**
- **Purchase Options panel polish (presentation only):** copy trim; Option A compact spacing; inline FROM/TO; smaller `purchase-panel-title`; `renderPurchaseLivePrice()` between slider and silver bar (display move, not new math); min purchase in footer with wallet hint — `PurchaseFlow.tsx` + scoped `globals.css` (~1319–1400)

**What passed (user-reported QA unless noted):**

- Mobile onboarding chassis on iPhone portrait
- Treasure → claim → wallet → factory → mint → publish end-to-end
- **`green333`** deployed from preview
- Desktop GOSHEESH + safeword `zeyoda` draft orbit loads nested drafts
- iPhone draft orbit taps load drafts (code fix + user QA)
- Toolbar horizontal row on iPhone
- Wallet identity card (collapsed truncate + Copy; expanded full address + Copy)

**Still open:**

1. Mobile profile edit comfort — **no scroll-shell approach**
2. iPhone regression — **buy/confirm**, cash-out, launch path, **public Incognito** `/?artist=slug` (purchase panel layout shipped; handler QA not yet logged)
3. Optional login email in Wallet expanded row
4. Optional purchase polish: slimmer Market active chip or merge status lines (not more 4px margin shaving)
5. Merge `feature/mobile-onboarding-fix` → `main` after QA

---

### Where we started (problem)

**Original pain:** iPhone portrait onboarding was cropped/clipped. Swap panel fit; onboarding did not.

**Diagnosis (code-backed):** Width/chassis bug, not input zoom alone — broken flex width chain, no hero viewport pinning, header wallet stretch, mobile overflow bandaids.

**Earlier passes (1/2):** Safe-area, shorter mobile hero, 16px inputs, Sign out label, hide "+ Create New" on invite, reduced halo inset. Preview still failed on iPhone portrait until Pass 3.

---

### Pass 3 — mobile onboarding chassis (done)

| Deliverable | Proof |
|-------------|-------|
| `app/utils/heroFitBox.ts` | `computeHeroFitBox` + `visualViewport` |
| Hero JS pin | `app/page.tsx` ~667–698, gated `onboarding \|\| upload-asset` |
| Width chain | `page.tsx` `w-full max-w-full min-w-0` on root → main → z-10 |
| `portal-panel-chassis` | `globals.css` ~294+; used in onboarding/edit/chat |
| `overflow-x-hidden` bandaid | Removed (grep: zero matches in repo) |

**User-reported:** Treasure claim, wallet, launch ceremony, form fit on iPhone — chassis pass.

---

### Backend / launch blockers (resolved)

#### 1. Factory ETH (code-proven requirement)

```105:105:contracts/uups/ArtistFactory.sol
        require(address(this).balance >= 0.005 ether, "Insufficient factory ETH balance");
```

Factory needs ≥ **0.005 ETH** per launch (LP seed). Fund `NEXT_PUBLIC_ARTIST_FACTORY` on Base Sepolia (~0.05 ETH recommended).

**User-reported:** Fixed; steps 1–3 passed after funding.

#### 2. Mint ABI (`ArtistDownloadsUUPSABI`)

`app/api/uploadAsset/route.ts` imports `ArtistDownloadsUUPSABI` from `app/utils/abis/` (Hardhat artifact import removed).

**User-reported:** Full launch succeeded; **`green333`** deployed from preview.

---

### P0 — workshop draft orbit tap (done)

**Symptom:** Desktop GOSHEESH + safeword `zeyoda` → draft orbit coins load nested drafts. iPhone: rotation paused, draft did not load.

**Root cause (code):** `ThemeOrbitRenderer` container `touchstart`/`pointerdown` set `suppressClickRef = true` on any `.orbit-token`; draft `onClick` bailed if suppress still true.

**Fix shipped** — `app/components/ThemeOrbitRenderer.tsx`:

- `isDraftCoinTarget` — skip container suppress for `[data-draft-coin]`
- Draft chips load on `pointerup` when movement ≤ 6px (`TAP_MOVE_THRESHOLD_SQ = 36`)
- `touchAction: 'manipulation'` on draft buttons
- Container click capture carve-out for draft targets

**User-reported:** Desktop and iPhone draft taps work.

**Architecture (unchanged):** Gate `showWorkshopDraftOrbit` — admin + onboarding + drafts (`page.tsx` ~1658–1659). Load via `OnboardingPanel.loadTreasureDraftByCoinId` → `/api/invite/admin-draft?coin=...`.

---

### P0 — mobile profile edit (NOT done)

Edit works functionally; mobile UX not polished.

| Issue | Code fact |
|-------|-----------|
| Save at bottom of long panel | `ProfileEditPanel.tsx` ~1028+ — no sticky footer |
| Flat panel restored | No scroll shell (failed Phase 2 reverted) |
| Edit entry | Toolbar ✏️ + chat ✏️; owner gate `treasury_wallet === user` on current URL |
| Color/font grids | Still `w-12 h-12`, full-size — not compacted yet |

**Explicitly rejected approach:** Panel-inside-panel scroll shell, sticky Save, shared `portal-form-panel` compact CSS bundle — tried once, reverted (below). **No scroll-shell approach going forward.**

---

### Failed Phase 2 attempt (reverted — lesson learned)

**What was tried (too much at once):**

- `portal-form-panel` wrappers in `ProfileEditPanel` + `OnboardingPanel`
- `max-height: 100dvh` scroll shell, inner `overflow-y: auto`
- Sticky Save/Cancel footer
- Compact color grids, fonts, shorter previews
- `max-sm:flex-col` on toolbar → made toolbar taller/worse

**User reaction:** Form felt “trapped”; stacked toolbar was wrong.

**Cleanup (completed):** Removed all `portal-form-panel` from TSX + `globals.css`. Restored flat panel structure; Save in normal document flow. Grep confirms: **zero** `portal-form-panel`, `100dvh`, `showFullAddress`, `app-header-wallet-chip` in repo.

**Rule going forward:** One tiny change at a time. **No scroll-shell approach.**

---

### Mobile polish — completed steps (surgical)

#### Step 1 — toolbar compact (done)

**File:** `app/page.tsx` ~3537–3591

| Control | Behavior |
|---------|----------|
| Wallet | `💰 Wallet` / `Close`, blue, full label |
| Create | Tiny `+`, `w-10 h-8`, `title="Create new asset"` |
| Edit | Tiny `✏️`, `w-10 h-8`, `title="Edit artist page"`, hidden when `appMode === 'profile-edit'` |
| Layout | `flex flex-row` on mobile — **no** `max-sm:flex-col` |

**User-reported:** Horizontal row on iPhone — Wallet big, tiny +, tiny ✏️.

#### Step 2 — move address off header (done)

**Removed from `page.tsx`:** `showFullAddress` state, `✅ Connected: 0x...` chip in `app-header`, dead `.app-header-wallet-chip` CSS.

**Header now:** Sign out only when logged in (`app/page.tsx` ~2477–2482).

**Added to `Wallet.tsx`:** Address row under “💰 Your Assets” yellow header.

#### Step 2 refinement — identity card (done)

**File:** `app/components/Wallet.tsx` ~613–668

- **Collapsed:** `✅ Wallet address` + caret `▾`, short address, `📋 Copy` pill
- **Expanded:** Full address (`font-mono break-all`), `📋 Copy` still visible
- **Copy:** `handleCopyAddress` → full address + toast `"Wallet address copied"`
- **Email:** Not added — deferred micro-step (would need `localStorage`, `magic.user.getInfo()`, or new prop)

**User-reported / git:** Step 2 refinement approved; included as done (working tree clean at checkpoint).

---

### Purchase Options panel polish — done (presentation only)

**Scope:** Logged-in purchase panel only (`user && globalSafewordVerified && !purchaseConfirmationData`). **Files:** `app/components/PurchaseFlow.tsx`, `app/globals.css` (rules scoped under **`.purchase-slider-section`** only).

| Pass | What |
|------|------|
| Copy trim | Removed market helper lines, testnet gas line, featured-download USD subtext under checkbox |
| Option A | Compact padding/margins, slider spacing, silver bar padding, CTA spacing — safe but **subtle** |
| Inline FROM/TO | `swap-silver-bar-row--inline` — first **clearly visible** height win (~25–35px on silver bar) |
| Title | `purchase-panel-title` overrides global `.mock-ui-section h3` size in purchase panel only |
| Live price | `renderPurchaseLivePrice()` — **same branches/math**; moved between slider and silver box |
| Min purchase | `$1.00 Minimum Purchase (USD -> Artistocks)` in `purchase-panel-footer` with wallet hint |

**Panel order now:** Purchase Options → slider → live price → FROM/TO → Market active → Include Featured Download → gold CTA → wallet hint · min purchase.

**Do not:** Change global `.swap-silver-bar` (onboarding/profile use stacked labels). Touch swap handlers, purchase handlers, confirm flow, backend, auth, contracts, or price math.

**Open QA:** iPhone buy + confirm after layout churn; cash-out; launch; public Incognito artist page.

---

### Proven working end-to-end

| Stage | Status | Source |
|-------|--------|--------|
| Mobile onboarding chassis | ✅ | User-reported + code |
| Treasure → claim → wallet → factory → mint → publish | ✅ | User-reported (after factory fund + ABI fix) |
| `green333` deployed from preview | ✅ | User-reported |
| Desktop GOSHEESH + `zeyoda` draft orbit | ✅ | User-reported |
| iPhone draft orbit tap | ✅ | Code fix + user-reported |
| Top toolbar compact row | ✅ | Code + user-reported |
| Address inside Wallet panel + identity card | ✅ | Code + user-reported |
| Purchase Options layout/copy polish | ✅ code shipped | iPhone buy/confirm QA **open** |
| Mobile profile edit usability | ❌ open | Code (Save at bottom, full swatches) |
| Merge to `main` | ❌ not yet | Process gate |

---

### Current UI layout (logged in)

```
TOP-LEFT (fixed):  [💰 Wallet] [+] [✏️]     TOP-RIGHT: [Sign out]

Wallet panel (when open):
  ┌─ 💰 Your Assets          [🔄] [✕] ─┐
  ├─ ✅ Wallet address            ▾  ─┤  ← identity card
  │    0xeE69…a0e8      [📋 Copy]    │
  ├─ 📢 Feedback (admin)             ─┤
  └─ assets / balances ...           ─┘

MAIN: hero + onboarding / edit / swap panels (flat, page scroll)
BOTTOM: Chat / Command well (still renders during edit)
```

---

### Files touched across this arc (reference)

| File | Role |
|------|------|
| `app/utils/heroFitBox.ts` | Pass 3 hero dimensions |
| `app/globals.css` | Chassis, mobile inputs, halo; `portal-form-panel` **removed** |
| `app/page.tsx` | Width chain, hero pin, toolbar, header (Sign out only) |
| `app/components/OnboardingPanel.tsx` | Chassis; flat panel restored |
| `app/components/ProfileEditPanel.tsx` | Chassis; flat panel restored |
| `app/components/ThemeOrbitRenderer.tsx` | Draft orbit iPhone tap fix |
| `app/api/uploadAsset/route.ts` | `ArtistDownloadsUUPSABI` |
| `app/components/Wallet.tsx` | Address row + identity card + copy |
| `app/components/PurchaseFlow.tsx` | Purchase panel layout/copy; `renderPurchaseLivePrice()` |
| `app/globals.css` | `.purchase-slider-section` compact + inline FROM/TO (~1319–1400) |

---

### Next work (one step at a time — do not bundle)

| Priority | Task | Scope hint |
|----------|------|------------|
| P0 | Mobile profile edit — Save reachable / comfort | **No scroll shell**; discuss smaller sections or natural page scroll only |
| P0 | Purchase panel — iPhone buy + confirm after layout churn | Same handlers; layout-only changes expected safe |
| Gate | iPhone regression — cash-out, launch, public Incognito `/?artist=slug` | Before merge |
| Optional | Login email in Wallet expanded row | Separate micro-step |
| Optional | Slimmer Market active / merge status line | Scoped `.purchase-slider-section` CSS only if panel still tall |
| P1 | Normal-mode orbit `Link` taps on phone | Same renderer family as draft fix |
| Final | Merge `feature/mobile-onboarding-fix` → `main` | User decision after QA |

---

### Strict rules for next session

- Frontend-only for polish unless user expands scope
- No scroll-shell / sticky Save / `portal-form-panel` unless user explicitly reopens that
- No git commits/pushes by agent
- No `.env`, contracts, factory, faucet, Supabase schema, `PRD.json` (unless user asks)
- Prove facts; ask if unknown
- Surgical: one approved step → build → audit → preview

---

### Next-session handoff (paste block)

```text
Continue feature/mobile-onboarding-fix. Do not merge to main yet.

Done:
- Pass 3 mobile onboarding chassis
- Full launch path (factory fund + ArtistDownloadsUUPSABI)
- green333 deployed from preview
- ThemeOrbitRenderer iPhone draft orbit tap fix
- Reverted bad portal-form-panel scroll-shell Phase 2
- Toolbar: Wallet full + tiny + and ✏️ horizontal row
- Address moved from header to Wallet panel identity card (✅ Wallet address ▾, 📋 Copy, reveal full address)
- Purchase Options panel polish (presentation only): PurchaseFlow.tsx + scoped globals.css (.purchase-slider-section)
  - Copy trim; Option A spacing; inline FROM/TO; smaller purchase-panel-title
  - renderPurchaseLivePrice() between slider and silver box (display move, not new math)
  - Min purchase in footer with wallet hint
  - Do NOT change global .swap-silver-bar; do NOT touch handlers/confirm logic

Open:
- Mobile profile edit comfort (no scroll-shell)
- iPhone regression: buy/confirm, cash-out, launch, public Incognito /?artist=slug
- Optional: Wallet email; slimmer Market active chip (not more 4px shaving)
- Merge after QA

Purchase panel rule: handlers/confirm logic forbidden; approved layout/copy/CSS under .purchase-slider-section OK.

Process: plan → approve → implement → build → audit → preview. No git by agent.
Full detail: SESSION_REPORT_AND_BACKLOG.md Part 11.
```

---

## Part 12: PEMF onboarding hardening pass (May 2026)

### What got proven on testnet

- Treasure claim → **auto-whitelist** is live in production. Every successful `/api/invite/claim` now upserts a `whitelist_emails` row with note `Treasure claim: <coin> (<slug>)`. Verified for `lisa@pemfnashville.com` (pemfcln1) and `rh@greenroadgroup.org` (cruisin9).
- **Auto-fund via `/api/faucet/v2` works after Vercel redeploy** with `FAUCET_ENABLED=true`. Proven by cruisin9: real `wallet_funding` row at `2026-05-25T02:51:09` (status `pending`, `tx hash 0x3dac79fea7…`), wallet ended at `~0.001995 ETH` (≈0.002 from faucet minus forge gas). Lisa's earlier launch required manual funding because the redeploy had not yet been triggered.
- Full launch chain (forge → upload → ERC-1155 master mint → finalize → live page) is repeatable on a clean coin. cruisin9 launched at `2026-05-25T02:51:32`, paused=false, asset #1 minted, public page returns HTTP 200.
- Old PEMF DB rows removed in FK order (artist_earnings → artist_assets → artist_registry → artists). Coins `dcwq275y4zg8`, `nz4z6d3r1364`, `wqcgcab1gwy7` revoked. On-chain contracts left orphaned — expected, can't delete.

### Phase 1 fix (shipped)

- **Bug:** invite `artist_slug` (display-derived) and live `artists.id` (token-derived) can drift. Example: `displayname="Cruisin"` → slug `cruisin`; `tokenName="CRUISIN9"` → id `cruisin9`. After launch, `?coin=` URLs were redirecting via the slug → no matching artist → wizard fallback.
- **Fix files:**
  - `app/api/invite/resolve/route.ts` — when `status === 'launched'`, looks up `artists.id` by mirroring the launch normalization (`tokenName.toUpperCase().replace(/\s+/g,'').toLowerCase()`), with a `treasury_wallet` fallback for legacy rows. Returns optional `launched_artist_id` field.
  - `app/components/TreasureAwareHome.tsx` — launched-status redirect prefers `launched_artist_id ?? artist_slug`.
  - `types/treasure-invite.ts` — `InviteResolveLaunchedRedirectBody.launched_artist_id?: string`.
- Backward compatible: when the lookup fails, the field is omitted and the frontend falls back to `artist_slug` exactly as before.
- Build passes. Pre-existing TS-strict error in `app/components/PurchaseFlow.tsx:1521` (bare `->` in JSX text from prior purchase-panel work) is unrelated and out of scope.

### Phase 2 / 3 (NOT done — explicit decisions for next session)

- **Phase 2:** prevent slug-vs-id drift at draft save. Either enforce `slugFromDisplayName(displayname) === tokenName.toUpperCase().replace(/\s+/g,'').toLowerCase()` at `/api/invite/save-draft`, or move to a single canonical id field. Phase 1 makes drift recoverable; Phase 2 keeps it from happening.
- **Phase 3 — faucet UX hardening, three smallest fixes:**
  - Surface faucet result in claim UI (`app/components/TreasureInviteShell.tsx:426–437`): replace `console.warn` with explicit toasts for `funded:true`, `success`, `403 disabled`, `500 misconfigured`, network errors. Persistent banner if not funded.
  - Pre-flight wallet-balance gate before forge (`app/page.tsx:handleSaveArtist`, before line 1103): read `signer.getBalance()`; if `< 0.0008 ETH`, abort with retry-faucet button instead of letting Magic throw "insufficient funds."
  - Optional admin-only `/api/faucet/health` GET endpoint: returns `{ enabled, hasFaucetKey, hasRpcUrl, signerAddress, balanceEth, chainId }`. Never returns the private key. Permanent ops tool.
- **Move `artist_invites.status = 'launched'` write** from `/api/createArtist:102` to `/api/artist/finalizeLaunch` so partial failures don't lock the invite as launched while the page is paused.
- **Faucet `Not eligible` race** (rare): one `failed_validation` row appeared 50 s before the cruisin9 claim committed. System self-recovered via the second call. Optional one-shot retry-after-500ms in `TreasureInviteShell.tsx` would eliminate the zombie row class.

### Operator rule still binding

For inner-circle drafts: `displayname` and `tokenName` should resolve to the same lowercase string after `.toUpperCase().replace(/\s+/g,'').toLowerCase()`. ≤8 alphanumeric, no spaces, no hyphens. Phase 1 makes drift recoverable; this rule keeps it from happening in the first place.

### Files changed in this pass

- `app/api/invite/resolve/route.ts` (Phase 1)
- `app/components/TreasureAwareHome.tsx` (Phase 1)
- `types/treasure-invite.ts` (Phase 1)
- `AGENT_NOTES.md` (memory update — Current Truths refresh, Gotcha clarification)
- `SESSION_REPORT_AND_BACKLOG.md` (this Part 12)

PRD.json deliberately untouched. Faucet UX hardening tracked in this Part and in `AGENT_NOTES.md` "Open onboarding risks"; if/when this becomes a formal backlog item, it would be `T-024 — Faucet UX visibility & pre-flight wallet gate`.

---

## Part 13: Client stability pass — diagnosed, deferred (May 2026)

**Finding:** Stability refactor was half-done. Auto-refresh disabled in `useArtistConfig` and `useWalletBalances` (comments cite "prevent page remounts"); hard reloads and full-screen loading gates in `LiveArtistPortal` were left as workarounds.

**Symptom:** Operator wallet/ops work feels unstable — repeated "Connecting wallet…" (hard reload → Magic re-init) and "Loading artist profile…" (`coreLoading` unmounts page + wallet on config refetch).

**Proven infra gaps (do not one-line fix):**
- `refreshWalletBalances` event dispatched from `PurchaseFlow` but **no listener** in repo.
- `useAllArtistsDownloadAccess` (Wallet downloads panel) has **no refresh API**.
- Login reload is **load-bearing**: `MagicProvider` init runs once; login handler does not update context `user` without reload.

**Bundles (post–Mister Guy; one at a time):**
- **Bundle A:** Remove `PurchaseFlow.tsx` reloads (~513, ~875); wire wallet-wide downloads refresh. Do not touch swap/sign handlers.
- **Bundle B:** `isInitialLoading` vs `isRefreshing` in `useArtistConfig`; stale-while-revalidate in `LiveArtistPortal`; cached wallet artist switch. Must bundle gate change with cached artist swap.

**Deferred:** Login/logout reload removal (MagicProvider redesign); optimistic Magic / whitelist fail-open (policy).

**Gate:** After Mister Guy launch + Phase B unless purchase reloads block rehearsal. Full detail: `AGENT_NOTES.md` → "Client stability pass — HALF DONE, deferred post–Mister Guy."

**Evidence session:** Cursor audit May 2026 (post–readiness-gate rehearsal).
