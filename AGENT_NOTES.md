# Agent Notes — Zeyoda

> Quick reference for AI agents. For full architecture, see `ZEYODA_KNOWLEDGE_BASE.md`.

---

## Project

**Zeyoda** = Artistocks Protocol. Next.js Web3 platform for artists to sell tokens and downloads. Protocol custody model.

**ArtisTalks** = Onboarding tool (separate app). Artists create art there, then list on Zeyoda.

---

## Constraints (Never Violate)

- **Never** read or modify `.env` or `.env.local`
- **Never** run git commands — user manages version control
- **Propose a plan** before non-trivial edits

---

## Key Files

| File | Purpose |
|------|---------|
| `ZEYODA_KNOWLEDGE_BASE.md` | Full architecture, auth, flows |
| `PRD.json` | Backlog items, priorities, status |
| `SESSION_REPORT_AND_BACKLOG.md` | Session history, ticket list |
| `PLAN_FEEDBACK_PRD_SYNC.md` | Feedback→PRD sync system design |

---

## Feedback → PRD Flow

1. Gosheesh submits feedback via 🎤→📢 in app → saved to `feedback` table (`source: admin`, `status: open`)
2. Run `npm run sync-feedback` → script pulls open admin feedback, adds to PRD.json, marks feedback `in_progress`
3. PRD.json is source of truth for backlog

---

## Conventions

- API errors: `{ error, message }` with 401/403/500
- Event names: `profilePreview`, `profilePreviewClear`, `primaryColorChange`, `logoPreviewChange`
- Protected API calls use `authenticatedFetch` with `getDidToken`

---

## Gotchas

- **PGRST116** — Supabase "no rows" is not an error
- **BigInt** — ethers v6 uses `0n`; check `balance > 0n`
- **Base Sepolia** — chainId 84532
- **fundWallet** — DISABLED; do not re-enable until SEC-001
