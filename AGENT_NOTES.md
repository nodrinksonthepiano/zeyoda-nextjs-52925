# Agent Notes — Zeyoda

> Quick reference for AI agents. Read `VOICE_AND_VISION.md` first. For full system detail, see `ZEYODA_KNOWLEDGE_BASE.md`.

---

## Project

**Zeyoda** is the layer, the portal, and the community hub.

**ARTISTOCKS** is the responsible issuer and steward inside that ecosystem.

**ArtisTalks** is separate:
- separate login
- separate codebase
- separate website
- more public-facing
- education and onboarding path for artists preparing to release responsibly

This repo is currently the **private testnet rehearsal space**, not the final public-ready birth of the system.

---

## Constraints (Never Violate)

- **Never** read or modify `.env` or `.env.local`
- **Never** run git commands — user manages version control
- **Propose a plan** before non-trivial edits

---

## Key Files

| File | Purpose |
|------|---------|
| `VOICE_AND_VISION.md` | Source of truth for tone, language, intent |
| `LAUNCH_ROADMAP.md` | Current phase, sequencing, and next steps |
| `TOKENOMICS_AND_STEWARDSHIP.md` | Launch economics, reserve vault logic, sovereignty handoff |
| `ZEYODA_KNOWLEDGE_BASE.md` | Architecture, auth, contracts, flows |
| `PRD.json` | Active backlog and priorities |
| `SESSION_REPORT_AND_BACKLOG.md` | Session history, strategic decisions, ticket context |
| `PLAN_FEEDBACK_PRD_SYNC.md` | Feedback → PRD sync design |
| `PLAN_REVERSE_SYNC.md` | PRD → feedback reverse sync design |

---

## Current Truths

