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

## Gotchas

- **PGRST116** — Supabase "no rows" is not an error
- **BigInt** — ethers v6 uses `0n`; check `balance > 0n`
- **Base Sepolia** — chainId `84532`
- **Base gas** — cheap, not free
- **fundWallet** — disabled until deliberately re-enabled with guardrails
