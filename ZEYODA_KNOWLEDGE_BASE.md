# Zeyoda Knowledge Base

> AI agent context for architecture, auth, contract behavior, and system truths.

---

## Project Overview

**Zeyoda** is the layer, portal, and community hub.

**ARTISTOCKS** is the issuer and steward inside that ecosystem. It launches the digital assets, handles the swap mechanics, and protects artists from carrying too much risk too early.

This repo is currently a **private testnet rehearsal** on Base Sepolia.

It is being used to:
- refine launch economics
- improve the onboarding experience
- test the fan journey
- prepare for a later clean public fork with new keys and cleaner assumptions

**Tech stack:** Next.js 15, TypeScript, Tailwind, Magic.link, Supabase, Base Sepolia, Solidity

---

## ArtisTalks Relationship

**ArtisTalks** is separate:
- separate login
- separate codebase
- separate website
- more public-facing

ArtisTalks is the education and onboarding path for artists preparing to release responsibly.
It is not this app.

There are still shared ideas and patterns between the two codebases, especially around:
- theme handling
- previews
- artist guidance
- onboarding language

---

## Current Economic Reality

Current testnet launch economics appear to be:
- total supply = `10B`
- `1B` to the artist
- `100M` for LP seeding
- `8.9B` in reserve
- LP paired with roughly `0.01 ETH`

Important correction:
- `100M` out of `10B` is **1%**, not 10%

The practical result is a shallow opening market.

The launch problem is not just token allocation. It is:
- token-side reserve depth
- ETH-side reserve depth
- constant-product AMM behavior together

The likely next model to assess is:
- `1B` artist
- `1B` LP
- `8B` reserve vault

---

## Stewardship And Sovereignty

The reserve should be thought of as a **reserve vault under stewardship**.

Purpose:
- keep some supply protected for later
- let the protocol support the artist at launch
- create a path to later sovereignty and handoff

The reserve is not meant to be:
- random hidden future supply
- an unclear dilution bucket
- a casual intervention tool

Long-term direction:
- protocol stewards first
- artist can inherit more later
- fee control, reserve control, and ownership can be handed off when the artist is ready

Because the contracts are UUPS proxy upgradeable, mechanics can improve over time.
Promises should not casually change under people.

Best principle:
**upgradeable mechanics, not casually changeable promises**

---

## Architecture

### Main Structure

```text
app/
  api/           protected and public routes
  components/    wallet, chat, purchase flow, onboarding
  contexts/      artist registry context
  hooks/         balances, config, download access
  utils/         auth, registry, swap helpers, guards
contracts/       token, AMM, downloads
deploy/          deployment and seeding scripts
middleware.ts    token / internal-secret gate
```

### Important Modules

| Module | Purpose |
|--------|---------|
| `middleware.ts` | Protects `/api/*`; allows public health/whitelist/registry routes |
| `app/utils/server/whitelistCheck.ts` | Verifies Magic DID token and whitelist access |
| `app/utils/authenticatedFetch.ts` | Adds Bearer token to protected requests |
| `app/utils/server/artistRegistry.ts` | Reads artist contract addresses with cache |
| `app/hooks/useArtistConfig.ts` | Artist config, live LP pricing, and fallback pricing |
| `app/hooks/useDownloadAccess.ts` | Checks ERC-1155 ownership for download access |

---

## Auth And Access

### Magic Flow

1. Fan or artist enters email
2. `checkWhitelist` decides whether they may continue
3. Magic login returns a DID token
4. Protected requests use `authenticatedFetch`
5. Middleware checks token presence
6. Route handlers call `verifyWhitelist()` for full validation

### Whitelist

- table: `whitelist_emails`
- protected routes require verified whitelist status
- login attempts are recorded in `login_attempts`

### Public Routes

- `/api/_health`
- `/api/checkWhitelist`
- `GET /api/registry`

### Internal Proxy Pattern

- `/api/public/*` routes verify the caller
- then forward internally using `x-internal-secret`
- internal route trusts the forwarded verified context

---

## Swap And Pricing

### AMM Shape

The AMM uses a constant-product curve with a `0.3%` fee.

Practical meaning:
- price depends on both token reserve and ETH reserve
- shallow reserves cause violent price movement
- Base is cheap, not free

### Pricing Flow

- if LP exists, the app reads `getReserves()` and shows live pricing
- if LP does not exist, the app falls back to stored price data
- live pricing refreshes on an interval

---

## Downloads And Purchases

### Download Access

- ERC-1155 ownership gates download access
- `useDownloadAccess()` checks balances
- registry supplies the download contract per artist

### Purchase Flow

- purchase routes are protected
- public proxy routes forward verified requests internally
- purchases are tracked in Supabase

---

## Feedback And Backlog

Feedback flow is intended to work like this:
- fans and artists send feedback through the chat
- feedback lands in Supabase
- `npm run sync-feedback` pulls it into `PRD.json`
- PRD items can also be reflected back into the wallet inbox

The long-term goal is a living loop:
- community signal
- PRD item
- implementation
- reflected back into the experience

---

## Onboarding Direction

The current bottleneck is the onboarding experience.

For the first inner-circle artist cohort, the preferred experience is:
- pre-curated portal
- artist arrives to something that already feels alive
- artist fine tunes after the reveal

This is stronger than leading with a blank self-serve form in the early cohort.

Chat remains the command center:
- safewords reveal tools
- revealed tools can still appear as visual panels
- the artist should feel guided, not buried in menus

---

## Conventions

- Never read or modify `.env`
- Never run git commands unless explicitly asked
- Propose a plan before non-trivial edits
- API errors return `{ error, message }`
- Event names: `profilePreview`, `profilePreviewClear`, `primaryColorChange`, `logoPreviewChange`

---

## Known Gotchas

1. `PGRST116` is not a real failure for "no rows"
2. ethers v6 uses `0n` for BigInt zero
3. Base Sepolia chain ID is `84532`
4. Base gas is low, not free
5. `fundWallet` is currently disabled and must be re-enabled deliberately with guardrails

---

## References

- `VOICE_AND_VISION.md`
- `LAUNCH_ROADMAP.md`
- `TOKENOMICS_AND_STEWARDSHIP.md`
- `PRD.json`
- `SESSION_REPORT_AND_BACKLOG.md`