- **Integration (Jun 2026):** `feature/mobile-onboarding-fix` merging `origin/main` — B2 audio/cover + auth gates combined with main launch-safety (coin-scoped whitelist, `finalizeLaunch` invite flip, `waitForLivePageReady`). Full arcs: **`SESSION_REPORT_AND_BACKLOG.md` Part 11–15**.
- **Mobile onboarding (shipped):** Pass 3 chassis; full launch after factory fund + `ArtistDownloadsUUPSABI`; iPhone draft orbit taps; toolbar Wallet + tiny `+` + ✏️; address in Wallet identity card (reveal + Copy). **`green333`** from preview (user-reported).
- **Display name self-serve (shipped May 2026):** Preview `c28ed3df`, main **`c18cc7a6`** — live preview display name edits via Profile Edit. PATCHes **`artists.displayname` only** (max **64** chars). Does **not** touch `tokenName`, `artists.id`, contracts, or coin.
- **Onboarding pillars proven on testnet (May 2026):** treasure draft → claim → **auto-whitelist** (`/api/invite/claim` upserts `whitelist_emails`) → **auto-fund** (`FAUCET_ENABLED=true`; cruisin9 / `rh@greenroadgroup.org` proof) → forge → asset upload → ERC-1155 master mint → `finalizeLaunch` → public live page.
- **Slug-vs-ID rule (operator + system):** invite `artist_slug` is display-derived; live `artists.id` is token-derived. **Phase 1 fix shipped:** `/api/invite/resolve` returns optional `launched_artist_id`; `TreasureAwareHome` redirects to `launched_artist_id ?? artist_slug`.
- **Launch timing (main, integrated):** `artist_invites.status = 'launched'` only in **`finalizeLaunch`** after integrity checks — not in `createArtist`. Post-launch session still needs **`checkWhitelist`** launched-owner bypass (`4200d7b1`).
- **B2 treasure launch + Johnny gate (Jun 2026, preview proof):** Self-serve path = reserved email claims coin → launches → **stays logged in** without manual `whitelist_emails`. **Proof artist:** **`l55555a`** (coin `5xdbzgy17ck5`, claim **`lt4@greenroadgroup.org`**, **not** in `whitelist_emails`). Session gate confirmed: reload + logout + re-login → no “rare treasure”. **Ignore `l4444a`** — stale partial run (paused, no asset/mint).
- **Audio + cover (shipped on feature arc):** D1 add-asset, D2 normal launch, B2 treasure/admin draft — MP3 + cover via direct Supabase upload; admin draft keeps cover separate from featured MP3; hero preview mirrors HTTPS audio+cover drafts.
- **Launch auth gates (Jun 2026):** **Steps 4–5:** `public/uploadFeatured` + `uploadAsset` → `assertMagicArtistUploader`. **Post-launch session:** `checkWhitelist` allows coin-scoped draft/claimed **and** launched owners by normalized `claimed_by_email`. **Do not** manually whitelist disposable test emails to hide gaps.
- **Open follow-ups (not merge blockers):** file-path launch proxies `asset-upload/prepare|finalize` still bare `verifyWhitelist`; P1 post-launch UX (BurialWizard flash, `appMode`/sessionStorage); `l4444a` cleanup; faucet failures still weak in UI; no pre-flight wallet-balance gate before forge; document Brave/ad-block breaking Supabase signed uploads.
- **Key preview commits (treasure arc):** `66325d0d` B2 audio+cover drafts · `3aa247ae` hero preview · `ab8e3fe1` claimed launch upload auth · **`4200d7b1`** launched owners whitelisted · plus `cd744029` / `1e2085bd` / `f27533ff` asset upload paths · `28bc30af` cover upload separation.
- **Purchase Options panel (May 2026, presentation only):** `PurchaseFlow.tsx` + scoped `globals.css` under **`.purchase-slider-section`** — copy trim; Option A compact spacing; inline FROM/TO; smaller `purchase-panel-title`; live price between slider and silver bar via **`renderPurchaseLivePrice()`** (display move, not new price math); `$1.00 Minimum Purchase` in footer with wallet hint. **No** swap handlers, purchase handlers, confirm flow, backend, auth, contracts, or price math changed.
- **Purchase panel rule:** Do **not** change global **`.swap-silver-bar`** for purchase tweaks — onboarding/profile share it. **Do not** touch `PurchaseFlow` handlers or confirm logic. Layout/copy/CSS under `.purchase-slider-section` is OK when Jai explicitly approves.
- **Purchase panel lessons:** Option A margin-only compaction was subtle; inline FROM/TO + info reorder (price up, min down) were the visible wins. Optional next: slimmer Market active chip or merge status lines — not more random 4px margin shaving.
- **Rejected (do not retry without explicit ask):** `portal-form-panel` / scroll-shell / sticky Save Phase 2 — reverted; grep-clean. **No scroll-shell for profile edit.**
- **Open on `main` (live testnet QA):** mobile UI/purchase/onboarding polish is shipped to `main`; ongoing live-site QA covers buy/confirm, cash-out, launch, public Incognito `/?artist=slug`, mobile profile edit comfort (no scroll-shell), purchase handler regressions, and optional Wallet email row. **No longer an unmerged-branch gate** — these are live-site issues to resolve in place.
- **Process:** one surgical step — plan → approve → implement → build → audit → preview. Run **`npm run sync-feedback` locally** before PRD-driven work (sandbox fetch may fail).
- **MVP testnet spine (May 2026):** Normal launch + nested/treasure launch + **public Incognito** page + buy + cash-out + optional download after cash-out are the rehearsal bar. Phase = **pre–artist-testing hardening**, not “prove the stack runs.” **Do not** expand into tokenomics, token-to-token, LP drains, or legacy cleanup in the same breath as first external artist invites.
- **Public launch ≠ owner session:** `LiveArtistPortal` black screen when `artists.paused === true` and user is not treasury. **Always** verify `/?artist=slug` **logged out / Incognito** before calling a page “live.”
- **Publish gate:** `createArtist` sets `paused: true`; `POST /api/artist/finalizeLaunch` flips `false` after integrity checks. Manual `paused` edits are a valid testnet escape hatch but bypass automated proof.
- **Featured hero file upload:** Do not use browser `supabase.storage` (anon) for `artist-assets` on launch—RLS blocks. Use **`/api/uploadFeaturedFile`** + bootstrap row in `page.tsx` (see `SESSION_REPORT_AND_BACKLOG.md` Part 9).
- **Next product decision:** Prefer **light finalize/publish telemetry or “Retry publish” UI** before scaling artist testers (recommended in Part 9).

- This repo is for rehearsal and refinement on Base Sepolia
- Inner-circle artists may be onboarded here for testing before a clean public fork
- Current LP issue is based on `100M` LP seed out of `10B` total supply, which is **1%**, not 10%
- The likely next launch model to assess is `1B artist / 1B LP / 8B reserve vault`
- The reserve vault is part of the stewardship-to-sovereignty path
- The onboarding experience is the current bottleneck
- For the first artist cohort, prefer pre-curated onboarding over blank-canvas-first
- The chat is the command center and reveal mechanism
- Feedback should flow from fans and artists to GOSHEESH

---

