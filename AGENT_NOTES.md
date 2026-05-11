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
- `app/api/artist/profile/route.ts` — **PATCH body keys are allowlisted only** (`artistId` + theme / logo / background / `videosrc` fields). Any other key (e.g. `treasury_wallet`, `paused`, contract or payout-shaped fields) → **400** + `disallowedKeys`

**Routes using `assertMagicTreasuryArtist`:**

- `app/api/lp/withdraw/route.ts` — internal: `requireSecret`, required **`x-verified-email`**, Bearer identity must match verified email, then treasury check
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

**Card behavior:** No GOSHEESH branding on the card; no dial. **Running:** “Launch in progress…”, **Milestone X of 6**, a **single caption** for the current `activeStepIndex` (one milestone at a time), plus the six-step checklist (done / active / pending). **Success:** “Contracts deployed successfully.”, “Entering your page…”, token live; **`window.location.href`** after ~**4.2s** sleep. **Failure:** Retry/Dismiss unchanged.

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
- **fundWallet** — disabled until deliberately re-enabled with guardrails
