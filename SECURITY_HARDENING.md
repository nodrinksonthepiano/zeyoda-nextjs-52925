# Security Hardening Backlog

Known live risks and infrastructure gaps. Faucet V2 addresses the old `fundWallet` class of vulnerability; routes below remain open until a dedicated hardening pass.

## Faucet V2 (implemented)

| Item | Status |
|------|--------|
| `/api/fundWallet` | Permanently **403** — dangerous implementation removed |
| `/api/faucet/v2` | Replacement — kill switch `FAUCET_ENABLED`, dedicated `TESTNET_FAUCET_KEY_V2` |
| Pre-send chain guard | `requireFreshBaseSepolia` via raw `eth_chainId` RPC (bypasses ethers cache); `ChainGuardError` for typed detection |
| Pending tx reconciliation | Rows logged as `status='pending'`; manual SQL update to `success` or `failed_confirmation` for 1.0 |
| DB failure after broadcast | Retries pending insert 3×; fallback `db_failure_after_broadcast` alert + structured JSON `console.error` |
| Active row uniqueness | Partial unique index `wallet_funding_active_unique` on `wallet_address` where `status IN ('success', 'pending')` |

**Rollback:** Set `FAUCET_ENABLED=false` → confirm `/api/fundWallet` still 403 → pause invite testing → inspect `wallet_funding` and `faucet_alerts` → monitor minter/sponsor balance.

## Known Limitations (post-rehearsal cleanup)

- **Email rate limit shares IP bucket:** `apiGuard.rateLimit` keys by IP and prefixes with the supplied key, so per-email rate limiting only works within a single IP. Does not add protection against IP-rotating attackers. Acceptable for inner-circle testnet; revisit with DB-backed rate limiting before broader cohort.

- **`wallet_address='unknown'` placeholder:** Used in early-failure rows when auth is missing a wallet. Consider making `wallet_address` nullable in `wallet_funding` post-rehearsal so failure rows can use `NULL` instead of the string literal.

- **`guardExistingWallet` on other routes:** Uses cached `getNetwork()` — redundant but not under-protected. Migrate other signing routes to `requireFreshBaseSepolia` before broader cohort.

- **Concurrent login race:** Duplicate check + pending insert is not atomic. In rare cases of simultaneous login firings (double-click, Magic callback retry), two broadcasts can occur before either DB row is written. The `wallet_funding_active_unique` index blocks a second `pending`/`success` insert but cannot undo a tx already broadcast. Rate limits cap practical exposure. **Post-rehearsal:** true idempotency — insert `pending` row before broadcast, then update with `tx_hash` after.

- **Faucet polish backlog (document only, not implemented for 1.0):**
  - Combine `priorSuccess` + `priorPending` into a single `.in('status', ['success', 'pending'])` query (one fewer DB round-trip per login).
  - Add ~8s timeout wrapper on `sendTransaction` so a hung RPC does not hold Vercel function slots until platform timeout.
  - `failed_validation` rows for ineligible wallets can accumulate; rate limit bounds abuse; revisit DB hygiene post-rehearsal.
  - Comment the pending-insert retry loop (`1 initial + 3 retries = 4 total attempts`).

## Routes — fix post-Faucet, pre-broader cohort

These accept a **client-supplied address** while the server signs with a high-value key. Same vulnerability class as old `fundWallet`; different blast radius.

| Route | Issue |
|-------|-------|
| `/api/purchase/1155` | Client `userAddress` + `MINTER_PRIVATE_KEY` signs `buyFor(..., { value: priceWei })` — sponsor wallet pays ETH |
| `/api/mint-collectible` | Client `userAddress` + minter signs `mintDownload(userAddress, ...)` |
| `/api/mintDownload` | Client `userAddress` in request body |
| `/api/uploadAsset` (internal) | Client `userAddress` from FormData/body |
| `/api/public/purchase1155` | Public proxy forwards body unchanged to internal route |
| `/api/public/mintDownload` | Same proxy pattern |
| `/api/public/mintCollectible` | Same proxy pattern |
| `/api/public/uploadAsset` | Same proxy pattern |

**Fix direction:** Derive recipient from Magic session server-side (same posture as Faucet V2 / `/api/me/cash-balance`).

## UNVERIFIED infrastructure

### `check_and_reserve_gas_budget` Supabase RPC

- **Called from:** `app/api/mint-collectible/route.ts` (line ~72)
- **SQL in repo:** None — definition not version-controlled
- **Action:** Verify this RPC exists in live Supabase before relying on it for mint gas budgets
- **Faucet V2:** Does **not** depend on this RPC; daily cap uses a direct `SUM` on `wallet_funding`

## Post-rehearsal

- Split `MINTER_PRIVATE_KEY` into **mint-only** (gas) vs **download-payer** (ETH out via `buyFor`) to cap blast radius of `/api/purchase/1155`
- Automate `pending` → `success` / `failed_confirmation` reconciliation (cron or webhook)