## Artist naming — three layers (May 2026)

Three fields; do not conflate:

| Layer | Field | Role | Change policy |
|-------|-------|------|---------------|
| **Display / profile name** | `artists.displayname` | Top page title, human-facing brand | **Self-serve** via Profile Edit (shipped `c18cc7a6`). Max **64** chars. Live preview while typing; persist on Save only. |
| **Token ticker** | `artists.tokenName` + on-chain symbol | Swap UI, forge ceremony, market labels | **Not self-serve today.** On-chain symbol effectively immutable without UUPS/protocol-safe upgrade (factory owns token). Future rename epic required. |
| **Canonical identity** | `artists.id` | URLs (`/?artist=`), FKs (assets, purchases, earnings, feedback, registry), coin resolve target | **Do not casually change.** |

**Slug vs ID (unchanged):** invite `artist_slug` is display-derived at draft; live `artists.id` is token-derived at launch. Phase 1 coin resolve (`launched_artist_id`) makes drift recoverable for NFC retap.

**Future token ticker policy (not shipped):**
- Max ticker length going forward: **12 characters** (onboarding UI still enforces 8 until updated).
- Old tickers must be **reserved/redirected forever** to the original artist.
- Original owner retains prior ticker **aliases**; aliases resolve to canonical `artists.id`.
- DB `tokenName` updates only **after** on-chain rename succeeds.
- NFC/coin stable via `coin_public_id`; display name and ticker changes should not require reprogramming.

**Pass 1 shipped:** display name edit with live preview. **Pass 2–4 deferred:** ticker alias table, redirect/resolve, UUPS symbol change, onboarding 12-char alignment.

---

## Client stability pass — HALF DONE, deferred post–Mister Guy (May 2026)

**Status:** Diagnosed and scoped; **not shipped.** Mister Guy display-name feedback **shipped** in **`c18cc7a6`** (Pass 1); stability bundles (A/B) remain deferred. Prior stability work was started then abandoned: auto-refresh intervals were **disabled** in `useArtistConfig` and `useWalletBalances` (comments: "prevent page remounts") but full-screen loading gates and `window.location.reload()` workarounds remain.

**Symptom:** App feels unstable during wallet/ops work — "Connecting wallet…" and "Loading artist profile…" repeat. Wallet connects once; the **page around it unmounts** on refetch or hard reload.

**Two mechanisms (do not conflate):**
1. **Hard reloads** → Magic re-init → "Connecting wallet…" (`MagicProvider` blocks until `isReady`).
2. **Full-screen gates** → no document reload, but `LiveArtistPortal` unmounts entire tree including Wallet when `coreLoading` (`app/page.tsx` ~3707–3743).

**Proven reload call sites (do not delete blindly):**

| Location | Trigger |
|----------|---------|
| `PurchaseFlow.tsx` ~513, ~875 | Download / swap success (8s delay) |
| `page.tsx` ~2334 | Login success (2s) |
| `page.tsx` ~2097 | Logout (1s) |
| `page.tsx` ~1518 | Asset edit save (500ms) |
| `TreasureInviteShell.tsx` ~302, ~370 | Treasure login / sign-out |
| `page.tsx` ~1017 | Post-launch enter live page (`location.href` — intentional, has readiness poll) |

**Critical infra facts for implementers:**
- `refreshWalletBalances` is **dispatched** from `PurchaseFlow` but has **no listener** anywhere. Reload compensates for missing wiring.
- `transactionSuccess` → `useWalletBalances` refresh (2s delay) **does** work.
- `refreshDownloadAccess()` in PurchaseFlow **does** work for per-artist access.
- `useAllArtistsDownloadAccess` (Wallet downloads panel) has **no refresh API** — only refetches on `userAddress` / `allArtistsConfig` change.
- Login reload is **required today**: `MagicProvider` init runs once in `useEffect([])`; login handler does not update context `user` without reload.
- `useArtistConfig` sets `isLoading=true` on **every** `fetchConfig` (not just first load) → wallet artist `router.push` blanks full page.

**Launch path vs operator pain:**
- **Mister Guy / first-boop:** claim, login reload, post-launch `location.href` — purchase reloads usually **not** on path unless artist buys during session.
- **Operator rehearsal:** purchase 8s reload + wallet artist navigation blanking are the main annoyances.

**Approved bundles (one at a time; audit each):**

**Bundle A — PurchaseFlow reload stability (post-Mister-Guy priority 1)**
- Files: `PurchaseFlow.tsx`; `useDownloadAccess.ts` and/or minimal Wallet wiring.
- Remove `window.location.reload()` at ~513 and ~875 only.
- Replace with: existing `transactionSuccess`, `refreshDownloadAccess()`, + **add** wallet-wide downloads refresh trigger for `useAllArtistsDownloadAccess`.
- Do **not** touch swap/sign/confirm/mint handlers.
- Manual test: swap, download-only, cash-out+download — balances and download rows update without reload.

**Bundle B — Mount once / navigation (post-Mister-Guy priority 2)**
- Files: `useArtistConfig.ts`, `useFeaturedAsset.ts`, `page.tsx` (`LiveArtistPortal`), possibly `TreasureAwareHome.tsx`.
- Split `isInitialLoading` vs `isRefreshing`; gate only on initial.
- On `?artist=` change: use cached `allArtistsConfig[artistId]` immediately, refresh in background.
- **Do not** do LiveArtistPortal gate-only change without cached artist swap (wrong-artist flash risk).

**Deferred (not launch-night):**
- Login/logout reload removal → requires `MagicProvider` post-login session propagation.
- Optimistic Magic + whitelist fail-open → security/policy decision.
- Asset-edit reload → `useArtistAssets.refresh()` + event (lower priority).

**Decision tree:**
- Instability **blocking** rehearsal → Bundle A only, then rehearse.
- Annoying but rehearsable → defer; run rehearsal → Phase B → Mister Guy → then Bundle A → Bundle B.
- **Never:** one-line reload delete; Pass 3 without 4/5; login reload removal without MagicProvider.

**Product rule when done:** Mount once. Refresh in place. Hard reload almost never. Full-screen gates only on true first load or intentional account change.

**Related shipped launch fixes (same week, separate layer):** Phase A faucet visibility, hollow-launch rule, post-launch readiness poll (`waitForLivePageReady` in `app/page.tsx`). See vault ceremony section below for redirect behavior.

**Tests:** No automated coverage for auth/purchase refresh paths — manual preview QA only (`tests/` has orbit/swap engine only).

---

## Feedback ↔ PRD Flow

1. App feedback goes to Supabase
2. `npm run sync-feedback` pulls feedback into `PRD.json`
3. Reverse sync can also place PRD items back into the wallet inbox
4. Wallet inbox and PRD should stay aligned over time

---

## Conventions

- API errors: `{ error, message }` with 401/403/500
- Event names: `profilePreview`, `profilePreviewClear`, `primaryColorChange`, `logoPreviewChange`
- Protected API calls use `authenticatedFetch` with `getDidToken`

---

## Auth hardening rules (Pass 1–2)

**Middleware vs routes** — `middleware.ts` only ensures a Bearer token or internal secret is *present* on `/api/*`. It does **not** validate the Magic DID. Handlers must call `getMagicAuthFromBearer` / shared helpers so **Magic is the source of truth**. **`x-wallet-address` is advisory only** (possible `console.warn` if it disagrees with Magic `publicAddress`); it must **not** be used to authorize.

**Two helpers (do not conflate):**

| Helper | Use for | Allows | Disallows |
|--------|---------|--------|-----------|
| `assertMagicArtistUploader` | Art / content / presentation | Treasury `publicAddress`, finalize-style **invite** match, **`whitelist_emails.role === 'admin'`** (with `console.warn` admin bypass) | — |
| `assertMagicTreasuryArtist` | Money / value movement | **Only** `Magic.publicAddress === artists.treasury_wallet` | Admin bypass, invite shortcut |

**Governance line:** Admin may help artists with **presentation**; only the **treasury’s Magic wallet** may perform **withdraw / economic** actions covered by `assertMagicTreasuryArtist`.

**Routes using `assertMagicArtistUploader` (representative):**

- `app/api/uploadFeaturedFile/route.ts`
- `app/api/uploadLogo/route.ts`, `app/api/uploadBackground/route.ts`
- `app/api/uploadAsset/route.ts` — internal; with `app/api/public/uploadAsset/route.ts` forwarding **`Authorization`** and internal binding of Bearer identity to **`x-verified-email`**
- `app/api/deleteLogo/route.ts`, `app/api/deleteBackground/route.ts`
- `app/api/artist/profile/route.ts` — **PATCH body keys are allowlisted only** (`artistId`, `displayname`, theme / logo / background / `videosrc` fields). `displayname`: trim, 1–64 chars. Any other key (e.g. `tokenName`, `id`, `treasury_wallet`, `paused`, contract or payout-shaped fields) → **400** + `disallowedKeys`

**Session gate (distinct from upload auth):** `POST /api/checkWhitelist` — treasure bypass for invite `draft` / `claimed` / **`launched`** (normalized `claimed_by_email` or reserved email). Not the same as `verifyWhitelist()` or `assertMagicArtistUploader` (which also checks treasury wallet on writes).

**Routes using `assertMagicTreasuryArtist`:**

- `app/api/lp/withdraw/route.ts` — internal: `requireSecret`, **`x-verified-email`**, Bearer identity match, **`assertMagicTreasuryArtist`**; truth-path **Artist Cashout** calls **`withdrawArtistCashoutEth`** on shared UupsAMM — **`SERVER_AMM_OWNER_PRIVATE_KEY`** (else **`MINTER_PRIVATE_KEY`**) must be **AMM `owner`**; **no** synthetic tx hash; **no** `cash_balances` / `artist_earnings` credits for this path
- `app/api/public/lpWithdraw/route.ts` — must forward **`Authorization`** (same idea as `public/uploadAsset`)
- `app/api/artist/withdraw/route.ts`

**Regression to avoid:** Clients that call `public/uploadAsset` or `public/lpWithdraw` without **`authenticatedFetch`/Bearer` will fail internal Magic checks.

**Not done in Pass 1–2 (next passes / backlog):**

- Publish observability / **Retry publish** for `finalizeLaunch` vs `paused` (before many external artist testers)
- Server-side gate on **`GET /api/treasury-earnings`** (PRD **T-006**) before widening testers
- Audit any other mutators still trusting headers alone if they appear in grep
- Optionally split this section into `HARDENING_AND_AUTH.md` if it grows large

---

## Vault launch ceremony UI (May 2026)

**Engine (do not reorder casually):** `handleSaveArtist` in `app/page.tsx` drives launch; `setLaunchProgressStep(n)` runs only at real `await` boundaries (factory, uploads, publish, `finalizeLaunch`). Treat chain calls, Supabase, upload routes, auth, and redirect as product/security surface area.

**UX-only layer:** `VaultLaunchCeremonyCard.tsx`, dimming + frozen chat + scrim/`inert` in `app/page.tsx`, `globals.css` (`.vault-launch-*`, `vault-launch-chat-well`), optional `Wallet` dim via `vaultLaunchDimmed`.

**Card behavior:** No GOSHEESH branding on the card; no dial. **Running:** “Launch in progress…”, **Milestone X of 6**, a **single caption** for the current `activeStepIndex` (one milestone at a time), plus the six-step checklist (done / active / pending). **Success:** “Contracts deployed successfully.”, “Entering your page…”, token live; **readiness poll** via `waitForLivePageReady` (Supabase `paused === false` + registry entry), then **`window.location.href`**; on timeout stay on celebrate UI with “Try entering again” retry (no redirect to wizard). **Failure:** Retry/Dismiss unchanged.

**Caption index map (aligned with `setLaunchProgressStep`):** 0 treasure → 1 opening vault → 2 forging (uses `progressTokenName`) → 3 placing treasure → 4 minting key → 5 publishing portal.

**Focus mode (`vaultLaunchFocusActive`):** Scrim over chrome; `inert` on content above chat; hero/particles/header/top-left controls dimmed; chat column raised. Chat **frozen** for `running` or `celebrating` with placeholder “Vault sequence in progress…”

**Scroll:** `vaultLaunchCeremonyRef` scrolls into view when `visible && running && activeStepIndex === 0` (Retry may not re-scroll if index never returns to 0 — edge case).

**Build:** If `next build` fails on missing `.next` chunk (e.g. `8548.js`), try `rm -rf .next && npm run build`.

---

## Gotchas

- **Launch Storage RLS** — direct client upload to `artist-assets` can throw `new row violates row-level security policy`; server routes use service role.
- **PGRST116** — Supabase "no rows" is not an error
- **BigInt** — ethers v6 uses `0n`; check `balance > 0n`
- **Base Sepolia** — chainId `84532`
- **Base gas** — cheap, not free
- **Faucet split:** legacy `/api/fundWallet` stays disabled (returns 403). Active faucet is `/api/faucet/v2`, gated by `FAUCET_ENABLED=true`, `TESTNET_FAUCET_KEY_V2`, `SERVER_BASE_SEPOLIA_RPC_URL` on Vercel. **Vercel env changes require a redeploy** — old deployments keep serving the old values until promoted.
